const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const filter = req.user.role === 'buyer' ? { buyer: req.user._id } : { 'items.seller': req.user._id };
    const orders = await Order.find(filter).populate('buyer', 'name email phone').populate('items.product', 'name image').sort({ createdAt: -1 });
    const visibleOrders = req.user.role === 'seller' ? orders.map((order) => {
      const value = order.toObject();
      value.items = value.items.filter((item) => item.seller.toString() === req.user._id.toString());
      value.total = value.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      return value;
    }) : orders;
    res.json(visibleOrders);
  } catch (error) { next(error); }
});

router.post('/', requireAuth, requireRole('buyer'), async (req, res, next) => {
  const reserved = [];
  try {
    const { items, shippingAddress } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Your bag is empty.' });
    if (!shippingAddress || !shippingAddress.trim()) return res.status(400).json({ message: 'A delivery address is required.' });
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) return res.status(400).json({ message: 'One of the product quantities is invalid.' });
    const orderItems = [];
    let total = 0;
    for (const requested of items) {
      const product = await Product.findOneAndUpdate(
        { _id: requested.product, stock: { $gte: requested.quantity } },
        { $inc: { stock: -requested.quantity } },
        { new: true }
      );
      if (!product) {
        const error = new Error('A product is no longer available in that quantity.');
        error.status = 409;
        throw error;
      }
      reserved.push({ id: product._id, quantity: requested.quantity });
      orderItems.push({ product: product._id, seller: product.seller, name: product.name, image: product.image, price: product.price, quantity: requested.quantity });
      total += product.price * requested.quantity;
    }
    const order = await Order.create({ buyer: req.user._id, items: orderItems, total, shippingAddress: shippingAddress.trim() });
    res.status(201).json(order);
  } catch (error) {
    // If a later item or saving the order fails, put reserved quantities back.
    await Promise.all(reserved.map(({ id, quantity }) => Product.updateOne({ _id: id }, { $inc: { stock: quantity } })));
    next(error);
  }
});

module.exports = router;
