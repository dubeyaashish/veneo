// routes/orders.js (continued)
const express = require('express');
const router = express.Router();
const axios = require('axios');

// Import auth middleware from separate file
const { authenticateJWT } = require('../middleware/auth');

// Helper function for NetSuite OAuth header
function buildOAuthHeader(url, method, config) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = require('crypto').randomBytes(16).toString('hex');
  
  const oauthParams = {
    oauth_consumer_key: config.consumer_key,
    oauth_token: config.token,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: '1.0'
  };
  
  // Sort parameters
  const sortedParams = Object.keys(oauthParams).sort().reduce(
    (obj, key) => {
      obj[key] = oauthParams[key];
      return obj;
    }, {}
  );
  
  // Build base string
  const baseParams = [];
  for (const key in sortedParams) {
    baseParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(sortedParams[key])}`);
  }
  
  const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(baseParams.join('&'))}`;
  const signingKey = `${encodeURIComponent(config.consumer_secret)}&${encodeURIComponent(config.token_secret)}`;
  
  // Create signature
  const crypto = require('crypto');
  const signature = crypto.createHmac('sha256', signingKey).update(baseString).digest('base64');
  
  oauthParams.oauth_signature = signature;
  
  // Build header string
  let header = `OAuth realm="${config.realm}", `;
  for (const key in oauthParams) {
    header += `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}", `;
  }
  
  return header.slice(0, -2); // Remove trailing comma and space
}

// Get all orders
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Get search parameters
    const search = req.query.search || '';
    
    // Build query with search
    let query = `
      SELECT so.*, 
        COALESCE(COUNT(items.id), 0) as itemCount
      FROM v_so so
      LEFT JOIN v_so_item items ON so.salesOrderNo = items.salesOrderNo
    `;
    
    const queryParams = [];
    
    if (search) {
      query += `
        WHERE so.salesOrderNo LIKE ? 
        OR so.salesOrderSubject LIKE ?
        OR so.customerCode LIKE ?
      `;
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    query += `
      GROUP BY so.id
      ORDER BY so.salesOrderDate DESC
      LIMIT ? OFFSET ?
    `;
    
    queryParams.push(limit, offset);
    
    // Execute query
    const [orders] = await db.query(query, queryParams);
    
    // Get total count for pagination
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM v_so ${search ? 'WHERE salesOrderNo LIKE ? OR salesOrderSubject LIKE ? OR customerCode LIKE ?' : ''}`,
      search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []
    );
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      orders,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        limit
      }
    });
    
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Failed to get orders' });
  }
});

// Get order by ID
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const orderId = req.params.id;
    
    // Get order details
    const [orders] = await db.query('SELECT * FROM v_so WHERE id = ?', [orderId]);
    
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const order = orders[0];
    
    // Get order items
    const [items] = await db.query('SELECT * FROM v_so_item WHERE salesOrderNo = ?', [order.salesOrderNo]);
    
    res.json({
      success: true,
      order: {
        ...order,
        items
      }
    });
    
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, message: 'Failed to get order details' });
  }
});

// Update order in NetSuite
router.post('/:id/push-to-netsuite', authenticateJWT, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const orderId = req.params.id;
    
    // Get order details
    const [orders] = await db.query('SELECT * FROM v_so WHERE id = ?', [orderId]);
    
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const order = orders[0];
    
    // Get order items
    const [items] = await db.query('SELECT * FROM v_so_item WHERE salesOrderNo = ?', [order.salesOrderNo]);
    
    // Load NetSuite config
    const config = {
      consumer_key: process.env.NETSUITE_CONSUMER_KEY || "c1ff2a739418bf4bc940b461e13d9ce9f54312e55e37f0a6f1f7f8327dc3b5eb",
      consumer_secret: process.env.NETSUITE_CONSUMER_SECRET || "ac749d2bc5e9547a6af60caa3c8754a10c193dd35c1f5c26c47f9db370513d36",
      token: process.env.NETSUITE_TOKEN || "c635201371c288126c67700560ad45a7445f45590a3ff604c3fbc87c7855f4d6",
      token_secret: process.env.NETSUITE_TOKEN_SECRET || "dfdb35719ce8adb50c3607bb504a3e0f502aeb6b99f3dbd7fd8081baa4b988a0",
      realm: process.env.NETSUITE_REALM || "7446749_SB1",
      base_url: process.env.NETSUITE_BASE_URL || "https://7446749-sb1.suitetalk.api.netsuite.com/services/rest/record/v1",
      accounting_url: process.env.NETSUITE_ACCOUNTING_URL || "https://7446749-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id="
    };
    
    // Prepare items payload
    const itemsPayload = items.map(item => ({
      item: { id: item.productCode },
      quantity: item.quantity,
      rate: item.price,
      description: item.description,
      inventorylocation: { id: 18 }, // Default location, should be configurable
      custcol_pp_estimate_pricetype: { id: "1" },
      custcol_ar_so_custprice: item.price
    }));
    
    // Prepare order payload
    const payload = {
      entity: { id: order.customerId },
      tranDate: order.salesOrderDate,
      department: 23, // Should be configurable
      otherrefnum: order.salesOrderNo,
      salesrep: 1035, // Should be configurable
      memo: order.salesOrderSubject,
      custbody_ar_req_inv_mac5: `Venio. ${order.salesOrderNo}`,
      custbody_po_shipmentby: "",
      shipaddresslist: 17359, // Should be configurable
      shipdate: new Date().toISOString().split('T')[0], // Today
      discountitem: -6, // Should be configurable
      discountrate: -order.discountValue || 0,
      item: {
        items: itemsPayload
      },
      discounttotal: order.discountValue || 0,
      taxtotal: order.totalVat || 0,
      subtotal: order.subTotal || 0,
      location: { id: "18" }, // Default location, should be configurable
      custbody_ar_all_memo: `*** NetSuite API Integration - ${order.remark || ''}`,
      custbodyar_so_memo2: `*** NetSuite API Integration - ${order.remark || ''}`
    };
    
    // Build URL and headers
    const url = `${config.base_url}/salesOrder`;
    const authHeader = buildOAuthHeader(url, 'POST', config);
    
    // Send request to NetSuite
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    });
    
    // Extract order ID from location header
    const locationHeader = response.headers.location;
    let netsuiteOrderId = null;
    
    if (locationHeader) {
      const parts = locationHeader.split('/');
      netsuiteOrderId = parts[parts.length - 1];
      
      // Update order status in database
      await db.query('UPDATE v_so SET status = ?, netsuite_id = ? WHERE id = ?', ['yes', netsuiteOrderId, orderId]);
    }
    
    res.json({
      success: true,
      message: 'Order pushed to NetSuite successfully',
      netsuiteOrderId,
      netsuiteUrl: netsuiteOrderId ? `${config.accounting_url}${netsuiteOrderId}` : null
    });
    
  } catch (error) {
    console.error('Push to NetSuite error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to push order to NetSuite',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Edit order in NetSuite
router.put('/:id/edit-netsuite', authenticateJWT, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const orderId = req.params.id;
    const { netsuiteId, changes } = req.body;
    
    if (!netsuiteId) {
      return res.status(400).json({ success: false, message: 'NetSuite ID is required' });
    }
    
    // Load NetSuite config
    const config = {
      consumer_key: process.env.NETSUITE_CONSUMER_KEY || "c1ff2a739418bf4bc940b461e13d9ce9f54312e55e37f0a6f1f7f8327dc3b5eb",
      consumer_secret: process.env.NETSUITE_CONSUMER_SECRET || "ac749d2bc5e9547a6af60caa3c8754a10c193dd35c1f5c26c47f9db370513d36",
      token: process.env.NETSUITE_TOKEN || "c635201371c288126c67700560ad45a7445f45590a3ff604c3fbc87c7855f4d6",
      token_secret: process.env.NETSUITE_TOKEN_SECRET || "dfdb35719ce8adb50c3607bb504a3e0f502aeb6b99f3dbd7fd8081baa4b988a0",
      realm: process.env.NETSUITE_REALM || "7446749_SB1",
      base_url: process.env.NETSUITE_BASE_URL || "https://7446749-sb1.suitetalk.api.netsuite.com/services/rest/record/v1"
    };
    
    // Build URL and headers for header update
    const orderUrl = `${config.base_url}/salesOrder/${netsuiteId}`;
    const authHeader = buildOAuthHeader(orderUrl, 'PATCH', config);
    
    // Update header fields
    if (changes.header && Object.keys(changes.header).length > 0) {
      const headerResponse = await axios.patch(orderUrl, changes.header, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        }
      });
      
      if (headerResponse.status !== 204) {
        return res.status(400).json({ 
          success: false, 
          message: 'Failed to update order header in NetSuite'
        });
      }
    }
    
    // Update line items
    let itemUpdateResults = [];
    
    if (changes.items && changes.items.length > 0) {
      for (const item of changes.items) {
        if (!item.href) continue;
        
        const itemAuthHeader = buildOAuthHeader(item.href, 'PATCH', config);
        
        try {
          const itemResponse = await axios.patch(item.href, item.changes, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': itemAuthHeader
            }
          });
          
          itemUpdateResults.push({
            success: itemResponse.status === 204,
            item: item.id
          });
        } catch (error) {
          itemUpdateResults.push({
            success: false,
            item: item.id,
            error: error.message
          });
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Order updated in NetSuite',
      headerUpdated: changes.header && Object.keys(changes.header).length > 0,
      itemsUpdated: itemUpdateResults
    });
    
  } catch (error) {
    console.error('Edit NetSuite order error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update order in NetSuite',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update order in database
router.put('/:id', authenticateJWT, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const orderId = req.params.id;
    const { order } = req.body;
    
    if (!order) {
      return res.status(400).json({ success: false, message: 'Order data is required' });
    }
    
    // Get existing order
    const [existingOrders] = await db.query('SELECT * FROM v_so WHERE id = ?', [orderId]);
    
    if (existingOrders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Update order in database
    await db.query(`
      UPDATE v_so SET
        salesOrderSubject = ?,
        discountValue = ?,
        discountType = ?,
        paymentTerm = ?,
        remark = ?,
        staffCode = ?,
        currencyCode = ?,
        vatCalculation = ?,
        subTotal = ?,
        subTotalWithDiscount = ?,
        totalVat = ?,
        grandTotal = ?
      WHERE id = ?
    `, [
      order.salesOrderSubject,
      order.discountValue,
      order.discountType,
      order.paymentTerm,
      order.remark,
      order.staffCode,
      order.currencyCode,
      order.vatCalculation,
      order.subTotal,
      order.subTotalWithDiscount,
      order.totalVat,
      order.grandTotal,
      orderId
    ]);
    
    // Update items if provided
    if (order.items && order.items.length > 0) {
      // First, delete existing items
      await db.query('DELETE FROM v_so_item WHERE salesOrderNo = ?', [existingOrders[0].salesOrderNo]);
      
      // Then, insert new items
      const itemStatement = await db.prepare(`
        INSERT INTO v_so_item (
          salesOrderNo, productCode, productName, price, quantity, unitName, description, discount, totalPrice
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const item of order.items) {
        await itemStatement.execute([
          existingOrders[0].salesOrderNo,
          item.productCode,
          item.productName,
          item.price,
          item.quantity,
          item.unitName,
          item.description,
          item.discount,
          item.totalPrice
        ]);
      }
    }
    
    res.json({
      success: true,
      message: 'Order updated successfully'
    });
    
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete order
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const orderId = req.params.id;
    
    // Get existing order
    const [existingOrders] = await db.query('SELECT * FROM v_so WHERE id = ?', [orderId]);
    
    if (existingOrders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Delete order items first (foreign key constraint)
    await db.query('DELETE FROM v_so_item WHERE salesOrderNo = ?', [existingOrders[0].salesOrderNo]);
    
    // Delete order
    await db.query('DELETE FROM v_so WHERE id = ?', [orderId]);
    
    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/stats', authenticateJWT, async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Get total orders count
    const [totalResult] = await db.query('SELECT COUNT(*) as total FROM v_so');
    const totalOrders = totalResult[0].total;
    
    // Get pending orders count
    const [pendingResult] = await db.query('SELECT COUNT(*) as total FROM v_so WHERE status = ?', ['no']);
    const pendingOrders = pendingResult[0].total;
    
    // Get completed orders count
    const [completedResult] = await db.query('SELECT COUNT(*) as total FROM v_so WHERE status = ?', ['yes']);
    const completedOrders = completedResult[0].total;
    
    // Get total revenue
    const [revenueResult] = await db.query('SELECT SUM(grandTotal) as total FROM v_so');
    const revenue = revenueResult[0].total || 0;
    
    res.json({
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        completedOrders,
        revenue
      }
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get order statistics' });
  }
});

module.exports = router;