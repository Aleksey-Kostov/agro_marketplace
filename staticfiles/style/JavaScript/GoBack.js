function goBack() {
        window.history.back(); // Navigate to the previous page
    }

    // JavaScript to navigate back to the previous page when Cancel is clicked

document.getElementById('cancelButton').addEventListener('click', function () {
        window.history.back(); // Go to the previous page
    });