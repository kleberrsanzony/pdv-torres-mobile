const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { ThermalPrinter, PrinterTypes, CharacterSet } = require('node-thermal-printer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const PRINTER_INTERFACE = process.env.PRINTER_NAME || 'printer:ELGIN i8 (Copiar 1)';
const PRODUCTS_FILE = path.join(__dirname, 'products.json');

app.get('/produtos', (req, res) => {
    if (!fs.existsSync(PRODUCTS_FILE)) return res.json([]);
    try { res.json(JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'))); } 
    catch (err) { res.status(500).json({ error: "Erro ao ler" }); }
});

app.post('/produtos', (req, res) => {
    try {
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Erro ao salvar" }); }
});

async function printOrder(data) {
  console.log("LOG: Iniciando Motor Epson...");

  // USANDO CONSTANTE OFICIAL PARA EVITAR 'NO DRIVER SET!'
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON || 'epson', 
    interface: PRINTER_INTERFACE,
    characterSet: CharacterSet.PC850,
    removeSpecialCharacters: false,
    lineCharacter: "-",
    width: 32, // Largura ideal Elgin
  });

  try {
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) console.warn("ALERTA: Impressora não detectada pelo sistema!");

    // --- CABEÇALHO ---
    printer.alignCenter();
    printer.bold(true);
    printer.println(String(data.empresa || "COMERCIAL TORRES").toUpperCase());
    printer.bold(false);
    printer.println(String(data.endereco || "RUA MARQUES DE OLINDA-601"));
    printer.println(String(data.cidade || "CENTRO-SIRINHAEM"));
    printer.println(`FONE: ${String(data.telefone || "(81) 3577-1419")}`);
    if (data.whatsapp) printer.println(`WHATSAPP ${String(data.whatsapp)}`);
    
    printer.drawLine();

    // --- IDENTIFICAÇÃO ---
    printer.alignLeft();
    printer.bold(true);
    printer.println(`Sequencia:         ${String(data.sequencia || '00000')}`);
    printer.bold(false);
    
    printer.alignRight();
    printer.println(`Operacao:  ${String(data.operacao || 'Orcamento').toUpperCase()}`);
    
    printer.alignLeft();
    printer.println(`Data: ${String(data.data || '')} ${String(data.hora || '')}`);
    printer.println(`Vendedor: ${String(data.vendedor || 'KLEBER')}`);
    printer.println(`Nome: ${String(data.cliente || 'CLIENTE BALCAO')}`);
    
    printer.drawLine();

    // --- TABELA ---
    printer.tableCustom([
      { text: "Descricao:", align: "LEFT", width: 0.40 },
      { text: "Qt.", align: "LEFT", width: 0.10 },
      { text: "Unit.", align: "LEFT", width: 0.25 },
      { text: "TOTAL", align: "RIGHT", width: 0.25 }
    ]);
    printer.drawLine();

    if (Array.isArray(data.itens)) {
        data.itens.forEach(item => {
            printer.println(String(item.descricao || "ITEM").toUpperCase());
            printer.tableCustom([
              { text: "", align: "LEFT", width: 0.40 },
              { text: `${item.quantidade || 1}`, align: "LEFT", width: 0.10 },
              { text: `${(parseFloat(item.unitario) || 0).toFixed(2)}`, align: "LEFT", width: 0.25 },
              { text: `${(parseFloat(item.total) || 0).toFixed(2)}`, align: "RIGHT", width: 0.25 }
            ]);
        });
    }

    printer.drawLine();

    // --- TOTAIS ---
    printer.alignRight();
    printer.println(`Valor Total Produtos R$: ${(parseFloat(data.totalProdutos) || 0).toFixed(2)}`);
    if (parseFloat(data.descontos) > 0) {
      printer.println(`Descontos R$: ${(parseFloat(data.descontos) || 0).toFixed(2)}`);
    }
    
    printer.newLine();
    printer.bold(true);
    printer.println(`valor Total R$: ${(parseFloat(data.totalFinal) || 0).toFixed(2)}`);
    printer.bold(false);

    printer.drawLine();

    // --- RODAPÉ ---
    printer.alignCenter();
    printer.println("Confira a mercadoria no ato da entrega");
    printer.println("Nao Aceitamos Reclamacoes Posteriores");
    printer.println("*Se Orcamento,");
    printer.println("Alteracao de preco sem Previo Aviso*");
    
    printer.newLine();
    printer.newLine();
    printer.cut();

    await printer.execute();
    console.log("SUCESSO: Impressão oficial enviada para a Elgin i8!");
    return { success: true };
  } catch (error) {
    console.error("ERRO DURANTE IMPRESSÃO:", error);
    throw error;
  }
}

app.post('/imprimir', async (req, res) => {
  console.log("LOG: Recebido pedido para Comercial Torres:", req.body.cliente);
  try {
    await printOrder(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error("ERRO NO POST:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`\n=========================================`);
  console.log(`COMERCIAL TORRES - PDV (CORREÇÃO DE DRIVER)`);
  console.log(`Porta: ${port}`);
  console.log(`=========================================\n`);
});
