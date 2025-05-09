document.addEventListener('DOMContentLoaded', function () {
    // Function to update message counts
    function updateMessageCounts() {
        // Ensure that elements are available in the DOM
        const unreadMessages = document.querySelectorAll('.message-card.unread').length || 0;
        const readMessages = document.querySelectorAll('.message-card.read').length || 0;

        const totalMessages = unreadMessages + readMessages;

        // Ensure the elements with ids 'unreadCount', 'readCount', and 'allCount' exist before setting attributes
        const unreadCountElement = document.getElementById('unreadCount');
        const readCountElement = document.getElementById('readCount');
        const allCountElement = document.getElementById('allCount');

        if (unreadCountElement) {
            unreadCountElement.setAttribute('data-count', unreadMessages);
        }

        if (readCountElement) {
            readCountElement.setAttribute('data-count', readMessages);
        }

        if (allCountElement) {
            allCountElement.setAttribute('data-count', totalMessages);
        }
    }

    // Function to delete a message
    function deleteMessage(button) {
        const messageItem = button.closest('.message-card');
        if (messageItem) {
            messageItem.remove();
            updateMessageCounts();
        }
    }

    // Initialize message counts when the DOM is loaded
    updateMessageCounts();
});
