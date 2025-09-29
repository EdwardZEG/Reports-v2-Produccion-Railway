# Script de deploy para Railway (Windows)
Write-Host "🚀 Iniciando proceso de build para Railway..." -ForegroundColor Green

# Instalar dependencias
Write-Host "📦 Instalando dependencias..." -ForegroundColor Yellow
pnpm install --frozen-lockfile

# Build del cliente React
Write-Host "⚛️ Building cliente React..." -ForegroundColor Blue
Set-Location apps/client
pnpm run build
Set-Location ../..

# Build del servidor TypeScript
Write-Host "🔧 Building servidor TypeScript..." -ForegroundColor Magenta
Set-Location apps/server
pnpm run build
Set-Location ../..

Write-Host "✅ Build completado. Listo para Railway!" -ForegroundColor Green