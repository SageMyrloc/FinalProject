document.addEventListener("DOMContentLoaded", function () {
  const categories = window.addItemData.categories;
  const applianceTypes = window.addItemData.applianceTypes;
  const foodTypes = window.addItemData.foodTypes;
  const transportTypes = window.addItemData.transportTypes;
  const userID = window.userID;

  console.log("Categories Loaded:", categories);
  console.log("Appliance Types Loaded:", applianceTypes);
  console.log("UserID:", userID);

  let currentMode = "category";
  let selectedCategory = "";

  const buttonContainer = document.getElementById("buttonContainer");
  const categoryDisplay = document.getElementById("selectedCategoryDisplay");
  const detailsMessage = document.getElementById("detailsMessage");
  const dynamicForm = document.getElementById("dynamicForm");

  function displayMessage(type, text) {
    const messageBox = document.getElementById("messageBox");
    messageBox.innerHTML = `<div class="alert alert-${type}" role="alert">${text}</div>`;

    // Optional: Auto-dismiss after 4 seconds
    setTimeout(() => {
      messageBox.innerHTML = "";
    }, 3000);
  }

  function renderButtons(list, type) {
    buttonContainer.innerHTML = "";

    list.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn btn-${type} btn-lg mb-1`;
      btn.textContent = item;

      btn.setAttribute("data-category", item);

      if (type === "primary") {
        btn.classList.add("category-btn", "text-nowrap");
      }

      buttonContainer.appendChild(btn);
    });

    if (type === "secondary") {
      const backBtn = document.createElement("button");
      backBtn.type = "button";
      backBtn.className = "btn btn-outline-primary btn-lg mt-3";
      backBtn.textContent = "Back to Categories";
      backBtn.onclick = () => {
        currentMode = "category";
        selectedCategory = "";
        categoryDisplay.textContent = "Categories";
        detailsMessage.textContent = "Please select a category from the left to add a new item.";
        dynamicForm.innerHTML = "";
        renderButtons(categories, "primary");
      };
      buttonContainer.appendChild(backBtn);
    }
  }

  buttonContainer.addEventListener("click", function (e) {
    if (e.target && e.target.hasAttribute("data-category")) {
      const clickedCategory = e.target.getAttribute("data-category");
      console.log("Clicked Category:", clickedCategory);
      console.log("Current Mode:", currentMode);

      const clickedLower = clickedCategory.toLowerCase();

      if (currentMode === "category" && categories.map((c) => c.toLowerCase()).includes(clickedLower)) {
        selectedCategory = clickedCategory;

        if (clickedLower === "appliance") {
          console.log("Switching to Appliance Mode");
          currentMode = "appliance";
          renderButtons(applianceTypes, "secondary");
        } else if (clickedLower === "food") {
          console.log("Switching to Food Mode");
          currentMode = "food";
          renderButtons(foodTypes, "secondary");
        } else if (clickedLower === "transport") {
          console.log("Switching to Transport Mode");
          currentMode = "transport";
          renderButtons(transportTypes, "secondary");
        }
      } else if (currentMode === "appliance") {
        if (applianceTypes.includes(clickedCategory)) {
          console.log("Fetching appliances for:", clickedCategory);
          categoryDisplay.textContent = `You selected: ${clickedCategory}`;
          detailsMessage.textContent = "Please complete the following:";
          dynamicForm.innerHTML = "";

          fetch(`/api/items/appliance/${encodeURIComponent(clickedCategory)}`)
            .then((response) => response.json())
            .then((data) => {
              if (data.length === 0) {
                dynamicForm.innerHTML = "<p>No appliances found for this category.</p>";
                return;
              }

              const select = document.createElement("select");
              select.className = "form-select mb-3";

              data.forEach((appliance) => {
                const option = document.createElement("option");
                option.value = appliance.name;
                option.textContent = appliance.name;
                option.dataset.wattage = appliance.wattage || "";
                select.appendChild(option);
              });

              dynamicForm.appendChild(select);

              const inputsContainer = document.createElement("div");
              dynamicForm.appendChild(inputsContainer);

              function getCurrentDateTime() {
                const now = new Date();
                return (
                  now.getFullYear() +
                  "-" +
                  String(now.getMonth() + 1).padStart(2, "0") +
                  "-" +
                  String(now.getDate()).padStart(2, "0") +
                  " " +
                  String(now.getHours()).padStart(2, "0") +
                  ":" +
                  String(now.getMinutes()).padStart(2, "0") +
                  ":" +
                  String(now.getSeconds()).padStart(2, "0")
                );
              }

              select.addEventListener("change", function () {
                const selectedOption = select.options[select.selectedIndex];
                const wattage = selectedOption.dataset.wattage;
                const currentDateTime = getCurrentDateTime();

                inputsContainer.innerHTML = `
                                  <div class="mb-3">
                                      <label for="usageTime" class="form-label">Length of Time Used (hours)</label>
                                      <input type="number" class="form-control" id="usageTime" min="0" step="0.1" placeholder="Enter hours used">
                                  </div>
                                  <div class="mb-3">
                                      <label for="wattageInput" class="form-label">Wattage (kWh)</label>
                                      <input type="number" class="form-control" id="wattageInput" value="${wattage}" step="0.01">
                                  </div>
                                  <div class="mb-3">
                                      <label for="logTime" class="form-label">Log Time (DateTime)</label>
                                      <input type="text" class="form-control" id="logTime" value="${currentDateTime}" readonly>
                                  </div>
                                  <button type="button" class="btn btn-success" id="submitAppliance">Submit</button>
                              `;

                document.getElementById("submitAppliance").addEventListener("click", function () {
                  const usageTime = document.getElementById("usageTime").value;
                  const wattageInput = document.getElementById("wattageInput").value;
                  const logTime = document.getElementById("logTime").value;

                  if (!usageTime || usageTime <= 0) {
                    displayMessage("danger","Please enter a valid usage time.");
                    return;
                  }

                  const payload = {
                    userID: userID,
                    applianceName: select.value,
                    usageTime: parseFloat(usageTime),
                    wattage: parseFloat(wattageInput),
                    logTime: logTime,
                  };

                  console.log("Submitting Data:", payload);

                  fetch("/api/log-appliance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  })
                    .then((response) => response.json())
                    .then((data) => {
                      if (data.success) {
                        displayMessage("success","Appliance usage logged successfully!");
                        dynamicForm.innerHTML = "";
                      } else {
                        displayMessage("Danger","Error: " + data.message);
                      }
                    })
                    .catch((error) => {
                      console.error("Submission Error:", error);
                      displayMessage("Danger","An error occurred while submitting.");
                    });
                });
              });

              select.dispatchEvent(new Event("change"));
            })
            .catch((error) => {
              console.error("Fetch error:", error);
              dynamicForm.innerHTML = "<p>Error loading appliances. Please try again.</p>";
            });
        }
      } else if (currentMode === "transport") {
        if (transportTypes.includes(clickedCategory)) {
          console.log("Fetching transport options for:", clickedCategory);
          categoryDisplay.textContent = `You selected: ${clickedCategory}`;
          detailsMessage.textContent = "Please complete the following:";
          dynamicForm.innerHTML = "";

          fetch(`/api/items/transport/${encodeURIComponent(clickedCategory)}`)
            .then((response) => response.json())
            .then((data) => {
              if (data.length === 0) {
                dynamicForm.innerHTML = "<p>No transport options found for this category.</p>";
                return;
              }

              const select = document.createElement("select");
              select.className = "form-select mb-3";

              data.forEach((transport) => {
                const option = document.createElement("option");
                option.value = transport.name;
                option.textContent = `${transport.name} (${transport.fuel_type})`;
                option.dataset.co2e = transport.co2e_per_mile || "";
                select.appendChild(option);
              });

              dynamicForm.appendChild(select);

              const inputsContainer = document.createElement("div");
              dynamicForm.appendChild(inputsContainer);

              function getCurrentDateTime() {
                const now = new Date();
                return (
                  now.getFullYear() +
                  "-" +
                  String(now.getMonth() + 1).padStart(2, "0") +
                  "-" +
                  String(now.getDate()).padStart(2, "0") +
                  " " +
                  String(now.getHours()).padStart(2, "0") +
                  ":" +
                  String(now.getMinutes()).padStart(2, "0") +
                  ":" +
                  String(now.getSeconds()).padStart(2, "0")
                );
              }

              select.addEventListener("change", function () {
                const currentDateTime = getCurrentDateTime();

                inputsContainer.innerHTML = `
                            <div class="mb-3">
                                <label for="distance" class="form-label">Distance Travelled (miles)</label>
                                <input type="number" class="form-control" id="distance" min="0" step="0.1" placeholder="Enter distance">
                            </div>
                            <div class="mb-3">
                                <label for="logTime" class="form-label">Log Time (DateTime)</label>
                                <input type="text" class="form-control" id="logTime" value="${currentDateTime}" readonly>
                            </div>
                            <button type="button" class="btn btn-success" id="submitTransport">Submit</button>
                        `;

                document.getElementById("submitTransport").addEventListener("click", function () {
                  const distance = document.getElementById("distance").value;
                  const logTime = document.getElementById("logTime").value;

                  if (!distance || distance <= 0) {
                    displayMessage("danger","Please enter a valid distance.");
                    return;
                  }

                  const payload = {
                    userID: userID,
                    transportName: select.value,
                    distance: parseFloat(distance),
                    logTime: logTime,
                  };

                  console.log("Submitting Transport Data:", payload);

                  fetch("/api/log-transport", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  })
                    .then((response) => response.json())
                    .then((data) => {
                      if (data.success) {
                        displayMessage("Success","Transport logged successfully!");
                        dynamicForm.innerHTML = "";
                      } else {
                        displayMessage("danger","Error: " + data.message);
                      }
                    })
                    .catch((error) => {
                      console.error("Submission Error:", error);
                      displayMessage("danger","An error occurred while submitting.");
                    });
                });
              });

              select.dispatchEvent(new Event("change"));
            })
            .catch((error) => {
              console.error("Fetch error:", error);
              dynamicForm.innerHTML = "<p>Error loading transport options. Please try again.</p>";
            });
        }
      } else if (currentMode === "food") {
        if (foodTypes.includes(clickedCategory)) {
          console.log("Fetching food items for:", clickedCategory);
          categoryDisplay.textContent = `You selected: ${clickedCategory}`;
          detailsMessage.textContent = "Please complete the following:";
          dynamicForm.innerHTML = "";

          fetch(`/api/items/food/${encodeURIComponent(clickedCategory)}`)
            .then((response) => response.json())
            .then((data) => {
              if (data.length === 0) {
                dynamicForm.innerHTML = "<p>No food items found for this category.</p>";
                return;
              }

              const select = document.createElement("select");
              select.className = "form-select mb-3";

              data.forEach((food) => {
                const option = document.createElement("option");
                option.value = food.name;
                option.textContent = food.name;
                option.dataset.co2e = food.co2e_per_kg || "";
                select.appendChild(option);
              });

              dynamicForm.appendChild(select);

              const inputsContainer = document.createElement("div");
              dynamicForm.appendChild(inputsContainer);

              function getCurrentDateTime() {
                const now = new Date();
                return (
                  now.getFullYear() +
                  "-" +
                  String(now.getMonth() + 1).padStart(2, "0") +
                  "-" +
                  String(now.getDate()).padStart(2, "0") +
                  " " +
                  String(now.getHours()).padStart(2, "0") +
                  ":" +
                  String(now.getMinutes()).padStart(2, "0") +
                  ":" +
                  String(now.getSeconds()).padStart(2, "0")
                );
              }

              select.addEventListener("change", function () {
                const currentDateTime = getCurrentDateTime();

                inputsContainer.innerHTML = `
                            <div class="mb-3">
                                <label for="quantity" class="form-label">Quantity (kg unless otherwise stated)</label>
                                <input type="number" class="form-control" id="quantity" min="0" step="0.1" placeholder="Enter quantity">
                            </div>
                            <div class="mb-3">
                                <label for="logTime" class="form-label">Log Time (DateTime)</label>
                                <input type="text" class="form-control" id="logTime" value="${currentDateTime}" readonly>
                            </div>
                            <button type="button" class="btn btn-success" id="submitFood">Submit</button>
                        `;

                document.getElementById("submitFood").addEventListener("click", function () {
                  const quantity = document.getElementById("quantity").value;
                  const logTime = document.getElementById("logTime").value;

                  if (!quantity || quantity <= 0) {
                    displayMessage("danger","Please enter a valid quantity.");
                    return;
                  }

                  const payload = {
                    userID: userID,
                    foodName: select.value,
                    quantity: parseFloat(quantity),
                    logTime: logTime,
                  };

                  console.log("Submitting Food Data:", payload);

                  fetch("/api/log-food", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  })
                    .then((response) => response.json())
                    .then((data) => {
                      if (data.success) {
                        displayMessage("success","Food logged successfully!");
                        dynamicForm.innerHTML = "";
                      } else {
                        displayMessage("danger","Error: " + data.message);
                      }
                    })
                    .catch((error) => {
                      console.error("Submission Error:", error);
                      displayMessage("danger","An error occurred while submitting.");
                    });
                });
              });

              select.dispatchEvent(new Event("change"));
            })
            .catch((error) => {
              console.error("Fetch error:", error);
              dynamicForm.innerHTML = "<p>Error loading food items. Please try again.</p>";
            });
        }
      }
    }
  });

  // Optionally render categories on load
  // renderButtons(categories, "primary");
});
