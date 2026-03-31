import { createIcons, Search, Camera, ShoppingCart, Plus, PackageOpen, Printer, X, Settings, Zap, Download, Pencil, TriangleAlert, Trash2 } from 'lucide';
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
    icons: { Search, Camera, ShoppingCart, Plus, PackageOpen, Printer, X, Settings, Zap, Download, Pencil, TriangleAlert, Trash2 }
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
let selectedProduct = null;
let paymentType = 'DINHEIRO';
let orderType = 'ORCAMENTO';
let itemToRemoveId = null;

// Configs
let configIp = localStorage.getItem('config_ip') || 'localhost';
let configSeller = localStorage.getItem('config_seller') || '';
let configPixKey = localStorage.getItem('config_pix_key') || '81997834549';

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
const btnCancelSearch = document.getElementById('btn-cancel-search');
const inputTotalFinal = document.getElementById('input-total-final');

// Apply Initial Configs
if (displayVendedor) displayVendedor.textContent = configSeller || "Sanzony";

// Initialize Managers
const cart = new CartManager();

// --- CENTRALIZED PRODUCT SYNC (PC <-> MOBILE) ---

async function fetchProductsFromServer() {
    const serverUrl = `https://${configIp}/produtos`;
    console.log("LOG: Tentando sincronizar produtos com", serverUrl);
    try {
        const response = await fetch(serverUrl, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (response.ok) {
            const serverProducts = await response.json();
            if (serverProducts && serverProducts.length > 0) {
                products = serverProducts;
                localStorage.setItem('products', JSON.stringify(products));
                console.log(`LOG: ${products.length} produtos sincronizados do PC.`);
            }
        }
    } catch (err) {
        console.warn("LOG: Servidor offline. Usando catálogo local.", err);
    }
}

async function saveProductsToServer(newProducts) {
    const serverUrl = `https://${configIp}/produtos`;
    try {
        await fetch(serverUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(newProducts)
        });
        console.log("LOG: Catálogo enviado para o PC central.");
    } catch (err) {
        console.error("LOG: Erro ao sincronizar catálogo com o PC.", err);
    }
}

// Auto-sync on Load
fetchProductsFromServer();

// Configure Cart Update Listener
cart.onUpdate = (items, totals) => {
    if (items.length === 0) {
        cartList.innerHTML = `<div class="empty-cart"><i data-lucide="package-open"></i><p>Carrinho vazio</p></div>`;
    } else {
        cartList.innerHTML = items.map(item => `
            <div class="cart-item">
                <div class="item-info">
                    <span class="item-name">${item.name}</span>
                    <span class="item-details">${item.quantity}un x R$ ${item.price.toFixed(2)} | Desc: R$ ${item.discountVal.toFixed(2)}</span>
                </div>
                <div class="item-right">
                    <span class="item-total">R$ ${item.totalFinal.toFixed(2)}</span>
                    <button class="btn-remove-text" data-id="${item.id}">Remover</button>
                </div>
            </div>
        `).join('');
    }
    createIcons({ icons: { PackageOpen } });
    cartList.querySelectorAll('.btn-remove-text').forEach(btn => {
        btn.addEventListener('click', () => {
            itemToRemoveId = Number(btn.dataset.id);
            document.getElementById('confirm-remove-item-modal').classList.remove('hidden');
            vibrate(30);
        });
    });
    cartCount.textContent = `${items.length} itens`;
    document.getElementById('total-gross').textContent = `R$ ${totals.gross.toFixed(2)}`;
    document.getElementById('total-discount').textContent = `R$ ${totals.discount.toFixed(2)}`;

    // Automatic Rounding (to 0.10)
    const finalRounded = Math.round(totals.final * 10) / 10;
    const adjustment = finalRounded - totals.final;
    const rowAdjustment = document.getElementById('row-adjustment');
    
    if (Math.abs(adjustment) > 0.01) {
        rowAdjustment.classList.remove('hidden');
        document.getElementById('total-adjustment').textContent = `R$ ${adjustment.toFixed(2)}`;
    } else {
        rowAdjustment.classList.add('hidden');
    }

    // Header Totals (Now with Rounding synced)
    document.getElementById('total-gross-header').textContent = `R$ ${totals.gross.toFixed(2)}`;
    document.getElementById('total-discount-header').textContent = `R$ ${totals.discount.toFixed(2)}`;
    document.getElementById('total-final-header').textContent = `R$ ${finalRounded.toFixed(2)}`;
    
    inputTotalFinal.value = finalRounded.toFixed(2);
};

// Modals Removal logic
document.getElementById('btn-cancel-remove-item').addEventListener('click', () => document.getElementById('confirm-remove-item-modal').classList.add('hidden'));
document.getElementById('btn-confirm-remove-item').addEventListener('click', () => {
    if (itemToRemoveId) {
        cart.removeItem(itemToRemoveId);
        itemToRemoveId = null;
        document.getElementById('confirm-remove-item-modal').classList.add('hidden');
        vibrate(100);
    }
});

cart.notify();

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

function updateClock() {
    const now = new Date();
    currentDatetime.textContent = now.toLocaleString('pt-BR');
}
setInterval(updateClock, 1000);
updateClock();

document.getElementById('btn-toggle-summary').addEventListener('click', () => {
    document.getElementById('summary-accordion').classList.toggle('collapsed');
    vibrate(30);
});

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

productSearch.addEventListener('focus', () => {
    vibrate(20);
    document.body.classList.add('searching-mode');
    btnCancelSearch.classList.remove('hidden');
});

function exitSearchMode() {
    document.body.classList.remove('searching-mode');
    btnCancelSearch.classList.add('hidden');
    searchResults.classList.add('hidden');
}

btnCancelSearch.addEventListener('click', () => {
    vibrate(20);
    exitSearchMode();
    productSearch.value = '';
    productSearch.blur();
});

productSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    if (term.length < 1) {
        searchResults.classList.add('hidden');
        return;
    }
    const filtered = products.filter(p => (p.name && p.name.toLowerCase().includes(term)) || (p.code && p.code.toLowerCase().includes(term))).slice(0, 15);
    renderSearchResults(filtered);
});

function renderSearchResults(results) {
    searchResults.classList.remove('hidden');
    if (products.length === 0) {
        searchResults.innerHTML = `<div class="search-item" style="text-align: center; padding: 2rem;"><p style="color: var(--primary); font-weight: 700;">Catálogo Vazio!</p><p style="font-size: 0.8rem; color: var(--text-muted);">Aguardando sincronização com o PC...</p></div>`;
        return;
    }
    if (results.length === 0) {
        searchResults.innerHTML = `<div class="search-item" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhum produto encontrado.</div>`;
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
            selectProduct(products.find(p => p.code === el.dataset.code));
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
    inputFinalPrice.value = (gross - (parseFloat(inputDiscountVal.value) || 0)).toFixed(2);
}

document.querySelectorAll('.btn-quick').forEach(btn => {
    btn.addEventListener('click', () => {
        const val = btn.dataset.discount;
        if (val.includes('%')) { inputDiscountPct.value = Math.abs(parseFloat(val)); updateInsertionTotals('pct'); }
        else { inputDiscountVal.value = Math.abs(parseFloat(val)); updateInsertionTotals('val'); }
        vibrate(30);
    });
});

inputQnty.addEventListener('input', () => updateInsertionTotals('pct'));
inputDiscountVal.addEventListener('input', () => updateInsertionTotals('val'));
inputDiscountPct.addEventListener('input', () => updateInsertionTotals('pct'));

btnAddItem.addEventListener('click', () => {
    if (!selectedProduct) { alert("Selecione um produto!"); return; }
    cart.addItem(selectedProduct, parseFloat(inputQnty.value) || 1, parseFloat(inputDiscountVal.value) || 0, parseFloat(inputDiscountPct.value) || 0);
    vibrate(50);
    selectedProduct = null;
    productSearch.value = ''; inputQnty.value = 1; inputPrice.value = ''; inputTotal.value = ''; inputDiscountVal.value = ''; inputDiscountPct.value = ''; inputFinalPrice.value = '';
});

// Config & Import
const importModal = document.getElementById('import-modal');
document.getElementById('btn-open-import').addEventListener('click', () => { importModal.classList.remove('hidden'); vibrate(30); });
document.getElementById('close-import').addEventListener('click', () => importModal.classList.add('hidden'));

document.getElementById('btn-process-import').addEventListener('click', async () => {
    vibrate(50);
    configIp = document.getElementById('config-ip').value || 'localhost';
    configSeller = document.getElementById('config-seller').value || '';
    configPixKey = document.getElementById('config-pix-key').value || '81997834549';
    localStorage.setItem('config_ip', configIp);
    localStorage.setItem('config_seller', configSeller);
    localStorage.setItem('config_pix_key', configPixKey);
    if (displayVendedor) displayVendedor.textContent = configSeller || "Sanzony";

    const file = document.getElementById('csv-file').files[0];
    if (file) {
        const reader = new FileReader();
        const extension = file.name.split('.').pop().toLowerCase();
        const processResults = async (data) => {
            const mapped = data.map(row => ({
                code: String(row['Código Produto'] || row.código || row.codigo || row.code || '').trim(),
                name: String(row['Nome Produto'] || row.nome || row.name || '').trim(),
                price: parseFloat(String(row['Unitário'] || row.price || '0').replace(',', '.')),
                stock: parseInt(row['Estoque'] || 0)
            })).filter(p => p.code && p.name && !isNaN(p.price));

            if (mapped.length > 0) {
                products = mapped;
                localStorage.setItem('products', JSON.stringify(products));
                // ENVIAR PARA O COMPUTADOR CENTRAL
                await saveProductsToServer(products);
                alert(`Sucesso! ${products.length} produtos importados e sincronizados.`);
                importModal.classList.add('hidden');
            } else { alert("Erro: Planilha inválida."); }
        };
        if (extension === 'xlsx' || extension === 'xls') {
            reader.onload = (e) => {
                const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                processResults(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]));
            };
            reader.readAsArrayBuffer(file);
        } else {
            Papa.parse(file, { header: true, skipEmptyLines: true, complete: results => processResults(results.data) });
        }
    } else { alert("Configurações salvas."); importModal.classList.add('hidden'); }
});

// Printing Logic
document.getElementById('btn-print').addEventListener('click', async () => {
    if (cart.items.length === 0) { document.getElementById('empty-cart-modal').classList.remove('hidden'); return; }
    vibrate(100);
    const totals = cart.getTotals();
    const orderData = { empresa: ENTERPRISE, vendedor: configSeller, cliente: document.getElementById('client-name').value, data: new Date().toLocaleDateString(), hora: new Date().toLocaleTimeString(), tipo: orderType, pagamento: paymentType, itens: cart.items.map(i => ({ descricao: i.name, quantidade: i.quantity, total: i.totalFinal })), totalProdutos: totals.gross, descontos: totals.discount, totalFinal: parseFloat(inputTotalFinal.value), pixKey: configPixKey };
    try {
        const res = await fetch(`https://${configIp}/imprimir`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }, body: JSON.stringify(orderData) });
        if (res.ok) { document.getElementById('success-msg').textContent = `${orderType} impresso!`; document.getElementById('success-screen').classList.remove('hidden'); }
        else throw new Error();
    } catch (err) { alert("Impressão falhou. Usando impressão do navegador."); window.print(); }
});

document.getElementById('btn-next-order').addEventListener('click', () => { cart.clear(); document.getElementById('success-screen').classList.add('hidden'); document.getElementById('tab-produtos').click(); vibrate(50); });
document.getElementById('close-empty-cart').addEventListener('click', () => document.getElementById('empty-cart-modal').classList.add('hidden'));

// Confirmation for Global Clear
document.getElementById('btn-clear-order').addEventListener('click', () => { document.getElementById('confirm-clear-modal').classList.remove('hidden'); vibrate(30); });
document.getElementById('btn-cancel-clear').addEventListener('click', () => document.getElementById('confirm-clear-modal').classList.add('hidden'));
document.getElementById('btn-confirm-clear').addEventListener('click', () => { cart.clear(); document.getElementById('confirm-clear-modal').classList.add('hidden'); vibrate(100); });
