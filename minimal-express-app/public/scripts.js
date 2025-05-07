/* filepath: /c:/repos/ChatApp/minimal-express-app/public/scripts.js */

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

// Add Log Out Button Dynamically
function addLogoutButton() {
  const logoutButton = document.createElement("button");
  logoutButton.id = "logout-button";
  logoutButton.textContent = "Log Out";
  logoutButton.onclick = logoutUser;
  logoutButton.style.position = "fixed";
  logoutButton.style.bottom = "20px";
  logoutButton.style.right = "20px";
  logoutButton.style.padding = "10px 20px";
  logoutButton.style.border = "none";
  logoutButton.style.borderRadius = "5px";
  logoutButton.style.background = "linear-gradient(to right, #ff6a00, #ee0979)";
  logoutButton.style.color = "white";
  logoutButton.style.fontSize = "1rem";
  logoutButton.style.cursor = "pointer";
  logoutButton.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.2)";
  logoutButton.style.transition = "background 0.3s ease, transform 0.2s ease";

  document.body.appendChild(logoutButton);
}

// Only add the Log Out button on the chat page
if (window.location.pathname === "/chat.html") {
  addLogoutButton();
  localStorage.getItem("username");
}
