// Load active chats when the page loads
window.onload = () => {
  loadActiveChats();
  displayGreeting();

  // Poll for new messages every 5 second
  setInterval(loadActiveChats, 5000); // Adjust the interval as needed
};

// Load active chats
async function loadActiveChats() {
  const token = localStorage.getItem("token");
  const loggedInUser = localStorage.getItem("username"); // Get the logged-in user's username

  try {
    const response = await fetch("/api/active-chats", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const chats = await response.json();
      const activeChatsList = document.getElementById("active-chats-list");
      const noActiveChatsMessage = document.getElementById("no-active-chats-message");

      // Clear the active chats list
      if (activeChatsList) {
        activeChatsList.innerHTML = "";
      }

      if (noActiveChatsMessage) {
        if (chats.length === 0) {
          noActiveChatsMessage.style.display = "block"; // Show "No active chats" message
        } else {
          noActiveChatsMessage.style.display = "none"; // Hide the message
        }
      }

      if (chats.length > 0 && activeChatsList) {
        chats.forEach(chat => {
          console.log("Chat data:", chat); // Debugging

          // Find the other participant in the chat
          let otherUser = chat.participants.find(user => user !== loggedInUser);

          // If the other user has left, check the leftParticipants field
          if (!otherUser && chat.leftParticipants) {
            otherUser = chat.leftParticipants.find(user => user !== loggedInUser);
          }

          // If still not found, fall back to the allParticipants field
          if (!otherUser && chat.allParticipants) {
            otherUser = chat.allParticipants.find(user => user !== loggedInUser);
          }

          console.log("Other user:", otherUser); // Debugging

          // Get the latest message and truncate if necessary
          let latestMessage = "No messages yet";
          if (chat.messages.length > 0) {
            const msg = chat.messages[chat.messages.length - 1]; // Get the last message
            latestMessage = (msg && typeof msg === "object" && msg.text) ? msg.text : "No messages yet";
          }
          const truncatedMessage = latestMessage.length > 50 ? latestMessage.substring(0, 50) + "..." : latestMessage;

          const chatItem = document.createElement("div");
          chatItem.classList.add("chat-item");
          chatItem.innerHTML = `
            <strong>${otherUser || "Unknown User"}</strong>
            <p>${truncatedMessage}</p>
          `;

          // Add a click event to open the chat
          chatItem.onclick = () => {
            window.location.href = `/chatbox.html?chatId=${chat._id}`;
          };

          activeChatsList.appendChild(chatItem);
        });
      }
    } else {
      alert("Failed to load active chats.");
    }
  } catch (err) {
    console.error("Error loading active chats:", err);
    alert("An error occurred. Please try again.");
  }
}

// Display the greeting
function displayGreeting() {
  const username = localStorage.getItem("username");
  if (username) {
    const header = document.getElementById("header");
    header.textContent = `Hi ${username}!`;
  }
}

// Search for users
async function searchUsers() {
  const token = localStorage.getItem("token"); // Retrieve the token from local storage
  const searchInput = document.getElementById("search-input").value;

  if (!searchInput) {
    alert("Please enter a username to search.");
    return;
  }

  try {
    const response = await fetch(`/api/search-users?query=${searchInput}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`, // Include the token for authentication
      },
    });

    if (response.ok) {
      const users = await response.json();
      const resultsList = document.getElementById("search-results-list");

      // Clear previous results
      resultsList.innerHTML = "";

      if (users.length === 0) {
        resultsList.innerHTML = "<li>No users found.</li>";
      } else {
        users.forEach(user => {
          const listItem = document.createElement("li");
          listItem.textContent = user.username;

          // Add a "Start Chat" button for each user
          const startChatButton = document.createElement("button");
          startChatButton.textContent = "Start Chat";
          startChatButton.onclick = () => startChat(user.username);

          listItem.appendChild(startChatButton);
          resultsList.appendChild(listItem);
        });
      }
    } else {
      alert("Failed to search for users.");
    }
  } catch (err) {
    console.error("Error searching for users:", err);
    alert("An error occurred. Please try again.");
  }
}

// Start a new chat
async function startChat(recipient) {
  const token = localStorage.getItem("token"); // Retrieve the token from localStorage

  // Ask for confirmation
  const confirmStart = confirm(`Do you want to start a chat with ${recipient}?`);
  if (!confirmStart) {
    return; // Exit if the user clicks "No"
  }

  try {
    const response = await fetch("/api/start-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`, // Include the token for authentication
      },
      body: JSON.stringify({ recipient }),
    });

    if (response.ok) {
      const data = await response.json();
      // Redirect to the chat page with the chat ID
      window.location.href = `/chatbox.html?chatId=${data.chatId}`;
    } else {
      const error = await response.json();
      alert("Failed to start chat: " + error.error);
    }
  } catch (err) {
    console.error("Error starting chat:", err);
    alert("An error occurred. Please try again.");
  }
}

function logoutUser() {
  // Remove the token from localStorage
  localStorage.removeItem("token");

  // Redirect to the login page
  window.location.href = "/";
}

const loggedInUser = localStorage.getItem("username");
console.log("Logged-in user:", loggedInUser); // Debugging

// filepath: c:\repos\ChatApp\minimal-express-app\models\Chat.js
const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  participants: { type: [String], required: true }, // Array of user IDs
  messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }] // References to Message documents
});

module.exports = mongoose.model("Chat", chatSchema);