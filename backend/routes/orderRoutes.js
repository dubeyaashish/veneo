const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

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

module.exports = router;
