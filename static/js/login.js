document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault(); // Prevent form submission

      // Collect user input
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();

      if (!username || !password) {
        displayMessage("Please enter both username and password.", "danger");
        return;
      }

      try {
        // Send login request to Flask backend
        const response = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        });

        const result = await response.json();

        if (result.success) {
          displayMessage("Login successful! Redirecting...", "success");

          // Redirect to another page after successful login
          setTimeout(() => {
            window.location.href = "/menu/"; // Change to your actual dashboard URL
          }, 1500);
        } else {
          displayMessage(result.message, "danger");
        }
      } catch (error) {
        console.error("Error:", error);
        displayMessage("An error occurred. Please try again.", "danger");
      }
    });
  }
});

// Function to show messages to the user
function displayMessage(message, type) {
  const messageContainer = document.getElementById("messageContainer");
  if (messageContainer) {
    messageContainer.innerHTML = `<div class="alert alert-${type}" role="alert">${message}</div>`;
  }
}
