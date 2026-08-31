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


    // ==============================
    // PRICE FIELDS
    // ==============================

    const priceTypeField =
        document.getElementById("id_price_type");

    const priceFieldsContainer =
        document.getElementById("priceFieldsContainer");

    const pricePerUnitContainer =
        document.getElementById("pricePerUnitContainer");

    const priceAllQuantityContainer =
        document.getElementById("priceAllQuantityContainer");

    const currencyContainer =
        document.getElementById("currencyContainer");


    if (
        priceTypeField &&
        priceFieldsContainer &&
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

                priceFieldsContainer.style.display = "block";

                pricePerUnitContainer.style.display = "block";

                priceAllQuantityContainer.style.display = "none";

                currencyContainer.style.display = "block";
            }


            // ==============================
            // PRICE FOR ALL QUANTITY
            // ==============================

            else if (selectedValue === "all_quantity") {

                priceFieldsContainer.style.display = "block";

                pricePerUnitContainer.style.display = "none";

                priceAllQuantityContainer.style.display = "block";

                currencyContainer.style.display = "block";
            }


            // ==============================
            // PRICE BY NEGOTIATION
            // ==============================

            else {

                priceFieldsContainer.style.display = "none";

                pricePerUnitContainer.style.display = "none";

                priceAllQuantityContainer.style.display = "none";

                currencyContainer.style.display = "none";
            }
        }


        // Change price type
        priceTypeField.addEventListener(
            "change",
            togglePriceFields
        );


        // IMPORTANT FOR EDIT
        // Run once when page loads
        // so existing saved values are displayed.
        togglePriceFields();
    }

});
