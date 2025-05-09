document.addEventListener('DOMContentLoaded', () => {
    const dateTimeElement = document.getElementById('currentDateTime');

    // Check if the element exists before proceeding
    if (!dateTimeElement) {
        console.log('Element with ID "currentDateTime" not found. Skipping date/time update.');
        return;
    }

    function updateDateTime() {
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        dateTimeElement.innerText = now.toLocaleString(undefined, options);
    }

    updateDateTime(); // Initial call to display the time
    setInterval(updateDateTime, 60000); // Update every minute
});
