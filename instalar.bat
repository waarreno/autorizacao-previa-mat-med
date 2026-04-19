@echo off
chcp 65001 > nul
title Autorização Prévia Mat/Med — Instalação

echo.
echo =============================================================
echo   Autorização Prévia Mat/Med v1.0.0 — Instalar Dependências
echo =============================================================
echo.

:: -------------------------------------------------------
:: Node.js portável — sempre usa a cópia local na raiz
:: -------------------------------------------------------
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "NODE_DIR=%ROOT%\node_portavel"
set "NODE_URL=https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip"
set "NODE_ZIP=%ROOT%\node_portavel.zip"
set "NODE_INNER=node-v22.14.0-win-x64"

if exist "%NODE_DIR%\node.exe" (
    echo [OK] Node.js portável já presente em node_portavel.
    goto :usar_portavel
)

echo Baixando Node.js portável v22.14.0 (~30 MB)...
echo.

:: 1ª tentativa: curl nativo (Windows 10+) — mais rápido, sem overhead do PowerShell
curl -L --progress-bar -o "%NODE_ZIP%" "%NODE_URL%"

:: 2ª tentativa: BITS via PowerShell
if not exist "%NODE_ZIP%" (
    echo [AVISO] curl falhou. Tentando via BITS...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-BitsTransfer -Source '%NODE_URL%' -Destination '%NODE_ZIP%' -Priority Foreground"
)

:: 3ª tentativa: WebClient
if not exist "%NODE_ZIP%" (
    echo [AVISO] BITS falhou. Tentando via WebClient...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%NODE_URL%','%NODE_ZIP%')"
)

if not exist "%NODE_ZIP%" (
    echo.
    echo [ERRO] Nao foi possivel baixar o Node.js.
    echo        Verifique sua conexao e tente novamente.
    pause
    exit /b 1
)

echo.
echo [OK] Download concluido. Extraindo...

:: Extração via tar (nativo no Windows 10+) — muito mais rápido que Expand-Archive
:: pushd/popd evita o bug do tar com -C e caminhos com espaços
pushd "%ROOT%"
tar -xf "%NODE_ZIP%"
popd
if errorlevel 1 (
    :: Fallback: Expand-Archive do PowerShell
    echo [AVISO] tar falhou. Usando Expand-Archive...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%ROOT%' -Force"
)

:: Renomeia a subpasta extraída para node_portavel
if exist "%~dp0%NODE_INNER%" (
    move /y "%~dp0%NODE_INNER%" "%NODE_DIR%" > nul
)

:: Limpa o zip
del /f /q "%NODE_ZIP%" 2>nul

if not exist "%NODE_DIR%\node.exe" (
    echo.
    echo [ERRO] Extracao falhou. node_portavel\node.exe nao encontrado.
    pause
    exit /b 1
)

echo [OK] Node.js portavel extraido com sucesso.

:usar_portavel
:: Usa exclusivamente o node_portavel desta pasta (ignora qualquer Node global)
set PATH=%NODE_DIR%;%NODE_DIR%\node_modules\.bin;%PATH%
echo [OK] Node.js portavel adicionado ao PATH desta sessao.
set /p DUMMY=      Versao: <nul
"%NODE_DIR%\node.exe" -v
echo.

:: -------------------------------------------------------
:: Instalação das dependências npm
:: -------------------------------------------------------
:instalar_deps
echo Instalando dependencias do projeto (playwright, xlsx, dotenv)...
call "%NODE_DIR%\npm.cmd" install
if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao instalar dependencias via npm.
    pause
    exit /b 1
)

echo.
echo Instalando navegador Chromium do Playwright...
call "%NODE_DIR%\npx.cmd" playwright install chromium
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