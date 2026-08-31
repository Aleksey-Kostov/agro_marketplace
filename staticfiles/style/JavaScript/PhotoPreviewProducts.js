document.addEventListener("DOMContentLoaded", function () {

    // ==========================================================
    // PHOTO PREVIEWS
    // ==========================================================

    function handleFileInputChange(inputId, previewId) {

        const inputElement = document.getElementById(inputId);
        const previewElement = document.getElementById(previewId);

        if (!inputElement || !previewElement) {
            return;
        }

        inputElement.addEventListener("change", function () {

            const file = inputElement.files[0];

            if (!file) {
                return;
            }

            const reader = new FileReader();

            reader.onload = function (event) {
                previewElement.src = event.target.result;
            };

            reader.readAsDataURL(file);
        });
    }

    handleFileInputChange("id_photo_1", "photoPreview1");
    handleFileInputChange("id_photo_2", "photoPreview2");
    handleFileInputChange("id_photo_3", "photoPreview3");
    handleFileInputChange("id_photo_4", "photoPreview4");


    // ==========================================================
    // PRICE TYPE / CURRENCY
    // ==========================================================

    const priceTypeField = document.getElementById("id_price_type");
    const priceFieldsRow = document.getElementById("priceFieldsRow");

    const pricePerUnitContainer =
        document.getElementById("pricePerUnitContainer");

    const priceAllQuantityContainer =
        document.getElementById("priceAllQuantityContainer");

    const currencyContainer =
        document.getElementById("currencyContainer");


    if (
        !priceTypeField ||
        !priceFieldsRow ||
        !pricePerUnitContainer ||
        !priceAllQuantityContainer ||
        !currencyContainer
    ) {
        return;
    }


    function togglePriceFields() {

        const selectedValue = priceTypeField.value;


        // Price per unit
        if (selectedValue === "per_quantity") {

            priceFieldsRow.style.display = "flex";

            pricePerUnitContainer.style.display = "block";
            priceAllQuantityContainer.style.display = "none";

            currencyContainer.style.display = "block";
        }


        // Price for all quantity
        else if (selectedValue === "all_quantity") {

            priceFieldsRow.style.display = "flex";

            pricePerUnitContainer.style.display = "none";
            priceAllQuantityContainer.style.display = "block";

            currencyContainer.style.display = "block";
        }


        // Price by negotiation
        else {

            priceFieldsRow.style.display = "none";

            pricePerUnitContainer.style.display = "none";
            priceAllQuantityContainer.style.display = "none";

            currencyContainer.style.display = "none";
        }
    }


    priceTypeField.addEventListener(
        "change",
        togglePriceFields
    );


    // Needed when editing an existing object
    togglePriceFields();

});
