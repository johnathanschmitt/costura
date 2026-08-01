# Build context = raiz do monorepo (o package-lock.json fica lá)
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

FROM base AS deps
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm ci --workspace=backend

FROM base AS builder
COPY --from=deps /app ./
COPY backend ./backend
RUN npm run prisma:generate --workspace=backend
RUN npm run build --workspace=backend

FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/backend ./backend
WORKDIR /app/backend
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
