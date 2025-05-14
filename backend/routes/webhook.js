// routes/webhook.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

// Helper function to get GoFive API token
async function getGoFiveToken() {
  try {
    const response = await axios.post('https://api.gofive.co.th/authorization/connect/token', 
      'grant_type=client_credentials&client_id=ffd67260-5ff2-476e-b6de-6d10c242a1ac&client_secret=1PxDnmB3CVWbY11aj8D11WUhb5yXBrSR4HUbRNjXasm%2Bw%2FMCKPzoRyh9TA8%3D',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Ocp-Apim-Subscription-Key': process.env.GOFIVE_OCP_KEY || 'e91a6823c52f404794af8f6ddd3b4c01'
        }
      }
    );
    
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting GoFive token:', error);
    throw error;
  }
}

// Helper function to fetch order details from GoFive API
async function fetchOrderDetails(orderNo, token) {
  try {
    const response = await axios.get(`https://api.gofive.co.th/v2/salesorder/${orderNo}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': process.env.GOFIVE_OCP_KEY || 'e91a6823c52f404794af8f6ddd3b4c01'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching order details for ${orderNo}:`, error);
    throw error;
  }
}

// Helper function to fetch customer details from GoFive API
async function fetchCustomerDetails(customerId, token) {
  try {
    const response = await axios.get(`https://api.gofive.co.th/v3/customers/${customerId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': process.env.GOFIVE_OCP_KEY || 'e91a6823c52f404794af8f6ddd3b4c01'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching customer details for ${customerId}:`, error);
    throw error;
  }
}

// Helper function to send notification to Telegram
async function sendTelegramNotification(message) {
  try {
    const chatId = process.env.TELEGRAM_CHAT_ID || "-4774943682";
    
    await axios.post(process.env.TELEGRAM_API_URL || "https://itppg.com/telegram/send_message_api.php", {
      chat_id: chatId,
      message: message
    }, {
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

// Helper function to create/update NetSuite order
async function pushToNetSuite(orderData, customerData, salesOrderNo) {
  try {
    // This function will be implemented in a separate file
    // For now, we'll just log the data
    console.log('Pushing order to NetSuite:', { orderData, customerData, salesOrderNo });
    return true;
  } catch (error) {
    console.error('Error pushing to NetSuite:', error);
    return false;
  }
}

// Webhook endpoint to receive sales order data
router.post('/sales-order', async (req, res) => {
  try {
    // Extract data from the webhook payload
    const payload = req.body;
    const salesOrderNo = payload.Data?.SaleOrderNo;
    
    if (!salesOrderNo) {
      return res.status(400).json({ success: false, message: 'Sales order number is required' });
    }
    
    // Get GoFive API token
    const token = await getGoFiveToken();
    
    // Fetch order details from GoFive API
    const orderData = await fetchOrderDetails(salesOrderNo, token);
    
    if (orderData.status.code !== 1000) {
      return res.status(400).json({ 
        success: false, 
        message: `Failed to fetch order details: ${orderData.status.description}` 
      });
    }
    
    // Fetch customer details from GoFive API
    const customerData = await fetchCustomerDetails(orderData.data.customerCode, token);
    
    if (customerData.status.code !== 1000) {
      return res.status(400).json({ 
        success: false, 
        message: `Failed to fetch customer details: ${customerData.status.description}` 
      });
    }
    
    // Store in the database
    const db = req.app.locals.db;
    
    // Insert sales order
    const [orderResult] = await db.query(`
      INSERT INTO v_so (
        customerId, customerCode, salesOrderSubject, salesOrderNo, salesOrderDate, 
        discountValue, discountType, paymentTerm, remark, staffCode, currencyCode, 
        vatCalculation, subTotal, subTotalWithDiscount, totalVat, grandTotal, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderData.data.customerId,
      orderData.data.customerCode,
      orderData.data.salesOrderSubject,
      orderData.data.salesOrderNo,
      orderData.data.salesOrderDate,
      orderData.data.discountValue,
      orderData.data.discountType,
      orderData.data.paymentTerm,
      orderData.data.remark,
      orderData.data.staffCode,
      orderData.data.currencyCode,
      orderData.data.vatCalculation,
      orderData.data.subTotal,
      orderData.data.subTotalWithDiscount,
      orderData.data.totalVat,
      orderData.data.grandTotal,
      'no'
    ]);
    
    // Insert sales order items
    const itemStatement = await db.prepare(`
      INSERT INTO v_so_item (
        salesOrderNo, productCode, productName, price, quantity, unitName, description, discount, totalPrice
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const item of orderData.data.salesorderDetails) {
      await itemStatement.execute([
        orderData.data.salesOrderNo,
        item.productCode,
        item.productName,
        item.price,
        item.qty,
        item.productUnitName,
        item.productDescription,
        item.discountValue,
        item.totalPrice
      ]);
    }
    
    // Send to NetSuite
    const netSuiteResult = await pushToNetSuite(orderData.data, customerData.data, salesOrderNo);
    
    // Prepare Telegram notification
    const message = `เปิด SO ${salesOrderNo} https://itppg.com/venio/sodata.php?so=${salesOrderNo}`;
    const telegramResult = await sendTelegramNotification(message);
    
    res.status(200).json({
      success: true,
      message: 'Sales order processed successfully',
      orderNo: salesOrderNo,
      netSuiteResult,
      telegramResult
    });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process sales order webhook', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;