//=====================================================
// GST Billing System - app.js
// Change WEB_APP_URL after deploying Google Apps Script
//=====================================================

// Dummy URL (Replace with your Google Apps Script URL)
const WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec";

//-----------------------------------------------------
// Global Arrays
//-----------------------------------------------------

let customers = [];
let products = [];

//-----------------------------------------------------
// On Page Load
//-----------------------------------------------------

window.onload = function () {

    generateInvoiceNo();

    document.getElementById("invoiceDate").value =
        new Date().toISOString().split("T")[0];

    loadCustomers();

    loadProducts();

};

//-----------------------------------------------------
// Generate Invoice Number
//-----------------------------------------------------

function generateInvoiceNo() {

    let d = new Date();

    let invoice =
        "INV" +
        d.getFullYear() +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0") +
        "-" +
        Math.floor(Math.random() * 9000 + 1000);

    document.getElementById("invoiceNo").value = invoice;

}

//-----------------------------------------------------
// Load Customers
//-----------------------------------------------------

function loadCustomers() {

    fetch(WEB_APP_URL + "?action=customers")

        .then(res => res.json())

        .then(data => {

            customers = data;

            let dropdown = document.getElementById("customerSelect");

            dropdown.innerHTML =
                '<option value="">Select Customer</option>';

            customers.forEach((customer, index) => {

                let option = document.createElement("option");

                option.value = index;

                option.textContent = customer.CustomerName;

                dropdown.appendChild(option);

            });

        })

        .catch(error => {

            console.log(error);

            alert("Unable to load customers.");

        });

}

//-----------------------------------------------------
// Load Products
//-----------------------------------------------------

function loadProducts() {

    fetch(WEB_APP_URL + "?action=products")

        .then(res => res.json())

        .then(data => {

            products = data;

            let dropdown = document.getElementById("productSelect");

            dropdown.innerHTML =
                '<option value="">Select Product</option>';

            products.forEach((product, index) => {

                let option = document.createElement("option");

                option.value = index;

                option.textContent = product.ProductName;

                dropdown.appendChild(option);

            });

        })

        .catch(error => {

            console.log(error);

            alert("Unable to load products.");

        });

}

//-----------------------------------------------------
// Customer Selection
//-----------------------------------------------------

document
    .getElementById("customerSelect")
    .addEventListener("change", function () {

        if (this.value === "") return;

        let customer = customers[this.value];

        document.getElementById("customerGST").value =
            customer.GSTIN;

        document.getElementById("customerAddress").value =
            customer.Address;

    });

//-----------------------------------------------------
// Product Selection
//-----------------------------------------------------

document
    .getElementById("productSelect")
    .addEventListener("change", function () {

        if (this.value === "") return;

        let product = products[this.value];

        document.getElementById("hsn").value =
            product.HSN;

        document.getElementById("gstRate").value =
            product.GST;

        document.getElementById("rate").value =
            product.Rate;

        calculateBill();

    });

//-----------------------------------------------------
// Quantity Change
//-----------------------------------------------------

document
    .getElementById("qty")
    .addEventListener("input", calculateBill);

//-----------------------------------------------------
// Bill Calculation
//-----------------------------------------------------

function calculateBill() {

    let qty =
        Number(document.getElementById("qty").value);

    let rate =
        Number(document.getElementById("rate").value);

    let gst =
        Number(document.getElementById("gstRate").value);

    let taxable = qty * rate;

    let gstAmount = taxable * gst / 100;

    let grandTotal = taxable + gstAmount;

    document.getElementById("amount").value =
        taxable.toFixed(2);

    document.getElementById("taxableAmount").value =
        taxable.toFixed(2);

    document.getElementById("gstAmount").value =
        gstAmount.toFixed(2);

    document.getElementById("grandTotal").value =
        grandTotal.toFixed(2);

}

//-----------------------------------------------------
// Save Bill
//-----------------------------------------------------

document
    .getElementById("invoiceForm")
    .addEventListener("submit", function (e) {

        e.preventDefault();

        let invoice = {

            InvoiceNo:
                document.getElementById("invoiceNo").value,

            InvoiceDate:
                document.getElementById("invoiceDate").value,

            Customer:
                document.getElementById("customerSelect").selectedOptions[0].text,

            GSTIN:
                document.getElementById("customerGST").value,

            Address:
                document.getElementById("customerAddress").value,

            Product:
                document.getElementById("productSelect").selectedOptions[0].text,

            HSN:
                document.getElementById("hsn").value,

            GST:
                document.getElementById("gstRate").value,

            Rate:
                document.getElementById("rate").value,

            Qty:
                document.getElementById("qty").value,

            Amount:
                document.getElementById("amount").value,

            TaxableAmount:
                document.getElementById("taxableAmount").value,

            GSTAmount:
                document.getElementById("gstAmount").value,

            GrandTotal:
                document.getElementById("grandTotal").value,

            Remarks:
                document.getElementById("remarks").value

        };

        fetch(WEB_APP_URL, {

            method: "POST",

            body: JSON.stringify(invoice)

        })

            .then(res => res.text())

            .then(result => {

                alert("GST Bill Saved Successfully.");

                document.getElementById("invoiceForm").reset();

                generateInvoiceNo();

                document.getElementById("invoiceDate").value =
                    new Date().toISOString().split("T")[0];

                document.getElementById("customerGST").value = "";
                document.getElementById("customerAddress").value = "";
                document.getElementById("hsn").value = "";
                document.getElementById("gstRate").value = "";
                document.getElementById("rate").value = "";
                document.getElementById("amount").value = "";
                document.getElementById("taxableAmount").value = "";
                document.getElementById("gstAmount").value = "";
                document.getElementById("grandTotal").value = "";

            })

            .catch(error => {

                console.log(error);

                alert("Unable to save bill.");

            });

    });
