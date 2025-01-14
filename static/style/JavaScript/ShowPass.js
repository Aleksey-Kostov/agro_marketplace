document.querySelectorAll('.toggle-password').forEach(function(toggleButton) {
    toggleButton.addEventListener('click', function() {
        let targetInput = document.querySelector(this.getAttribute('data-target'));
        let eyeIcon = this.querySelector('i');

        if (targetInput.type === 'password') {
            targetInput.type = 'text';
            eyeIcon.classList.remove('fa-eye');
            eyeIcon.classList.add('fa-eye-slash');
        } else {
            targetInput.type = 'password';
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
        }
    });
});
