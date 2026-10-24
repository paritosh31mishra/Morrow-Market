const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['buyer', 'seller'], required: true, default: 'buyer' },
  phone: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
