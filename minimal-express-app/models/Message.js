// filepath: c:\repos\ChatApp\minimal-express-app\models\Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  text: { type: String, required: true },
  sender: { type: String, required: true }, // User ID of the sender
  timestamp: { type: Date, default: Date.now },
  readBy: { type: [String], default: [] } // Array of user IDs who have read the message
});

module.exports = mongoose.model("Message", messageSchema);