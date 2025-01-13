document.addEventListener('DOMContentLoaded', () => {
    function updateDateTime() {
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        document.getElementById('currentDateTime').innerText = now.toLocaleString(undefined, options);
    }
    
    updateDateTime(); // Initial call to display the time
    setInterval(updateDateTime, 60000); // Update every minute
});
