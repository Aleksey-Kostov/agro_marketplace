// Функция за рендиране на графики
function renderChart(canvasId, type, labels, datasetLabel, data, backgroundColors, borderColors) {
    var ctx = document.getElementById(canvasId).getContext('2d');
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

fetch('/api/data/')
    .then(response => response.json())
    .then(data => {
        console.log('Fetched Data:', data);

        // Активни продавачи
        renderChart(
            'activeSellersChart',
            'bar',
            data.months,
            'Active Sellers',
            data.activeSellersData,
            '#007bff', '#007bff'
        );

        // Активни купувачи
        renderChart(
            'activeBuyersChart',
            'line',
            data.months,
            'Active Buyers',
            data.activeBuyersData,
            'rgba(40, 167, 69, 0.2)', '#28a745'
        );

        // Общи продукти
        renderChart(
            'totalProductsChart',
            'pie',
            data.totalProductsLabels,
            'Total Products',
            data.totalProductsData,
            ['#33c9ff', '#33ff57', '#3357ff', '#ff33a8', '#a833ff',
                    '#ffc107', '#6f42c1', '#fd7e14', '#20c997'], '#fff'
        );
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });
