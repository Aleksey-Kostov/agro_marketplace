
 document.addEventListener('DOMContentLoaded', function () {
    const profilePhotoInput = document.getElementById('id_profile_photo');
    const profileImgPreview = document.getElementById('profile-img-preview');

    if (profilePhotoInput && profileImgPreview) {
        profilePhotoInput.addEventListener('change', function (event) {
            const reader = new FileReader();

            reader.onload = function () {
                profileImgPreview.src = reader.result;  // Update the src of the preview image
            };

            if (event.target.files[0]) {
                reader.readAsDataURL(event.target.files[0]);  // Convert the file to data URL
            }
        });
    }
});
