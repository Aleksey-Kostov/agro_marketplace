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
    // PRICE TYPE
    // ==============================

    const priceTypeField =
        document.getElementById("id_price_type");

    const pricePerUnitContainer =
        document.getElementById("pricePerUnitContainer");

    const priceAllQuantityContainer =
        document.getElementById("priceAllQuantityContainer");

    const currencyContainer =
        document.getElementById("currencyContainer");

    const currencyPerUnitPlace =
        document.getElementById("currencyPerUnitPlace");

    const currencyAllQuantityPlace =
        document.getElementById("currencyAllQuantityPlace");


    // Check that all required elements exist
    if (
        priceTypeField &&
        pricePerUnitContainer &&
        priceAllQuantityContainer &&
        currencyContainer &&
        currencyPerUnitPlace &&
        currencyAllQuantityPlace
    ) {


        // ==============================
        // TOGGLE PRICE FIELDS
        // ==============================

        function togglePriceFields() {

            const selectedValue = priceTypeField.value;


            // ------------------------------
            // PRICE PER UNIT
            // ------------------------------

            if (selectedValue === "per_quantity") {

                pricePerUnitContainer.style.display = "block";

                priceAllQuantityContainer.style.display = "none";


                // Move currency into Price Per Unit row
                currencyPerUnitPlace.appendChild(currencyContainer);

                currencyContainer.style.display = "block";
            }


            // ------------------------------
            // PRICE FOR ALL QUANTITY
            // ------------------------------

            else if (selectedValue === "all_quantity") {

                pricePerUnitContainer.style.display = "none";

                priceAllQuantityContainer.style.display = "block";


                // Move currency into Price All Quantity row
                currencyAllQuantityPlace.appendChild(currencyContainer);

                currencyContainer.style.display = "block";
            }


            // ------------------------------
            // PRICE BY NEGOTIATION
            // ------------------------------

            else if (selectedValue === "negotiation") {

                pricePerUnitContainer.style.display = "none";

                priceAllQuantityContainer.style.display = "none";

                // Hide currency completely
                currencyContainer.style.display = "none";
            }
        }


        // ==============================
        // CHANGE EVENT
        // ==============================

        priceTypeField.addEventListener(
            "change",
            togglePriceFields
        );


        // ==============================
        // IMPORTANT FOR EDIT
        // ==============================

        // Detect current saved price type
        // when the edit page opens.
        togglePriceFields();

    }

});
