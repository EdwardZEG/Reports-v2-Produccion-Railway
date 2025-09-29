# Script para limpiar archivos temporales de la carpeta temp
# Ejecutar: .\limpiar-temp.ps1

$carpetaTemp = "c:\Users\Edward\Documents\GitHub\Reports-v2\apps\server\temp"

Write-Host "=== LIMPIEZA DE ARCHIVOS TEMPORALES ===" -ForegroundColor Green
Write-Host "Carpeta: $carpetaTemp" -ForegroundColor Yellow

# Verificar si la carpeta existe
if (Test-Path $carpetaTemp) {
    # Contar archivos antes de limpiar
    $archivosAntes = (Get-ChildItem "$carpetaTemp\*.docx" -ErrorAction SilentlyContinue).Count
    Write-Host "Archivos .docx encontrados: $archivosAntes" -ForegroundColor Cyan
    
    if ($archivosAntes -gt 0) {
        # Mostrar archivos que se van a eliminar
        Write-Host "`nArchivos a eliminar:" -ForegroundColor Red
        Get-ChildItem "$carpetaTemp\*.docx" | ForEach-Object {
            $tamaño = [math]::Round($_.Length / 1KB, 2)
            Write-Host "  - $($_.Name) ($tamaño KB)" -ForegroundColor Gray
        }
        
        # Eliminar archivos
        Remove-Item "$carpetaTemp\*.docx" -Force -ErrorAction SilentlyContinue
        
        # Verificar limpieza
        $archivosDepues = (Get-ChildItem "$carpetaTemp\*.docx" -ErrorAction SilentlyContinue).Count
        $eliminados = $archivosAntes - $archivosDepues
        
        Write-Host "`n✅ Limpieza completada:" -ForegroundColor Green
        Write-Host "   - Archivos eliminados: $eliminados" -ForegroundColor Green
        Write-Host "   - Archivos restantes: $archivosDepues" -ForegroundColor Green
    } else {
        Write-Host "✅ La carpeta temp ya está limpia (no hay archivos .docx)" -ForegroundColor Green
    }
} else {
    Write-Host "❌ La carpeta temp no existe: $carpetaTemp" -ForegroundColor Red
}

Write-Host "`n=== LIMPIEZA FINALIZADA ===" -ForegroundColor Green