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

// SYNC ENDPOINTS
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

// LOGICA DE IMPRESSÃO - LAYOUT OFICIAL "COMERCIAL TORRES"
async function printOrder(data) {
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: PRINTER_INTERFACE,
    characterSet: CharacterSet.PC850,
    removeSpecialCharacters: false,
    lineCharacter: "-",
    width: 32, // Elgin i8
  });

  const isConnected = await printer.isPrinterConnected();
  if (!isConnected && !PRINTER_INTERFACE.startsWith('printer:')) {
    console.error("Impressora offline:", PRINTER_INTERFACE);
  }

  // --- CABEÇALHO OFICIAL ---
  printer.alignCenter();
  printer.setTextSize(1, 1);
  printer.bold(true);
  printer.println(data.empresa || "COMERCIAL TORRES");
  printer.bold(false);
  printer.setTextNormal();
  printer.println(data.endereco || "RUA MARQUES DE OLINDA-601");
  printer.println(data.cidade || "CENTRO-SIRINHAEM");
  printer.println(`FONE: ${data.telefone || "(81) 3577-1419"}`);
  if (data.whatsapp) printer.println(`WHATSAPP ${data.whatsapp}`);
  
  printer.drawLine();

  // --- BLOCO IDENTIFICAÇÃO (Estilo Nota Oficial) ---
  printer.alignLeft();
  printer.bold(true);
  printer.println(`Sequencia:         ${data.sequencia || '00000'}`);
  printer.bold(false);
  
  printer.alignRight();
  printer.println(`Operacao:  ${(data.operacao || 'Orcamento').toUpperCase()}`);
  
  printer.alignLeft();
  printer.println(`Data: ${data.data} ${data.hora}`);
  printer.println(`Nome do Vendedor: ${data.vendedor || 'KLEBER'}`);
  printer.println(`Nome: ${data.cliente || 'CLIENTE BALCAO'}`);
  
  printer.drawLine();

  // --- TABELA DE ITENS ---
  // Layout: Descricao: | Qtde. | Preco Unit. | TOTAL
  printer.tableCustom([
    { text: "Descricao:", align: "LEFT", width: 0.40 },
    { text: "Qt.", align: "LEFT", width: 0.10 },
    { text: "Unit.", align: "LEFT", width: 0.25 },
    { text: "TOTAL", align: "RIGHT", width: 0.25 }
  ]);
  printer.drawLine();

  data.itens.forEach(item => {
      // Primeira linha: Nome do produto
      printer.println(item.descricao);
      // Segunda linha: Valores
      printer.tableCustom([
        { text: "", align: "LEFT", width: 0.40 },
        { text: `${item.quantidade}`, align: "LEFT", width: 0.10 },
        { text: `${(item.unitario || 0).toFixed(2)}`, align: "LEFT", width: 0.25 },
        { text: `${(item.total || 0).toFixed(2)}`, align: "RIGHT", width: 0.25 }
      ]);
  });

  printer.drawLine();

  // --- TOTAIS FINAIS ---
  printer.alignRight();
  printer.println(`Valor Total Produtos R$: ${data.totalProdutos.toFixed(2)}`);
  if (data.descontos > 0) {
    printer.println(`Descontos R$: ${data.descontos.toFixed(2)}`);
  }
  
  printer.newLine();
  printer.bold(true);
  printer.println(`valor Total R$: ${data.totalFinal.toFixed(2)}`);
  printer.bold(false);

  printer.drawLine();

  // --- REGRAS DA LOJA (RODAPÉ) ---
  printer.alignCenter();
  printer.bold(true);
  printer.println("Confira a mercadoria no ato da entrega");
  printer.println("Nao Aceitamos Reclamacoes Posteriores");
  printer.bold(false);
  printer.println("*Se Orcamento,");
  printer.println("Alteracao de preco sem Previo Aviso*");
  
  printer.newLine();
  printer.newLine();
  printer.cut();

  try {
    await printer.execute();
    return { success: true };
  } catch (error) {
    console.error("Erro Elgin:", error);
    throw error;
  }
}

// ROTAS
app.post('/imprimir', async (req, res) => {
  try {
    await printOrder(req.body);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(port, () => {
  console.log(`\n=========================================`);
  console.log(`COMERCIAL TORRES - PDV`);
  console.log(`Porta: ${port}`);
  console.log(`=========================================\n`);
});
