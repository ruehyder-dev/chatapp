// Extract the chat ID from the URL
const urlParams = new URLSearchParams(window.location.search);
const chatId = urlParams.get("chatId");
console.log("Chat ID:", chatId);

// Display the greeting
function displayGreeting() {
  const username = localStorage.getItem("username");
  if (username) {
    const header = document.getElementById("header");
    header.textContent = `Hi ${username}!`;
  }
}

// Fetch and display chat messages
async function loadMessages() {
  const token = localStorage.getItem("token");
  const chatMessagesDiv = document.getElementById("chat-messages");

  if (!chatMessagesDiv) {
    console.error("Error: Element with id 'chat-messages' not found in the DOM.");
    return;
  }

  try {
    const response = await fetch(`/api/chats/${chatId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const messages = await response.json();
      chatMessagesDiv.innerHTML = ""; // Clear existing messages
      messages.forEach((message) => {
        const messageDiv = document.createElement("div");
        messageDiv.textContent = `${message.sender}: ${message.text}`;
        chatMessagesDiv.appendChild(messageDiv);
      });

      // Scroll to the bottom of the chat
      chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    } else {
      console.error("Failed to load messages:", await response.json());
    }
  } catch (err) {
    console.error("Error loading messages:", err);
  }
}

// Connect to the WebSocket server
let socket;

function connectWebSocket() {
  socket = new WebSocket('ws://localhost:3000'); // Replace with your server's WebSocket URL

  socket.addEventListener('open', () => {
    console.log('WebSocket connection established');
  });

  socket.addEventListener('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Handle incoming messages
  socket.addEventListener('message', (event) => {
    const chatMessagesDiv = document.getElementById('chat-messages');
    const typingIndicator = document.getElementById('typing-indicator');
    const message = JSON.parse(event.data);

    if (message.type === 'typing') {
      typingIndicator.textContent = `${message.sender} is typing...`;
      typingIndicator.style.display = 'block';

      // Hide the typing indicator after 3 seconds
      setTimeout(() => {
        typingIndicator.style.display = 'none';
      }, 3000);
    } else if (message.type === 'message') {
      // Create a new message element
      const messageDiv = document.createElement('div');
      messageDiv.textContent = `${message.sender}: ${message.text}`;
      chatMessagesDiv.appendChild(messageDiv);

      // Scroll to the bottom of the chat
      chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;

      // Hide the typing indicator if a message is received
      typingIndicator.style.display = 'none';
    }
  });

  socket.addEventListener('close', () => {
    console.log('WebSocket connection closed. Reconnecting...');
    setTimeout(connectWebSocket, 1000); // Attempt to reconnect after 1 second
  });
}

// Send a message through WebSocket
async function sendMessage() {
  const token = localStorage.getItem("token");
  const messageInput = document.getElementById("message-input");
  const messageText = messageInput.value.trim(); // Trim whitespace

  if (!messageText) {
    alert("Message cannot be empty.");
    return;
  }

  const username = localStorage.getItem("username");

  try {
    // Send the message to the server via WebSocket
    socket.send(JSON.stringify({ sender: username, text: messageText }));

    // Save the message to the database via POST request
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
      console.log("Message sent successfully");
    } else {
      const error = await response.json();
      console.error("Failed to send message:", error);
      alert("Failed to send message.");
    }
  } catch (err) {
    console.error("Error sending message:", err);
    alert("An error occurred. Please try again.");
  }
}

// Leave the chat
async function leaveChat() {
  const confirmLeave = confirm("Are you sure you want to leave the chat?");
  if (!confirmLeave) {
    // If the user cancels, do nothing
    return;
  }

  const token = localStorage.getItem("token");

  try {
    const response = await fetch(`/api/chats/${chatId}/leave`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (response.ok) {
      alert("You have left the chat.");
      window.location.href = "/chat.html"; // Redirect to the main chat page
    } else {
      const error = await response.json();
      alert("Failed to leave chat: " + error.error);
    }
  } catch (err) {
    console.error("Error leaving chat:", err);
    alert("An error occurred. Please try again.");
  }
}

// Handle the Back button
function goBack() {
  window.location.href = "/chat.html"; // Redirect to the chat page
}

// Call loadMessages when the page loads
document.addEventListener("DOMContentLoaded", () => {
  displayGreeting();
  loadMessages();

  document.getElementById("send-button").addEventListener("click", sendMessage);
  document.getElementById("leave-button").addEventListener("click", leaveChat);
  document.getElementById("back-button").addEventListener("click", goBack);
  connectWebSocket();
});

const messageInput = document.getElementById("message-input");
let typingTimeout;

// Notify the server when the user starts typing
messageInput.addEventListener("input", () => {
  socket.send(JSON.stringify({ type: 'typing', sender: localStorage.getItem("username") }));

  // Clear the typing timeout to avoid sending multiple "typing" events
  clearTimeout(typingTimeout);

  // Stop typing after 2 seconds of inactivity
  typingTimeout = setTimeout(() => {
    socket.send(JSON.stringify({ type: 'stop-typing', sender: localStorage.getItem("username") }));
  }, 2000);
});