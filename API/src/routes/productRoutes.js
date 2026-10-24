const express = require('express');
const Product = require('../models/Product');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.get('/', async (req, res, next) => {
  try {
    // Keep sold-out listings visible so buyers can see that the item exists.
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.search) filter.$or = [{ name: new RegExp(req.query.search, 'i') }, { description: new RegExp(req.query.search, 'i') }];
    const products = await Product.find(filter).populate('seller', 'name').sort({ createdAt: -1 });
    res.json(products);
  } catch (error) { next(error); }
});
router.get('/mine', requireAuth, requireRole('seller'), async (req, res, next) => {
  try { res.json(await Product.find({ seller: req.user._id }).sort({ createdAt: -1 })); } catch (error) { next(error); }
});
router.post('/', requireAuth, requireRole('seller'), async (req, res, next) => {
  try {
    const { name, category, description, image, price, stock } = req.body;
    if (!name || !description || !Number.isFinite(Number(price)) || !Number.isInteger(Number(stock))) return res.status(400).json({ message: 'Add a name, description, valid price and whole-number stock quantity.' });
    const product = await Product.create({ name, category, description, image, price: Number(price), stock: Number(stock), seller: req.user._id });
    res.status(201).json(product);
  } catch (error) { next(error); }
});
router.patch('/:id/stock', requireAuth, requireRole('seller'), async (req, res, next) => {
  try {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: 'Enter a whole number of units to add.' });
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, seller: req.user._id },
      { $inc: { stock: quantity } },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found in your store.' });
    res.json(product);
  } catch (error) { next(error); }
});
router.delete('/:id', requireAuth, requireRole('seller'), async (req, res, next) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, seller: req.user._id });
    if (!product) return res.status(404).json({ message: 'Product not found in your store.' });
    res.json({ message: 'Product removed.' });
  } catch (error) { next(error); }
});
module.exports = router;
