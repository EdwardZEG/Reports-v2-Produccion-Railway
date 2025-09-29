#!/bin/bash

# Script de deploy para Railway
echo "🚀 Iniciando proceso de build para Railway..."

# Instalar dependencias
echo "📦 Instalando dependencias..."
pnpm install --frozen-lockfile

# Build del cliente React
echo "⚛️ Building cliente React..."
cd apps/client
pnpm run build
cd ../..

# Build del servidor TypeScript
echo "🔧 Building servidor TypeScript..."
cd apps/server
pnpm run build
cd ../..

echo "✅ Build completado. Listo para Railway!"