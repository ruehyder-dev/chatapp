// filepath: /c:/repos/ChatApp/minimal-express-app/app.js
const express = require("express");
const http = require("http");
const { connectToDatabase } = require("./database"); // Import database logic

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Connect to the database
(async () => {
  try {
    await connectToDatabase();
  } catch (err) {
    console.error("Error connecting to the database:", err);
  }
})();

module.exports = app;
