document.addEventListener("DOMContentLoaded", function () {
  const registerForm = document.querySelector("form");

  registerForm.addEventListener("submit", function (e) {
    e.preventDefault(); // Prevent form submission to handle validation

    // Get form input values
    const username = document.getElementById("registerUsername").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();
    const confirmPassword = document.getElementById("registerConfirmPassword").value.trim();

    // Client-side validation
    // Client-side validation
    if (!username || !email || !password || !confirmPassword) {
      displayMessage("All fields are required.", "danger");
      return;
    }

    if (password !== confirmPassword) {
      displayMessage("Passwords do not match.", "danger");
      return;
    }

    // Create data object for the API request
    const userData = {
      username: username,
      email: email,
      password: password,
      confirm_password: confirmPassword,
    };

    // Send POST request to register API
    fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // If registration is successful, redirect or show a success message
          displayMessage("Registration successful! Redirecting to login...", "success");
          setTimeout(() => {
            window.location.href = "/login/";
          }, 1500);
          // window.location.href = "/login"; // Redirect to login page after registration
        } else {
          // If there's an error (e.g., username or email already exists)
          displayMessage(data.message, "danger");
        }
      })
      .catch((error) => {
        // Handle fetch or server errors
        displayMessage("An error occurred, please try again.", "danger");
      });
  });

  // function to display the success or error message
  function displayMessage(message, type) {
    const messageContainer = document.getElementById("messageContainer");
    if (messageContainer) {
      messageContainer.innerHTML = `<div class="alert alert-${type}" role="alert">${message}</div>`;
    }
  }
});
