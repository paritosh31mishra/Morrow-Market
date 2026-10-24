const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  image: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: { type: [orderItemSchema], validate: (items) => items.length > 0 },
  total: { type: Number, required: true, min: 0 },
  shippingAddress: { type: String, required: true, trim: true },
  status: { type: String, enum: ['Placed', 'Preparing', 'Shipped', 'Delivered', 'Cancelled'], default: 'Placed' },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
