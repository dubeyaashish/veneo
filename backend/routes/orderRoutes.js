const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.get('/orders/staff/:staffCode', orderController.getOrdersByStaff);
router.get('/order/:id', orderController.getOrderDetails);
router.post('/order/:id/update', orderController.updateOrder);
router.post('/order/:id/respond', orderController.respondOrder);
router.get('/departments', orderController.getDepartments);
router.get('/orders/search', orderController.searchOrders);

module.exports = router;
