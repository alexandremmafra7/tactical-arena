FROM node:20-slim AS builder

WORKDIR /app

# Instalar dependências necessárias para compilação nativa e openssl para o Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copiar arquivos de configuração de dependências
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/server/package*.json ./packages/server/
COPY packages/web/package*.json ./packages/web/

# Instalar todas as dependências
RUN npm ci

# Copiar o restante do código-fonte do monorepo
COPY . .

# 1. Compilar o pacote compartilhado
RUN npm run build:shared

# 2. Gerar cliente do Prisma
RUN npx prisma generate --schema=packages/server/prisma/schema.prisma

# 3. Compilar a interface Web (SPA)
RUN npm run build -w packages/web

# 4. Compilar o servidor backend
RUN npm run build -w packages/server

# 5. Gerar o banco inicial template.db com schema e clubes reais dentro do build
ENV DATABASE_URL="file:/app/template.db"
RUN npx prisma db push --schema=packages/server/prisma/schema.prisma --skip-generate && \
    npx tsx packages/server/scripts/import-content.ts

# -------------------------------------------------------------
# Runner Stage (imagem final leve)
# -------------------------------------------------------------
FROM node:20-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV APP_MODE=hosted
ENV DESKTOP_MODE=false
ENV HOST=0.0.0.0
ENV PORT=10000
ENV WEB_DIST_PATH=/app/packages/web/dist
ENV DATABASE_URL=file:/app/data/online_world.db

# Copiar dependências de produção e builds
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/package.json
COPY --from=builder /app/packages/server/prisma ./packages/server/prisma
COPY --from=builder /app/packages/web/dist ./packages/web/dist
COPY --from=builder /app/content ./content
COPY --from=builder /app/template.db /app/data/template.db

# Criar diretório de dados
RUN mkdir -p /app/data

EXPOSE 10000

# Script de boot: se online_world.db não existir, inicializa a partir do template.db
CMD ["node", "-e", "const fs=require('fs'); if(!fs.existsSync('/app/data/online_world.db') && fs.existsSync('/app/data/template.db')) { fs.copyFileSync('/app/data/template.db', '/app/data/online_world.db'); console.log('Mundo online inicializado do template.db'); } require('./packages/server/dist/index.js');"]
