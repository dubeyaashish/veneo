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

// Replace createSplitOrder function - using EXACT PHP webhook structure
async function createSplitOrder(req, res) {
  try {
    const { originalOrderId, items: splitItems, updatedBy } = req.body;

    console.log('Creating split order from original:', originalOrderId);
    console.log('Split items:', splitItems);

    if (!splitItems || splitItems.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No items provided for split order' 
      });
    }

    // Get the original order data
    const originalSO = await netsuite.fetchSalesOrder(originalOrderId);
    const originalItems = await netsuite.fetchOrderItems(originalOrderId);
    console.log('Original order fetched:', originalSO.id);

    const logs = [];

    // Filter valid split items
    const validSplitItems = splitItems.filter(item => {
      const qty = parseFloat(item.quantity);
      if (qty <= 0) {
        logs.push(`⚠️ Skipped item ${item.item_id} - quantity is ${qty}`);
        return false;
      }
      return true;
    });

    if (validSplitItems.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid items with quantity > 0 to split' 
      });
    }

    console.log(`Valid split items: ${validSplitItems.length} out of ${splitItems.length}`);

    // Step 1: Prepare NetSuite items in EXACT PHP format
    const netsuiteItems = validSplitItems.map(item => ({
      'item': { 'id': parseInt(item.item_id) },
      'quantity': parseFloat(item.quantity),
      'rate': parseFloat(item.rate),
      'description': item.description || '',
      'inventorylocation': { 'id': parseInt(item.location) || 18 },
      ...(item.custcol_ice_ld_discount && { 'custcol_ice_ld_discount': parseFloat(item.custcol_ice_ld_discount) }),
      ...(item.inpt_units_11 && { 'inpt_units_11': item.inpt_units_11 })
    }));

    // Step 2: Build NetSuite payload using EXACT PHP webhook structure
    console.log('Step 2: Creating child order using PHP webhook structure...');
    
    // Calculate totals (simplified - you might want to make this more sophisticated)
    const subtotal = validSplitItems.reduce((sum, item) => 
      sum + (parseFloat(item.quantity) * parseFloat(item.rate)), 0
    );
    
    const nsPayload = {
      // Core fields - EXACT format from PHP
      'entity': { 'id': originalSO.entity?.id || originalSO.entity },
      'tranDate': originalSO.tranDate ? originalSO.tranDate.substring(0, 10) : new Date().toISOString().substring(0, 10),
      
      // Department as integer (from PHP: 'department' => 23)
      'department': originalSO.department?.id || originalSO.department || 23,
      
      // Field names matching PHP exactly
      'otherrefnum': (originalSO.otherRefNum || '') + '-SPLIT',
      'salesrep': originalSO.salesRep?.id || originalSO.salesRep,
      'memo': (originalSO.memo || '') + ' - Split Order',
      
      // Custom fields - exact names from PHP
      'custbody_ar_req_inv_mac5': originalSO.custbody_ar_req_inv_mac5 || '',
      'custbody_po_shipmentby': '',
      
      // Ship date (from PHP: next day)
      'shipdate': originalSO.tranDate ? 
        new Date(new Date(originalSO.tranDate).getTime() + 24*60*60*1000).toISOString().substring(0, 10) :
        new Date(Date.now() + 24*60*60*1000).toISOString().substring(0, 10),
      
      // Discount fields (simplified for split order)
      'discountitem': -6,
      'discountrate': 0,
      'discounttotal': 0,
      'taxtotal': 0,
      'subtotal': subtotal,
      
      // CRITICAL: Items structure exactly like PHP
      'item': { 'items': netsuiteItems },
      
      // Location as object with id
      'location': { 'id': originalSO.location?.id || '18' },
      
      // Additional custom fields
      'custbody_ar_all_memo': (originalSO.custbody_ar_all_memo || '') + ' - Split Order',
      'custbodyar_so_memo2': `Split from SO ${originalOrderId}`,
      
      // Copy other custom fields if they exist
      ...(originalSO.custbody_ar_so_statusbill && { 'custbody_ar_so_statusbill': originalSO.custbody_ar_so_statusbill }),
      ...(originalSO.custbody_ar_estimate_contrat1 && { 'custbody_ar_estimate_contrat1': originalSO.custbody_ar_estimate_contrat1 }),
      ...(originalSO.shipaddresslist && { 'shipaddresslist': originalSO.shipaddresslist })
    };

    console.log('NetSuite payload (PHP style):', JSON.stringify(nsPayload, null, 2));

    // Step 3: Create the order in NetSuite using exact PHP method
    const createOrderUrl = `${config.base_url}/salesOrder`;
    const authHeader = netsuite.buildOAuthHeader(
      createOrderUrl,
      'POST',
      config.consumer_key,
      config.consumer_secret,
      config.token,
      config.token_secret,
      config.realm
    );

    const response = await require('axios').post(createOrderUrl, nsPayload, {
      headers: { 
        'Authorization': authHeader, 
        'Content-Type': 'application/json' 
      }
    });

    const newOrderId = response.data.id;
    console.log('Child order created with ID:', newOrderId);
    logs.push(`✅ Created child order: ${newOrderId} with ${validSplitItems.length} items`);

    // Step 4: Update parent order - reduce quantities or remove items
    console.log('Step 4: Updating parent order...');
    
    for (const splitItem of validSplitItems) {
      const originalItem = originalItems.find(item => 
        Number(item.item?.id) === Number(splitItem.item_id)
      );
      
      if (originalItem) {
        const originalQty = parseFloat(originalItem.quantity);
        const splitQty = parseFloat(splitItem.quantity);
        const newQuantity = originalQty - splitQty;
        
        console.log(`Item ${splitItem.item_id}: ${originalQty} - ${splitQty} = ${newQuantity}`);
        
        if (newQuantity > 0) {
          // Update quantity in parent order
          try {
            const updateData = { quantity: newQuantity };
            await netsuite.updateOrderItem(originalItem.href, updateData);
            logs.push(`✅ Updated parent item ${splitItem.item_id}: ${originalQty} -> ${newQuantity}`);
          } catch (updateError) {
            console.error('Error updating item:', updateError);
            logs.push(`❌ Failed to update parent item ${splitItem.item_id}: ${updateError.message}`);
          }
        } else {
          // Remove item from parent order (quantity is 0 or negative)
          try {
            const deleteAuthHeader = netsuite.buildOAuthHeader(
              originalItem.href,
              'DELETE',
              config.consumer_key,
              config.consumer_secret,
              config.token,
              config.token_secret,
              config.realm
            );
            
            await require('axios').delete(originalItem.href, {
              headers: { Authorization: deleteAuthHeader }
            });
            logs.push(`✅ Removed item ${splitItem.item_id} from parent (quantity = ${newQuantity})`);
          } catch (deleteError) {
            console.error('Error deleting item:', deleteError);
            logs.push(`❌ Failed to remove parent item ${splitItem.item_id}: ${deleteError.message}`);
          }
        }
      } else {
        logs.push(`⚠️ Item ${splitItem.item_id} not found in original order`);
      }
    }

    // Step 5: Record the split relationship in database
    try {
      await db.pool.query(
        'INSERT INTO order_splits (parent_order_id, child_order_id, split_reason, created_by) VALUES (?, ?, ?, ?)',
        [originalOrderId, newOrderId, 'Order split', updatedBy || null]
      );
      logs.push('✅ Split relationship recorded in database');
    } catch (dbError) {
      console.error('Database error:', dbError);
      logs.push('⚠️ Split created but failed to record in database: ' + dbError.message);
    }

    // Step 6: Send notifications (same as PHP webhook)
    try {
      const netsuiteLink = `${config.accounting_url}${newOrderId}`;
      const editLink = `https://ppg24.tech/order/${newOrderId}`;
      
      const message = `🆕 Split Order สร้างเรียบร้อย: Split Order\n` +
                     `📝 New SO ID: ${newOrderId}\n` +
                     `🔗 NetSuite: ${netsuiteLink}\n` +
                     `✏️ แก้ไข: ${editLink}\n` +
                     `📊 Original SO: ${originalOrderId}`;
      
      // Send to coordination department
      const [coordUsers] = await db.pool.query(
        "SELECT telegram_id FROM users WHERE department = 'M180101 แผนกประสานงานขาย' AND registration_complete = 1"
      );
      
      if (coordUsers.length > 0) {
        let successCount = 0;
        for (const user of coordUsers) {
          if (user.telegram_id) {
            try {
              const result = await netsuite.sendTelegramMessage(user.telegram_id, message);
              if (result) successCount++;
            } catch (telegramError) {
              console.error('Telegram notification error:', telegramError);
            }
          }
        }
        if (successCount > 0) {
          logs.push(`✅ Notified coordination department (${successCount} people)`);
        }
      }
    } catch (err) {
      console.error('Error sending notifications:', err);
      logs.push('❌ Error sending notifications: ' + err.message);
    }

    // Success response
    res.json({ 
      success: true, 
      newOrderId, 
      newOrderNumber: newOrderId,
      logs,
      message: `Split order ${newOrderId} created successfully with ${validSplitItems.length} items`
    });

  } catch (error) {
    console.error('Error creating split order:', error);
    console.error('Error stack:', error.stack);
    
    let errorMessage = 'Failed to create split order';
    let errorDetails = null;
    
    if (error.response) {
      errorMessage = error.response.data?.message || 'NetSuite API error';
      errorDetails = error.response.data;
      console.error('NetSuite API Error Response:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Unable to connect to NetSuite API';
    } else {
      errorMessage = error.message || errorMessage;
    }
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage,
      error: errorDetails,
      logs: [`❌ Error: ${errorMessage}`]
    });
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
  createSplitOrder,
};
