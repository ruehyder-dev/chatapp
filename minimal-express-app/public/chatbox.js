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

// Load chat messages
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
    } else {
      console.error("Error loading messages:", await response.json());
    }
  } catch (err) {
    console.error("Error loading messages:", err);
  }
}

// Send a message
async function sendMessage() {
  const token = localStorage.getItem("token");
  const messageInput = document.getElementById("message-input");
  const message = messageInput.value;

  if (!message) return;

  try {
    const response = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: message }),
    });

    if (response.ok) {
      messageInput.value = ""; // Clear input
      loadMessages(); // Reload messages
    } else {
      console.error("Error sending message:", await response.json());
    }
  } catch (err) {
    console.error("Error sending message:", err);
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

// Add event listeners
document.addEventListener("DOMContentLoaded", () => {
  displayGreeting();
  loadMessages();

  document.getElementById("send-button").addEventListener("click", sendMessage);
  document.getElementById("leave-button").addEventListener("click", leaveChat);
  document.getElementById("back-button").addEventListener("click", goBack); // Add this line
});