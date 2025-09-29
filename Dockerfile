# Dockerfile para producción con Railway
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

# Build del cliente
RUN pnpm run build

# Build del servidor
WORKDIR /app/apps/server
RUN pnpm run build

# Etapa de producción
FROM node:18-alpine AS production

RUN npm install -g pnpm@9.0.0

WORKDIR /app

# Copiar archivos necesarios para producción
COPY --from=base /app/apps/server/dist ./dist
COPY --from=base /app/apps/server/package.json ./package.json
COPY --from=base /app/apps/client/dist ./public

# Instalar solo dependencias de producción
RUN pnpm install --prod --frozen-lockfile

# Crear directorio temporal para archivos
RUN mkdir -p temp

# Exponer puerto
EXPOSE $PORT

# Comando de inicio
CMD ["node", "dist/index.js"]