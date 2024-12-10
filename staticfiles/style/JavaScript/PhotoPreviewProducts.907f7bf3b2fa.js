 // Function to handle file input change and update the image preview
function handleFileInputChange(inputId, previewId) {
    const inputElement = document.getElementById(inputId);
    const previewElement = document.getElementById(previewId);

    // Ensure that the file input element exists
    if (inputElement && previewElement) {
        inputElement.addEventListener("change", () => {
            const file = inputElement.files[0];  // Get the selected file
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewElement.src = e.target.result;  // Update the preview image
                };
                reader.readAsDataURL(file);  // Read the file as a data URL
            }
        });
    }
}

// Attach event listeners to all four file inputs
document.addEventListener("DOMContentLoaded", function() {
    handleFileInputChange("id_photo_1", "photoPreview1");
    handleFileInputChange("id_photo_2", "photoPreview2");
    handleFileInputChange("id_photo_3", "photoPreview3");
    handleFileInputChange("id_photo_4", "photoPreview4");
});



document.addEventListener("DOMContentLoaded", function () {
    const priceTypeField = document.getElementById("id_price_type");
    const pricePerUnitContainer = document.getElementById("pricePerUnitContainer");
    const priceAllQuantityContainer = document.getElementById("priceAllQuantityContainer");

    function togglePriceFields() {
        const selectedValue = priceTypeField.value;

        if (selectedValue === "per_quantity") {
            pricePerUnitContainer.style.display = "block";
            priceAllQuantityContainer.style.display = "none";
        } else if (selectedValue === "all_quantity") {
            pricePerUnitContainer.style.display = "none";
            priceAllQuantityContainer.style.display = "block";
        } else if (selectedValue === "negotiation") {
            pricePerUnitContainer.style.display = "none";
            priceAllQuantityContainer.style.display = "none";
        }
    }

    priceTypeField.addEventListener("change", togglePriceFields);
    togglePriceFields();
});
