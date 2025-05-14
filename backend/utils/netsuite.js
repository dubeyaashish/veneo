// utils/netsuite.js
const axios = require('axios');
const crypto = require('crypto');

// Load NetSuite config
const getNetSuiteConfig = () => {
  return {
    consumer_key: process.env.NETSUITE_CONSUMER_KEY || "c1ff2a739418bf4bc940b461e13d9ce9f54312e55e37f0a6f1f7f8327dc3b5eb",
    consumer_secret: process.env.NETSUITE_CONSUMER_SECRET || "ac749d2bc5e9547a6af60caa3c8754a10c193dd35c1f5c26c47f9db370513d36",
    token: process.env.NETSUITE_TOKEN || "c635201371c288126c67700560ad45a7445f45590a3ff604c3fbc87c7855f4d6",
    token_secret: process.env.NETSUITE_TOKEN_SECRET || "dfdb35719ce8adb50c3607bb504a3e0f502aeb6b99f3dbd7fd8081baa4b988a0",
    realm: process.env.NETSUITE_REALM || "7446749_SB1",
    base_url: process.env.NETSUITE_BASE_URL || "https://7446749-sb1.suitetalk.api.netsuite.com/services/rest/record/v1",
    accounting_url: process.env.NETSUITE_ACCOUNTING_URL || "https://7446749-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id="
  };
};

// Build OAuth header for NetSuite
const buildOAuthHeader = (url, method, config) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  
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
  const signature = crypto.createHmac('sha256', signingKey).update(baseString).digest('base64');
  
  oauthParams.oauth_signature = signature;
  
  // Build header string
  let header = `OAuth realm="${config.realm}", `;
  for (const key in oauthParams) {
    header += `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}", `;
  }
  
  return header.slice(0, -2); // Remove trailing comma and space
};

// Create sales order in NetSuite
const createSalesOrder = async (orderData) => {
  try {
    const config = getNetSuiteConfig();
    
    // Prepare items payload
    const itemsPayload = orderData.items.map(item => ({
      item: { id: item.productCode },
      quantity: parseFloat(item.quantity),
      rate: parseFloat(item.price),
      description: item.description,
      inventorylocation: { id: 18 }, // Default location, should be configurable
      custcol_pp_estimate_pricetype: { id: "1" },
      custcol_ar_so_custprice: parseFloat(item.price)
    }));
    
    // Prepare order payload
    const payload = {
      entity: { id: orderData.customerId },
      tranDate: orderData.salesOrderDate,
      department: 23, // Should be configurable
      otherrefnum: orderData.salesOrderNo,
      salesrep: 1035, // Should be configurable
      memo: orderData.salesOrderSubject,
      custbody_ar_req_inv_mac5: `Venio. ${orderData.salesOrderNo}`,
      custbody_po_shipmentby: "",
      shipaddresslist: 17359, // Should be configurable
      shipdate: new Date().toISOString().split('T')[0], // Today
      discountitem: -6, // Should be configurable
      discountrate: -parseFloat(orderData.discountValue || 0),
      item: {
        items: itemsPayload
      },
      discounttotal: parseFloat(orderData.discountValue || 0),
      taxtotal: parseFloat(orderData.totalVat || 0),
      subtotal: parseFloat(orderData.subTotal || 0),
      location: { id: "18" }, // Default location, should be configurable
      custbody_ar_all_memo: `*** NetSuite API Integration - ${orderData.remark || ''}`,
      custbodyar_so_memo2: `*** NetSuite API Integration - ${orderData.remark || ''}`
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
    }
    
    return {
      success: true,
      netsuiteOrderId,
      netsuiteUrl: netsuiteOrderId ? `${config.accounting_url}${netsuiteOrderId}` : null
    };
  } catch (error) {
    console.error('Create NetSuite order error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get sales order from NetSuite
const getSalesOrder = async (orderId) => {
  try {
    const config = getNetSuiteConfig();
    
    // Build URL and headers
    const url = `${config.base_url}/salesOrder/${orderId}`;
    const authHeader = buildOAuthHeader(url, 'GET', config);
    
    // Send request to NetSuite
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    });
    
    return {
      success: true,
      order: response.data
    };
  } catch (error) {
    console.error('Get NetSuite order error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get sales order items from NetSuite
const getSalesOrderItems = async (orderId) => {
  try {
    const config = getNetSuiteConfig();
    
    // Build URL and headers
    const url = `${config.base_url}/salesOrder/${orderId}/item`;
    const authHeader = buildOAuthHeader(url, 'GET', config);
    
    // Send request to NetSuite
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    });
    
    // Fetch details for each item
    const items = [];
    
    for (const entry of response.data.items) {
      const href = entry.links[0].href;
      
      const itemAuthHeader = buildOAuthHeader(href, 'GET', config);
      const itemResponse = await axios.get(href, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': itemAuthHeader
        }
      });
      
      items.push({
        ...itemResponse.data,
        href
      });
    }
    
    return {
      success: true,
      items
    };
  } catch (error) {
    console.error('Get NetSuite order items error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Update sales order in NetSuite
const updateSalesOrder = async (orderId, changes) => {
  try {
    const config = getNetSuiteConfig();
    
    // Build URL and headers
    const url = `${config.base_url}/salesOrder/${orderId}`;
    const authHeader = buildOAuthHeader(url, 'PATCH', config);
    
    // Send request to NetSuite
    const response = await axios.patch(url, changes, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    });
    
    return {
      success: response.status === 204
    };
  } catch (error) {
    console.error('Update NetSuite order error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Update sales order item in NetSuite
const updateSalesOrderItem = async (itemHref, changes) => {
  try {
    const config = getNetSuiteConfig();
    
    // Build headers
    const authHeader = buildOAuthHeader(itemHref, 'PATCH', config);
    
    // Send request to NetSuite
    const response = await axios.patch(itemHref, changes, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    });
    
    return {
      success: response.status === 204
    };
  } catch (error) {
    console.error('Update NetSuite order item error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  getNetSuiteConfig,
  buildOAuthHeader,
  createSalesOrder,
  getSalesOrder,
  getSalesOrderItems,
  updateSalesOrder,
  updateSalesOrderItem
};