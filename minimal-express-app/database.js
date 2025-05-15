require('dotenv').config({ path: '../credentials.env' }); // Load environment variables

const mongoose = require("mongoose");

async function connectToDatabase() {
  const username = process.env.MONGO_USERNAME;
  const password = process.env.MONGO_PASSWORD;
  const mongoUri = `mongodb+srv://${username}:${password}@cluster0.hys2s2c.mongodb.net/cluster0?retryWrites=true&w=majority`;

  try {
    await mongoose.connect(mongoUri); // No need for deprecated options
    console.log("Connected to MongoDB with Mongoose!");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
    throw err;
  }
}

module.exports = { connectToDatabase };


