const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  participants: { type: [String], required: true }, // Array of user IDs
  messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }] // References to Message documents
});

module.exports = mongoose.model("Chat", chatSchema);