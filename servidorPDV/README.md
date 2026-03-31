# Servidor de Impressão PDV Torres 🖨️⚙️
**Backend em Node.js para Impressão Térmica Direta (ESC/POS)**

Este servidor recebe os dados do PWA (via HTTPS/Ngrok) e comanda a impressora térmica conectada ao Windows.

---

## 🛠️ Configuração no Windows

### 1. Nome da Impressora
A impressora deve estar instalada no Windows com o nome **exato**:
`ELGIN i8 (Copiar 1)`
*(Se o nome for diferente, altere no arquivo `server.js` na linha 18).*

### 2. Rodando via PM2 (Início Automático)
Para que o servidor inicie sozinho com o Windows e rode em background:
1. Instale o PM2 globalmente: `npm install pm2 -g`
2. Instale o iniciador de serviço: `npm install pm2-windows-startup -g`
3. Na pasta do servidor, rode:
   ```cmd
   pm2 start server.js --name "servidor-pdv"
   pm2 save
   ```

---

## 🔌 Configuração de Impressora (TCP/IP Fix)

O Servidor PDV está configurado para o protocolo de estabilidade máxima **TCP/IP da Máquina**, no arquivo `server.js`. 

Mude a constante `PRINTER_INTERFACE` caso o roteador mude o IP da ELGIN ou se instalar outra máquina térmica:
```javascript
// Exemplo Atual via TCP (Porta Padrão é a 9100)
const PRINTER_INTERFACE = process.env.PRINTER_NAME || 'tcp://192.168.3.245';

// Exemplo via USB Driver do Windows
// const PRINTER_INTERFACE = 'printer:ELGIN i8 (Copiar 1)';
```

## 🚑 Solução de Erros (Troubleshooting)

### "No driver set!" no PM2 Logs
Verifique a linha 22 do seu `server.js`. Em impressoras clones ou Epson Compatible (Como Elgin i8), você **DEVE FORÇAR** a string para `'epson'` na configuração de Type, como mostrado abaixo:
```javascript
  const printer = new ThermalPrinter({
    type: 'epson', // Mantenha isso fixo
    interface: PRINTER_INTERFACE,
    width: 33, // 58mm Paper
  });
```

### O Celular Mostra Sucesso mas não Caiu Papel
1. Confirme no celular se a configuração IP na engrenagem está para **`Seu_IP_Local:3000`** (Ex: `192.168.x.x:3000`).
2. Confirme via CMD se a impressora local está respondendo a pings pro IP final dela (`ping 192.168.3.245`).
3. Rode `pm2 logs` e certifique-se de que a requisição de rede entrou.
