@echo off
chcp 65001 > nul
title Autorização Prévia Mat/Med — Limpeza

echo.
echo ===========================================================
echo   Autorização Prévia Mat/Med v1.0.0 — Limpar Dependências
echo ===========================================================
echo.
echo   O que será removido:
echo   - node_modules\
echo   - node_portavel\
echo   - package-lock.json
    echo   - logs\               (pasta completa de logs)
echo.
echo   O que será MANTIDO:
echo   - dados\base.xlsx      (sua planilha)
echo   - logs\*.csv           (histórico de execuções)
echo   - scripts\automacao.js (script principal)
echo   - .env                 (suas credenciais)
echo.

set /p CONFIRMAR=Confirma a limpeza? (S/N): 
if /i not "%CONFIRMAR%"=="S" (
    echo.
    echo Operação cancelada.
    pause
    exit /b 0
)

echo.

:: -------------------------------------------------------
:: Remove node_modules
:: -------------------------------------------------------
if exist "node_modules" (
    echo Removendo node_modules...
    rmdir /s /q node_modules
    echo [OK] node_modules removido.
) else (
    echo [INFO] node_modules não encontrado. Pulando.
)

:: -------------------------------------------------------
:: Remove node_portavel
:: -------------------------------------------------------
if exist "node_portavel" (
    echo Removendo node_portavel...
    rmdir /s /q node_portavel
    echo [OK] node_portavel removido.
) else (
    echo [INFO] node_portavel não encontrado. Pulando.
)

:: -------------------------------------------------------
:: Remove package-lock.json
:: -------------------------------------------------------
if exist "package-lock.json" (
    echo Removendo package-lock.json...
    del /f /q package-lock.json
    echo [OK] package-lock.json removido.
) else (
    echo [INFO] package-lock.json não encontrado. Pulando.
)

:: -------------------------------------------------------
:: Remove pasta logs (histórico de execuções e progresso)
:: -------------------------------------------------------
if exist "logs" (
    echo Removendo logs...
    rmdir /s /q logs
    echo [OK] logs removido.
) else (
    echo [INFO] logs não encontrado. Pulando.
)

echo.
echo ============================================
echo   Limpeza concluída!
echo ============================================
echo.
echo   Para reinstalar as dependências: 1_instalar.bat
echo.
echo   Copyright (c) 2026 Wárreno Hendrick Costa Lima Guimarães
echo.
pause