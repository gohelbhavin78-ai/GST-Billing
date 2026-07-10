// REPLACE WITH YOUR ACTIVE DEPLOYED GOOGLE APPS SCRIPT WEB APP URL
const APPS_SCRIPT_ENDPOINT = "https://script.google.com/macros/s/AKfycbwYnovGrXZi_tSo3YRQzPpvm1K33kZbCppCLGGeKlvTNQRGk8fcvEqGVqdvJbPSxoCB/exec";

let globalCustomerRegistry = {};
let globalProductRegistry = {};

document.getElementById('invoiceDate').valueAsDate = new Date();
window.addEventListener('DOMContentLoaded', () => { initializeRemoteDataPipelines(); });

function switchView(viewId, btnElement) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active-view'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(viewId).classList.add('active-view');
    btnElement.classList.add('active');
}

function initializeRemoteDataPipelines() {
    fetch(`${APPS_SCRIPT_ENDPOINT}?action=getNextInvoiceNo`)
        .then(res => res.json())
        .then(data => { document.getElementById('invoiceNo').value = data.nextInvoiceNo; })
        .catch(() => { document.getElementById('invoiceNo').value = "INV-" + Math.floor(1000 + Math.random() * 9000); });

    fetch(`${APPS_SCRIPT_ENDPOINT}?action=getCustomers`)
        .then(res => res.json())
        .then(data => {
            const dropdown = document.getElementById('customerDropdown');
            dropdown.innerHTML = '<option value="">-- Choose Profile Registration --</option>';
            globalCustomerRegistry = {};
            data.forEach(customer => {
                globalCustomerRegistry[customer.id] = customer;
                let opt = document.createElement('option');
                opt.value = customer.id;
                opt.textContent = customer.name;
                dropdown.appendChild(opt);
            });
        }).catch(err => console.warn("Customer dataset dropped.", err));

    fetch(`${APPS_SCRIPT_ENDPOINT}?action=getProducts`)
        .then(res => res.json())
        .then(data => {
            globalProductRegistry = {};
            data.forEach(prod => { globalProductRegistry[prod.id] = prod; });
            document.getElementById('lineItemContainer').innerHTML = '';
            appendProductRow();
        }).catch(err => { console.warn("Product dataset dropped.", err); appendProductRow(); });
}

function autoFillCustomerMetrics(id) {
    const client = globalCustomerRegistry[id];
    document.getElementById('custGstin').value = client ? client.gstin : '';
    document.getElementById('custContact').value = client ? client.contact : '';
    document.getElementById('custAddress').value = client ? client.address : '';
}

function appendProductRow() {
    const tbody = document.getElementById('lineItemContainer');
    const rank = tbody.rows.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="w-sr item-rank">${rank}</td>
        <td>
            <select class="field-prod-id" onchange="autoFillProductRowMetrics(this)">
                <option value="">-- Select Product --</option>
                ${Object.values(globalProductRegistry).map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
        </td>
        <td><input type="text" class="field-hsn" readonly></td>
        <td><input type="number" class="field-mrp" step="0.01" oninput="executeReverseTaxMathematics(this)"></td>
        <td><input type="number" class="field-rate" step="0.01" oninput="executeReverseTaxMathematics(this)"></td>
        <td><input type="number" class="field-cgst-pct" readonly value="0"></td>
        <td><input type="text" class="field-cgst-amt" readonly value="0.00"></td>
        <td><input type="number" class="field-sgst-pct" readonly value="0"></td>
        <td><input type="text" class="field-sgst-amt" readonly value="0.00"></td>
        <td><input type="number" class="field-qty" value="1" min="1" oninput="executeReverseTaxMathematics(this)"></td>
        <td><input type="text" class="field-total-amt w-amt" readonly value="0.00"></td>
        <td class="col-action" style="text-align:center;"><button class="btn-del" onclick="purgeTargetRow(this)">X</button></td>
    `;
    tbody.appendChild(tr);
}

function purgeTargetRow(btn) { btn.closest('tr').remove(); realignRowIndices(); collateBillSummaryTotals(); }
function realignRowIndices() { document.querySelectorAll('#lineItemContainer tr').forEach((row, i) => { row.querySelector('.item-rank').textContent = i + 1; }); }

function autoFillProductRowMetrics(selectDom) {
    const row = selectDom.closest('tr');
    const item = globalProductRegistry[selectDom.value];
    if (item) {
        row.querySelector('.field-hsn').value = item.hsn;
        row.querySelector('.field-mrp').value = parseFloat(item.mrp).toFixed(2);
        row.querySelector('.field-rate').value = parseFloat(item.rate || item.mrp).toFixed(2);
        
        const splitTaxRate = parseFloat(item.gstPct || 0) / 2;
        row.querySelector('.field-cgst-pct').value = splitTaxRate;
        row.querySelector('.field-sgst-pct').value = splitTaxRate;
    } else {
        row.querySelector('.field-hsn').value = ''; row.querySelector('.field-mrp').value = ''; row.querySelector('.field-rate').value = '0.00';
        row.querySelector('.field-cgst-pct').value = 0; row.querySelector('.field-sgst-pct').value = 0;
    }
    executeReverseTaxMathematics(selectDom);
}

// Fixed Calculations Engine: GST derived from MRP, added straight to selling rate.
function executeReverseTaxMathematics(element) {
    const row = element.closest('tr');
    const mrpInclusive = parseFloat(row.querySelector('.field-mrp').value) || 0;
    const sellingRate = parseFloat(row.querySelector('.field-rate').value) || 0;
    const cgstPct = parseFloat(row.querySelector('.field-cgst-pct').value) || 0;
    const sgstPct = parseFloat(row.querySelector('.field-sgst-pct').value) || 0;
    const totalGstPercentage = cgstPct + sgstPct;
    const quantity = parseFloat(row.querySelector('.field-qty').value) || 0;

    // 1. Find raw GST value hidden inside the standard MRP baseline metric rules
    const baseExclRateFromMrp = mrpInclusive / (1 + (totalGstPercentage / 100));
    const absoluteGstValuePerItem = mrpInclusive - baseExclRateFromMrp;
    
    // 2. Fragment tax fields down into discrete accounting targets
    const cgstLineTotal = (absoluteGstValuePerItem / 2) * quantity;
    const sgstLineTotal = (absoluteGstValuePerItem / 2) * quantity;
    
    // 3. Gross Line Pricing Formula Rules Definition: (Selling Rate + Extracted MRP GST Component Value) * Qty
    const calculatedLineTotalGross = (sellingRate + absoluteGstValuePerItem) * quantity;

    row.querySelector('.field-cgst-amt').value = cgstLineTotal.toFixed(2);
    row.querySelector('.field-sgst-amt').value = sgstLineTotal.toFixed(2);
    row.querySelector('.field-total-amt').value = calculatedLineTotalGross.toFixed(2);
    collateBillSummaryTotals();
}

function collateBillSummaryTotals() {
    let totalRateAccumulator = 0, totalCgstAccumulator = 0, totalSgstAccumulator = 0, totalGrandAccumulator = 0;
    
    document.querySelectorAll('#lineItemContainer tr').forEach(row => {
        const lineQty = parseFloat(row.querySelector('.field-qty').value) || 0;
        const sellingRate = parseFloat(row.querySelector('.field-rate').value) || 0;
        const cgstAmt = parseFloat(row.querySelector('.field-cgst-amt').value) || 0;
        const sgstAmt = parseFloat(row.querySelector('.field-sgst-amt').value) || 0;
        const totalLineGross = parseFloat(row.querySelector('.field-total-amt').value) || 0;

        totalRateAccumulator += (sellingRate * lineQty);
        totalCgstAccumulator += cgstAmt;
        totalSgstAccumulator += sgstAmt;
        totalGrandAccumulator += totalLineGross;
    });

    document.getElementById('summaryTaxable').textContent = `₹${totalRateAccumulator.toFixed(2)}`;
    document.getElementById('summaryCgst').textContent = `₹${totalCgstAccumulator.toFixed(2)}`;
    document.getElementById('summarySgst').textContent = `₹${totalSgstAccumulator.toFixed(2)}`;
    document.getElementById('summaryGrand').textContent = `₹${totalGrandAccumulator.toFixed(2)}`;
}

function dispatchInvoiceToSheets() {
    const targetCustomerSelect = document.getElementById('customerDropdown');
    if (!document.getElementById('invoiceNo').value || !targetCustomerSelect.value) {
        alert("Validation Error: Verification fields incomplete."); return;
    }
    const activeLineItemsPayload = [];
    document.querySelectorAll('#lineItemContainer tr').forEach(row => {
        const pId = row.querySelector('.field-prod-id').value;
        if(pId) {
            activeLineItemsPayload.push({
                productId: pId,
                productName: row.querySelector('.field-prod-id').options[row.querySelector('.field-prod-id').selectedIndex].text,
                hsn: row.querySelector('.field-hsn').value,
                mrp: row.querySelector('.field-mrp').value,
                rate: row.querySelector('.field-rate').value,
                cgstPct: row.querySelector('.field-cgst-pct').value,
                cgstAmt: row.querySelector('.field-cgst-amt').value,
                sgstPct: row.querySelector('.field-sgst-pct').value,
                sgstAmt: row.querySelector('.field-sgst-amt').value,
                qty: row.querySelector('.field-qty').value,
                amount: row.querySelector('.field-total-amt').value
            });
        }
    });

    fetch(APPS_SCRIPT_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "saveInvoice",
            invoiceNo: document.getElementById('invoiceNo').value,
            invoiceDate: document.getElementById('invoiceDate').value,
            customerName: targetCustomerSelect.options[targetCustomerSelect.selectedIndex].text,
            customerGstin: document.getElementById('custGstin').value,
            totalTaxable: document.getElementById('summaryTaxable').textContent.replace('₹', ''),
            totalCgst: document.getElementById('summaryCgst').textContent.replace('₹', ''),
            totalSgst: document.getElementById('summarySgst').textContent.replace('₹', ''),
            grandTotal: document.getElementById('summaryGrand').textContent.replace('₹', ''),
            items: activeLineItemsPayload
        })
    }).then(() => { 
        alert("Invoice successfully dispatched!"); 
        flushFormLayout(); 
    });
}

function submitNewCustomer(e) {
    e.preventDefault();
    fetch(APPS_SCRIPT_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "addCustomer",
            id: document.getElementById('newCustId').value,
            name: document.getElementById('newCustName').value,
            gstin: document.getElementById('newCustGstin').value,
            contact: document.getElementById('newCustContact').value,
            address: document.getElementById('newCustAddress').value
        })
    }).then(() => {
        alert("Customer database registry updated!");
        document.getElementById('customerForm').reset();
        initializeRemoteDataPipelines();
        switchView('invoiceView', document.querySelector('.nav-btn'));
    });
}

function submitNewProduct(e) {
    e.preventDefault();
    fetch(APPS_SCRIPT_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "addProduct",
            id: document.getElementById('newProdId').value,
            name: document.getElementById('newProdName').value,
            hsn: document.getElementById('newProdHsn').value,
            mrp: document.getElementById('newProdMrp').value,
            rate: document.getElementById('newProdRate').value, // Transmitted Selling Price Field Metric
            gstPct: document.getElementById('newProdGst').value
        })
    }).then(() => {
        alert("Product specification ledger logs updated!");
        document.getElementById('productForm').reset();
        initializeRemoteDataPipelines();
        switchView('invoiceView', document.querySelector('.nav-btn'));
    });
}

function flushFormLayout() {
    autoFillCustomerMetrics('');
    document.getElementById('customerDropdown').value = '';
    document.getElementById('lineItemContainer').innerHTML = '';
    initializeRemoteDataPipelines();
}
