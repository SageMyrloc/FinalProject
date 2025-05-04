document.addEventListener("DOMContentLoaded", function () {
  const fetchBtn = document.getElementById("fetchDataBtn");

  fetchBtn.addEventListener("click", function () {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    if (!startDate || !endDate) {
      displayChartMessage("Please select both start and end dates.", "warning");
      return;
    }

    fetch(`/api/activity-data?start=${startDate}&end=${endDate}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.dates.length === 0) {
          displayChartMessage("No data found for the selected range.", "info");
          if (window.carbonChart && typeof window.carbonChart.destroy === "function") {
            window.carbonChart.destroy();
          }
          return;
        }

        if (window.carbonChart && typeof window.carbonChart.destroy === "function") {
          window.carbonChart.destroy();
        }

        const ctx = document.getElementById("carbonChart").getContext("2d");
        window.carbonChart = new Chart(ctx, {
          type: "bar",
          data: {
            labels: data.dates,
            datasets: [
              {
                label: "Appliance",
                data: data.Appliance,
                backgroundColor: "rgba(0, 123, 255, 0.7)",
              },
              {
                label: "Food",
                data: data.Food,
                backgroundColor: "rgba(40, 167, 69, 0.7)",
              },
              {
                label: "Transport",
                data: data.Transport,
                backgroundColor: "rgba(220, 53, 69, 0.7)",
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: "Daily Carbon Footprint Breakdown",
              },
              tooltip: {
                mode: "index",
                intersect: false,
              },
            },
            interaction: {
              mode: "index",
              intersect: false,
            },
            scales: {
              x: {
                stacked: true,
                title: {
                  display: true,
                  text: "Date",
                },
              },
              y: {
                stacked: true,
                beginAtZero: true,
                title: {
                  display: true,
                  text: "CO₂ (kg)",
                },
              },
            },
          },
        });
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        displayChartMessage("An error occurred while retrieving data.", "danger");
        if (window.carbonChart && typeof window.carbonChart.destroy === "function") {
          window.carbonChart.destroy();
        }
      });
  });

  // Flash message function for the chart page
  function displayChartMessage(message, type) {
    const box = document.getElementById("chartMessageBox");
    box.innerHTML = `<div class="alert alert-${type}" role="alert">${message}</div>`;
    setTimeout(() => {
      box.innerHTML = "";
    }, 4000);
  }
});
