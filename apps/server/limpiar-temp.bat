@echo off
echo === LIMPIANDO ARCHIVOS TEMPORALES ===
cd /d "c:\Users\Edward\Documents\GitHub\Reports-v2\apps\server\temp"
echo Eliminando archivos .docx de la carpeta temp...
del *.docx 2>nul
if %errorlevel%==0 (
    echo ✅ Archivos eliminados exitosamente
) else (
    echo ℹ️ No se encontraron archivos .docx para eliminar
)
echo === LIMPIEZA COMPLETADA ===
pause