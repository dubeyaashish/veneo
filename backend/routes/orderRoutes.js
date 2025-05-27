const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');


router.get('/orders/staff/:staffCode', orderController.getOrdersByStaff);
router.get('/order/:id', orderController.getOrderDetails);
router.post('/order/:id/update', orderController.updateOrder);
router.post('/order/:id/respond', orderController.respondOrder);
router.get('/departments', orderController.getDepartments);
router.get('/orders/search', orderController.searchOrders)
router.post('/order/:id/split', orderController.splitOrder);
router.get('/order/:id/splits', orderController.getOrderSplits);
router.get('/order/:id/family', orderController.getOrderFamily);
router.get('/filters/staff', orderController.getStaffList); // New
router.get('/filters/status', orderController.getStatusList);
router.get('/orders/all', orderController.getAllOrders);
router.post('/order/split/create', orderController.createSplitOrder);
router.post('/order/split/create', orderController.createSplitOrder);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../pdf');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const orderId = req.params.id;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `SO_${orderId}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Add these routes to your existing routes

// Upload PDF
router.post('/order/:id/upload', upload.single('pdfFile'), async (req, res) => {
  try {
    const orderId = req.params.id;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileName = req.file.filename;
    
    // Update the order record with the PDF filename
    await db.pool.query(
      'UPDATE sid_v_so SET pdf_attachment = ? WHERE netsuite_id = ?',
      [fileName, orderId]
    );

    console.log(`✅ PDF uploaded for SO ${orderId}: ${fileName}`);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        filename: fileName,
        originalname: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// View PDF
router.get('/order/:id/pdf', async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // Get the PDF filename from database
    const [rows] = await db.pool.query(
      'SELECT pdf_attachment FROM sid_v_so WHERE netsuite_id = ?',
      [orderId]
    );
    
    if (rows.length === 0 || !rows[0].pdf_attachment) {
      return res.status(404).json({ success: false, message: 'No PDF found for this order' });
    }
    
    const filename = rows[0].pdf_attachment;
    const filePath = path.join(__dirname, '../pdf', filename);
    
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.sendFile(filePath);
    } else {
      res.status(404).json({ success: false, message: 'PDF file not found on server' });
    }
  } catch (error) {
    console.error('Error serving PDF:', error);
    res.status(500).json({ success: false, message: 'Error serving file' });
  }
});

// Delete PDF
router.delete('/order/:id/pdf', async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // Get current PDF filename
    const [rows] = await db.pool.query(
      'SELECT pdf_attachment FROM sid_v_so WHERE netsuite_id = ?',
      [orderId]
    );
    
    if (rows.length > 0 && rows[0].pdf_attachment) {
      const filename = rows[0].pdf_attachment;
      const filePath = path.join(__dirname, '../pdf', filename);
      
      // Delete file from server
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // Remove from database
      await db.pool.query(
        'UPDATE sid_v_so SET pdf_attachment = NULL WHERE netsuite_id = ?',
        [orderId]
      );
      
      console.log(`✅ PDF deleted for SO ${orderId}: ${filename}`);
      res.json({ success: true, message: 'PDF deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'No PDF found' });
    }
  } catch (error) {
    console.error('Error deleting PDF:', error);
    res.status(500).json({ success: false, message: 'Error deleting file' });
  }
});

module.exports = router;
