const db = require('../db');
const config = require('../config');
const netsuite = require('../services/netsuiteService');
const dataService = require('../services/orderDataService');
const orderSplitService = require('../services/orderSplitService');

// GET /api/orders/staff/:staffCode
async function getOrdersByStaff(req, res) {
  try {
    const { staffCode } = req.params;
    
    // Enhanced query with joins to get customer name and sales rep name
    const query = `
      SELECT 
        so.*,
        cus.Name as customerName,
        emp.Name as saleRepName
      FROM sid_v_so so
      LEFT JOIN erp_cus cus ON so.customerCode = cus.ID
      LEFT JOIN erp_emp emp ON so.staffCode = emp.ID
      WHERE so.staffCode = ? 
      ORDER BY so.salesOrderDate DESC 
      LIMIT 20
    `;
    
    const [orders] = await db.pool.query(query, [staffCode]);
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching staff orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
}

// GET /api/order/:id
async function getOrderDetails(req, res) {
  try {
    const orderId = req.params.id;
    const venioSONumber = await dataService.getVenioSONumber(orderId);
    const so = await netsuite.fetchSalesOrder(orderId);
    if (!so || so.type) {
      return res.status(404).json({ error: 'Sales order not found' });
    }
    const { customerName, shippingAddresses } = await dataService.getCustomerInfo(so.entity?.id);
    const items = await netsuite.fetchOrderItems(orderId);
    const conditions = await dataService.getConditions();
    const itemMap = await dataService.getItemMap();
    const locations = await dataService.getLocations();
    res.json({ so, items, venioSONumber, customerName, shippingAddresses, conditions, itemMap, locations });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
}

// POST /api/order/:id/respond
async function respondOrder(req, res) {
  try {
    const orderId = req.params.id;
    const { department, action, remark = '', respondedBy } = req.body;

    if (!department || !action) {
      return res.status(400).json({ success: false, message: 'Missing department or action' });
    }

    await db.pool.query(
      'INSERT INTO order_responses (netsuite_id, department, action, remark, responded_by) VALUES (?, ?, ?, ?, ?)',
      [orderId, department, action, remark, respondedBy || null]
    );

    const [wfRows] = await db.pool.query('SELECT updated_by, selected_departments FROM order_workflow WHERE netsuite_id = ? LIMIT 1', [orderId]);
    const updatedBy = wfRows.length > 0 ? wfRows[0].updated_by : null;
    const soUrl = `https://ppg24.tech/order/${orderId}`;

    if (action === 'revise' && updatedBy) {
      await netsuite.sendTelegramMessage(
        updatedBy,
        `🔄 มีการขอแก้ไขจาก ${department} สำหรับ SO ${orderId}\nหมายเหตุ: ${remark}\n🔗 ${soUrl}`
      );
    }

    if (wfRows.length > 0) {
      const departments = (wfRows[0].selected_departments || '').split(',').map(d => d.trim()).filter(Boolean);
      for (const dept of departments) {
        const [users] = await db.pool.query(
          'SELECT telegram_id FROM users WHERE department = ? AND registration_complete = 1',
          [dept]
        );
        for (const user of users) {
          if (user.telegram_id) {
            await netsuite.sendTelegramMessage(
              user.telegram_id,
              `ℹ️ สถานะล่าสุดของ SO ${orderId}: ${department} ${action === 'approve' ? 'ผ่าน' : 'ส่งแก้ไข'}\n🔗 ${soUrl}`
            );
          }
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error in respondOrder:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// POST /api/order/:id/update
async function updateOrder(req, res) {
  try {
    const orderId = req.params.id;
    const {
      memo,
      otherrefnum,
      tranDate,
      location_id,
      custbody_ar_req_inv_mac5,
      shipaddresslist,
      custbodyar_so_memo2,
      custbody_ar_all_memo,
      custbody_ar_so_statusbill,
      custbody_ar_estimate_contrat1,
      items,
      selectedDepartments = [],
      updatedBy
    } = req.body;

    const currentSO = await netsuite.fetchSalesOrder(orderId);
    const headerChanges = {};
    if (String(currentSO.memo || '').trim() !== String(memo || '').trim()) headerChanges.memo = memo;
    if (String(currentSO.otherRefNum || '').trim() !== String(otherrefnum || '').trim()) headerChanges.otherRefNum = otherrefnum;
    if (currentSO.tranDate?.substring(0, 10) !== tranDate) headerChanges.tranDate = tranDate;
    if (Number(currentSO.location?.id) !== Number(location_id)) headerChanges.location = { id: Number(location_id) };
    if (String(currentSO.custbody_ar_req_inv_mac5 || '').trim() !== String(custbody_ar_req_inv_mac5 || '').trim()) headerChanges.custbody_ar_req_inv_mac5 = custbody_ar_req_inv_mac5;
    if (String(currentSO.shipaddresslist || '').trim() !== String(shipaddresslist || '').trim()) headerChanges.shipaddresslist = shipaddresslist;
    if (String(currentSO.custbodyar_so_memo2 || '').trim() !== String(custbodyar_so_memo2 || '').trim()) headerChanges.custbodyar_so_memo2 = custbodyar_so_memo2;
    if (String(currentSO.custbody_ar_all_memo || '').trim() !== String(custbody_ar_all_memo || '').trim()) headerChanges.custbody_ar_all_memo = custbody_ar_all_memo;
    if (String(currentSO.custbody_ar_so_statusbill || '').trim() !== String(custbody_ar_so_statusbill || '').trim()) headerChanges.custbody_ar_so_statusbill = custbody_ar_so_statusbill;
    if (String(currentSO.custbody_ar_estimate_contrat1 || '').trim() !== String(custbody_ar_estimate_contrat1 || '').trim()) headerChanges.custbody_ar_estimate_contrat1 = custbody_ar_estimate_contrat1;

    const logs = [];
    if (Object.keys(headerChanges).length > 0) {
      const result = await netsuite.updateSalesOrder(orderId, headerChanges);
      if (result.success) {
        logs.push(`✅ Updated header: HTTP ${result.status}`);
      } else {
        logs.push(`❌ Failed to update header: ${result.message}`);
      }
    } else {
      logs.push('✅ No header changes detected');
    }

    const itemsUpdated = [];
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.href) continue;
        const authHeader = netsuite.buildOAuthHeader(
          item.href,
          'GET',
          config.consumer_key,
          config.consumer_secret,
          config.token,
          config.token_secret,
          config.realm
        );
        const response = await require('axios').get(item.href, { headers: { Authorization: authHeader } });
        const originalItem = response.data;
        const changes = {};
        if (Number(originalItem.item?.id) !== Number(item.item_id)) changes.item = { id: Number(item.item_id) };
        if (Number(originalItem.quantity) !== Number(item.quantity)) changes.quantity = Number(item.quantity);
        if (Number(originalItem.rate) !== Number(item.rate)) changes.rate = Number(item.rate);
        if (String(originalItem.description || '').trim() !== String(item.description || '').trim()) changes.description = item.description;
        if (Number(originalItem.inventorylocation?.id || 0) !== Number(item.location)) changes.inventorylocation = { id: Number(item.location) };
        if (Number(originalItem.custcol_ice_ld_discount) !== Number(item.custcol_ice_ld_discount)) changes.custcol_ice_ld_discount = Number(item.custcol_ice_ld_discount);
        if (String(originalItem.inpt_units_11 || '').trim() !== String(item.inpt_units_11 || '').trim()) changes.inpt_units_11 = item.inpt_units_11;
        if (Object.keys(changes).length > 0) {
          const result = await netsuite.updateOrderItem(item.href, changes);
          if (result.success) {
            logs.push(`✅ [Line ${i + 1}] Updated: HTTP ${result.status}`);
          } else {
            logs.push(`❌ [Line ${i + 1}] Failed: ${result.message}`);
          }
          itemsUpdated.push({ lineNum: i + 1, success: result.success });
        } else {
          logs.push(`✅ [Line ${i + 1}] No changes detected`);
        }
      }
    }

    if (Object.keys(headerChanges).length > 0 || itemsUpdated.length > 0) {
      try {
        const soUrl = `https://ppg24.tech/order/${orderId}`;
        const message = `✅ แก้ไข SaleOrder สมบูรณ์ ดำเนินการต่อได้\n🔗 ลิงก์: ${soUrl}`;
        const [coordUsers] = await db.pool.query(
          "SELECT telegram_id FROM users WHERE department = 'M180101 แผนกประสานงานขาย' AND registration_complete = 1"
        );
        if (coordUsers.length > 0) {
          let successCount = 0;
          for (const user of coordUsers) {
            if (user.telegram_id) {
              const result = await netsuite.sendTelegramMessage(user.telegram_id, message);
              if (result) successCount++;
            }
          }
          if (successCount > 0) logs.push(`✅ ส่งการแจ้งเตือนไปยังแผนกประสานงานขายแล้ว (${successCount} คน)`);
        }

        if (Array.isArray(selectedDepartments) && selectedDepartments.length > 0) {
          await db.pool.query(
            'INSERT INTO order_workflow (netsuite_id, updated_by, selected_departments) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE updated_by = VALUES(updated_by), selected_departments = VALUES(selected_departments)',
            [orderId, updatedBy || null, selectedDepartments.join(',')]
          );

          const baseUrl = 'https://ppg24.tech/response';
          for (const dept of selectedDepartments) {
            const [deptUsers] = await db.pool.query(
              'SELECT telegram_id FROM users WHERE department = ? AND registration_complete = 1',
              [dept]
            );
            const replyMarkup = {
              inline_keyboard: [
                [
                  { text: '✅ ผ่าน', url: `${baseUrl}/${orderId}?dept=${encodeURIComponent(dept)}&action=approve` }
                ],
                [
                  { text: '✏️ ส่งไปแก้ไข', url: `${baseUrl}/${orderId}?dept=${encodeURIComponent(dept)}&action=revise` }
                ]
              ]
            };
            let count = 0;
            for (const user of deptUsers) {
              if (user.telegram_id) {
                await netsuite.sendTelegramMessage(
                  user.telegram_id,
                  `🔔 มีการอัปเดต SalesOrder ${orderId}\n🔗 ${soUrl}`,
                  { replyMarkup }
                );
                count++;
              }
            }
            if (count > 0) logs.push(`✅ แจ้งเตือน ${dept} แล้ว (${count} คน)`);
          }
        }
      } catch (err) {
        console.error('Error notifying coordination department:', err);
        logs.push('❌ Error notifying coordination department');
      }
    }

    res.json({ success: true, logs, headerUpdated: Object.keys(headerChanges).length > 0, itemsUpdated });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
}

// GET /api/departments
async function getDepartments(req, res) {
  try {
    const [departments] = await db.pool.query('SELECT Name_no_hierarchy FROM erp_deep ORDER BY Name_no_hierarchy');
    res.json({ success: true, departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch departments' });
  }
}

// GET /api/orders/search
async function searchOrders(req, res) {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json({ results: [] });
  }
  const [rows] = await db.pool.query(
    `SELECT netsuite_id, salesOrderNo, customerCode FROM sid_v_so WHERE salesOrderNo LIKE ? OR customerCode LIKE ? OR netsuite_id = ? LIMIT 10`,
    [`%${q}%`, `%${q}%`, q]
  );
  res.json({ results: rows });
}

async function getOrderSplits(req, res) {
  try {
    const orderId = req.params.id;
    const splits = await orderSplitService.getSplitOrderHistory(orderId);
    
    res.json({
      success: true,
      splits
    });
  } catch (error) {
    console.error('Error fetching order splits:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch split history' 
    });
  }
}

// GET /api/order/:id/family - Get parent and all child orders
async function getOrderFamily(req, res) {
  try {
    const orderId = req.params.id;
    
    // Get split history
    const splits = await orderSplitService.getSplitOrderHistory(orderId);
    
    // Determine all related order IDs
    const relatedOrderIds = new Set();
    splits.forEach(split => {
      relatedOrderIds.add(split.parent_order_id);
      relatedOrderIds.add(split.child_order_id);
    });
    
    // Remove the current order ID and fetch details for related orders
    relatedOrderIds.delete(parseInt(orderId));
    const relatedOrders = [];
    
    for (const relatedId of relatedOrderIds) {
      try {
        const so = await netsuite.fetchSalesOrder(relatedId);
        const items = await netsuite.fetchOrderItems(relatedId);
        const venioSONumber = await dataService.getVenioSONumber(relatedId);
        
        relatedOrders.push({
          orderId: relatedId,
          so,
          items,
          venioSONumber
        });
      } catch (error) {
        console.error(`Error fetching related order ${relatedId}:`, error);
      }
    }
    
    res.json({
      success: true,
      splits,
      relatedOrders
    });
  } catch (error) {
    console.error('Error fetching order family:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch order family' 
    });
  }
}
async function splitOrder(req, res) {
  try {
    const orderId = req.params.id;
    const { splitItems, createdBy } = req.body;

    if (!splitItems || !Array.isArray(splitItems) || splitItems.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No items provided for split order' 
      });
    }

    // Validate split items
    for (const item of splitItems) {
      if (!item.item_id || !item.quantity || parseFloat(item.quantity) <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid item data in split request' 
        });
      }
    }

    const result = await orderSplitService.createSplitOrder(
      orderId, 
      splitItems, 
      createdBy
    );

    if (result.success) {
      // Log the split operation
      console.log(`Split order created: ${result.newOrderNumber} from parent ${orderId}`);
      
      res.json({
        success: true,
        message: result.message,
        newOrderId: result.newOrderId,
        newOrderNumber: result.newOrderNumber
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to create split order'
      });
    }
  } catch (error) {
    console.error('Error in splitOrder:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error while creating split order' 
    });
  }
}

async function getAllOrders(req, res) {
  try {
    const { staffCode, status, startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        so.*,
        cus.Name as customerName,
        emp.Name as saleRepName,
        emp.ID as staffId
      FROM sid_v_so so
      LEFT JOIN erp_cus cus ON so.customerCode = cus.ID
      LEFT JOIN erp_emp emp ON so.staffCode = emp.ID
      WHERE 1=1
    `;
    
    const params = [];
    
    // Add filters
    if (staffCode && staffCode !== 'all') {
      query += ' AND so.staffCode = ?';
      params.push(staffCode);
    }
    
    if (status && status !== 'all') {
      query += ' AND so.status = ?';
      params.push(status);
    }
    
    if (startDate) {
      query += ' AND DATE(so.salesOrderDate) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(so.salesOrderDate) <= ?';
      params.push(endDate);
    }
    
    query += ' ORDER BY so.salesOrderDate DESC LIMIT 100';
    
    const [orders] = await db.pool.query(query, params);
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
}

// GET /api/filters/staff - Get all staff for filter dropdown
async function getStaffList(req, res) {
  try {
    const query = `
      SELECT DISTINCT 
        emp.ID as staffCode,
        emp.Name as staffName
      FROM erp_emp emp
      INNER JOIN sid_v_so so ON emp.ID = so.staffCode
      ORDER BY emp.Name
    `;
    
    const [staff] = await db.pool.query(query);
    res.json({ success: true, staff });
  } catch (error) {
    console.error('Error fetching staff list:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch staff list' });
  }
}

// GET /api/filters/status - Get all statuses for filter dropdown
async function getStatusList(req, res) {
  try {
    const query = `
      SELECT DISTINCT status
      FROM sid_v_so
      WHERE status IS NOT NULL AND status != ''
      ORDER BY status
    `;
    
    const [statuses] = await db.pool.query(query);
    res.json({ success: true, statuses: statuses.map(s => s.status) });
  } catch (error) {
    console.error('Error fetching status list:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch status list' });
  }
}

module.exports = {
  getOrdersByStaff,
  getOrderDetails,
  updateOrder,
  respondOrder,
  getDepartments,
  searchOrders,
  splitOrder,           // New
  getOrderSplits,       // New
  getOrderFamily,
  getAllOrders,        // New
  getStaffList,        // New  
  getStatusList,
};
