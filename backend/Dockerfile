# Build context = raiz do monorepo (o package-lock.json fica lá)
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

FROM base AS deps
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
# --include=dev: nest CLI e prisma são devDependencies e o build falha sem elas
RUN npm ci --workspace=backend --include=dev \
 && test -x node_modules/.bin/nest && test -x node_modules/.bin/prisma

FROM base AS builder
COPY --from=deps /app ./
COPY backend ./backend
RUN npm run prisma:generate --workspace=backend
RUN npm run build --workspace=backend

FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/backend/package.json ./backend/package.json
WORKDIR /app/backend
EXPOSE 3000
# tsc emite dist/src/main.js (prisma/seed.ts também entra na compilação, deslocando o rootDir)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
