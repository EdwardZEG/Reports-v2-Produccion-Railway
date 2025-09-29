# Guía de Deploy para Railway - Reports v2

## 📋 Preparación del Proyecto

Este proyecto está preparado para desplegarse en Railway con la siguiente configuración:

### 🏗️ Arquitectura
- **Monorepo** con Turbo
- **Frontend**: React + Vite + TypeScript
- **Backend**: Node.js + Express + TypeScript + MongoDB
- **Build**: Multi-stage Docker con optimizaciones

### 📁 Archivos Importantes para Railway

1. **`Dockerfile`** - Configuración multi-stage para optimizar el build
2. **`railway.json`** - Configuración específica de Railway
3. **`.env.example`** - Variables de entorno necesarias

## 🚀 Pasos para Deploy en Railway

### 1. Preparar el repositorio
```bash
# Asegúrate de que todos los archivos estén commiteados
git add .
git commit -m "Preparar para deploy en Railway"
git push origin main
```

### 2. Variables de entorno en Railway
Configura estas variables en el dashboard de Railway:

```env
NODE_ENV=production
PORT=4000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/reports-v2?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
```

### 3. Conectar a Railway
1. Ve a [railway.app](https://railway.app)
2. Conecta tu repositorio de GitHub
3. Railway detectará automáticamente el `Dockerfile`
4. El build se iniciará automáticamente

## 🔧 Configuración del Proyecto

### Cliente (React + Vite)
- **Puerto de desarrollo**: 5173
- **Build output**: `apps/client/dist/`
- **Proxy API**: `/api` → `http://localhost:4000`

### Servidor (Node.js + Express)
- **Puerto**: 4000 (configurable via `PORT`)
- **Build output**: `apps/server/dist/`
- **Archivos estáticos**: Sirve el cliente React en producción
- **Base de datos**: MongoDB (requiere `MONGO_URI`)

## 📦 Proceso de Build

El proceso de build se ejecuta en este orden:

1. **Instalar dependencias** con pnpm
2. **Build del cliente** (React + Vite)
3. **Build del servidor** (TypeScript)
4. **Copiar archivos** al contenedor de producción
5. **Servir aplicación** en puerto asignado por Railway

## 🛠️ Scripts Disponibles

```bash
# Desarrollo
pnpm dev          # Ejecuta ambos apps en modo desarrollo
pnpm build        # Build de producción completo
pnpm start        # Ejecuta el servidor en producción

# Individuales
cd apps/client && pnpm dev    # Solo cliente
cd apps/server && pnpm dev    # Solo servidor
```

## 🔍 Verificación del Deploy

Una vez desplegado, verifica:

1. **Health check**: `https://tu-app.railway.app/api/health`
2. **Frontend**: La aplicación React debe cargar correctamente
3. **API**: Los endpoints deben responder correctamente
4. **Base de datos**: Verificar conexión a MongoDB

## 🐛 Troubleshooting

### Problemas comunes:

1. **Error de conexión a MongoDB**
   - Verifica que `MONGO_URI` esté configurado correctamente
   - Asegúrate de que la IP de Railway esté en la whitelist de MongoDB

2. **Error 404 en rutas del frontend**
   - Verifica que el servidor esté sirviendo archivos estáticos
   - Revisa la configuración de React Router

3. **Variables de entorno**
   - Verifica que todas las variables estén configuradas en Railway
   - Revisa que `NODE_ENV=production` esté configurado

## 📝 Notas Adicionales

- El proyecto usa **pnpm** como package manager
- La aplicación sirve el frontend y el backend desde el mismo puerto
- Los archivos temporales se almacenan en `/app/temp`
- El health check está disponible en `/api/health`

## 🔒 Seguridad

Asegúrate de:
- Usar un `JWT_SECRET` fuerte y único
- Configurar CORS apropiadamente para producción
- Usar HTTPS en producción (Railway lo maneja automáticamente)
- Mantener las variables de entorno seguras