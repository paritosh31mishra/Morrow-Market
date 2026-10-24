const mongoose = require('mongoose');

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is missing. Add it to API/.env before starting the server.');
  await mongoose.connect(uri);
  console.log('Connected to the Morrow Market MongoDB database.');
}

module.exports = connectDatabase;
