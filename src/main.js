import { createIcons, Search, Camera, ShoppingCart, Plus, PackageOpen, Printer, X, Settings, Zap, Download, Pencil, TriangleAlert } from 'lucide';
import Papa from 'papaparse';
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
let salesHistory = JSON.parse(localStorage.getItem('sales_history') || '[]');

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
let editingItemId = null;
let scanner = null;

// POS 2.0 State
let orderType = "ORÇAMENTO";
let recentClients = JSON.parse(localStorage.getItem('recent_clients') || '[]');

// Config state
let configIp = localStorage.getItem('config_ip') || 'localhost';
let configSeller = localStorage.getItem('config_seller') || '';
let configPixKey = localStorage.getItem('config_pix_key') || '81997834549';

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
const displayVendedor = document.getElementById('display-vendedor');
const btnClearOrder = document.getElementById('btn-clear-order');

// Config Modal Elements
const inputConfigIp = document.getElementById('config-ip');
const inputConfigSeller = document.getElementById('config-seller');
const inputConfigPixKey = document.getElementById('config-pix-key');

// Initialize UI with saved configs
inputConfigIp.value = configIp;
inputConfigSeller.value = configSeller;
inputConfigPixKey.value = configPixKey;
if (displayVendedor) displayVendedor.textContent = configSeller || "Sanzony";

const btnToggleSummary = document.getElementById('btn-toggle-summary');
const summaryAccordion = document.getElementById('summary-accordion');
const totalFinalHeader = document.getElementById('total-final-header');
const tabButtons = document.querySelectorAll('.btn-tab');
const tabContents = document.querySelectorAll('.tab-content');

// --- Modular UI: Tab Logic ---
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        vibrate(30);
        const target = btn.getAttribute('data-tab');
        
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(target).classList.add('active');
        
        // Se mudar de aba, recolhe o resumo para não atrapalhar
        summaryAccordion.classList.add('collapsed');
    });
});

// --- Modular UI: Accordion Logic ---
if (btnToggleSummary) {
    btnToggleSummary.addEventListener('click', () => {
        vibrate(40);
        summaryAccordion.classList.toggle('collapsed');
    });
}

// Modals
const scannerModal = document.getElementById('scanner-modal');
const importModal = document.getElementById('import-modal');
const btnScan = document.getElementById('btn-scan');
const btnOpenImport = document.getElementById('btn-open-import');
const btnProcessImport = document.getElementById('btn-process-import');
const btnExportSales = document.getElementById('btn-export-sales');
const csvFile = document.getElementById('csv-file');

const successScreen = document.getElementById('success-screen');
const btnNextOrder = document.getElementById('btn-next-order');
const successMsg = document.getElementById('success-msg');

const typeOrcamento = document.getElementById('type-orcamento');
const typePedido = document.getElementById('type-pedido');
const paymentMethod = document.getElementById('payment-method');
const recentClientsList = document.getElementById('recent-clients-list');

const emptyCartModal = document.getElementById('empty-cart-modal');
const btnCloseEmptyCart = document.getElementById('close-empty-cart');

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

function getCurrentSequence() {
    const seq = parseInt(localStorage.getItem('order_sequence') || '1');
    return seq.toString().padStart(6, '0');
}

// --- Persistence Layer ---
function saveCartState() {
    localStorage.setItem('active_cart', JSON.stringify(cart.items));
}

function loadCartState() {
    const saved = localStorage.getItem('active_cart');
    if (saved) {
        const items = JSON.parse(saved);
        if (items.length > 0) {
            cart.loadItems(items);
        }
    }
}

// --- Customer History ---
function saveRecentClient(name) {
    if (!name || name === "Cliente Balcão") return;
    recentClients = [name, ...recentClients.filter(c => c !== name)].slice(0, 10);
    localStorage.setItem('recent_clients', JSON.stringify(recentClients));
    renderRecentClients();
}

function renderRecentClients() {
    recentClientsList.innerHTML = recentClients.map(c => `<option value="${c}">`).join('');
}

// --- Order Type Toggle ---
typeOrcamento.addEventListener('click', () => {
    vibrate(30);
    orderType = "ORÇAMENTO";
    typeOrcamento.classList.add('active');
    typePedido.classList.remove('active');
});

typePedido.addEventListener('click', () => {
    vibrate(30);
    orderType = "PEDIDO DE VENDA";
    typePedido.classList.add('active');
    typeOrcamento.classList.remove('active');
});

// --- REMOVED: Quick Products Logic (Migrated to Tabs) ---

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

document.querySelectorAll('.btn-quick').forEach(btn => {
    btn.addEventListener('click', () => {
        vibrate(30);
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
    vibrate(60);
    if (!selectedProduct) {
        alert("Selecione um produto primeiro.");
        return;
    }

    const qnty = parseFloat(inputQnty.value);
    const discVal = parseFloat(inputDiscountVal.value) || 0;
    const discPct = parseFloat(inputDiscountPct.value) || 0;

    if (editingItemId) {
        cart.updateItem(editingItemId, qnty, discVal, discPct);
        editingItemId = null;
        btnAddItem.innerHTML = `<i data-lucide="plus"></i> Adicionar Item`;
        createIcons({ icons: { Plus }});
    } else {
        cart.addItem(selectedProduct, qnty, discVal, discPct);
    }
    
    // Clear form
    selectedProduct = null;
    productSearch.value = '';
    inputPrice.value = '';
    inputQnty.value = 1;
    inputTotal.value = '';
    inputDiscountVal.value = '';
    inputDiscountPct.value = '';
    inputFinalPrice.value = '';
    
    // Volta para a aba de venda para ver o item no carrinho (Opcional, mas melhora UX)
    const tabVenda = document.getElementById('tab-venda');
    if (tabVenda) tabVenda.click();
});

cart.onUpdate = (items, totals) => {
    renderCart(items);
    updateTotals(totals);
    saveCartState();
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
                <button class="btn-action edit" data-id="${item.id}" style="color: var(--primary);">
                    <i data-lucide="pencil"></i> Editar
                </button>
                <button class="btn-action remove" data-id="${item.id}">
                    <i data-lucide="x"></i> Remover
                </button>
            </div>
        </div>
    `).join('');
    
    createIcons({ icons: { X, Pencil } });

    cartList.querySelectorAll('.remove').forEach(btn => {
        btn.addEventListener('click', () => {
            if (editingItemId === Number(btn.dataset.id)) {
                // Cancel edit if removing the item being edited
                editingItemId = null;
                btnAddItem.innerHTML = `<i data-lucide="plus"></i> Adicionar Item`;
                createIcons({ icons: { Plus }});
                selectedProduct = null;
                productSearch.value = '';
                inputPrice.value = '';
                inputQnty.value = 1;
                inputTotal.value = '';
                inputDiscountVal.value = '';
                inputDiscountPct.value = '';
                inputFinalPrice.value = '';
            }
            cart.removeItem(Number(btn.dataset.id));
        });
    });

    cartList.querySelectorAll('.edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            const item = cart.items.find(i => i.id === id);
            if (!item) return;

            vibrate(30);
            editingItemId = id;
            selectedProduct = { code: item.code, name: item.name, price: item.price };
            
            productSearch.value = item.name;
            inputPrice.value = parseFloat(item.price).toFixed(2);
            inputQnty.value = item.quantity;
            inputDiscountVal.value = item.discountVal > 0 ? item.discountVal.toFixed(2) : '';
            inputDiscountPct.value = item.discountPct > 0 ? item.discountPct.toFixed(2) : '';
            
            updateInsertionTotals();
            
            btnAddItem.innerHTML = `<i data-lucide="pencil"></i> Salvar Alterações`;
            createIcons({ icons: { Pencil }});
            
            // Scroll to top to see the insertion form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function updateTotals(totals) {
    cartCount.textContent = `${cart.items.length} itens`;
    totalGross.textContent = `R$ ${totals.gross.toFixed(2)}`;
    totalDiscount.textContent = `R$ ${totals.discount.toFixed(2)}`;
    totalFinal.textContent = `R$ ${totals.final.toFixed(2)}`;
    if (totalFinalHeader) totalFinalHeader.textContent = `R$ ${totals.final.toFixed(2)}`;
}

// --- Import & Config Logic ---
btnOpenImport.addEventListener('click', () => {
    inputConfigIp.value = localStorage.getItem('config_ip') || '';
    inputConfigSeller.value = localStorage.getItem('config_seller') || '';
    importModal.classList.remove('hidden');
});
document.getElementById('close-import').addEventListener('click', () => importModal.classList.add('hidden'));

btnProcessImport.addEventListener('click', () => {
    vibrate(50);
    // Save configurations
    configIp = inputConfigIp.value || 'localhost';
    configSeller = inputConfigSeller.value || '';
    configPixKey = inputConfigPixKey.value || '81997834549';

    localStorage.setItem('config_ip', configIp);
    localStorage.setItem('config_seller', configSeller);
    localStorage.setItem('config_pix_key', configPixKey);
    if (displayVendedor) displayVendedor.textContent = configSeller || "Sanzony";

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

// Clear Order Logic
if (btnClearOrder) {
    btnClearOrder.addEventListener('click', () => {
        if (cart.items.length === 0) return;
        if (confirm("Tem certeza que deseja limpar toda a venda?")) {
            cart.clear();
            renderCart();
            vibrate(100);
        }
    });
}

// Sales Export Logic
btnExportSales.addEventListener('click', () => {
    vibrate(50);
    if (salesHistory.length === 0) {
        alert("Nenhuma venda registrada hoje.");
        return;
    }

    const csv = Papa.unparse(salesHistory);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `vendas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

// --- Thermal Ticket Generation (Epson i8 / 58mm) ---
function generatePrintLayout(data) {
    const printArea = document.getElementById('print-area');
    printArea.className = 'mode-thermal';

    const itemsHtml = data.itens.map(item => `
        <div class="thermal-item">
            <div class="thermal-item-name">${item.descricao.toUpperCase()}</div>
            <div class="thermal-item-details">
                <span>${item.quantidade} x R$ ${(item.total/item.quantidade).toFixed(2)}</span>
                <span>R$ ${item.total.toFixed(2)}</span>
            </div>
        </div>
    `).join('');

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(configPixKey)}`;

    printArea.innerHTML = `
        <div class="thermal-header">
            <h3>${data.empresa}</h3>
            <p>${data.endereco}</p>
            <p>TELEFONE: ${data.telefone}</p>
        </div>

        <div class="thermal-divider-triple"></div>
        
        <div class="thermal-row-box">
            <span>Sequência:</span>
            <span class="thermal-val-big">${data.sequencia}</span>
        </div>

        <div class="thermal-info">
            <div class="thermal-row"><span>Operação:</span> <strong>${data.operacao}</strong></div>
            <div class="thermal-row"><span>Data:</span> ${data.data} ${data.hora}</div>
            <div class="thermal-row"><span>Vendedor:</span> ${data.vendedor.toUpperCase()}</div>
            <div class="thermal-row"><span>Cliente:</span> ${data.cliente.toUpperCase()}</div>
        </div>

        <div class="thermal-divider"></div>
        
        <div class="thermal-table-header">
            <span>Descrição / Detalhes</span>
            <span>Subtotal</span>
        </div>
        
        <div class="thermal-items-list">
            ${itemsHtml}
        </div>

        <div class="thermal-divider"></div>

        <div class="thermal-totals">
            <div class="thermal-row"><span>Valor Total Prod R$:</span> <span>${data.totalProdutos.toFixed(2)}</span></div>
            ${data.descontos > 0 ? `<div class="thermal-row"><span>Descontos R$:</span> <span>${data.descontos.toFixed(2)}</span></div>` : ''}
            <div class="thermal-row thermal-final"><span>VALOR TOTAL R$:</span> <span>${data.totalFinal.toFixed(2)}</span></div>
            <div class="thermal-row"><span>Pagamento:</span> <span>${data.pagamento}</span></div>
        </div>

        <div class="thermal-divider-dashed"></div>

        <div class="thermal-footer">
            <p>Confira a mercadoria no ato da entrega</p>
            <p>Não aceitamos reclamações posteriores</p>
            <p>* Alteração de preço sem prévio aviso *</p>
            
            <div class="thermal-pix-section">
                <p><strong>Pague com PIX</strong></p>
                <img src="${qrCodeUrl}" alt="QR Code Pix" class="pix-qr">
                <p style="font-size: 8pt; margin-top: 4px;">Chave: ${configPixKey}</p>
            </div>

            <p style="font-size: 7pt; margin-top: 10px; opacity: 0.7;">PDV Torres Mobile - v2.0</p>
        </div>
    `;
}

btnPrint.addEventListener('click', () => {
    vibrate(80);
    if (cart.items.length === 0) {
        emptyCartModal.classList.remove('hidden');
        return;
    }

    const sequence = getNextSequence();
    const totals = cart.getTotals();
    const client = clientName.value || "Cliente Balcão";

    const data = {
        empresa: ENTERPRISE.nome,
        endereco: ENTERPRISE.endereco,
        telefone: ENTERPRISE.contato,
        whatsapp: configPixKey, // Assuming Pix key (phone) is also WhatsApp
        sequencia: sequence,
        operacao: orderType,
        pagamento: paymentMethod.value,
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR'),
        vendedor: configSeller || "Sanzony",
        cliente: client,
        itens: cart.items.map(item => ({
            quantidade: item.quantity,
            descricao: item.name,
            total: item.totalFinal
        })),
        totalProdutos: totals.gross,
        descontos: totals.discount,
        totalFinal: totals.final
    };

    // Save history & Client
    salesHistory.push(data);
    localStorage.setItem('sales_history', JSON.stringify(salesHistory));
    saveRecentClient(client);

    // Prepare Layout
    generatePrintLayout(data);

    // Send to Electronic/Remote Print Server if IP is configured
    if (configIp && configIp !== 'localhost') {
        let urlBase = configIp.trim();
        if (urlBase.endsWith('/')) urlBase = urlBase.slice(0, -1);
        
        let serverUrl = '';
        // Se for Ngrok, removemos a porta :3000 se o usuário colou e forçamos HTTPS
        if (urlBase.includes('ngrok')) {
            // Remove qualquer :porta (ex: :3000) e protocolos
            let cleanUrl = urlBase.split(':')[0]
                .replace('http://', '')
                .replace('https://', '')
                .replace('//', '');
            
            // Reconstrói URL segura
            serverUrl = `https://${cleanUrl}/imprimir`;
        } else if (urlBase.startsWith('http://') || urlBase.startsWith('https://')) {
            serverUrl = `${urlBase}/imprimir`;
        } else {
            serverUrl = urlBase.includes(':') ? `http://${urlBase}/imprimir` : `http://${urlBase}:3000/imprimir`;
        }
        
        fetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(res => {
            if (res.success) {
                console.log("Impressão enviada para o servidor remoto com sucesso.");
            } else {
                console.error("Erro no servidor de impressão:", res.error);
                alert("Erro ao imprimir no servidor Windows: " + res.error);
            }
        })
        .catch(err => {
            console.error("Servidor de impressão inacessível:", err);
            // Fallback to browser print if remote fails
            window.print();
        });
    } else {
        // Fallback/Local Browser printing
        window.print();
    }

    // Show Success Screen
    successMsg.textContent = `${orderType} #${sequence} finalizado com sucesso.`;
    successScreen.classList.remove('hidden');
});

btnNextOrder.addEventListener('click', () => {
    vibrate(50);
    // Reset UI & Cart
    cart.items = [];
    cart.notify();
    clientName.value = "Cliente Balcão";
    localStorage.removeItem('active_cart'); // Clear persistence for fresh order
    successScreen.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// --- Startup ---
loadCartState();
renderRecentClients();

// Modal Listeners
btnCloseEmptyCart.addEventListener('click', () => {
    emptyCartModal.classList.add('hidden');
});
