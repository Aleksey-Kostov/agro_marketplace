// Function to update message counts
function updateMessageCounts() {
    const unreadMessages = document.querySelectorAll('.message-card.unread').length;
    const readMessages = document.querySelectorAll('.message-card.read').length;

    const totalMessages = unreadMessages + readMessages;

    document.getElementById('unreadCount').setAttribute('data-count', unreadMessages);
    document.getElementById('readCount').setAttribute('data-count', readMessages);
    document.getElementById('allCount').setAttribute('data-count', totalMessages);
}


// Function to delete a message
function deleteMessage(button) {
    const messageItem = button.closest('.message-card');
    if (messageItem) {
        messageItem.remove();
        updateMessageCounts();
    }
}

document.addEventListener('DOMContentLoaded', updateMessageCounts);
