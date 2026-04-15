@echo off
chcp 65001 > nul
title Autorização Prévia Mat/Med — Execução

echo.
echo ============================================
echo   Autorização Prévia Mat/Med v1.0.0 — Executar
echo ============================================
echo.

:: -------------------------------------------------------
:: Resolve Node.js — global ou portável
:: -------------------------------------------------------
node -v > nul 2>&1
if not errorlevel 1 goto :verificar_deps

if exist "node_portavel\node.exe" (
    set PATH=%CD%\node_portavel;%CD%\node_portavel\node_modules\.bin;%PATH%
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
if not exist "node_modules\playwright" (
    echo [ERRO] Dependências não instaladas.
    echo        Execute primeiro: 1_instalar.bat
    pause
    exit /b 1
)

:: -------------------------------------------------------
:: Verifica arquivos essenciais
:: -------------------------------------------------------
if not exist ".env" (
    echo [ERRO] Arquivo .env não encontrado.
    echo        Crie o arquivo .env com USUARIO e SENHA.
    pause
    exit /b 1
)

if not exist "dados\base.xlsx" (
    echo [ERRO] Planilha não encontrada em dados\base.xlsx
    pause
    exit /b 1
)

if not exist "scripts\automacao.js" (
    echo [ERRO] Script não encontrado em scripts\automacao.js
    pause
    exit /b 1
)

:: -------------------------------------------------------
:: Verifica progresso anterior
:: -------------------------------------------------------
if exist "logs\progresso.json" (
    echo [INFO] Progresso anterior detectado.
    echo        A execução será retomada do ponto onde parou.
    echo        Para reiniciar do zero, delete: logs\progresso.json
    echo.
)

:: -------------------------------------------------------
:: Execução
:: -------------------------------------------------------
echo   Copyright (c) 2026 Wárreno Hendrick Costa Lima Guimarães
echo.
echo Iniciando automação...
echo Para interromper: Ctrl + C
echo.

call node scripts/automacao.js

echo.
if errorlevel 1 (
    echo [ERRO] A execução encerrou com erro. Verifique o log em logs\
) else (
    echo [OK] Execução finalizada. Verifique o log em logs\
)

echo.
pause