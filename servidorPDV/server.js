const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { ThermalPrinter, PrinterTypes, CharacterSet } = require('node-thermal-printer');

const app = express();
const port = 3000;

// Configurações
app.use(cors());
app.use(bodyParser.json());

/**
 * CONFIGURAÇÃO DA IMPRESSORA
 * No Windows, use 'printer:NOME_DA_IMPRESSORA'
 * No Linux/Mac via USB, pode ser '/dev/usb/lp0'
 */
const PRINTER_INTERFACE = process.env.PRINTER_NAME || 'printer:ELGIN i8 (Copiar 1)';

const fs = require('fs');
const path = require('path');

const PRODUCTS_FILE = path.join(__dirname, 'products.json');

// --- PRODUCT SYNC ENDPOINTS ---

// GET: Fetch products from server
app.get('/produtos', (req, res) => {
    if (!fs.existsSync(PRODUCTS_FILE)) {
        return res.json([]);
    }
    try {
        const data = fs.readFileSync(PRODUCTS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: "Erro ao ler produtos" });
    }
});

// POST: Save products to server
app.post('/produtos', (req, res) => {
    try {
        const products = req.body;
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
        console.log(`LOG: Catálogo atualizado com ${products.length} itens.`);
        res.json({ success: true, count: products.length });
    } catch (err) {
        res.status(500).json({ error: "Erro ao salvar produtos" });
    }
});

async function printOrder(data) {
  const printer = new ThermalPrinter({
    type: 'epson', // Usando string direta para evitar erro de driver
    interface: PRINTER_INTERFACE,
    characterSet: CharacterSet.PC850,
    removeSpecialCharacters: false,
    lineCharacter: "=",
    width: 33, // 33 caracteres para impressoras térmicas de 58mm
  });

  const isConnected = await printer.isPrinterConnected();
  if (!isConnected && !PRINTER_INTERFACE.startsWith('printer:')) {
    console.error("ERRO: Impressora não detectada na interface:", PRINTER_INTERFACE);
  }

  // --- TOPO/EMPRESA ---
  printer.alignCenter();
  printer.setTextSize(1, 1);
  printer.bold(true);
  printer.println(data.empresa.toUpperCase());
  printer.bold(false);
  printer.setTextNormal();
  printer.println(data.endereco);
  printer.println(`Fone: ${data.telefone}`);
  if (data.whatsapp) printer.println(`WhatsApp: ${data.whatsapp}`);

  printer.drawLine(); // ================================

  // --- INFO PEDIDO ---
  printer.alignLeft();
  printer.bold(true);
  printer.println(`${data.operacao.toUpperCase()} Nº: ${data.sequencia}`);
  printer.bold(false);
  printer.println(`Data: ${data.data} - Hora: ${data.hora}`);
  printer.println(`Vendedor: ${data.vendedor}`);
  printer.println(`Cliente: ${data.cliente}`);

  printer.drawLine(); // ================================

  // --- CABEÇALHO ITENS ---
  // Formato: Qtd | Descrição | Valor
  printer.tableCustom([
    { text: "QTD", align: "LEFT", width: 0.15 },
    { text: "DESCRICAO", align: "LEFT", width: 0.55 },
    { text: "TOTAL", align: "RIGHT", width: 0.30 }
  ]);
  printer.drawLine();

  // --- LISTA DE ITENS ---
  data.itens.forEach(item => {
    printer.tableCustom([
      { text: item.quantidade.toString(), align: "LEFT", width: 0.15 },
      { text: item.descricao, align: "LEFT", width: 0.55 },
      { text: item.total.toFixed(2), align: "RIGHT", width: 0.30 }
    ]);
  });

  printer.drawLine();

  // --- TOTAIS ---
  printer.alignRight();
  printer.println(`Total Produtos: R$ ${data.totalProdutos.toFixed(2)}`);
  if (data.descontos > 0) {
    printer.println(`Descontos: R$ ${data.descontos.toFixed(2)}`);
  }
  if (data.pagamento) {
    printer.println(`Pagamento: ${data.pagamento.toUpperCase()}`);
  }

  printer.newLine();
  printer.setTextDoubleHeight();
  printer.setTextDoubleWidth();
  printer.bold(true);
  printer.println(`TOTAL: R$ ${data.totalFinal.toFixed(2)}`);
  printer.bold(false);
  printer.setTextNormal();

  printer.newLine();
  printer.alignCenter();
  printer.println("Obrigado pela preferência!");
  printer.newLine();

  // CORTE E EXECUÇÃO
  printer.cut();

  try {
    let execute = await printer.execute();
    console.log("LOG: Impressão realizada com sucesso.");
    return { success: true, message: "Impresso com sucesso" };
  } catch (error) {
    console.error("ERRO na impressão:", error);
    throw error;
  }
}

// ROTA PRINCIPAL
app.post('/imprimir', async (req, res) => {
  console.log("LOG: Pedido recebido de", req.body.cliente);
  try {
    await printOrder(req.body);
    res.status(200).json({ success: true, message: "Impressão enviada" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROTA DE TESTE
app.get('/teste', async (req, res) => {
  console.log("LOG: Teste de impressão solicitado");
  const testData = {
    empresa: "TESTE DE IMPRESSÃO",
    endereco: "Servidor PDV Local",
    telefone: "(00) 0000-0000",
    whatsapp: "",
    sequencia: 0,
    operacao: "Teste",
    data: new Date().toLocaleDateString(),
    hora: new Date().toLocaleTimeString(),
    vendedor: "SISTEMA",
    cliente: "TESTE LOCAL",
    itens: [{ descricao: "ITEM TESTE", quantidade: 1, unitario: 0, total: 0 }],
    totalProdutos: 0,
    descontos: 0,
    totalFinal: 0
  };

  try {
    await printOrder(testData);
    res.send("Teste enviado para a impressora!");
  } catch (error) {
    res.status(500).send("Erro no teste: " + error.message);
  }
});

app.listen(port, () => {
  console.log(`\n=========================================`);
  console.log(`SERVIDOR PDV - IMPRESSÃO AUTOMÁTICA`);
  console.log(`Porta: ${port}`);
  console.log(`Impressora: ${PRINTER_INTERFACE}`);
  console.log(`Endpoint: POST http://192.168.3.228:${port}/imprimir`);
  console.log(`Teste: GET http://192.168.3.228:${port}/teste`);
  console.log(`=========================================\n`);
});
