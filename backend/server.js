// server.js - Main server file
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const axios = require('axios');
const bodyParser = require('body-parser');
const config = require('./config');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const otpService = require('./otpService');
const emailService = require('./emailService');
const path = require('path'); 
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database connection
const getDbConnection = async () => {
  return mysql.createConnection(config.db);
};



// Authentication endpoint
app.post('/api/auth/telegram', async (req, res) => {
  try {
    const telegramUser = req.body;
    
    // Verify Telegram data (uncomment in production)
    // const isValid = verifyTelegramData(telegramUser, config.telegram.bot_token);
    // if (!isValid) {
    //   return res.status(400).json({ success: false, message: 'Invalid Telegram data' });
    // }
    
    if (!telegramUser.id || !telegramUser.first_name) {
      return res.status(400).json({ success: false, message: 'Invalid Telegram data' });
    }
    
    const conn = await getDbConnection();
    
    // Check if user exists
    const [userRows] = await conn.execute(
      'SELECT * FROM users WHERE telegram_id = ?',
      [telegramUser.id]
    );
    
    let user;
    let isNewUser = false;
    
    if (userRows.length === 0) {
      // New user - create account
      const [result] = await conn.execute(
        'INSERT INTO users (telegram_id, first_name, last_name, username, photo_url, auth_date, registration_complete) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          telegramUser.id,
          telegramUser.first_name,
          telegramUser.last_name || '',
          telegramUser.username || '',
          telegramUser.photo_url || '',
          telegramUser.auth_date || Math.floor(Date.now() / 1000),
          false  // Registration incomplete for new users
        ]
      );
      
      const [newUser] = await conn.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
      user = newUser[0];
      isNewUser = true;
    } else {
      // Existing user - update info
      user = userRows[0];
      
      await conn.execute(
        'UPDATE users SET first_name = ?, last_name = ?, username = ?, photo_url = ?, auth_date = ? WHERE telegram_id = ?',
        [
          telegramUser.first_name,
          telegramUser.last_name || '',
          telegramUser.username || '',
          telegramUser.photo_url || '',
          telegramUser.auth_date || Math.floor(Date.now() / 1000),
          telegramUser.id
        ]
      );
    }
    
    // Check if user has a staffCode mapping
    const [staffRows] = await conn.execute(
      'SELECT * FROM staff_telegram_mapping WHERE telegram_id = ?',
      [telegramUser.id]
    );
    
    const userResponse = {
      id: user.id,
      telegram_id: user.telegram_id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      photo_url: user.photo_url,
      email: user.email,
      employee_id: user.employee_id,
      staff_code: staffRows.length > 0 ? staffRows[0].staff_code : null,
      registration_complete: isNewUser ? false : (user.registration_complete === 1)
    };
    
    await conn.end();
    
    res.json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    console.error('Error in Telegram authentication:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
});

// Complete registration endpoint
// Modify the existing complete-registration endpoint in server.js
app.post('/api/auth/complete-registration', async (req, res) => {
  try {
    const userData = req.body;
    
    if (!userData.telegram_id) {
      return res.status(400).json({ success: false, message: 'Invalid user data' });
    }
    
    if (!userData.email || !userData.employee_id || !userData.department) {
      return res.status(400).json({ success: false, message: 'Email, Employee ID, and Department are required' });
    }
    
    // Validate email format
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(userData.email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    
    const conn = await getDbConnection();
    
    // Check if user exists
    const [userRows] = await conn.execute(
      'SELECT * FROM users WHERE telegram_id = ?',
      [userData.telegram_id]
    );
    
    if (userRows.length === 0) {
      await conn.end();
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Update user with email, employee ID, department, and mark registration as complete
    await conn.execute(
      'UPDATE users SET email = ?, employee_id = ?, department = ?, registration_complete = TRUE WHERE telegram_id = ?',
      [userData.email, userData.employee_id, userData.department, userData.telegram_id]
    );
    
    // Check if we can map this employee ID to a staff code
    try {
      // Create or update the staff_telegram_mapping table
      const [mappingRows] = await conn.execute(
        'SELECT * FROM staff_telegram_mapping WHERE telegram_id = ?',
        [userData.telegram_id]
      );
      
      if (mappingRows.length === 0) {
        // Create a new mapping
        await conn.execute(
          'INSERT INTO staff_telegram_mapping (telegram_id, staff_code) VALUES (?, ?)',
          [userData.telegram_id, userData.employee_id]
        );
      } else {
        // Update existing mapping
        await conn.execute(
          'UPDATE staff_telegram_mapping SET staff_code = ? WHERE telegram_id = ?',
          [userData.employee_id, userData.telegram_id]
        );
      }
    } catch (error) {
      console.error('Error creating staff mapping:', error);
      // Continue even if mapping fails - we have the essential registration data
    }
    
    // Get the updated user data
    const [updatedRows] = await conn.execute(
      'SELECT u.*, stm.staff_code FROM users u LEFT JOIN staff_telegram_mapping stm ON u.telegram_id = stm.telegram_id WHERE u.telegram_id = ?',
      [userData.telegram_id]
    );
    
    await conn.end();
    
    if (updatedRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found after update' });
    }
    
    const user = updatedRows[0];
    
    const userResponse = {
      id: user.id,
      telegram_id: user.telegram_id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      photo_url: user.photo_url,
      email: user.email,
      employee_id: user.employee_id,
      department: user.department,
      staff_code: user.staff_code,
      registration_complete: user.registration_complete === 1
    };
    
    res.json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    console.error('Error in registration:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});
// Get orders associated with a staff member
app.get('/api/orders/staff/:staffCode', async (req, res) => {
  try {
    const { staffCode } = req.params;
    
    const conn = await getDbConnection();
    
    // Get orders for this staff code
    const [orders] = await conn.execute(
      'SELECT * FROM sid_v_so WHERE staffCode = ? ORDER BY salesOrderDate DESC LIMIT 20',
      [staffCode]
    );
    
    await conn.end();
    
    res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Error fetching staff orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
});

// Get order details
app.get('/api/order/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // Fetch Venio SO number
    const venioSONumber = await getVenioSONumber(orderId);
    
    // Fetch sales order from NetSuite
    const so = await fetchSalesOrder(orderId);
    
    if (!so || so.type) {
      return res.status(404).json({ error: 'Sales order not found' });
    }
    
    // Fetch customer info
    const { customerName, shippingAddresses } = await getCustomerInfo(so.entity?.id);
    
    // Fetch order items
    const items = await fetchOrderItems(orderId);
    
    // Fetch database info
    const conn = await getDbConnection();
    const conditions = await getConditions(conn);
    const itemMap = await getItemMap(conn);
    const locations = await getLocations(conn);
    await conn.end();
    
    // Return complete order details
    res.json({
      so,
      items,
      venioSONumber,
      customerName,
      shippingAddresses,
      conditions,
      itemMap,
      locations
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Update order
// In server.js - Modify the existing POST route for updating orders

// Replace your entire update order route with this corrected version
// Make sure the sendTelegramMessage function is OUTSIDE of this route handler

// Update order
app.post('/api/order/:id/update', async (req, res) => {
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
      items 
    } = req.body;
    
    // Fetch current SO state from NetSuite
    const currentSO = await fetchSalesOrder(orderId);
    
    // Determine header changes
    const headerChanges = {};
    
    if (String(currentSO.memo || '').trim() !== String(memo || '').trim()) {
      headerChanges.memo = memo;
    }
    
    if (String(currentSO.otherRefNum || '').trim() !== String(otherrefnum || '').trim()) {
      headerChanges.otherRefNum = otherrefnum;
    }
    
    if (currentSO.tranDate?.substring(0, 10) !== tranDate) {
      headerChanges.tranDate = tranDate;
    }
    
    if (Number(currentSO.location?.id) !== Number(location_id)) {
      headerChanges.location = { id: Number(location_id) };
    }
    
    if (String(currentSO.custbody_ar_req_inv_mac5 || '').trim() !== String(custbody_ar_req_inv_mac5 || '').trim()) {
      headerChanges.custbody_ar_req_inv_mac5 = custbody_ar_req_inv_mac5;
    }
    
    if (String(currentSO.shipaddresslist || '').trim() !== String(shipaddresslist || '').trim()) {
      headerChanges.shipaddresslist = shipaddresslist;
    }
    
    if (String(currentSO.custbodyar_so_memo2 || '').trim() !== String(custbodyar_so_memo2 || '').trim()) {
      headerChanges.custbodyar_so_memo2 = custbodyar_so_memo2;
    }
    if (String(currentSO.custbody_ar_all_memo || '').trim() !== String(custbody_ar_all_memo || '').trim()) {
      headerChanges.custbody_ar_all_memo = custbody_ar_all_memo;
    }
    if (String(currentSO.custbody_ar_so_statusbill || '').trim() !== String(custbody_ar_so_statusbill || '').trim()) {
       headerChanges.custbody_ar_so_statusbill = custbody_ar_so_statusbill;
    }
    if (String(currentSO.custbody_ar_estimate_contrat1 || '').trim() !== String(custbody_ar_estimate_contrat1 || '').trim()) {
        headerChanges.custbody_ar_estimate_contrat1 = custbody_ar_estimate_contrat1;
    }

    
    const logs = [];
    
    // Update header if there are changes
    if (Object.keys(headerChanges).length > 0) {
      const result = await updateSalesOrder(orderId, headerChanges);
      if (result.success) {
        logs.push(`✅ Updated header: HTTP ${result.status}`);
      } else {
        logs.push(`❌ Failed to update header: ${result.message}`);
      }
    } else {
      logs.push('✅ No header changes detected');
    }
    
    // Update items
    const itemsUpdated = [];
    
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.href) continue;
        
        // Fetch current item state
        const authHeader = buildOAuthHeader(
          item.href, 
          'GET', 
          config.consumer_key, 
          config.consumer_secret, 
          config.token, 
          config.token_secret, 
          config.realm
        );
        
        const response = await axios.get(item.href, {
          headers: {
            'Authorization': authHeader
          }
        });
        
        const originalItem = response.data;
        
        // Determine item changes
        const changes = {};
        
        if (Number(originalItem.item?.id) !== Number(item.item_id)) {
          changes.item = { id: Number(item.item_id) };
        }
        
        if (Number(originalItem.quantity) !== Number(item.quantity)) {
          changes.quantity = Number(item.quantity);
        }
        
        if (Number(originalItem.rate) !== Number(item.rate)) {
          changes.rate = Number(item.rate);
        }
        
        if (String(originalItem.description || '').trim() !== String(item.description || '').trim()) {
          changes.description = item.description;
        }
        
        if (Number(originalItem.inventorylocation?.id || 0) !== Number(item.location)) {
          changes.inventorylocation = { id: Number(item.location) };
        }
        if (Number(originalItem.custcol_ice_ld_discount) !== Number(item.custcol_ice_ld_discount)) {
        changes.custcol_ice_ld_discount = Number(item.custcol_ice_ld_discount);
        }
        if (String(originalItem.inpt_units_11 || '').trim() !== String(item.inpt_units_11 || '').trim()) {
        changes.inpt_units_11 = item.inpt_units_11;
        }

        
        // Update item if there are changes
        if (Object.keys(changes).length > 0) {
          const result = await updateOrderItem(item.href, changes);
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
    
    // Check if order has been modified and send notifications
    if (Object.keys(headerChanges).length > 0 || itemsUpdated.length > 0) {
      try {
        // Get the order details
        const conn = await getDbConnection();
        // Always send notification, don't require DB query
        const soNo = orderId;  // Or use a string like "Sales Order #" + orderId
        const soUrl = `${config.accounting_url}${orderId}`;
        const soSubject = ""; // or "Sales Order updated" (if you want)

        // Notify coordination department users
        try {
          const [coordUsers] = await conn.execute(
            "SELECT telegram_id FROM users WHERE department = 'M180101 แผนกประสานงานขาย' AND registration_complete = 1"
          );

          if (coordUsers.length > 0) {
            const coordMessage =
              `✅ แก้ไข SaleOrder สมบูรณ์ ดำเนินการต่อได้\n` +
              `📄 เลขที่ SO: ${soNo}\n` +
              (soSubject ? `📋 รายละเอียด: ${soSubject}\n` : "") +
              `🔗 ลิงก์: ${soUrl}`;

            let successCount = 0;
            for (const user of coordUsers) {
              if (user.telegram_id) {
                const coordResult = await sendTelegramMessage(user.telegram_id, coordMessage);
                if (coordResult) successCount++;
              }
            }

            if (successCount > 0) {
              logs.push(`✅ ส่งการแจ้งเตือนไปยังแผนกประสานงานขายแล้ว (${successCount} คน)`);
            }
          }
        } catch (err) {
          console.error("Error notifying coordination department:", err);
          logs.push('❌ Error notifying coordination department');
        }

        await conn.end();
      } catch (error) {
        console.error('Error sending notifications:', error);
        logs.push('❌ เกิดข้อผิดพลาดในการส่งการแจ้งเตือน');
      }
    }
    
    res.json({
      success: true,
      logs,
      headerUpdated: Object.keys(headerChanges).length > 0,
      itemsUpdated
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});


// Add this function OUTSIDE of all route handlers, at the top-level scope
// Place this with other helper functions in your server.js file

// Add helper function to send Telegram messages
async function sendTelegramMessage(chatId, message) {
  const botToken = config.telegram.bot_token;
  const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  try {
    console.log(`Debug - Sending Telegram message to chat ID: ${chatId}`);
    console.log(`Debug - Message content: ${message}`);
    console.log(`Debug - Using bot token: ${botToken.substring(0, 10)}...`);
    
    const response = await axios.post(telegramApiUrl, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    
    console.log(`Debug - Telegram API response:`, response.status, response.data);
    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error.message);
    if (error.response) {
      console.error('Telegram API error details:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    return false;
  }
}

// Helper Functions
async function getVenioSONumber(netsuiteId) {
  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      'SELECT salesOrderNo FROM sid_v_so WHERE netsuite_id = ? LIMIT 1',
      [netsuiteId]
    );
    await conn.end();
    
    return rows.length > 0 ? rows[0].salesOrderNo : null;
  } catch (error) {
    console.error('Error fetching Venio SO:', error);
    return null;
  }
}

async function getCustomerInfo(customerId) {
  try {
    const conn = await getDbConnection();
    
    // Get customer name
    const [nameRows] = await conn.execute(
      'SELECT DISTINCT name FROM erp_shipto WHERE internal_id = ?',
      [customerId]
    );
    
    // Get shipping addresses
    const [addressRows] = await conn.execute(
      'SELECT address_internal_id, shipping_address FROM erp_shipto WHERE internal_id = ?',
      [customerId]
    );
    
    await conn.end();
    
    return {
      customerName: nameRows.length > 0 ? nameRows[0].name : '',
      shippingAddresses: addressRows
    };
  } catch (error) {
    console.error('Error fetching customer info:', error);
    return { customerName: '', shippingAddresses: [] };
  }
}

async function getConditions(conn) {
  try {
    const [rows] = await conn.execute('SELECT * FROM billing_conditions ORDER BY condition_group, id');
    
    // Group by condition_group
    const conditions = {};
    for (const row of rows) {
      if (!conditions[row.condition_group]) {
        conditions[row.condition_group] = [];
      }
      conditions[row.condition_group].push(row);
    }
    
    return conditions;
  } catch (error) {
    console.error('Error fetching conditions:', error);
    return {};
  }
}

async function getItemMap(conn) {
  try {
    const [rows] = await conn.execute('SELECT Internal_ID, Item FROM erp_price');
    
    const itemMap = {};
    for (const row of rows) {
      itemMap[row.Internal_ID] = row.Item;
    }
    
    return itemMap;
  } catch (error) {
    console.error('Error fetching item map:', error);
    return {};
  }
}

async function getLocations(conn) {
  try {
    const [rows] = await conn.execute('SELECT Internal_ID, Name FROM erp_location');
    
    const locations = {};
    for (const row of rows) {
      locations[row.Internal_ID] = row.Name;
    }
    
    return locations;
  } catch (error) {
    console.error('Error fetching locations:', error);
    return {};
  }
}

// OAuth header builder (similar to build_oauth_header in PHP)
const buildOAuthHeader = (url, method, consumer_key, consumer_secret, token, token_secret, realm) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  
  const oauthParams = {
    oauth_consumer_key: consumer_key,
    oauth_token: token,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: '1.0'
  };
  
  // Sort params
  const sortedParams = Object.keys(oauthParams).sort().reduce((acc, key) => {
    acc[key] = oauthParams[key];
    return acc;
  }, {});
  
  // Create base string params
  const baseParams = [];
  for (const [key, value] of Object.entries(sortedParams)) {
    baseParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  
  // Create base string
  const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(baseParams.join('&'))}`;
  
  // Create signing key
  const signingKey = `${encodeURIComponent(consumer_secret)}&${encodeURIComponent(token_secret)}`;
  
  // Create signature
  const signature = crypto.createHmac('sha256', signingKey).update(baseString).digest('base64');
  oauthParams.oauth_signature = signature;
  
  // Create header
  let header = `OAuth realm="${realm}", `;
  for (const [key, value] of Object.entries(oauthParams)) {
    header += `${encodeURIComponent(key)}="${encodeURIComponent(value)}", `;
  }
  
  return header.slice(0, -2); // Remove trailing comma and space
};

// Fetch order from NetSuite
async function fetchSalesOrder(orderId) {
  const soUrl = `${config.base_url}/salesOrder/${orderId}`;
  const authHeader = buildOAuthHeader(
    soUrl, 
    'GET', 
    config.consumer_key, 
    config.consumer_secret, 
    config.token, 
    config.token_secret, 
    config.realm
  );
  
  try {
    const response = await axios.get(soUrl, {
      headers: {
        'Authorization': authHeader
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching sales order:', error);
    throw error;
  }
}

// Fetch order items from NetSuite
async function fetchOrderItems(orderId) {
  const itemUrl = `${config.base_url}/salesOrder/${orderId}/item`;
  const authHeader = buildOAuthHeader(
    itemUrl, 
    'GET', 
    config.consumer_key, 
    config.consumer_secret, 
    config.token, 
    config.token_secret, 
    config.realm
  );
  
  try {
    const response = await axios.get(itemUrl, {
      headers: {
        'Authorization': authHeader
      }
    });
    
    const items = [];
    
    // Fetch each line item
    for (const entry of response.data.items || []) {
      const href = entry.links[0]?.href;
      if (href) {
        const lineAuthHeader = buildOAuthHeader(
          href, 
          'GET', 
          config.consumer_key, 
          config.consumer_secret, 
          config.token, 
          config.token_secret, 
          config.realm
        );
        
        const lineResponse = await axios.get(href, {
          headers: {
            'Authorization': lineAuthHeader
          }
        });
        
        const item = lineResponse.data;
        if (item) {
          item.href = href;
          items.push(item);
        }
      }
    }
    
    return items;
  } catch (error) {
    console.error('Error fetching order items:', error);
    throw error;
  }
}

// Update sales order in NetSuite
async function updateSalesOrder(orderId, headerChanges) {
  const orderUrl = `${config.base_url}/salesOrder/${orderId}`;
  const authHeader = buildOAuthHeader(
    orderUrl, 
    'PATCH', 
    config.consumer_key, 
    config.consumer_secret, 
    config.token, 
    config.token_secret, 
    config.realm
  );
  
  try {
    const response = await axios.patch(orderUrl, headerChanges, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    console.error('Error updating sales order:', error);
    return {
      success: false,
      status: error.response?.status || 500,
      message: error.message
    };
  }
}

// Update sales order item in NetSuite
async function updateOrderItem(itemHref, changes) {
  const authHeader = buildOAuthHeader(
    itemHref, 
    'PATCH', 
    config.consumer_key, 
    config.consumer_secret, 
    config.token, 
    config.token_secret, 
    config.realm
  );
  
  try {
    const response = await axios.patch(itemHref, changes, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    console.error('Error updating order item:', error);
    return {
      success: false,
      status: error.response?.status || 500,
      message: error.message
    };
  }
}

// Send notification via Telegram
async function sendTelegramNotification(chatId, message) {
  try {
    const telegramData = {
      chat_id: chatId,
      message: message
    };
    
    await axios.post(config.telegram.notification_url, telegramData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return false;
  }
}
// In server.js - Add this route

// Get departments for dropdown
app.get('/api/departments', async (req, res) => {
  try {
    const conn = await getDbConnection();
    
    // Get departments from erp_deep table
    const [departments] = await conn.execute(
      'SELECT Name_no_hierarchy FROM erp_deep ORDER BY Name_no_hierarchy'
    );
    
    await conn.end();
    
    res.json({
      success: true,
      departments
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments'
    });
  }
});


app.get('/api/orders/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json({ results: [] });
  }
  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT netsuite_id, salesOrderNo, customerCode
     FROM sid_v_so
     WHERE salesOrderNo LIKE ? OR customerCode LIKE ? OR netsuite_id = ? 
     LIMIT 10`,
    [`%${q}%`, `%${q}%`, q]
  );
  await conn.end();
  res.json({ results: rows });
});


// Send OTP endpoint
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { telegram_id, email, employee_id, department } = req.body;
    
    if (!telegram_id || !email || !employee_id || !department) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required information' 
      });
    }
    
    // Validate email format
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }
    
    // Check if user exists
    const conn = await getDbConnection();
    const [userRows] = await conn.execute(
      'SELECT * FROM users WHERE telegram_id = ?',
      [telegram_id]
    );
    
    if (userRows.length === 0) {
      await conn.end();
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Generate OTP
    const otp = otpService.generateOTP();
    
    // Store OTP
    otpService.storeOTP(telegram_id, email, otp);
    
    // Send OTP via email
    const emailSent = await emailService.sendOTPEmail(email, otp);
    
    await conn.end();
    
    if (emailSent) {
      res.json({
        success: true,
        message: 'OTP sent successfully',
        email: email.replace(/(.{2})(.*)(@.*)/, '$1****$3') // Mask email for privacy
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Verify OTP endpoint should also use otpService.verifyOTP method
// Update your verify-otp and resend-otp endpoints similarly

// Verify OTP endpoint
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { telegram_id, otp, email, employee_id, department } = req.body;
    
    if (!telegram_id || !otp || !email || !employee_id || !department) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required information' 
      });
    }
    
    // Verify OTP
    const verification = otpService.verifyOTP(telegram_id, otp);
    
    if (!verification.valid) {
      return res.status(400).json({ 
        success: false, 
        message: verification.message 
      });
    }
    
    // Verify email matches
    if (verification.email !== email) {
      return res.status(400).json({
        success: false,
        message: 'Email mismatch. Please request a new OTP.'
      });
    }
    
    // OTP is valid, proceed with registration
    const conn = await getDbConnection();
    
    // Update user with email, employee ID, department, and mark registration as complete
    await conn.execute(
      'UPDATE users SET email = ?, employee_id = ?, department = ?, registration_complete = TRUE WHERE telegram_id = ?',
      [email, employee_id, department, telegram_id]
    );
    
    // Check if we can map this employee ID to a staff code
    try {
      // Create or update the staff_telegram_mapping table
      const [mappingRows] = await conn.execute(
        'SELECT * FROM staff_telegram_mapping WHERE telegram_id = ?',
        [telegram_id]
      );
      
      if (mappingRows.length === 0) {
        // Create a new mapping
        await conn.execute(
          'INSERT INTO staff_telegram_mapping (telegram_id, staff_code) VALUES (?, ?)',
          [telegram_id, employee_id]
        );
      } else {
        // Update existing mapping
        await conn.execute(
          'UPDATE staff_telegram_mapping SET staff_code = ? WHERE telegram_id = ?',
          [employee_id, telegram_id]
        );
      }
    } catch (error) {
      console.error('Error creating staff mapping:', error);
      // Continue even if mapping fails - we have the essential registration data
    }
    
    // Get the updated user data
    const [updatedRows] = await conn.execute(
      'SELECT u.*, stm.staff_code FROM users u LEFT JOIN staff_telegram_mapping stm ON u.telegram_id = stm.telegram_id WHERE u.telegram_id = ?',
      [telegram_id]
    );
    
    await conn.end();
    
    if (updatedRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found after update' 
      });
    }
    
    const user = updatedRows[0];
    
    const userResponse = {
      id: user.id,
      telegram_id: user.telegram_id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      photo_url: user.photo_url,
      email: user.email,
      employee_id: user.employee_id,
      department: user.department,
      staff_code: user.staff_code,
      registration_complete: user.registration_complete === 1
    };
    
    res.json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Resend OTP endpoint
app.post('/api/auth/resend-otp', async (req, res) => {
  try {
    const { telegram_id, email } = req.body;
    
    if (!telegram_id || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing telegram_id or email' 
      });
    }
    
    // Generate new OTP
    const otp = otpService.generateOTP();
    
    // Store OTP
    otpService.storeOTP(telegram_id, email, otp);
    
    // Send OTP via email
    const emailSent = await emailService.sendOTPEmail(email, otp);
    
    if (emailSent) {
      res.json({
        success: true,
        message: 'OTP resent successfully',
        email: email.replace(/(.{2})(.*)(@.*)/, '$1****$3') // Mask email for privacy
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to resend OTP email'
      });
    }
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});


// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});