import { createIcons, Search, Camera, ShoppingCart, Plus, PackageOpen, Printer, X, Settings, Zap, Download, Pencil, TriangleAlert } from 'lucide';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { CartManager, syncDiscounts } from './cart';
import { ScannerManager } from './scanner';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker for PWA (Installable App)
const updateSW = registerSW({
  onNeedRefresh() {},
  onOfflineReady() {},
});

// Initialize Lucide
createIcons({
    icons: { Search, Camera, ShoppingCart, Plus, PackageOpen, Printer, X, Settings, Zap, Download, Pencil, TriangleAlert }
});

// Haptic Feedback Helper
function vibrate(ms = 50) {
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(ms);
    }
}

// Enterprise Metadata
const ENTERPRISE = {
    nome: "PDV Torres",
    endereco: "Av. Principal, 1000 - Centro",
    contato: "(11) 99999-9999 / WhatsApp"
};

// State Management
let products = JSON.parse(localStorage.getItem('products')) || [];
let currentOrder = JSON.parse(localStorage.getItem('current_order')) || [];
let selectedProduct = null;
let paymentType = 'DINHEIRO';
let orderType = 'ORCAMENTO'; // 'ORCAMENTO' or 'PEDIDO'

// DOM Elements
const productSearch = document.getElementById('product-search');
const searchResults = document.getElementById('search-results');
const inputQnty = document.getElementById('input-qnty');
const inputPrice = document.getElementById('input-price');
const inputTotal = document.getElementById('input-total');
const inputDiscountVal = document.getElementById('input-discount-val');
const inputDiscountPct = document.getElementById('input-discount-pct');
const inputFinalPrice = document.getElementById('input-final-price');
const btnAddItem = document.getElementById('btn-add-item');
const cartList = document.getElementById('cart-list');
const cartCount = document.getElementById('cart-count');
const displayVendedor = document.getElementById('display-vendedor');
const currentDatetime = document.getElementById('current-datetime');

// Configs
let configIp = localStorage.getItem('config_ip') || 'localhost';
let configSeller = localStorage.getItem('config_seller') || '';
let configPixKey = localStorage.getItem('config_pix_key') || '81997834549';

// Apply Initial Configs
if (displayVendedor) displayVendedor.textContent = configSeller || "Sanzony";

// Initialize Managers
const cart = new CartManager(cartList, cartCount);
const scanner = new ScannerManager('reader', (code) => {
    const product = products.find(p => p.code === code || p.barcode === code);
    if (product) {
        selectProduct(product);
        vibrate(100);
    } else {
        alert("Produto não encontrado: " + code);
    }
});

// --- Tab System ---
const tabs = document.querySelectorAll('.btn-tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(target).classList.add('active');
        vibrate(30);
    });
});

// --- UI Clocks ---
function updateClock() {
    const now = new Date();
    currentDatetime.textContent = now.toLocaleString('pt-BR');
}
setInterval(updateClock, 1000);
updateClock();

// --- Summary Accordion Logic ---
const summaryAccordion = document.getElementById('summary-accordion');
const btnToggleSummary = document.getElementById('btn-toggle-summary');

btnToggleSummary.addEventListener('click', () => {
    summaryAccordion.classList.toggle('collapsed');
    vibrate(30);
});

// --- Order Type & Payment Selection ---
const btnOrcamento = document.getElementById('type-orcamento');
const btnPedido = document.getElementById('type-pedido');
const paymentButtons = document.querySelectorAll('.btn-payment');

btnOrcamento.addEventListener('click', () => {
    orderType = 'ORCAMENTO';
    btnOrcamento.classList.add('active');
    btnPedido.classList.remove('active');
    vibrate(30);
});

btnPedido.addEventListener('click', () => {
    orderType = 'PEDIDO';
    btnPedido.classList.add('active');
    btnOrcamento.classList.remove('active');
    vibrate(30);
});

paymentButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        paymentType = btn.dataset.value;
        paymentButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        vibrate(30);
    });
});

// --- Product Search & Selection ---
const btnScan = document.getElementById('btn-scan');

productSearch.addEventListener('focus', () => {
    vibrate(20);
    document.body.classList.add('searching-mode');
    btnScan.innerHTML = `<i data-lucide="x"></i>`;
    createIcons({ icons: { X } });
});

function exitSearchMode() {
    document.body.classList.remove('searching-mode');
    btnScan.innerHTML = `<i data-lucide="camera"></i>`;
    createIcons({ icons: { Camera } });
    searchResults.classList.add('hidden');
}

btnScan.addEventListener('click', (e) => {
    if (document.body.classList.contains('searching-mode')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        exitSearchMode();
        productSearch.value = '';
        productSearch.blur();
    }
});

productSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    if (term.length < 1) {
        searchResults.classList.add('hidden');
        return;
    }

    const filtered = products.filter(p => 
        (p.name && p.name.toLowerCase().includes(term)) || 
        (p.code && p.code.toLowerCase().includes(term))
    ).slice(0, 15);

    renderSearchResults(filtered);
});

function renderSearchResults(results) {
    searchResults.classList.remove('hidden');
    
    if (products.length === 0) {
        searchResults.innerHTML = `
            <div class="search-item" style="text-align: center; padding: 2rem;">
                <p style="color: var(--primary); font-weight: 700;">Catálogo Vazio!</p>
                <p style="font-size: 0.8rem; color: var(--text-muted);">Vá na Engrenagem ⚙️ e suba o seu Excel.</p>
            </div>`;
        return;
    }

    if (results.length === 0) {
        searchResults.innerHTML = `
            <div class="search-item" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                Nenhum produto encontrado.
            </div>`;
        return;
    }

    searchResults.innerHTML = results.map(p => `
        <div class="search-item" data-code="${p.code}">
            <span class="name">${p.name}</span>
            <span class="meta">Cód: ${p.code} | Estoque: ${p.stock || 0} | R$ ${parseFloat(p.price || 0).toFixed(2)}</span>
        </div>
    `).join('');

    searchResults.querySelectorAll('.search-item').forEach(el => {
        el.addEventListener('click', () => {
            const code = el.dataset.code;
            const product = products.find(p => p.code === code);
            selectProduct(product);
        });
    });
}

function selectProduct(product) {
    selectedProduct = product;
    productSearch.value = product.name;
    inputPrice.value = parseFloat(product.price).toFixed(2);
    inputQnty.value = 1;
    inputDiscountVal.value = '';
    inputDiscountPct.value = '';
    
    updateInsertionTotals();
    exitSearchMode();
}

// --- Insertion Totals & Discount Logic ---
function updateInsertionTotals(source = 'calc') {
    if (!selectedProduct) return;

    const price = parseFloat(inputPrice.value) || 0;
    const qnty = parseFloat(inputQnty.value) || 0;
    const gross = price * qnty;

    inputTotal.value = gross.toFixed(2);

    if (source === 'val') {
        const sync = syncDiscounts(price, qnty, 'val', inputDiscountVal.value);
        inputDiscountPct.value = sync.pct;
        inputDiscountVal.value = sync.val;
    } else if (source === 'pct') {
        const sync = syncDiscounts(price, qnty, 'pct', inputDiscountPct.value);
        inputDiscountVal.value = sync.val;
        inputDiscountPct.value = sync.pct;
    }

    const discount = parseFloat(inputDiscountVal.value) || 0;
    const final = gross - discount;
    inputFinalPrice.value = final.toFixed(2);
}

inputQnty.addEventListener('input', () => updateInsertionTotals('pct'));
inputDiscountVal.addEventListener('input', () => updateInsertionTotals('val'));
inputDiscountPct.addEventListener('input', () => updateInsertionTotals('pct'));

// --- Cart Operations ---
btnAddItem.addEventListener('click', () => {
    if (!selectedProduct) return;
    
    const item = {
        code: selectedProduct.code,
        name: selectedProduct.name,
        price: parseFloat(inputPrice.value),
        qnty: parseFloat(inputQnty.value),
        discount: parseFloat(inputDiscountVal.value) || 0
    };

    cart.addItem(item);
    vibrate(50);
    
    // Clear form
    selectedProduct = null;
    productSearch.value = '';
    inputQnty.value = 1;
    inputPrice.value = '';
    inputTotal.value = '';
    inputDiscountVal.value = '';
    inputDiscountPct.value = '';
    inputFinalPrice.value = '';
    
    // Switch to cart tab if mobile
    if (window.innerWidth < 768) {
        document.getElementById('tab-venda').click();
    }
    
    updateGlobalTotals();
});

// --- Global Totals & Print ---
const inputTotalFinal = document.getElementById('input-total-final');

function updateGlobalTotals() {
    const totals = cart.getTotals();
    
    document.getElementById('total-gross').textContent = `R$ ${totals.gross.toFixed(2)}`;
    document.getElementById('total-discount').textContent = `R$ ${totals.discount.toFixed(2)}`;
    
    // Automatic adjustment handling (Rounding)
    const finalRounded = Math.round(totals.final * 10) / 10;
    const adjustment = finalRounded - totals.final;
    
    const rowAdjustment = document.getElementById('row-adjustment');
    if (Math.abs(adjustment) > 0.01) {
        rowAdjustment.classList.remove('hidden');
        document.getElementById('total-adjustment').textContent = `R$ ${adjustment.toFixed(2)}`;
    } else {
        rowAdjustment.classList.add('hidden');
    }

    inputTotalFinal.value = finalRounded.toFixed(2);
    
    // Update Header
    document.getElementById('total-gross-header').textContent = `R$ ${totals.gross.toFixed(2)}`;
    document.getElementById('total-discount-header').textContent = `R$ ${totals.discount.toFixed(2)}`;
    document.getElementById('total-final-header').textContent = `R$ ${finalRounded.toFixed(2)}`;
}

// Global hook for cart changes
window.addEventListener('cart-updated', updateGlobalTotals);

// --- Config & Import ---
const importModal = document.getElementById('import-modal');
const btnOpenImport = document.getElementById('btn-open-import');
const btnProcessImport = document.getElementById('btn-process-import');
const csvFile = document.getElementById('csv-file');
const inputConfigIp = document.getElementById('config-ip');
const inputConfigSeller = document.getElementById('config-seller');
const inputConfigPixKey = document.getElementById('config-pix-key');

// Load configs
inputConfigIp.value = configIp;
inputConfigSeller.value = configSeller;
inputConfigPixKey.value = configPixKey;

btnOpenImport.addEventListener('click', () => {
    importModal.classList.remove('hidden');
    vibrate(30);
});

document.getElementById('close-import').addEventListener('click', () => importModal.classList.add('hidden'));

btnProcessImport.addEventListener('click', () => {
    vibrate(50);
    configIp = inputConfigIp.value || 'localhost';
    configSeller = inputConfigSeller.value || '';
    configPixKey = inputConfigPixKey.value || '81997834549';

    localStorage.setItem('config_ip', configIp);
    localStorage.setItem('config_seller', configSeller);
    localStorage.setItem('config_pix_key', configPixKey);
    if (displayVendedor) displayVendedor.textContent = configSeller || "Sanzony";

    const file = csvFile.files[0];
    if (file) {
        const reader = new FileReader();
        const extension = file.name.split('.').pop().toLowerCase();

        const processResults = (data) => {
            const mapped = data.map(row => ({
                code: String(row['Código Produto'] || row.código || row.codigo || row.code || '').trim(),
                name: String(row['Nome Produto'] || row.nome || row.name || '').trim(),
                price: parseFloat(String(row['Unitário'] || row.preço || row.preco || row.price || '0').replace(',', '.')),
                stock: parseInt(row['Estoque'] || row.estoque || row.stock || 0)
            })).filter(p => p.code && p.name && !isNaN(p.price));

            if (mapped.length > 0) {
                products = mapped;
                localStorage.setItem('products', JSON.stringify(products));
                alert(`Sucesso! ${products.length} produtos importados.`);
                importModal.classList.add('hidden');
            } else {
                alert("Erro: Nenhum produto válido encontrado.");
            }
        };

        if (extension === 'xlsx' || extension === 'xls') {
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                processResults(jsonData);
            };
            reader.readAsArrayBuffer(file);
        } else {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    processResults(results.data);
                }
            });
        }
    } else {
        alert("Configurações salvas.");
        importModal.classList.add('hidden');
    }
});

// --- Printing Logic ---
const btnPrint = document.getElementById('btn-print');
const successScreen = document.getElementById('success-screen');
const successMsg = document.getElementById('success-msg');
const btnNextOrder = document.getElementById('btn-next-order');

btnPrint.addEventListener('click', async () => {
    if (cart.items.length === 0) {
        document.getElementById('empty-cart-modal').classList.remove('hidden');
        return;
    }

    vibrate(100);
    const orderData = {
        empresa: ENTERPRISE,
        vendedor: configSeller,
        cliente: document.getElementById('client-name').value,
        data: new Date().toLocaleString('pt-BR'),
        tipo: orderType,
        pagamento: paymentType,
        items: cart.items,
        subtotal: cart.getTotals().gross,
        desconto: cart.getTotals().discount,
        total: parseFloat(inputTotalFinal.value),
        pixKey: configPixKey
    };

    const serverUrl = `https://${configIp}/imprimir`;

    try {
        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(orderData)
        });

        if (response.ok) {
            successMsg.textContent = `${orderType} enviado com sucesso!`;
            successScreen.classList.remove('hidden');
        } else {
            throw new Error("Erro no servidor");
        }
    } catch (err) {
        console.error("Erro na impressão remota:", err);
        window.print(); // Fallback to browser print
    }
});

btnNextOrder.addEventListener('click', () => {
    cart.clear();
    updateGlobalTotals();
    successScreen.classList.add('hidden');
    document.getElementById('tab-produtos').click();
    vibrate(50);
});

// --- Modal Closers ---
document.getElementById('close-empty-cart').addEventListener('click', () => {
    document.getElementById('empty-cart-modal').classList.add('hidden');
});

// Confirmation for Clear Order
const btnClearOrder = document.getElementById('btn-clear-order');
const confirmClearModal = document.getElementById('confirm-clear-modal');
const btnCancelClear = document.getElementById('btn-cancel-clear');
const btnConfirmClear = document.getElementById('btn-confirm-clear');

btnClearOrder.addEventListener('click', () => {
    confirmClearModal.classList.remove('hidden');
    vibrate(30);
});

btnCancelClear.addEventListener('click', () => confirmClearModal.classList.add('hidden'));

btnConfirmClear.addEventListener('click', () => {
    cart.clear();
    updateGlobalTotals();
    confirmClearModal.classList.add('hidden');
    vibrate(100);
});
