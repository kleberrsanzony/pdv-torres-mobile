import { createIcons, Search, Camera, ShoppingCart, Plus, PackageOpen, Printer, X, Settings } from 'lucide';
import Papa from 'papaparse';
import { CartManager, syncDiscounts } from './cart';
import { ScannerManager } from './scanner';

// Initialize Lucide
createIcons({
    icons: { Search, Camera, ShoppingCart, Plus, PackageOpen, Printer, X, Settings }
});

// Enterprise Metadata
const ENTERPRISE = {
    nome: "PDV Torres",
    endereco: "Av. Principal, 1000 - Centro",
    contato: "(11) 99999-9999 / WhatsApp"
};

const RODAPE = [
    "Confira a mercadoria no ato da entrega",
    "Não aceitamos reclamações posteriores",
    "Alteração de preço sem prévio aviso",
    "Desenvolvido por Sanzony Tech 2026"
];

// Default Products for Testing
const DEFAULT_PRODUCTS = [
    { code: "1001", name: "Cimento CP II-Z 32-40 50kg", price: 54.44, stock: 500 },
    { code: "1002", name: "Argamassa AC-I Votorantim 20kg", price: 12.50, stock: 300 },
    { code: "1003", name: "Tijolo 8 Furos (Milheiro)", price: 850.00, stock: 10 },
    { code: "1004", name: "Areia Lavada (Metro m3)", price: 95.00, stock: 100 },
    { code: "1005", name: "Pedra Brita 1 (Metro m3)", price: 110.00, stock: 100 }
];

// App State
let products = JSON.parse(localStorage.getItem('products') || '[]');

// Seed if empty or update current test products
if (products.length === 0) {
    products = DEFAULT_PRODUCTS;
    localStorage.setItem('products', JSON.stringify(products));
} else {
    // Force update of default test products prices if they exist
    DEFAULT_PRODUCTS.forEach(def => {
        const index = products.findIndex(p => p.code === def.code);
        if (index !== -1) {
            products[index].price = def.price;
        }
    });
    localStorage.setItem('products', JSON.stringify(products));
}
const cart = new CartManager();
let selectedProduct = null;
let scanner = null;

// Config state
let configIp = localStorage.getItem('config_ip') || 'localhost';
let configSeller = localStorage.getItem('config_seller') || '';

// UI Elements
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
const totalGross = document.getElementById('total-gross');
const totalDiscount = document.getElementById('total-discount');
const totalFinal = document.getElementById('total-final');
const btnPrint = document.getElementById('btn-print');
const currentDateTime = document.getElementById('current-datetime');
const clientName = document.getElementById('client-name');
const sellerName = document.getElementById('seller-name');

// Config Modal Elements
const inputConfigIp = document.getElementById('config-ip');
const inputConfigSeller = document.getElementById('config-seller');

// Initialize UI with saved configs
inputConfigIp.value = configIp;
inputConfigSeller.value = configSeller;
sellerName.value = configSeller;

// Modals
const scannerModal = document.getElementById('scanner-modal');
const importModal = document.getElementById('import-modal');
const btnScan = document.getElementById('btn-scan');
const btnOpenImport = document.getElementById('btn-open-import');
const btnProcessImport = document.getElementById('btn-process-import');
const csvFile = document.getElementById('csv-file');

// Update Clock
setInterval(() => {
    const now = new Date();
    currentDateTime.textContent = now.toLocaleString('pt-BR');
}, 1000);

// Sequence Number Logic
function getNextSequence() {
    let seq = parseInt(localStorage.getItem('order_sequence') || '0');
    seq++;
    localStorage.setItem('order_sequence', seq.toString());
    return seq.toString().padStart(6, '0');
}

// --- Product Search & Selection ---
productSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    if (term.length < 1) {
        searchResults.classList.add('hidden');
        return;
    }

    const filtered = products.filter(p => 
        (p.name && p.name.toLowerCase().includes(term)) || 
        (p.code && p.code.toLowerCase().includes(term))
    ).slice(0, 10);

    renderSearchResults(filtered);
});

function renderSearchResults(results) {
    if (results.length === 0) {
        searchResults.classList.add('hidden');
        return;
    }

    searchResults.innerHTML = results.map(p => `
        <div class="search-item" data-code="${p.code}">
            <span class="name">${p.name}</span>
            <span class="meta">Cód: ${p.code} | Estoque: ${p.stock} | R$ ${p.price.toFixed(2)}</span>
        </div>
    `).join('');
    searchResults.classList.remove('hidden');

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
    searchResults.classList.add('hidden');
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

// Quick Discounts
document.querySelectorAll('.btn-quick').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!selectedProduct) return;
        const discountAttr = btn.dataset.discount;
        
        if (discountAttr.endsWith('%')) {
            inputDiscountPct.value = discountAttr.replace('%', '').replace('-', '');
            updateInsertionTotals('pct');
        } else if (discountAttr.startsWith('-')) {
            inputDiscountVal.value = discountAttr.replace('-', '').replace('$', '');
            updateInsertionTotals('val');
        }
    });
});

// --- Cart Management ---
btnAddItem.addEventListener('click', () => {
    if (!selectedProduct) {
        alert("Selecione um produto primeiro.");
        return;
    }

    const qnty = parseFloat(inputQnty.value);
    const discVal = parseFloat(inputDiscountVal.value) || 0;
    const discPct = parseFloat(inputDiscountPct.value) || 0;

    cart.addItem(selectedProduct, qnty, discVal, discPct);
    
    // Clear form
    selectedProduct = null;
    productSearch.value = '';
    inputPrice.value = '';
    inputQnty.value = 1;
    inputTotal.value = '';
    inputDiscountVal.value = '';
    inputDiscountPct.value = '';
    inputFinalPrice.value = '';
});

cart.onUpdate = (items, totals) => {
    renderCart(items);
    updateTotals(totals);
};

function renderCart(items) {
    if (items.length === 0) {
        cartList.innerHTML = `<div class="empty-cart"><i data-lucide="package-open"></i><p>Carrinho vazio</p></div>`;
        createIcons({ icons: { PackageOpen } });
        return;
    }

    cartList.innerHTML = items.map(item => `
        <div class="cart-item">
            <div class="top">
                <span class="name">${item.name}</span>
                <span class="total">R$ ${item.totalFinal.toFixed(2)}</span>
            </div>
            <div class="details">
                <span>${item.quantity} x R$ ${item.price.toFixed(2)}</span>
                ${item.discountVal > 0 ? `<span class="discount-badge">-${item.discountPct}% (R$ ${item.discountVal.toFixed(2)})</span>` : ''}
            </div>
            <div class="cart-item-actions">
                <button class="btn-action remove" data-id="${item.id}">
                    <i data-lucide="x"></i> Remover
                </button>
            </div>
        </div>
    `).join('');
    
    createIcons({ icons: { X } });

    cartList.querySelectorAll('.remove').forEach(btn => {
        btn.addEventListener('click', () => {
            cart.removeItem(Number(btn.dataset.id));
        });
    });
}

function updateTotals(totals) {
    cartCount.textContent = `${cart.items.length} itens`;
    totalGross.textContent = `R$ ${totals.gross.toFixed(2)}`;
    totalDiscount.textContent = `R$ ${totals.discount.toFixed(2)}`;
    totalFinal.textContent = `R$ ${totals.final.toFixed(2)}`;
}

// --- Import & Config Logic ---
btnOpenImport.addEventListener('click', () => {
    inputConfigIp.value = localStorage.getItem('config_ip') || '';
    inputConfigSeller.value = localStorage.getItem('config_seller') || '';
    importModal.classList.remove('hidden');
});
document.getElementById('close-import').addEventListener('click', () => importModal.classList.add('hidden'));

btnProcessImport.addEventListener('click', () => {
    // Save configurations
    configIp = inputConfigIp.value || 'localhost';
    configSeller = inputConfigSeller.value || '';
    localStorage.setItem('config_ip', configIp);
    localStorage.setItem('config_seller', configSeller);
    sellerName.value = configSeller;

    // Handle CSV import if file is selected
    if (csvFile.files[0]) {
        Papa.parse(csvFile.files[0], {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const mapped = results.data.map(row => ({
                    code: row.código || row.codigo || row.code || '',
                    name: row.nome || row.name || '',
                    price: parseFloat(row.preço || row.preco || row.price || 0),
                    stock: parseInt(row.estoque || row.stock || 0)
                })).filter(p => p.code && p.name);

                products = mapped;
                localStorage.setItem('products', JSON.stringify(products));
                alert(`Configurações salvas e ${products.length} produtos importados.`);
                importModal.classList.add('hidden');
            }
        });
    } else {
        alert("Configurações salvas com sucesso.");
        importModal.classList.add('hidden');
    }
});

// --- Scanner Logic ---
btnScan.addEventListener('click', async () => {
    scannerModal.classList.remove('hidden');
    if (!scanner) {
        scanner = new ScannerManager('reader', (decodedText) => {
            const product = products.find(p => p.code === decodedText);
            if (product) {
                selectProduct(product);
                scanner.stop();
                scannerModal.classList.add('hidden');
            } else {
                alert(`Produto não encontrado: ${decodedText}`);
            }
        });
    }
    await scanner.start();
});

document.getElementById('close-scanner').addEventListener('click', async () => {
    if (scanner) await scanner.stop();
    scannerModal.classList.add('hidden');
});

// --- Thermal Print Logic ---
btnPrint.addEventListener('click', async () => {
    if (cart.items.length === 0) {
        alert("O carrinho está vazio.");
        return;
    }

    const sequence = getNextSequence();
    const totals = cart.getTotals();

    // Payload ALINHADO com o SEU server.js
    const payload = {
        empresa: ENTERPRISE.nome,
        endereco: ENTERPRISE.endereco,
        telefone: ENTERPRISE.contato,
        whatsapp: "", // Opcional
        sequencia: sequence,
        operacao: "VENDA MOBILE",
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR'),
        vendedor: sellerName.value || "Não informado",
        cliente: clientName.value || "Cliente Balcão",
        itens: cart.items.map(item => ({
            quantidade: item.quantity,
            descricao: item.name,
            total: item.totalFinal // Enviando como número
        })),
        totalProdutos: totals.gross,  // Nome correto esperado pelo servidor
        descontos: totals.discount,    // Nome correto esperado pelo servidor
        totalFinal: totals.final       // Nome correto esperado pelo servidor
    };

    const serverUrl = `http://${configIp}:3000/imprimir`;
    console.log(`Enviando para ${serverUrl}:`, payload);

    try {
        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert(`Pedido #${sequence} enviado com sucesso!`);
            // Limpar cliente, mas manter como padrão
            clientName.value = "Cliente Balcão";
        } else {
            const errorText = await response.text();
            throw new Error(errorText || "Erro na resposta do servidor.");
        }
    } catch (err) {
        console.warn("Servidor local não encontrado ou erro:", err);
        alert(`Ocorreu um erro ao falar com o servidor em ${configIp}: ${err.message}. Baixando JSON como backup.`);
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `pedido_${sequence}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
});
