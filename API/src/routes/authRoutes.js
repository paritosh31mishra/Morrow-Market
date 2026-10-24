const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
function makeToken(user) { return jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' }); }
function publicUser(user) { return { _id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, address: user.address }; }

router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password, role, phone, address } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required.' });
    if (password.length < 8) return res.status(400).json({ message: 'Choose a password with at least 8 characters.' });
    if (!['buyer', 'seller'].includes(role)) return res.status(400).json({ message: 'Choose buyer or seller account type.' });
    if (await User.exists({ email: email.toLowerCase().trim() })) return res.status(409).json({ message: 'An account already exists with that email.' });
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashedPassword, role, phone, address });
    res.status(201).json({ user: publicUser(user), token: makeToken(user) });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase().trim() }).select('+password');
    if (!user || !(await bcrypt.compare(password || '', user.password))) return res.status(401).json({ message: 'Email or password is incorrect.' });
    if (role && user.role !== role) return res.status(403).json({ message: `This account is registered as a ${user.role}. Choose the matching account type.` });
    res.json({ user: publicUser(user), token: makeToken(user) });
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
module.exports = router;
