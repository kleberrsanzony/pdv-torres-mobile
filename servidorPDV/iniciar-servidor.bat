@echo off
TITLE SERVIDOR DE IMPRESSAO PDV
SETLOCAL EnableDelayedExpansion

:: Verifica se o Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js não encontrado!
    echo Por favor, instale o Node.js em https://nodejs.org/
    pause
    exit /b
)

echo [INFO] Iniciando Servidor de Impressão PDV...
echo.

:: Verifica se a pasta node_modules existe, senao instala
if not exist "node_modules\" (
    echo [AVISO] Bibliotecas não encontradas. Instalando (isso pode levar uns segundos)...
    call npm install --no-fund --no-audit
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao instalar as dependências. Verifique sua conexão.
        pause
        exit /b
    )
)

:: Inicia o servidor
echo [SUCESSO] Servidor pronto para receber pedidos na porta 3000.
echo [DICA] Mantenha esta janela aberta para o servidor funcionar.
echo.

:: Executa o servidor
node server.js

:: Se o servidor parar por algum erro, nao fecha a janela imediatamente
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] O servidor parou inesperadamente.
    pause
)
