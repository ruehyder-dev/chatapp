// filepath: /c:/repos/ChatApp/minimal-express-app/app.js
//const express = require('express');
//const connectToDatabase = require('./database'); // Adjust the path if necessary

//const app = express();

// Connect to MongoDB
//(async () => {
   // await connectToDatabase();
//})();

//module.exports = app;

// filepath: /c:/repos/ChatApp/minimal-express-app/server.js
const app = require("./app"); // Import app.js
const http = require("http");

const server = http.createServer(app);

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
