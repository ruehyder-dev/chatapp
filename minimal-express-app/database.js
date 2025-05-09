require('dotenv').config({ path: '../credentials.env' }); // Load environment variables

const { MongoClient } = require("mongodb");

let db;

async function connectToDatabase() {
  if (db) return db; // Return the existing connection if already established

  const username = process.env.MONGO_USERNAME;
  const password = process.env.MONGO_PASSWORD;
  const mongoUri = `mongodb+srv://${username}:${password}@cluster0.hys2s2c.mongodb.net/cluster0?retryWrites=true&w=majority`;

  const client = new MongoClient(mongoUri); // Removed deprecated options

  try {
    await client.connect();
    console.log("Connected to MongoDB!");
    db = client.db("cluster0"); // Replace "cluster0" with your actual database name
    return db;
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
    throw err;
  }
}

module.exports = { connectToDatabase };


