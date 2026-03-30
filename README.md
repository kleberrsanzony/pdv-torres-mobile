# PDV Torres Mobile 🚀🛡️
**Sistema Ponto de Venda Mobile PWA com Impressão Térmica Remota**

O PDV Torres Mobile é um sistema de balcão desenhado para uso em dispositivos móveis (via navegador como um aplicativo nativo PWA), com integração direta com impressoras térmicas ESC/POS conectadas a um servidor Windows na rede local.

---

## 💻 Instalação e Execução (Frontend)

1. **Instale as dependências:**
   Abra o terminal na raiz do projeto e execute:
   ```bash
   npm install
   ```

2. **Inicie o Servidor de Desenvolvimento:**
   Para rodar no seu PC e acessar pelo celular na mesma rede:
   ```bash
   npm run dev -- --host
   ```
   > O terminal mostrará o IP local (ex: `http://192.168.x.x:5173`). Digite esse endereço no navegador do celular.
   
3. **Instale como App (PWA):**
   No celular (Chrome ou Safari), abra o menu do navegador e selecione **"Adicionar à Tela de Início"**. Isso torna a experiência em tela cheia (nativa).

---

## ⚙️ Configurações Iniciais no App

Ao acessar o aplicativo, clique no ícone de engrenagem ⚙️ (Canto superior esquerdo) para configurar:

1. **IP do Servidor de Impressão:** O endereço IP do Computador Windows e a porta (padrão `:3000`).
   * *Exemplo: `192.168.3.228:3000`*
2. **Nome do Vendedor:** Identificação de quem está usando o PDV.
3. **Chave Pix / WhatsApp:** Chave utilizada para gerar o QR Code Pix no final do ticket. Esse mesmo número é faturado no servidor de impressão como o contato WhatsApp.

---

## 🛠️ Como Personalizar o PDV (Avançado)

Toda a configuração de catálogo e identidade visual e metadados estão localizados no arquivo `src/main.js` ou `index.html`.

### > Como alterar o Nome ou Contato da Empresa
No arquivo `src/main.js`, localize a constante `ENTERPRISE` (Geralmente no topo do arquivo) e altere entre as aspas:
```javascript
const ENTERPRISE = {
    nome: "PDV Torres",
    endereco: "Av. Principal, 1000 - Centro",
    contato: "(11) 99999-9999 / WhatsApp"
};
```

### > Como adicionar ou alterar Produtos (Atalhos Predefinidos)
Também no arquivo `src/main.js`, localize a array `quickProducts` e modifique os objetos:
```javascript
const quickProducts = [
    { id: '1', name: 'Cimento CP', price: 54.44 },
    { id: '2', name: 'Tijolo Furo 8', price: 0.95 },
    { id: '3', name: 'Areia Lavada (M³)', price: 120.00 },
    // Para adicionar mais produtos, siga o formato:
    // { id: '4', name: 'NOVO PRODUTO', price: 10.50 }
];
```

---

## 📁 Estrutura do Projeto

* `index.html`: A interface (UI) principal do aplicativo.
* `src/main.js`: Lógica principal, Integração com Servidor Local via Fetch e Configurações de Empresa.
* `src/cart.js`: Regras de negócio do Carrinho (Totalizadores e Impostos).
* `src/style.css`: Estilização e Temas Visuais (Otimizado para PWA).
* `servidorPDV/`: Pasta do Backend de Impressão (Verifique o `README.md` de lá para mais detalhes).
* `public/`: Iconografia e Manifesto da Instalação do PWA.

---

**Desenvolvido sob o padrão estrutural Sanzony Tech.** 🛡️
