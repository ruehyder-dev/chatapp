const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');

// MongoDB connection string with your credentials
const uri = 'mongodb+srv://ruehyder:VqzblfkQvqaXQxbC@cluster0.hys2s2c.mongodb.net/cluster0?retryWrites=true&w=majority';

// Create a MongoDB client
const client = new MongoClient(uri);

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db('cluster0'); // Use your database name here
    return db;
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  }
}

module.exports = connectToDatabase;

const app = express();
const server = http.createServer(app);
