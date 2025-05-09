// Function to render a chart
function renderChart(canvasId, type, labels, datasetLabel, data, backgroundColors, borderColors) {
    const canvasElement = document.getElementById(canvasId);

    // Check if the canvas element exists
    if (!canvasElement) {
        console.warn(`Canvas with ID "${canvasId}" not found. Chart rendering skipped.`);
        return;
    }

    const ctx = canvasElement.getContext('2d');
    return new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: datasetLabel,
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Fetch data and render charts
fetch('/api/data/')
    .then(response => response.json())
    .then(data => {
        console.log('Fetched Data:', data);

        // Active Sellers Chart
        renderChart(
            'activeSellersChart', // Canvas ID
            'bar',                // Chart type
            data.months,          // Labels
            'Active Sellers',     // Dataset label
            data.activeSellersData, // Data
            '#007bff',            // Background color
            '#007bff'             // Border color
        );

        // Active Buyers Chart
        renderChart(
            'activeBuyersChart',
            'line',
            data.months,
            'Active Buyers',
            data.activeBuyersData,
            'rgba(40, 167, 69, 0.2)',
            '#28a745'
        );

        // Total Products Chart
        renderChart(
            'totalProductsChart',
            'pie',
            data.totalProductsLabels,
            'Total Products',
            data.totalProductsData,
            [
                '#33c9ff', '#33ff57', '#3357ff', '#ff33a8',
                '#a833ff', '#ffc107', '#6f42c1', '#fd7e14',
                '#20c997'
            ],
            '#fff'
        );
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });
