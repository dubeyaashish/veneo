// server.js - Main server file with modular routing
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db');

const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Serve React's static files after build (for production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
}

// Database connection test on startup
// Log a warning if the connection cannot be established but continue starting
// the server so the API is still reachable.
db.testConnection()
  .then((success) => {
    if (success) {
      console.log('Database ready for connections');
    } else {
      console.error('WARNING: Database connection test failed');
    }
  })
  .catch((err) => {
    console.error('Error testing database connection:', err);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', orderRoutes);

// In production, serve React app for all other routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;
