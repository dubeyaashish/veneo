// backend/db.js
const mysql = require('mysql2/promise');
const config = require('./config');

// Create connection pool instead of individual connections
const pool = mysql.createPool(config.db);

// Test the connection on startup
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection established successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Export the pool and test function
module.exports = {
  pool,
  testConnection
};