// server.js - Main Express server file
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mysql = require('mysql2/promise');

// Import route modules
const webhookRoutes = require('./routes/webhook');
const orderRoutes = require('./routes/orders');
const authRoutes = require('./routes/auth');


// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'itppg.com',
  user: process.env.DB_USER || 'misppg_db',
  password: process.env.DB_PASSWORD || 'JNN4ukBSUvnN2WDzLKJE',
  database: process.env.DB_NAME || 'misppg_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Make db available to all routes
app.set('db', pool);

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS for frontend
app.use(morgan('dev')); // HTTP request logger
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Routes
app.use('/api/webhook', webhookRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);

// Base route for API health check
app.get('/api', (req, res) => {
  res.json({ 
    status: 'success', 
    message: 'Orders API is running',
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app; // For testing purposes