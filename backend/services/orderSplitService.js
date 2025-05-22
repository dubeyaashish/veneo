// backend/services/orderSplitService.js
const db = require('../db');
const netsuite = require('./netsuiteService');
const config = require('../config');

async function generateSplitOrderNumber() {
  try {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month with leading zero
    const prefix = `SOV${year}${month}`;
    
    // Get next sequence number for this month/year
    await db.pool.query(`
      INSERT INTO split_order_sequence (current_number, prefix) 
      VALUES (1, ?) 
      ON DUPLICATE KEY UPDATE current_number = current_number + 1
    `, [prefix]);
    
    const [rows] = await db.pool.query(
      'SELECT current_number FROM split_order_sequence WHERE prefix = ? LIMIT 1', 
      [prefix]
    );
    
    if (rows.length > 0) {
      const runningNumber = String(rows[0].current_number).padStart(3, '0');
      return `${prefix}${runningNumber}`;
    }
    
    return `${prefix}001`;
  } catch (error) {
    console.error('Error generating split order number:', error);
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `SOV${year}${month}${Date.now().toString().slice(-3)}`;
  }
}

async function createSplitOrder(originalOrderId, splitItems, createdBy) {
  try {
    // 1. Fetch original order details
    const originalOrder = await netsuite.fetchSalesOrder(originalOrderId);
    const originalItems = await netsuite.fetchOrderItems(originalOrderId);
    
    // 2. Generate new order number
    const newOrderNumber = await generateSplitOrderNumber();
    
    // 3. Prepare new order data (inherit from original) - Use simple field values like EditOrder.js
    const newOrderData = {
      entity: originalOrder.entity?.id || originalOrder.entity,
      tranDate: originalOrder.tranDate,
      location: originalOrder.location?.id || originalOrder.location,
      shipaddresslist: originalOrder.shipaddresslist,
      custbody_ar_req_inv_mac5: originalOrder.custbody_ar_req_inv_mac5,
      custbodyar_so_memo2: `Split from SO ${originalOrderId}`,
      custbody_ar_all_memo: `${originalOrder.custbody_ar_all_memo || ''} - Split Order`,
      custbody_ar_estimate_contrat1: originalOrder.custbody_ar_estimate_contrat1,
      otherRefNum: `${originalOrder.otherRefNum || ''}-SPLIT`,
      memo: `Split from ${originalOrderId} - ${newOrderNumber}`
    };

    // 4. Create new sales order in NetSuite
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

    const orderResponse = await require('axios').post(createOrderUrl, newOrderData, {
      headers: { 
        Authorization: authHeader, 
        'Content-Type': 'application/json' 
      }
    });

    const newOrderId = orderResponse.data.id;

    // 5. Add items to new order
    const itemPromises = splitItems.map(async (splitItem) => {
      const itemData = {
        item: splitItem.item_id,
        quantity: splitItem.quantity,
        rate: splitItem.rate,
        description: splitItem.description,
        inventorylocation: splitItem.location || null,
        custcol_ice_ld_discount: splitItem.custcol_ice_ld_discount || 0,
        inpt_units_11: splitItem.inpt_units_11 || ''
      };

      const itemUrl = `${config.base_url}/salesOrder/${newOrderId}/item`;
      const itemAuthHeader = netsuite.buildOAuthHeader(
        itemUrl, 
        'POST', 
        config.consumer_key, 
        config.consumer_secret, 
        config.token, 
        config.token_secret, 
        config.realm
      );

      return require('axios').post(itemUrl, itemData, {
        headers: { 
          Authorization: itemAuthHeader, 
          'Content-Type': 'application/json' 
        }
      });
    });

    await Promise.all(itemPromises);

    // 6. Update original order quantities
    for (const splitItem of splitItems) {
      const originalItem = originalItems.find(item => 
        item.item?.id == splitItem.item_id
      );
      
      if (originalItem) {
        const newQuantity = parseFloat(originalItem.quantity) - parseFloat(splitItem.quantity);
        
        if (newQuantity > 0) {
          // Update original item quantity
          const updateData = { quantity: newQuantity };
          await netsuite.updateOrderItem(originalItem.href, updateData);
        } else if (newQuantity === 0) {
          // Remove item from original order if quantity becomes 0
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
        }
      }
    }

    // 7. Record split in database
    await db.pool.query(
      'INSERT INTO order_splits (parent_order_id, child_order_id, split_reason, created_by) VALUES (?, ?, ?, ?)',
      [originalOrderId, newOrderId, 'Item split', createdBy]
    );

    return {
      success: true,
      newOrderId,
      newOrderNumber,
      message: `Split order ${newOrderNumber} created successfully`
    };

  } catch (error) {
    console.error('Error creating split order:', error);
    throw new Error(`Failed to create split order: ${error.message}`);
  }
}

async function getSplitOrderHistory(orderId) {
  try {
    const [splits] = await db.pool.query(`
      SELECT 
        os.*,
        u.first_name,
        u.last_name
      FROM order_splits os
      LEFT JOIN users u ON os.created_by = u.telegram_id
      WHERE os.parent_order_id = ? OR os.child_order_id = ?
      ORDER BY os.created_at DESC
    `, [orderId, orderId]);

    return splits;
  } catch (error) {
    console.error('Error fetching split history:', error);
    return [];
  }
}

module.exports = {
  createSplitOrder,
  generateSplitOrderNumber,
  getSplitOrderHistory
};