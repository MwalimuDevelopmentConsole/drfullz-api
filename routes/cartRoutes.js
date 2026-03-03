const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const {authenticateToken} = require('../middleware/auth');

router.use(authenticateToken);

router
    .get('/', cartController.getCart)
    .get('/orders', cartController.getMyOrders)
    .get('/orders/:buyerId', cartController.getOrdersByBuyerId)
    .post('/add', cartController.addToCart)
    .post('/remove', cartController.removeFromCart)
    .post('/checkout', cartController.checkoutItems);

module.exports = router;