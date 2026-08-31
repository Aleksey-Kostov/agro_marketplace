document.addEventListener("DOMContentLoaded", function () {

    // ==============================
    // PHOTO PREVIEWS
    // ==============================

    function handleFileInputChange(inputId, previewId) {

        const inputElement = document.getElementById(inputId);
        const previewElement = document.getElementById(previewId);

        if (inputElement && previewElement) {

            inputElement.addEventListener("change", function () {

                const file = inputElement.files[0];

                if (file) {

                    const reader = new FileReader();

                    reader.onload = function (e) {
                        previewElement.src = e.target.result;
                    };

                    reader.readAsDataURL(file);
                }
            });
        }
    }


    handleFileInputChange("id_photo_1", "photoPreview1");
    handleFileInputChange("id_photo_2", "photoPreview2");
    handleFileInputChange("id_photo_3", "photoPreview3");
    handleFileInputChange("id_photo_4", "photoPreview4");

});
