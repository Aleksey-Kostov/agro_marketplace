document.addEventListener("DOMContentLoaded", function () {

    // ==============================
    // PHOTO PREVIEWS
    // ==============================

    function handleFileInputChange(inputId, previewId) {
        const inputElement = document.getElementById(inputId);
        const previewElement = document.getElementById(previewId);

        if (inputElement && previewElement) {
            inputElement.addEventListener("change", () => {
                const file = inputElement.files[0];

                if (file) {
                    const reader = new FileReader();

                    reader.onload = (e) => {
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


    // ==============================
    // PRICE TYPE
    // ==============================

    const priceTypeField = document.getElementById("id_price_type");
    const priceFieldsRow = document.getElementById("priceFieldsRow");

    const pricePerUnitContainer =
        document.getElementById("pricePerUnitContainer");

    const priceAllQuantityContainer =
        document.getElementById("priceAllQuantityContainer");

    const currencyContainer =
        document.getElementById("currencyContainer");


    if (
        priceTypeField &&
        priceFieldsRow &&
        pricePerUnitContainer &&
        priceAllQuantityContainer &&
        currencyContainer
    ) {

        function togglePriceFields() {

            const selectedValue = priceTypeField.value;


            // ==============================
            // PRICE PER UNIT
            // ==============================

            if (selectedValue === "per_quantity") {

                priceFieldsRow.style.display = "flex";

                pricePerUnitContainer.style.display = "block";
                priceAllQuantityContainer.style.display = "none";
                currencyContainer.style.display = "block";
            }


            // ==============================
            // PRICE FOR ALL QUANTITY
            // ==============================

            else if (selectedValue === "all_quantity") {

                priceFieldsRow.style.display = "flex";

                pricePerUnitContainer.style.display = "none";
                priceAllQuantityContainer.style.display = "block";
                currencyContainer.style.display = "block";
            }


            // ==============================
            // NEGOTIATION
            // ==============================

            else if (selectedValue === "negotiation") {

                priceFieldsRow.style.display = "none";

                pricePerUnitContainer.style.display = "none";
                priceAllQuantityContainer.style.display = "none";
                currencyContainer.style.display = "none";
            }
        }


        priceTypeField.addEventListener("change", togglePriceFields);

        // Important for Edit
        togglePriceFields();
    }

});
