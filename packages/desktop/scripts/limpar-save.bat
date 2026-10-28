@echo off
chcp 65001 >nul
title Limpar Save - Tactical Arena FC
echo ============================================
echo   Tactical Arena FC - Limpeza Segura de Save
echo ============================================
echo.

echo [1/3] Fechando o jogo se estiver em execucao...
taskkill /IM "Tactical Arena FC.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul 2>&1

echo.
echo [2/3] Verificando e limpando dados salvos...
set "FOUND=0"

for %%D in ("%APPDATA%\Tactical Arena FC" "%APPDATA%\tactical-arena-fc" "%APPDATA%\@tactical-arena\desktop") do (
    if exist "%%~D" (
        echo   Verificando diretorio: %%~D

        rem Apaga bancos de dados SQLite (atual e legados) e seus logs/journals
        for %%F in (tactical_arena.db tactical_arena.db-journal tactical_arena.db-wal tactical_arena.db-shm elifoot.db elifoot.db-journal elifoot.db-wal elifoot.db-shm config.json launch.log) do (
            if exist "%%~D\%%F" (
                del /F /Q "%%~D\%%F" >nul 2>&1
                echo     [OK] Removido arquivo: %%F
                set "FOUND=1"
            )
        )

        rem Apaga pastas de estado e storage do frontend (evita tokens orfaos ou cache corrompido)
        for %%S in ("Local Storage" "Session Storage" "IndexedDB" "backups" "saves" "backup-pre-calendario") do (
            if exist "%%~D\%%~S" (
                rd /S /Q "%%~D\%%~S" >nul 2>&1
                echo     [OK] Removida pasta: %%~S
                set "FOUND=1"
            )
        )
    )
)

echo.
echo [3/3] Finalizado!
if "%FOUND%"=="0" (
    echo   Nenhum save antigo foi encontrado (o ambiente ja estava limpo).
) else (
    echo   Todos os dados de save, cache e sessoes foram resetados com sucesso!
)

echo.
echo ====================================================================
echo O jogo agora comecara 100%% do zero (copiara o banco inicial limpo).
echo Voce ja pode abrir o Tactical Arena FC normalmente.
echo ====================================================================
echo.
pause

