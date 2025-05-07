"use strict";
const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection URI
const uri = 'mongodb+srv://ruehyder:VqzblfkQvqaXQxbC@cluster0.hys2s2c.mongodb.net/cluster0?retryWrites=true&w=majority';
const client = new MongoClient(uri);

// Middleware to parse JSON
app.use("/api", express.json());
app.use("/api", bodyParser.json());

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Connect to MongoDB
let db;
(async () => {
  db = await connectToDatabase();
})();

async function connectToDatabase() {
  try {
    console.log('Attempting to connect to MongoDB...');
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db('cluster0');
    return db;
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  }
}

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
    const usersCollection = db.collection("users");

    // Check if the username already exists
    const existingUser = await usersCollection.findOne({ username });

    if (existingUser) {
      return res.status(400).json({ error: "Username already exists." });
    }

    // Insert the new user into the database with a hashed password
    const hashedPassword = await bcrypt.hash(password, 10);
    await usersCollection.insertOne({ username, password: hashedPassword });
    res.status(201).json({ message: "User registered successfully. You can now log in." });
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).json({ error: "Internal server error. Please try again later." });
  }
});

// API route to handle user login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  try {
    const usersCollection = db.collection("users");

    // Check if the user exists
    const user = await usersCollection.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: "Invalid username or password." });
    }

    // Verify the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid username or password." });
    }

    // Create a token
    const token = jwt.sign({ username: user.username }, "your_secret_key", { expiresIn: "1h" });

    // Send the token to the client
    res.status(200).json({ message: "Login successful!", token });

    // Login successful
    //res.status(200).json({ message: "Login successful!" });
  } catch (err) {
    console.error("Error during user login:", err);
    res.status(500).json({ error: "Internal server error. Please try again later." });
  }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  jwt.verify(token, "your_secret_key", (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token." });
    }

    req.user = user; // Attach user info to the request
    next();
  });
};

// Example of a protected route
app.get("/api/chat", authenticateToken, (req, res) => {
  res.status(200).json({ message: "Welcome to the chat!", user: req.user });
});

app.get("/api/active-chats", authenticateToken, async (req, res) => {
  const username = req.user.username; // The logged-in user's username

  try {
    const chatsCollection = db.collection("chats");
    const activeChats = await chatsCollection
      .find({ participants: username }) // Find chats where the user is a participant
      .sort({ "messages.createdAt": -1 }) // Sort by the most recent message
      .project({ participants: 1, allParticipants:1,  messages: { $slice: -1 } }) // Include only the last message
      .toArray();

    res.json(activeChats); // Send the active chats to the frontend
  } catch (err) {
    console.error("Error fetching active chats:", err);
    res.status(500).json({ error: "Failed to fetch active chats." });
  }
});

app.get("/api/search-users", authenticateToken, async (req, res) => {
  const query = req.query.query; // The search query from the client

  try {
    const usersCollection = db.collection("users");

    // Perform a case-insensitive search using $regex
    const users = await usersCollection
      .find({ username: { $regex: query, $options: "i" } }) // Case-insensitive search
      .toArray();

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
    const chatsCollection = db.collection("chats");

    // Check if a chat already exists between the two users
    const existingChat = await chatsCollection.findOne({
      participants: { $all: [sender, recipient] },
    });

    if (existingChat) {
      return res.status(200).json({ message: "Chat already exists.", chatId: existingChat._id });
    }

    // Create a new chat
    const newChat = {
      participants: [sender, recipient],
      messages: [], // Initialize with no messages
      createdAt: new Date(),
    };

    const result = await chatsCollection.insertOne(newChat);
    res.status(201).json({ message: "Chat started successfully.", chatId: result.insertedId });
  } catch (err) {
    console.error("Error starting chat:", err);
    res.status(500).json({ error: "Failed to start chat." });
  }
});

app.get("/api/chats/:chatId", authenticateToken, async (req, res) => {
  const { chatId } = req.params;

  try {
    const chatsCollection = db.collection("chats");
    const chat = await chatsCollection.findOne({ _id: new ObjectId(chatId) });

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
  const sender = req.user.username;

  if (!text) {
    console.log("Message text is missing");
    return res.status(400).json({ error: "Message text is required." });
  }

  try {
    const chatsCollection = db.collection("chats");
    const result = await chatsCollection.updateOne(
      { _id: new ObjectId(chatId) },
      { $push: { messages: { sender, text, createdAt: new Date() } } }
    );

    console.log("Database update result:", result);

    if (result.modifiedCount === 0) {
      console.log("Chat not found");
      return res.status(404).json({ error: "Chat not found." });
    }

    console.log("Message saved successfully");
    res.status(201).json({ message: "Message sent successfully." });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ error: "Failed to send message." });
  }
});

app.post("/api/chats/:chatId/leave", authenticateToken, async (req, res) => {
  const { chatId } = req.params;
  const username = req.user.username; // Logged-in user's username

  try {
    const chatsCollection = db.collection("chats");

    // Find the chat
    const chat = await chatsCollection.findOne({ _id: new ObjectId(chatId) });
    if (!chat) {
      return res.status(404).json({ error: "Chat not found." });
    }

    // Remove the user from the participants array
    const updatedParticipants = chat.participants.filter(user => user !== username);

    // Add the user to the leftParticipants array (create it if it doesn't exist)
    const updatedLeftParticipants = chat.leftParticipants || [];
    if (!updatedLeftParticipants.includes(username)) {
      updatedLeftParticipants.push(username);
    }

    // Ensure the allParticipants field exists and includes all users who were ever part of the chat
    const updatedAllParticipants = chat.allParticipants || [...chat.participants];
    if (!updatedAllParticipants.includes(username)) {
      updatedAllParticipants.push(username);
    }

    // Add a system message indicating the user has left
    const systemMessage = {
      sender: "System",
      text: `${username} has left the chat.`,
      createdAt: new Date(),
    };

    if (updatedParticipants.length === 0) {
      // If no participants remain, delete the chat
      await chatsCollection.deleteOne({ _id: new ObjectId(chatId) });
      return res.status(200).json({ message: "Chat deleted as no participants remain." });
    } else {
      // Otherwise, update the chat
      await chatsCollection.updateOne(
        { _id: new ObjectId(chatId) },
        {
          $set: {
            participants: updatedParticipants,
            leftParticipants: updatedLeftParticipants,
            allParticipants: updatedAllParticipants,
          },
          $push: { messages: systemMessage },
        }
      );
      return res.status(200).json({ message: "You have left the chat." });
    }
  } catch (err) {
    console.error("Error leaving chat:", err);
    res.status(500).json({ error: "Failed to leave chat." });
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
      const parsedMessage = JSON.parse(message);
      console.log('Received:', parsedMessage);

      // Broadcast the message to all connected clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(parsedMessage));
        }
      });
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
