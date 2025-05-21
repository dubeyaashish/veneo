const db = require('../db');

async function getVenioSONumber(netsuiteId) {
  const [rows] = await db.pool.query(
    'SELECT salesOrderNo FROM sid_v_so WHERE netsuite_id = ? LIMIT 1',
    [netsuiteId]
  );
  return rows.length > 0 ? rows[0].salesOrderNo : null;
}

async function getCustomerInfo(customerId) {
  const [nameRows] = await db.pool.query(
    'SELECT DISTINCT name FROM erp_shipto WHERE internal_id = ?',
    [customerId]
  );
  const [addressRows] = await db.pool.query(
    'SELECT address_internal_id, shipping_address FROM erp_shipto WHERE internal_id = ?',
    [customerId]
  );
  return { customerName: nameRows.length > 0 ? nameRows[0].name : '', shippingAddresses: addressRows };
}

async function getConditions() {
  const [rows] = await db.pool.query('SELECT * FROM billing_conditions ORDER BY condition_group, id');
  const conditions = {};
  for (const row of rows) {
    if (!conditions[row.condition_group]) conditions[row.condition_group] = [];
    conditions[row.condition_group].push(row);
  }
  return conditions;
}

async function getItemMap() {
  const [rows] = await db.pool.query('SELECT Internal_ID, Item FROM erp_price');
  const itemMap = {};
  for (const row of rows) {
    itemMap[row.Internal_ID] = row.Item;
  }
  return itemMap;
}

async function getLocations() {
  const [rows] = await db.pool.query('SELECT Internal_ID, Name FROM erp_location');
  const locations = {};
  for (const row of rows) {
    locations[row.Internal_ID] = row.Name;
  }
  return locations;
}

module.exports = {
  getVenioSONumber,
  getCustomerInfo,
  getConditions,
  getItemMap,
  getLocations
};
