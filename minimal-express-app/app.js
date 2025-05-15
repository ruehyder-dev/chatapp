require('dotenv').config({ path: '../credentials.env' }); // Load environment variables

"use strict";
const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const WebSocket = require('ws');
const mongoose = require('mongoose');
const { connectToDatabase } = require("./database"); // Import the function
const Message = require("./models/Message");
const User = require("./models/User"); // Import your User model
const Chat = require("./models/Chat"); // Import your Chat model

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Use environment variables for MongoDB credentials
const username = process.env.MONGO_USERNAME;
const password = process.env.MONGO_PASSWORD;

// MongoDB connection string
const mongoUri = `mongodb+srv://${username}:${password}@cluster0.mongodb.net/myDatabase?retryWrites=true&w=majority`;


// Middleware to parse JSON
app.use("/api", express.json());
app.use("/api", bodyParser.json());

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Connect to MongoDB
let db; // Declare a global variable for the database

(async () => {
  try {
    db = await connectToDatabase(); // Assign the database object
    console.log("MongoDB connection established");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
})();

// Root route to serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API route to handle user registration
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  try {
    // Check if the username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists." });
    }

    // Insert the new user into the database with a hashed password
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashedPassword });
    res.status(201).json({ message: "User registered successfully. You can now log in." });
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).json({ error: "Internal server error. Please try again later." });
  }
});

// API route to handle user login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).send({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.send({ token });
  } catch (err) {
    console.error("Error during user login:", err);
    res.status(500).send({ error: "Internal server error" });
  }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]; // Extract the 'Authorization' header from the request.
  const token = authHeader && authHeader.split(" ")[1]; // Extract the token from the 'Bearer <token>' format.

  if (!token) {
    // If no token is provided, return a 401 Unauthorized error.
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  const jwtSecret = process.env.JWT_SECRET; // Fetch the JWT secret key from environment variables.
  if (!jwtSecret) {
    // If the secret key is not defined, log an error and return a 500 Internal Server Error.
    console.error("JWT_SECRET is not defined in the environment variables.");
    return res.status(500).json({ error: "Internal server error." });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    // Verify the token using the secret key.
    if (err) {
      // If the token is invalid or expired, return a 403 Forbidden error.
      return res.status(403).json({ error: "Invalid or expired token." });
    }

    req.user = user; // Attach the decoded user information to the request object.
    next(); // Call the next middleware or route handler.
  });
};

// Example of a protected route
app.get("/api/chat", authenticateToken, (req, res) => {
  res.status(200).json({ message: "Welcome to the chat!", user: req.user });
});

app.get("/api/active-chats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.username; // or req.user.id if you use IDs
    const chats = await Chat.find({ participants: userId }).populate("messages");
    res.send(chats);
  } catch (err) {
    console.error("Error fetching active chats:", err);
    res.status(500).send({ error: "Internal server error" });
  }
});

app.get("/api/search-users", authenticateToken, async (req, res) => {
  const query = req.query.query; // The search query from the client

  try {
    // Use Mongoose User model for search
    const users = await User.find({
      username: { $regex: query, $options: "i" }
    });

    // Exclude the current user from the search results
    const filteredUsers = users.filter(user => user.username !== req.user.username);

    res.json(filteredUsers);
  } catch (err) {
    console.error("Error searching for users:", err);
    res.status(500).json({ error: "Failed to search for users." });
  }
});

app.post("/api/start-chat", authenticateToken, async (req, res) => {
  const { recipient } = req.body; // The username of the user to chat with
  const sender = req.user.username; // The current logged-in user

  if (!recipient) {
    return res.status(400).json({ error: "Recipient username is required." });
  }

  try {
    // Check if a chat already exists between the two users
    let existingChat = await Chat.findOne({
      participants: { $all: [sender, recipient] },
    });

    if (existingChat) {
      return res.status(200).json({ message: "Chat already exists.", chatId: existingChat._id });
    }

    // Create a new chat
    const newChat = await Chat.create({
      participants: [sender, recipient],
      messages: [],
      createdAt: new Date(),
    });

    res.status(201).json({ message: "Chat started successfully.", chatId: newChat._id });
  } catch (err) {
    console.error("Error starting chat:", err);
    res.status(500).json({ error: "Failed to start chat." });
  }
});

app.get("/api/chats/:chatId", authenticateToken, async (req, res) => {
  const { chatId } = req.params;

  try {
    const chat = await Chat.findById(chatId).populate("messages");
    if (!chat) {
      return res.status(404).json({ error: "Chat not found." });
    }
    res.json(chat.messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Failed to fetch messages." });
  }
});

app.post("/api/chats/:chatId/messages", authenticateToken, async (req, res) => {
  const { chatId } = req.params;
  const { text } = req.body;
  const sender = req.user.id;

  try {
    const newMessage = new Message({
      text,
      sender,
      readBy: [sender] // Add the sender to the `readBy` array
    });

    // Save the message to the database
    await newMessage.save();

    // Optionally, associate the message with a chat
    await Chat.findByIdAndUpdate(chatId, { $push: { messages: newMessage._id } });

    res.status(201).send(newMessage);
  } catch (err) {
    console.error("Error creating message:", err);
    res.status(500).send({ error: "Internal server error" });
  }
});

app.post("/api/chats/:chatId/leave", authenticateToken, async (req, res) => {
  const { chatId } = req.params;
  const username = req.user.username; // Logged-in user's username

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found." });
    }

    // Remove the user from the participants array
    chat.participants = chat.participants.filter(user => user !== username);

    // Add the user to the leftParticipants array (create it if it doesn't exist)
    chat.leftParticipants = chat.leftParticipants || [];
    if (!chat.leftParticipants.includes(username)) {
      chat.leftParticipants.push(username);
    }

    // Ensure the allParticipants field exists and includes all users who were ever part of the chat
    chat.allParticipants = chat.allParticipants || [...chat.participants];
    if (!chat.allParticipants.includes(username)) {
      chat.allParticipants.push(username);
    }

    // Add a system message indicating the user has left
    chat.messages.push({
      sender: "System",
      text: `${username} has left the chat.`,
      createdAt: new Date(),
    });

    if (chat.participants.length === 0) {
      // If no participants remain, delete the chat
      await Chat.findByIdAndDelete(chatId);
      return res.status(200).json({ message: "Chat deleted as no participants remain." });
    } else {
      // Otherwise, update the chat
      await chat.save();
      return res.status(200).json({ message: "You have left the chat." });
    }
  } catch (err) {
    console.error("Error leaving chat:", err);
    res.status(500).json({ error: "Failed to leave chat." });
  }
});

app.post("/api/chats/:chatId/mark-as-read", authenticateToken, async (req, res) => {
  const chatId = req.params.chatId;
  const userId = req.user.id; // Assuming `req.user` contains the authenticated user's info

  try {
    const chat = await Chat.findById(chatId).populate("messages");
    if (!chat) {
      return res.status(404).send({ error: "Chat not found" });
    }

    // Update all unread messages to mark them as read by the current user
    let updated = false;
    for (const msg of chat.messages) {
      if (!msg.readBy.includes(userId)) {
        msg.readBy.push(userId);
        updated = true;
        await msg.save();
      }
    }

    if (updated) await chat.save();

    res.send({ success: true });
  } catch (err) {
    console.error("Error marking messages as read:", err);
    res.status(500).send({ error: "Internal server error" });
  }
});

async function registerUser() {
  const username = document.getElementById("register-username").value;
  const password = document.getElementById("register-password").value;
  const errorDiv = document.getElementById("register-error");

  console.log("Register button clicked"); // Debugging: Check if the function is called

  if (!username || !password) {
    errorDiv.textContent = "Username and password are required.";
    console.log("Validation failed: Missing username or password"); // Debugging
    return;
  }

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    console.log("Server response status:", response.status); // Debugging: Check server response status

    if (response.ok) {
        const data = await response.json();
        console.log("Registration successful:", data); // Debugging: Check success response
        errorDiv.style.color = "green";
        errorDiv.textContent = data.message;
      } else {
        const error = await response.json();
        console.log("Registration failed:", error); // Debugging: Check error response
        errorDiv.style.color = "red";
        errorDiv.textContent = "Registration failed: " + error.error;
      }
    } catch (err) {
      console.error("Error during registration:", err); // Debugging: Catch unexpected errors
      errorDiv.style.color = "red";
      errorDiv.textContent = "An error occurred. Please try again.";
    }
}

async function sendMessage() {
  const token = localStorage.getItem("token");
  const messageInput = document.getElementById("message-input");
  const messageText = messageInput.value.trim(); // Trim whitespace

  if (!messageText) {
    alert("Message cannot be empty.");
    return;
  }

  try {
    const response = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ text: messageText }),
    });

    if (response.ok) {
      messageInput.value = ""; // Clear the input field after sending
      loadMessages(); // Reload messages
    } else {
      alert("Failed to send message.");
    }
  } catch (err) {
    console.error("Error sending message:", err);
    alert("An error occurred. Please try again.");
  }
}

async function loadActiveChats() {
  console.log("loadActiveChats function is being called"); // Debugging

  const token = localStorage.getItem("token");
  const loggedInUser = localStorage.getItem("username");
  console.log("Logged-in user:", loggedInUser); // Debugging

  try {
    const response = await fetch("/api/active-chats", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    console.log("Response status:", response.status); // Debugging

    if (response.ok) {
      const chats = await response.json();
      console.log("Chats:", chats); // Debugging

      const activeChatsList = document.getElementById("active-chats-list");
      const noActiveChatsMessage = document.getElementById("no-active-chats-message");

      // Clear the active chats list
      activeChatsList.innerHTML = "";

      if (chats.length === 0) {
        noActiveChatsMessage.style.display = "block"; // Show "No active chats" message
      } else {
        noActiveChatsMessage.style.display = "none"; // Hide the message

        chats.forEach(chat => {
          console.log("Chat participants:", chat.participants); // Debugging

          // Normalize usernames to find the other participant
          const otherUser = chat.participants.find(user => user.trim().toLowerCase() !== loggedInUser.trim().toLowerCase());
          console.log("Other user:", otherUser); // Debugging

          const lastMessage = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].text : "No messages yet";

          const chatItem = document.createElement("div");
          chatItem.classList.add("chat-item");
          chatItem.innerHTML = `
            <strong>${otherUser}</strong>
            <p>${lastMessage}</p>
          `;

          chatItem.onclick = () => {
            window.location.href = `/chatbox.html?chatId=${chat._id}`;
          };

          activeChatsList.appendChild(chatItem);
        });
      }
    } else {
      console.error("Failed to fetch active chats"); // Debugging
    }
  } catch (err) {
    console.error("Error loading active chats:", err); // Debugging
  }
}

async function loginUser() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  if (!username || !password) {
    alert("Username and password are required.");
    return;
  }

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("token", data.token); // Save the token
      localStorage.setItem("username", username); // Save the logged-in user's username
      window.location.href = "/chat.html"; // Redirect to chat page
    } else {
      const error = await response.json();
      alert("Login failed: " + error.error);
    }
  } catch (err) {
    console.error("Error during login:", err);
    alert("An error occurred. Please try again.");
  }
}

// Create an HTTP server (if not already created)
const server = require('http').createServer(app);

// Attach WebSocket server to the HTTP server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('message', (message) => {
    try {
      // Convert the Buffer to a string
      const messageString = message.toString();
      console.log('Message received from client (string):', messageString);

      // Parse the message as JSON
      const parsedMessage = JSON.parse(messageString);

      if (parsedMessage.type === 'message' ||
          parsedMessage.type === 'typing') {
        console.log('Broadcasting message:', parsedMessage); // Log the parsed message

        // Broadcast the chat message to all connected clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            console.log('Sending message to client:', parsedMessage); // Log each broadcast
            client.send(JSON.stringify(parsedMessage));
          }
        });
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

connectToDatabase()
  .then(() => {
    console.log("Database connected. Starting server...");
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("Failed to connect to the database:", err);
    process.exit(1);
  });

module.exports = app;
