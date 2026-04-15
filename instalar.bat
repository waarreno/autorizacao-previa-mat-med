@echo off
chcp 65001 > nul
title Autorização Prévia Mat/Med — Instalação

echo.
echo =============================================================
echo   Autorização Prévia Mat/Med v1.0.0 — Instalar Dependências
echo =============================================================
echo.

:: -------------------------------------------------------
:: Verifica Node.js instalado globalmente
:: -------------------------------------------------------
node -v > nul 2>&1
if not errorlevel 1 (
    echo [OK] Node.js instalado globalmente detectado:
    node -v
    echo.
    goto :instalar_deps
)

:: -------------------------------------------------------
:: Node.js global não encontrado — verifica portável local
:: -------------------------------------------------------
echo [INFO] Node.js não encontrado no sistema.

if exist "node_portavel\node.exe" (
    echo [OK] Node.js portável já presente na pasta node_portavel.
    goto :usar_portavel
)

:: -------------------------------------------------------
:: Download do Node.js portável via PowerShell (BITS)
:: -------------------------------------------------------
echo.
echo Baixando Node.js portável v22.14.0 (~30 MB)...
echo Aguarde — usando transferência acelerada via BITS...
echo.

set NODE_URL=https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip
set NODE_ZIP=node_portavel.zip

:: BITS (Background Intelligent Transfer Service) — mais rápido e com retry automático
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-BitsTransfer -Source '%NODE_URL%' -Destination '%NODE_ZIP%' -Priority Foreground"

if not exist "%NODE_ZIP%" (
    echo.
    echo [AVISO] BITS falhou. Tentando via WebClient...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('%NODE_URL%', '%NODE_ZIP%')"
)

if not exist "%NODE_ZIP%" (
    echo.
    echo [ERRO] Não foi possível baixar o Node.js.
    echo        Verifique sua conexão e tente novamente.
    pause
    exit /b 1
)

echo.
echo [OK] Download concluído. Extraindo...

:: Extração via PowerShell (nativa, sem 7zip)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath 'node_portavel_tmp' -Force"

:: Move o conteúdo da subpasta para node_portavel/
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem 'node_portavel_tmp\node-v22.14.0-win-x64' | Move-Item -Destination 'node_portavel' -Force"

:: Limpa temporários
rmdir /s /q node_portavel_tmp 2>nul
del /f /q "%NODE_ZIP%" 2>nul

if not exist "node_portavel\node.exe" (
    echo.
    echo [ERRO] Extração falhou. Pasta node_portavel\node.exe não encontrada.
    pause
    exit /b 1
)

echo [OK] Node.js portável extraído com sucesso.

:usar_portavel
:: Adiciona node_portavel ao PATH desta sessão
set PATH=%CD%\node_portavel;%CD%\node_portavel\node_modules\.bin;%PATH%
echo [OK] Node.js portável adicionado ao PATH desta sessão.
set /p DUMMY=      Versão: <nul
node -v
echo.
goto :instalar_deps

:: -------------------------------------------------------
:: Instalação das dependências npm
:: -------------------------------------------------------
:instalar_deps
echo Instalando dependências do projeto (playwright, xlsx, dotenv)...
call npm install
if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao instalar dependências via npm.
    pause
    exit /b 1
)

echo.
echo Instalando navegador Chromium do Playwright...
call npx playwright install chromium
if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao instalar o Chromium do Playwright.
    pause
    exit /b 1
)

:: Cria pastas necessárias se não existirem
if not exist "dados" mkdir dados
if not exist "logs"  mkdir logs
if not exist "scripts" mkdir scripts

echo.
echo ============================================
echo   Instalação concluída com sucesso!
echo ============================================
echo.
echo   Próximos passos:
echo   - Coloque sua planilha em:      dados\base.xlsx
echo   - Preencha as credenciais em:   .env
echo   - Para executar:                2_executar.bat
echo.
echo   Copyright (c) 2026 Wárreno Hendrick Costa Lima Guimarães
echo.
pause