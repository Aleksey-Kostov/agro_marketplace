
 document.getElementById('id_profile_photo').addEventListener('change', function(event) {
        const reader = new FileReader();
        reader.onload = function() {
            const previewImage = document.getElementById('profile-img-preview');
            previewImage.src = reader.result;  // Update the src of the preview image
        };
        if (event.target.files[0]) {
            reader.readAsDataURL(event.target.files[0]);  // Convert the file to data URL
        }
    });