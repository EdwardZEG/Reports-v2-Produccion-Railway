# Dockerfile optimizado para Railway
FROM node:18-alpine AS base

# Instalar pnpm globalmente
RUN npm install -g pnpm@9.0.0

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración del workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copiar todos los packages y apps
COPY packages/ ./packages/
COPY apps/ ./apps/

# Instalar todas las dependencias
RUN pnpm install --frozen-lockfile

# Build completo con turbo
RUN pnpm run build

# Etapa de producción simplificada
FROM node:18-alpine AS production

RUN npm install -g pnpm@9.0.0

WORKDIR /app

# Copiar todo lo necesario desde la etapa de build
COPY --from=base /app/apps/server/dist ./dist
COPY --from=base /app/apps/client/dist ./public
COPY --from=base /app/apps/server/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules

# Crear directorio temporal para archivos
RUN mkdir -p temp

# Exponer puerto
EXPOSE $PORT

# Comando de inicio
CMD ["node", "dist/index.js"]