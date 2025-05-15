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
let typingTimeout; // Declare a global variable to track the typing timeout

function handleWebSocketMessage(event) {
  console.log("handleWebSocketMessage triggered");
  const chatMessagesDiv = document.getElementById("chat-messages");
  const typingIndicator = document.getElementById("typing-indicator");
  const message = JSON.parse(event.data);

  console.log("Message received from server:", message);

  const signedInUser = localStorage.getItem("username");

  if (message.type === "typing") {
    if (message.sender !== signedInUser) {
      // Show the typing indicator dynamically
      typingIndicator.textContent = `${message.sender} is typing...`;
      typingIndicator.style.display = "block";

      // Clear any existing timeout and set a new one to hide the indicator after 10 seconds
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        typingIndicator.style.display = "none";
      }, 10000); // 10 seconds of inactivity
    }
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

// Handle typing events
let userTypingTimeout; // Timeout to track user inactivity
let isTyping = false; // Flag to track if the user is currently typing

function handleTyping() {
  const messageInput = document.getElementById("message-input");

  if (messageInput.value.trim() !== "") {
    if (!isTyping) {
      // Notify the server that the user has started typing
      socket.send(JSON.stringify({ type: "typing", sender: localStorage.getItem("username") }));
      isTyping = true; // Set the typing flag to true
    }

    // Clear the user inactivity timeout and reset it
    clearTimeout(userTypingTimeout);
    userTypingTimeout = setTimeout(() => {
      // Notify the server that the user has stopped typing after 10 seconds of inactivity
      socket.send(JSON.stringify({ type: "stop-typing", sender: localStorage.getItem("username") }));
      isTyping = false; // Reset the typing flag
    }, 10000); // 10 seconds of inactivity
  }
}

// Send message on Enter key press
function handleKeyPress(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault(); // Prevent adding a new line
    sendMessage(); // Call the sendMessage function

    // Notify the server to stop the typing indicator
    socket.send(JSON.stringify({ type: "stop-typing", sender: localStorage.getItem("username") }));
    isTyping = false; // Reset the typing flag
    clearTimeout(userTypingTimeout); // Clear the inactivity timeout
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

function adjustTextareaWidth() {
  const messageInput = document.getElementById("message-input");

  // Create a temporary span element to measure the text width
  const tempSpan = document.createElement("span");
  tempSpan.style.visibility = "hidden"; // Hide the span
  tempSpan.style.whiteSpace = "pre"; // Preserve spaces
  tempSpan.style.font = window.getComputedStyle(messageInput).font; // Match the textarea's font style
  tempSpan.textContent = messageInput.value || " "; // Use the textarea's value or a single space if empty

  document.body.appendChild(tempSpan); // Add the span to the DOM to measure its width
  const textWidth = tempSpan.offsetWidth; // Get the width of the text
  document.body.removeChild(tempSpan); // Remove the span from the DOM

  // Set the textarea's width dynamically, with a minimum width
  messageInput.style.width = Math.max(200, textWidth + 20) + "px"; // Minimum width of 200px, add padding
}

// Add event listener to adjust the textarea width dynamically
document.addEventListener("DOMContentLoaded", () => {
  const messageInput = document.getElementById("message-input");

  // Adjust the width on input
  messageInput.addEventListener("input", adjustTextareaWidth);

  // Set the initial width
  adjustTextareaWidth();
});

function adjustTextareaHeight() {
  const messageInput = document.getElementById("message-input");

  // Reset the height to auto to calculate the correct scrollHeight
  messageInput.style.height = "auto";

  // Set the height to match the content
  messageInput.style.height = messageInput.scrollHeight + "px";
}

// Add event listener to adjust the textarea height dynamically
document.addEventListener("DOMContentLoaded", () => {
  const messageInput = document.getElementById("message-input");

  // Adjust the height on input
  messageInput.addEventListener("input", adjustTextareaHeight);

  // Set the initial height
  adjustTextareaHeight();
});