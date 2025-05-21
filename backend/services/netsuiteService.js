const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');

function buildOAuthHeader(url, method, consumer_key, consumer_secret, token, token_secret, realm) {
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
  const sortedParams = Object.keys(oauthParams).sort().reduce((acc, key) => {
    acc[key] = oauthParams[key];
    return acc;
  }, {});
  const baseParams = [];
  for (const [key, value] of Object.entries(sortedParams)) {
    baseParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(baseParams.join('&'))}`;
  const signingKey = `${encodeURIComponent(consumer_secret)}&${encodeURIComponent(token_secret)}`;
  const signature = crypto.createHmac('sha256', signingKey).update(baseString).digest('base64');
  oauthParams.oauth_signature = signature;
  let header = `OAuth realm="${realm}", `;
  for (const [key, value] of Object.entries(oauthParams)) {
    header += `${encodeURIComponent(key)}="${encodeURIComponent(value)}", `;
  }
  return header.slice(0, -2);
}

async function fetchSalesOrder(orderId) {
  const soUrl = `${config.base_url}/salesOrder/${orderId}`;
  const authHeader = buildOAuthHeader(soUrl, 'GET', config.consumer_key, config.consumer_secret, config.token, config.token_secret, config.realm);
  const response = await axios.get(soUrl, { headers: { Authorization: authHeader } });
  return response.data;
}

async function fetchOrderItems(orderId) {
  const itemUrl = `${config.base_url}/salesOrder/${orderId}/item`;
  const authHeader = buildOAuthHeader(itemUrl, 'GET', config.consumer_key, config.consumer_secret, config.token, config.token_secret, config.realm);
  const response = await axios.get(itemUrl, { headers: { Authorization: authHeader } });
  const items = [];
  for (const entry of response.data.items || []) {
    const href = entry.links[0]?.href;
    if (!href) continue;
    const lineAuthHeader = buildOAuthHeader(href, 'GET', config.consumer_key, config.consumer_secret, config.token, config.token_secret, config.realm);
    const lineResponse = await axios.get(href, { headers: { Authorization: lineAuthHeader } });
    const item = lineResponse.data;
    if (item) {
      item.href = href;
      items.push(item);
    }
  }
  return items;
}

async function updateSalesOrder(orderId, headerChanges) {
  const orderUrl = `${config.base_url}/salesOrder/${orderId}`;
  const authHeader = buildOAuthHeader(orderUrl, 'PATCH', config.consumer_key, config.consumer_secret, config.token, config.token_secret, config.realm);
  const response = await axios.patch(orderUrl, headerChanges, { headers: { Authorization: authHeader, 'Content-Type': 'application/json' } });
  return { success: true, status: response.status, data: response.data };
}

async function updateOrderItem(itemHref, changes) {
  const authHeader = buildOAuthHeader(itemHref, 'PATCH', config.consumer_key, config.consumer_secret, config.token, config.token_secret, config.realm);
  const response = await axios.patch(itemHref, changes, { headers: { Authorization: authHeader, 'Content-Type': 'application/json' } });
  return { success: true, status: response.status, data: response.data };
}

async function sendTelegramMessage(chatId, message) {
  const botToken = config.telegram.bot_token;
  const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await axios.post(telegramApiUrl, { chat_id: chatId, text: message, parse_mode: 'HTML' });
  return true;
}

async function sendTelegramNotification(chatId, message) {
  await axios.post(config.telegram.notification_url, { chat_id: chatId, message }, { headers: { 'Content-Type': 'application/json' } });
  return true;
}

module.exports = {
  buildOAuthHeader,
  fetchSalesOrder,
  fetchOrderItems,
  updateSalesOrder,
  updateOrderItem,
  sendTelegramMessage,
  sendTelegramNotification
};
