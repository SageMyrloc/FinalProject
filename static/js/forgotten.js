document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("forgotPasswordForm");
    const messageContainer = document.getElementById("messageContainer");
  
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
  
      const username = document.getElementById("username").value.trim();
      const email = document.getElementById("email").value.trim();
  
      try {
        const response = await fetch("/api/forgot-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, email }),
        });
  
        const result = await response.json();
  
        messageContainer.innerHTML = `
          <div class="alert alert-${result.success ? "success" : "danger"}" role="alert">
            ${result.message}
          </div>
        `;
      } catch (error) {
        messageContainer.innerHTML = `
          <div class="alert alert-danger" role="alert">
            An error occurred. Please try again later.
          </div>
        `;
      }
    });
  });
  