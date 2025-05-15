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
        chatMessagesDiv.appendChild(renderMessage(message));
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
    chatMessagesDiv.appendChild(renderMessage(message));
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
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

    if (response.ok) {
      // Optionally handle sent status here
    } else {
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
  // Initialize the emoji picker
  const emojiButton = document.getElementById("emoji-button");
  const emojiPicker = document.getElementById("emoji-picker");

  emojis.forEach((emoji) => {
    const emojiSpan = document.createElement("span");
    emojiSpan.textContent = emoji;
    emojiSpan.addEventListener("click", () => insertEmoji(emoji));
    emojiPicker.appendChild(emojiSpan);
  });

  emojiButton.addEventListener("click", toggleEmojiPicker);

  // Hide the emoji picker if the user clicks outside of it
  document.addEventListener("click", (event) => {
    if (!emojiPicker.contains(event.target) && event.target.id !== "emoji-button") {
      emojiPicker.style.display = "none";
    }
  });

  displayGreeting();
  loadMessages();
  document.getElementById("send-button").addEventListener("click", sendMessage);
  document.getElementById("leave-button").addEventListener("click", leaveChat);
  document.getElementById("back-button").addEventListener("click", goBack);
  connectWebSocket();
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

// List of emojis to display in the emoji picker
const emojis = [
  "😀", "😂", "😍", "😎", "😭", "😡", "👍", "👎", "🎉", "❤️", "🔥", "✨", "🎶", "🍕", "🍎",
  // ... (rest of your emoji list)
];

// Function to toggle the emoji picker as a popup
function toggleEmojiPicker() {
  const emojiPicker = document.getElementById("emoji-picker");
  const emojiButton = document.getElementById("emoji-button");

  if (!emojiPicker || !emojiButton) {
    console.error("Emoji picker or button element not found!");
    return;
  }

  // Toggle the display of the emoji picker
  if (emojiPicker.style.display === "none" || !emojiPicker.style.display) {
    // Position the emoji picker relative to the emoji button
    const buttonRect = emojiButton.getBoundingClientRect();
    emojiPicker.style.top = `${buttonRect.bottom + window.scrollY}px`; // Position below the button
    emojiPicker.style.left = `${buttonRect.left + window.scrollX}px`; // Align horizontally with the button
    emojiPicker.style.display = "block"; // Show the picker
  } else {
    emojiPicker.style.display = "none"; // Hide the picker
  }
}

// Function to insert an emoji at the cursor position
function insertEmoji(emoji) {
  const messageInput = document.getElementById("message-input");
  const start = messageInput.selectionStart;
  const end = messageInput.selectionEnd;

  // Insert the emoji at the cursor position
  const textBefore = messageInput.value.substring(0, start);
  const textAfter = messageInput.value.substring(end);
  messageInput.value = textBefore + emoji + textAfter;

  // Move the cursor to the position after the inserted emoji
  messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;

  // Hide the emoji picker
  document.getElementById("emoji-picker").style.display = "none";

  // Focus back on the input box
  messageInput.focus();
}

// Add event listeners for the emoji button and emoji picker
document.addEventListener("DOMContentLoaded", () => {
  const emojiButton = document.getElementById("emoji-button");
  const emojiPicker = document.getElementById("emoji-picker");

  // Populate the emoji picker with emojis
  emojis.forEach((emoji) => {
    const emojiSpan = document.createElement("span");
    emojiSpan.textContent = emoji;
    emojiSpan.addEventListener("click", () => insertEmoji(emoji));
    emojiPicker.appendChild(emojiSpan);
  });

  // Toggle the emoji picker when the emoji button is clicked
  emojiButton.addEventListener("click", toggleEmojiPicker);

  // Hide the emoji picker if the user clicks outside of it
  document.addEventListener("click", (event) => {
    if (!emojiPicker.contains(event.target) && event.target.id !== "emoji-button") {
      emojiPicker.style.display = "none";
    }
  });
});

// Add event listener for the leave button
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("leave-button").addEventListener("click", leaveChat);
});

function notifyMessageRead(messageId) {
  socket.send(JSON.stringify({ type: "read", messageId }));
}

// Listen for WebSocket messages indicating a message has been read
// (You may want to adjust this if you implement read receipts)
if (typeof socket !== "undefined") {
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "read") {
      const readCheck = document.querySelector(`.check-mark.read[data-id="${message.messageId}"]`);
      if (readCheck) {
        readCheck.classList.add("read");
      }
    }
  });
}

// Mark messages as read when the chatbox is opened
async function markMessagesAsRead(chatId) {
  const token = localStorage.getItem("token");

  try {
    const response = await fetch(`/api/chats/${chatId}/mark-as-read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to mark messages as read");
    }
  } catch (err) {
    console.error("Error marking messages as read:", err);
  }
}

// Call this function when the chatbox is loaded
if (chatId) {
  markMessagesAsRead(chatId);
}

// Render a single message (left/right based on sender)
function renderMessage(message) {
  const loggedInUser = localStorage.getItem("username");
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("chat-bubble");

  // Determine if this is a sent (right) or received (left) message
  const isSent = (
    message.sender &&
    message.sender.trim().toLowerCase() === loggedInUser.trim().toLowerCase()
  );
  messageDiv.classList.add(isSent ? "right" : "left");

  // Check mark logic (only show for sent messages)
  let checkMarkHTML = "";
  if (isSent) {
    // If every participant except the sender is in readBy, it's read
    // (Assume you have access to chat participants, or pass it in as needed)
    // For now, we check if readBy.length > 1 (sender + at least one more)
    if (Array.isArray(message.readBy) && message.readBy.length > 1) {
      checkMarkHTML = `<span class="check-mark read">&#10003;&#10003;</span>`; // double green
    } else {
      checkMarkHTML = `<span class="check-mark">&#10003;</span>`; // single gray
    }
  }

  messageDiv.innerHTML = `
    <span class="message-text">${message.text}</span>
    ${checkMarkHTML}
  `;
  return messageDiv;
}