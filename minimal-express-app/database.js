require('dotenv').config({ path: '../credentials.env' }); // Load environment variables

const mongoose = require('mongoose');

// Use the MONGO_URI environment variable
const uri = process.env.MONGO_URI;

if (!uri) {
  throw new Error('MONGO_URI is not defined in the environment variables');
}

// Connect to MongoDB using mongoose
async function connectToDatabase() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  }
}

module.exports = { connectToDatabase };


