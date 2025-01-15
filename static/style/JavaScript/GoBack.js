document.addEventListener('DOMContentLoaded', function () {
    // Ensure the cancelButton exists before adding the event listener
    const cancelButton = document.getElementById('cancelButton');

    if (cancelButton) {
        cancelButton.addEventListener('click', function () {
            window.history.back(); // Go to the previous page
        });
    }
});

function goBack() {
    window.history.back(); // Navigate to the previous page
}
