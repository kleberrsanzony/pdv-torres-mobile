# 🖨️ Gateway de Impressão Térmica (Servidor PDV) 
**Módulo Backend Windows - Impressão ESC/POS**

Este é o servidor autônomo e responsável por receber as ordens de impressão do Celular (PWA) via WiFi (Network) e descarregar no controlador da impressora local (Ex: Elgin i8).

---

## 🛠️ Instalação no Windows

1. **Dependências do Servidor:**
   Acesse a pasta `servidorPDV` pelo PowerShell do Windows ou Prompt de Comando, e instale os pacotes:
   ```bash
   npm install
   ```

2. **Como Iniciar Constantemente Usando PM2 (Recomendado)**
   O PM2 permite iniciar o servidor ocultamente sem a tela preta e ainda com auto-inicialização no Windows. Rode:
   ```bash
   npm install -g pm2
   npm install -g pm2-windows-startup
   
   pm2 start server.js --name "vendas-print-server"
   
   pm2-startup install
   pm2 save
   ```

---

## 💻 Gerenciando o Servidor (Comandos do Dia a Dia)

Uma vez que o `vendas-print-server` está ativo via PM2, use o CMD de qualquer parte do seu Windows para agir:

* **Logs: Ver os Recibos sendo Gerados Hoje**
  ```bash
  pm2 logs vendas-print-server
  ```
* **Reiniciar: O Servidor após Alterações Code/Hardware**
  ```bash
  pm2 restart vendas-print-server
  ```
* **Como Parar Tudo:**
  ```bash
  pm2 stop vendas-print-server
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
