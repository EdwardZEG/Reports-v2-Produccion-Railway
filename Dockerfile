# Dockerfile simplificado para Railway - Single stage
FROM node:18-alpine

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

# Crear directorio temporal para archivos
RUN mkdir -p temp

# Exponer puerto
EXPOSE $PORT

# Comando de inicio - ejecutar desde el directorio del servidor
WORKDIR /app/apps/server
CMD ["node", "dist/index.js"]