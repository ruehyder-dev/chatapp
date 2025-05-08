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
  if (socket) {
    console.log("Removing existing WebSocket listeners");
    socket.removeEventListener("message", handleWebSocketMessage);
    socket.removeEventListener("close", handleWebSocketClose);
  }

  socket = new WebSocket("ws://localhost:3000");

  socket.addEventListener("open", () => {
    console.log("WebSocket connection established");
  });

  socket.addEventListener("error", (error) => {
    console.error("WebSocket error:", error);
  });

  socket.addEventListener("message", handleWebSocketMessage);

  socket.addEventListener("close", handleWebSocketClose);
}

function handleWebSocketClose() {
  console.log("WebSocket connection closed. Reconnecting...");
  setTimeout(connectWebSocket, 1000); // Attempt to reconnect after 1 second
}

// Handle WebSocket messages
function handleWebSocketMessage(event) {
console.log("handleWebSocketMessage triggered"); // Add this log
  const chatMessagesDiv = document.getElementById("chat-messages");
  const typingIndicator = document.getElementById("typing-indicator");
  const message = JSON.parse(event.data);

  console.log("Message received from server:", message); // Log the received message

  if (message.type === "typing") {
    typingIndicator.textContent = `${message.sender} is typing...`;
    typingIndicator.style.display = "block";
    new Promise((resolve) => setTimeout(() => {
      resolve();
    }, 3000)).then(() => {
      // Hide the typing indicator after 2 seconds
      typingIndicator.style.display = "none"; 
    });
  } else if (message.type === "message") {
    // Create a new message element
    const messageDiv = document.createElement("div");
    messageDiv.textContent = `${message.sender}: ${message.text}`;
    chatMessagesDiv.appendChild(messageDiv);

    // Scroll to the bottom of the chat
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;

    // Hide the typing indicator if a message is received
    typingIndicator.style.display = "none";
  }
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

  // Clear the input field
  messageInput.value = "";

  // Notify the server to stop the typing indicator
  socket.send(JSON.stringify({ type: "stop-typing", sender: username }));

  try {
    // Send the message to the server via WebSocket
    socket.send(JSON.stringify({ type: "message", sender: username, text: messageText }));

    // Save the message to the database via HTTP POST
    const response = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ text: messageText }),
    });

    if (!response.ok) {
      console.error("Failed to save message:", await response.json());
      alert("Failed to save message.");
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

  connectWebSocket(); // Ensure this is called only once
});

let typingTimeout;

// Handle typing events
function handleTyping() {
  const messageInput = document.getElementById("message-input");
  //const typingIndicator = document.getElementById("typing-indicator");

  // Notify the server that the user is typing
  if (messageInput.value.trim() !== "") {
    socket.send(JSON.stringify({ type: "typing", sender: localStorage.getItem("username") }));

  }
}

// Send message on Enter key press
function handleKeyPress(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault(); // Prevent adding a new line
    sendMessage(); // Call the sendMessage function
  }
}

// Add event listeners
document.addEventListener("DOMContentLoaded", () => {
  const messageInput = document.getElementById("message-input");

  // Listen for typing events
  messageInput.addEventListener("input", handleTyping);

  // Listen for Enter key press
  messageInput.addEventListener("keypress", handleKeyPress);

  // Connect to the WebSocket server
  connectWebSocket();
});