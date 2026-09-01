document.addEventListener("DOMContentLoaded", function () {

    // =====================================================
    // PHOTO PREVIEWS
    // =====================================================

    function handleFileInputChange(inputId, previewId) {

        const inputElement = document.getElementById(inputId);
        const previewElement = document.getElementById(previewId);

        if (!inputElement || !previewElement) {
            return;
        }

        inputElement.addEventListener("change", function () {

            const file = this.files[0];

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


    // =====================================================
    // PRICE TYPE
    // =====================================================

    const priceTypeField = document.getElementById("id_price_type");

    const unitField = document.getElementById("id_unit_of_measure");

    const priceFieldsRow = document.getElementById("priceFieldsRow");

    const pricePerUnitContainer =
        document.getElementById("pricePerUnitContainer");

    const priceAllQuantityContainer =
        document.getElementById("priceAllQuantityContainer");

    const currencyContainer =
        document.getElementById("currencyContainer");

    const pricePerUnitLabel =
        document.getElementById("pricePerUnitLabel");


    if (
        !priceTypeField ||
        !unitField ||
        !priceFieldsRow ||
        !pricePerUnitContainer ||
        !priceAllQuantityContainer ||
        !currencyContainer ||
        !pricePerUnitLabel
    ) {
        return;
    }


    // =====================================================
    // UPDATE "PRICE PER ..."
    // =====================================================

    function updatePricePerUnitLabel() {

        const selectedOption =
            unitField.options[unitField.selectedIndex];

        if (!selectedOption) {
            return;
        }

        const unitText =
            selectedOption.text.trim();

        const unitValue =
            selectedOption.value;

        let displayUnit = unitText;

        /*
         * Use short units where appropriate.
         * This makes:
         *
         * Kilograms -> KG
         * Liters    -> L
         * Pieces    -> PC
         * Boxes     -> BX
         * Tons      -> T
         * Meters    -> M
         */

        const unitMap = {
            "pc": "PC",
            "kg": "KG",
            "l": "L",
            "m": "M",
            "bx": "BX",
            "t": "T"
        };

        if (unitMap[unitValue]) {
            displayUnit = unitMap[unitValue];
        } else {
            displayUnit = unitText.toUpperCase();
        }

        pricePerUnitLabel.textContent =
            "Price Per " + displayUnit + ":";
    }


    // =====================================================
    // SHOW / HIDE PRICE FIELDS
    // =====================================================

    function togglePriceFields() {

        const selectedValue = priceTypeField.value;


        // -----------------------------------------------
        // PRICE PER UNIT
        // -----------------------------------------------

        if (selectedValue === "per_quantity") {

            priceFieldsRow.style.display = "flex";

            pricePerUnitContainer.style.display = "block";

            priceAllQuantityContainer.style.display = "none";

            currencyContainer.style.display = "block";

            updatePricePerUnitLabel();
        }


        // -----------------------------------------------
        // PRICE FOR ALL QUANTITY
        // -----------------------------------------------

        else if (selectedValue === "all_quantity") {

            priceFieldsRow.style.display = "flex";

            pricePerUnitContainer.style.display = "none";

            priceAllQuantityContainer.style.display = "block";

            currencyContainer.style.display = "block";
        }


        // -----------------------------------------------
        // PRICE BY NEGOTIATION
        // -----------------------------------------------

        else if (selectedValue === "negotiation") {

            priceFieldsRow.style.display = "none";

            pricePerUnitContainer.style.display = "none";

            priceAllQuantityContainer.style.display = "none";

            currencyContainer.style.display = "none";
        }
    }


    // =====================================================
    // EVENTS
    // =====================================================

    priceTypeField.addEventListener(
        "change",
        togglePriceFields
    );


    unitField.addEventListener(
        "change",
        function () {

            updatePricePerUnitLabel();

        }
    );


    // =====================================================
    // INITIALIZE FOR EDIT PAGE
    // =====================================================

    updatePricePerUnitLabel();

    togglePriceFields();

});
