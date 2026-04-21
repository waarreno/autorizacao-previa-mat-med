@echo off
chcp 65001 > nul
title Autorização Prévia Mat/Med — Execução

:: %~dp0 = pasta onde este .bat está instalado (sempre correto,
::          independente de onde o atalho foi chamado)
set BASE=%~dp0

echo.
echo ================================================
echo   Autorização Prévia Mat/Med v1.0.0 — Executar
echo ================================================
echo.

:: -------------------------------------------------------
:: Resolve Node.js — global ou portável
:: -------------------------------------------------------
node -v > nul 2>&1
if not errorlevel 1 goto :verificar_deps

if exist "%BASE%node_portavel\node.exe" (
    set PATH=%BASE%node_portavel;%BASE%node_portavel\node_modules\.bin;%PATH%
    echo [OK] Usando Node.js portável.
    goto :verificar_deps
)

echo [ERRO] Node.js não encontrado.
echo        Execute primeiro: 1_instalar.bat
pause
exit /b 1

:: -------------------------------------------------------
:: Verifica dependências instaladas
:: -------------------------------------------------------
:verificar_deps
if not exist "%BASE%node_modules\playwright" (
    echo [ERRO] Dependências não instaladas.
    echo        Execute primeiro: 1_instalar.bat
    pause
    exit /b 1
)

:: -------------------------------------------------------
:: Verifica arquivos essenciais
:: -------------------------------------------------------
if not exist "%BASE%.env" (
    echo [ERRO] Arquivo .env não encontrado.
    echo        Crie o arquivo .env com USUARIO e SENHA.
    pause
    exit /b 1
)

if not exist "%BASE%dados\base.xlsx" (
    echo [ERRO] Planilha não encontrada em dados\base.xlsx
    pause
    exit /b 1
)

if not exist "%BASE%scripts\automacao.js" (
    echo [ERRO] Script não encontrado em scripts\automacao.js
    pause
    exit /b 1
)

:: -------------------------------------------------------
:: Verifica progresso anterior
:: -------------------------------------------------------
if exist "%BASE%logs\progresso.json" (
    echo [INFO] Progresso anterior detectado.
    echo        A execução será retomada do ponto onde parou.
    echo        Para reiniciar do zero, delete: logs\progresso.json
    echo.
)

:: -------------------------------------------------------
:: Muda para a pasta de instalação antes de executar
:: Garante que caminhos relativos dentro do Node.js
:: também funcionem corretamente
:: -------------------------------------------------------
cd /d "%BASE%"

:: -------------------------------------------------------
:: Execução
:: -------------------------------------------------------
echo   Copyright (c) 2026 Wárreno Hendrick Costa Lima Guimarães
echo.
echo Iniciando automação...
echo Para interromper: Ctrl + C
echo.

call node scripts\automacao.js

echo.
if errorlevel 1 (
    echo [ERRO] A execução encerrou com erro. Verifique o log em logs\
) else (
    echo [OK] Execução finalizada. Verifique o log em logs\
)

echo.
pause
