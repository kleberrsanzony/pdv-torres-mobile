import { createIcons, Search, Camera, ShoppingCart, Plus, PackageOpen, Printer, X, Settings, Zap, Download, Pencil, TriangleAlert, Trash2 } from 'lucide';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { CartManager, syncDiscounts } from './cart';
import { ScannerManager } from './scanner';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker for PWA
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

// Enterprise Metadata (MANTIDO PARA IMPRESSÃO)
const ENTERPRISE = {
    nome: "COMERCIAL TORRES",
    endereco: "RUA MARQUES DE OLINDA, 601",
    cidade: "CENTRO-SIRINHAEM",
    fone: "(81) 3577-1419",
    whatsapp: "(81) 98575-1320"
};

// State Management
let products = JSON.parse(localStorage.getItem('products')) || []; 
let selectedProduct = null;
let paymentType = 'DINHEIRO';
let orderType = 'Orcamento';
let itemToRemoveId = null;

// Configs
let configIp = localStorage.getItem('config_ip') || 'localhost';
let configSeller = localStorage.getItem('config_seller') || 'KLEBER';
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
if (displayVendedor) displayVendedor.textContent = configSeller;

// Initialize Managers
const cart = new CartManager();

// --- CENTRALIZED PRODUCT SYNC ---
async function fetchProductsFromServer() {
    const serverUrl = `https://${configIp}/produtos`;
    try {
        const response = await fetch(serverUrl, { headers: { 'ngrok-skip-browser-warning': 'true' } });
        if (response.ok) {
            const serverProducts = await response.json();
            if (serverProducts && serverProducts.length > 0) {
                products = serverProducts;
                localStorage.setItem('products', JSON.stringify(products));
            }
        }
    } catch (err) { console.warn("Usando catálogo local."); }
}

async function saveProductsToServer(newProducts) {
    const serverUrl = `https://${configIp}/produtos`;
    try {
        await fetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify(newProducts)
        });
    } catch (err) { console.error("Erro ao sincronizar catálogo."); }
}

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
    document.getElementById('total-gross-header').textContent = `R$ ${totals.gross.toFixed(2)}`;
    document.getElementById('total-discount-header').textContent = `R$ ${totals.discount.toFixed(2)}`;
    
    // Automatic Rounding (0.10)
    const finalRounded = Math.round(totals.final * 10) / 10;
    const adjustment = finalRounded - totals.final;
    const rowAdjustment = document.getElementById('row-adjustment');
    if (Math.abs(adjustment) > 0.01) {
        rowAdjustment.classList.remove('hidden');
        document.getElementById('total-adjustment').textContent = `R$ ${adjustment.toFixed(2)}`;
    } else { rowAdjustment.classList.add('hidden'); }

    document.getElementById('total-final-header').textContent = `R$ ${finalRounded.toFixed(2)}`;
    inputTotalFinal.value = finalRounded.toFixed(2);
};

// Modals logic
document.getElementById('btn-cancel-remove-item').addEventListener('click', () => document.getElementById('confirm-remove-item-modal').classList.add('hidden'));
document.getElementById('btn-confirm-remove-item').addEventListener('click', () => {
    if (itemToRemoveId) { cart.removeItem(itemToRemoveId); itemToRemoveId = null; document.getElementById('confirm-remove-item-modal').classList.add('hidden'); vibrate(100); }
});

cart.notify();

// --- TAB SYSTEM ---
document.querySelectorAll('.btn-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.btn-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
        vibrate(30);
    });
});

function updateClock() { document.getElementById('current-datetime').textContent = new Date().toLocaleString('pt-BR'); }
setInterval(updateClock, 1000); updateClock();

document.getElementById('btn-toggle-summary').addEventListener('click', () => { document.getElementById('summary-accordion').classList.toggle('collapsed'); vibrate(30); });

document.getElementById('type-orcamento').addEventListener('click', () => { orderType = 'Orcamento'; document.getElementById('type-orcamento').classList.add('active'); document.getElementById('type-pedido').classList.remove('active'); vibrate(30); });
document.getElementById('type-pedido').addEventListener('click', () => { orderType = 'Pedido'; document.getElementById('type-pedido').classList.add('active'); document.getElementById('type-orcamento').classList.remove('active'); vibrate(30); });

document.querySelectorAll('.btn-payment').forEach(btn => {
    btn.addEventListener('click', () => { paymentType = btn.dataset.value; document.querySelectorAll('.btn-payment').forEach(b => b.classList.remove('active')); btn.classList.add('active'); vibrate(30); });
});

productSearch.addEventListener('focus', () => { vibrate(20); document.body.classList.add('searching-mode'); btnCancelSearch.classList.remove('hidden'); });
function exitSearchMode() { document.body.classList.remove('searching-mode'); btnCancelSearch.classList.add('hidden'); searchResults.classList.add('hidden'); }
btnCancelSearch.addEventListener('click', () => { vibrate(20); exitSearchMode(); productSearch.value = ''; productSearch.blur(); });

productSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    if (term.length < 1) { searchResults.classList.add('hidden'); return; }
    const filtered = products.filter(p => (p.name && p.name.toLowerCase().includes(term)) || (p.code && p.code.toLowerCase().includes(term))).slice(0, 15);
    renderSearchResults(filtered);
});

function renderSearchResults(results) {
    searchResults.classList.remove('hidden');
    if (products.length === 0) { searchResults.innerHTML = `<div class="p-4 text-center">Catálogo Vazio! Sincronizando...</div>`; return; }
    if (results.length === 0) { searchResults.innerHTML = `<div class="p-4 text-center">Nenhum produto encontrado.</div>`; return; }
    searchResults.innerHTML = results.map(p => `<div class="search-item" data-code="${p.code}"><span class="name">${p.name}</span><span class="meta">Cód: ${p.code} | Estoque: ${p.stock || 0} | R$ ${parseFloat(p.price || 0).toFixed(2)}</span></div>`).join('');
    searchResults.querySelectorAll('.search-item').forEach(el => el.addEventListener('click', () => selectProduct(products.find(p => p.code === el.dataset.code))));
}

function selectProduct(product) { selectedProduct = product; productSearch.value = product.name; inputPrice.value = parseFloat(product.price).toFixed(2); inputQnty.value = 1; inputDiscountVal.value = ''; inputDiscountPct.value = ''; updateInsertionTotals(); exitSearchMode(); }

function updateInsertionTotals(source = 'calc') {
    if (!selectedProduct) return;
    const price = parseFloat(inputPrice.value) || 0; const qnty = parseFloat(inputQnty.value) || 0; const gross = price * qnty; inputTotal.value = gross.toFixed(2);
    if (source === 'val') { const s = syncDiscounts(price, qnty, 'val', inputDiscountVal.value); inputDiscountPct.value = s.pct; inputDiscountVal.value = s.val; }
    else if (source === 'pct') { const s = syncDiscounts(price, qnty, 'pct', inputDiscountPct.value); inputDiscountVal.value = s.val; inputDiscountPct.value = s.pct; }
    inputFinalPrice.value = (gross - (parseFloat(inputDiscountVal.value) || 0)).toFixed(2);
}

document.querySelectorAll('.btn-quick').forEach(btn => btn.addEventListener('click', () => { 
    const v = btn.dataset.discount; if (v.includes('%')) { inputDiscountPct.value = Math.abs(parseFloat(v)); updateInsertionTotals('pct'); } else { inputDiscountVal.value = Math.abs(parseFloat(v)); updateInsertionTotals('val'); } vibrate(30); 
}));

inputQnty.addEventListener('input', () => updateInsertionTotals('pct'));
inputDiscountVal.addEventListener('input', () => updateInsertionTotals('val'));
inputDiscountPct.addEventListener('input', () => updateInsertionTotals('pct'));

btnAddItem.addEventListener('click', () => {
    if (!selectedProduct) { alert("Selecione um produto!"); return; }
    cart.addItem(selectedProduct, parseFloat(inputQnty.value) || 1, parseFloat(inputDiscountVal.value) || 0, parseFloat(inputDiscountPct.value) || 0); vibrate(50);
    selectedProduct = null; productSearch.value = ''; inputQnty.value = 1; inputPrice.value = ''; inputTotal.value = ''; inputDiscountVal.value = ''; inputDiscountPct.value = ''; inputFinalPrice.value = '';
});

// Config & Import
document.getElementById('btn-open-import').addEventListener('click', () => { document.getElementById('import-modal').classList.remove('hidden'); vibrate(30); });
document.getElementById('close-import').addEventListener('click', () => document.getElementById('import-modal').classList.add('hidden'));

document.getElementById('btn-process-import').addEventListener('click', async () => {
    vibrate(50); configIp = document.getElementById('config-ip').value || 'localhost'; configSeller = document.getElementById('config-seller').value || ''; configPixKey = document.getElementById('config-pix-key').value || '81997834549';
    localStorage.setItem('config_ip', configIp); localStorage.setItem('config_seller', configSeller); localStorage.setItem('config_pix_key', configPixKey); if (displayVendedor) displayVendedor.textContent = configSeller;
    const f = document.getElementById('csv-file').files[0];
    if (f) {
        const reader = new FileReader(); const extension = f.name.split('.').pop().toLowerCase();
        const process = async (d) => {
            const m = d.map(r => ({ code: String(r['Código Produto'] || r.código || r.code || '').trim(), name: String(r['Nome Produto'] || r.nome || '').trim(), price: parseFloat(String(r['Unitário'] || r.price || '0').replace(',', '.')), stock: parseInt(r['Estoque'] || 0) })).filter(p => p.code && p.name && !isNaN(p.price));
            if (m.length > 0) { products = m; localStorage.setItem('products', JSON.stringify(products)); await saveProductsToServer(products); alert(`Sucesso! ${products.length} sincronizados.`); document.getElementById('import-modal').classList.add('hidden'); }
        };
        if (extension === 'xlsx' || extension === 'xls') { reader.onload = (e) => process(XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).Sheets[XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).SheetNames[0]])); reader.readAsArrayBuffer(file); }
        else { Papa.parse(f, { header: true, complete: r => process(r.data) }); }
    } else { document.getElementById('import-modal').classList.add('hidden'); }
});

// --- PRINTING LOGIC + AIRPRINT FALLBACK ---
document.getElementById('btn-print').addEventListener('click', async () => {
    if (cart.items.length === 0) { document.getElementById('empty-cart-modal').classList.remove('hidden'); return; }
    vibrate(100);
    const totals = cart.getTotals();
    const finalVal = parseFloat(inputTotalFinal.value);
    const sequenciaVal = Math.floor(10000 + Math.random() * 90000);
    const dataVal = new Date().toLocaleDateString('pt-BR');
    const horaVal = new Date().toLocaleTimeString('pt-BR');

    // DADOS PARA O SERVIDOR ELGIN
    const orderData = {
        empresa: ENTERPRISE.nome, endereco: ENTERPRISE.endereco, cidade: ENTERPRISE.cidade, telefone: ENTERPRISE.fone, whatsapp: ENTERPRISE.whatsapp,
        sequencia: sequenciaVal, operacao: orderType, data: dataVal, hora: horaVal, vendedor: configSeller || "KLEBER", cliente: document.getElementById('client-name').value || "CLIENTE BALCAO",
        itens: cart.items.map(i => ({ descricao: i.name.toUpperCase(), quantidade: i.quantity, unitario: i.price, total: i.totalFinal })),
        totalProdutos: totals.gross, descontos: totals.discount, totalFinal: finalVal
    };

    // --- PREPARAR ÁREA DE IMPRESSÃO FISICA (PDF/AIRPRINT) ---
    const printArea = document.getElementById('print-area');
    if (printArea) {
        printArea.innerHTML = `
            <div style="font-family: 'Courier New', Courier, monospace; width: 300px; padding: 10px; font-size: 12px; color: #000; background: #fff;">
                <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px;">
                    <strong style="font-size: 14px;">${ENTERPRISE.nome}</strong><br>
                    ${ENTERPRISE.endereco}<br>
                    ${ENTERPRISE.cidade}<br>
                    FONE: ${ENTERPRISE.fone}
                </div>
                <div>
                   <strong>Sequencia:</strong> ${sequenciaVal}<br>
                   <strong>Operacao:</strong> ${orderType.toUpperCase()}<br>
                   <strong>Data:</strong> ${dataVal} ${horaVal}<br>
                   <strong>Vendedor:</strong> ${configSeller}<br>
                   <strong>Cliente:</strong> ${orderData.cliente}
                </div>
                <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 5px 0; padding: 5px 0;">
                    <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 1px solid #000;">
                                <th align="left">DESCRIÇÃO</th>
                                <th align="right">QTD</th>
                                <th align="right">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cart.items.map(item => `
                                <tr>
                                    <td align="left">${item.name.toUpperCase()}</td>
                                    <td align="right">${item.quantity}</td>
                                    <td align="right">${item.totalFinal.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="text-align: right;">
                    Subtotal: R$ ${totals.gross.toFixed(2)}<br>
                    Desc.: R$ ${totals.discount.toFixed(2)}<br>
                    <strong style="font-size: 14px;">TOTAL: R$ ${finalVal.toFixed(2)}</strong>
                </div>
                <div style="text-align: center; margin-top: 10px; border-top: 1px dashed #000; padding-top: 5px;">
                   Obrigado pela preferência!<br>
                   Confira a mercadoria no ato da entrega.
                </div>
            </div>
        `;
    }

    try {
        const res = await fetch(`https://${configIp}/imprimir`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }, 
            body: JSON.stringify(orderData) 
        });
        if (res.ok) { document.getElementById('success-msg').textContent = `${orderType} enviado com sucesso!`; document.getElementById('success-screen').classList.remove('hidden'); }
        else throw new Error("Erro no servidor");
    } catch (err) { 
        console.warn("Falha automática. Acionando AirPrint..."); 
        window.print(); 
        document.getElementById('success-msg').textContent = "Nota gerada!"; 
        document.getElementById('success-screen').classList.remove('hidden');
    }
});

document.getElementById('btn-next-order').addEventListener('click', () => { cart.clear(); document.getElementById('success-screen').classList.add('hidden'); document.getElementById('tab-produtos').click(); vibrate(50); });
document.getElementById('close-empty-cart').addEventListener('click', () => document.getElementById('empty-cart-modal').classList.add('hidden'));

document.getElementById('btn-clear-order').addEventListener('click', () => { document.getElementById('confirm-clear-modal').classList.remove('hidden'); vibrate(30); });
document.getElementById('btn-cancel-clear').addEventListener('click', () => document.getElementById('confirm-clear-modal').classList.add('hidden'));
document.getElementById('btn-confirm-clear').addEventListener('click', () => { cart.clear(); document.getElementById('confirm-clear-modal').classList.add('hidden'); vibrate(100); });
