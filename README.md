# PDV Torres Mobile 🚀🛡️
**Sistema Ponto de Venda Mobile PWA com Impressão Térmica Remota**

O PDV Torres Mobile é um sistema de balcão de alta performance desenhado para dispositivos móveis (PWA), com integração via túnel seguro para impressoras térmicas ESC/POS conectadas a um servidor Windows.

---

## 🚀 Como Rodar o PDV Torres (Produção)

Este sistema já está configurado para o fluxo **PWA (Vercel) <-> Ngrok (Túnel) <-> Windows (Servidor)**.

### 1. Servidor de Impressão (Windows)
A impressora **ELGIN i8** deve estar conectada e o servidor Node rodando via PM2:
*   O servidor escuta na porta `3000`.
*   O serviço de túnel **Ngrok** inicia automaticamente com o Windows (Service).

### 2. Acesso via Celular (PWA)
Acesse o link gerado pela **Vercel** no seu celular:
1.  Abra o menu do navegador e selecione **"Adicionar à Tela de Início"**.
2.  No App, clique na engrenagem ⚙️ (Configurações).
3.  No campo **IP do Servidor**, cole o seu link fixo: `seu-link-estatico.ngrok-free.app`.
4.  Pronto! Suas vendas sairão na impressora do balcão de qualquer lugar (mesmo no 4G).

---

## 🛠️ Manutenção e Configuração do Túnel (Ngrok)

Se precisar reinstalar ou trocar o túnel no Windows (CMD como Admin):
```cmd
:: Parar e remover o serviço antigo (se houver)
ngrok service uninstall

:: Instalar o novo serviço usando o ngrok.yml corrigido
ngrok service install --config "%LocalAppData%\ngrok\ngrok.yml"

:: Iniciar o serviço
ngrok service start
```

---

## ⚙️ Estrutura do Projeto

*   `src/index.html`: UI principal otimizada com abas e grid de pagamentos.
*   `src/main.js`: Lógica de vendas, arredondamento e integração com Ngrok (HTTPS).
*   `src/style.css`: Estilização Premium Dark Mode e regras de impressão térmica.
*   `servidorPDV/`: Backend em Node.js para comunicação direta com a Elgin i8.
*   `public/`: Ícones e Manifesto PWA.

---

**Desenvolvido com excelência por Sanzony Tech 2026.** 🛡️✨
**Status do Projeto: PRODUÇÃO 🚀**
