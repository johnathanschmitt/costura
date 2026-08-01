# syntax=docker/dockerfile:1
# Build context = raiz do monorepo (o package-lock.json fica lá)
FROM node:20-alpine AS builder
WORKDIR /app

# npm 10.8.2 (bundled no node:20) tem o bug "Exit handler never called!",
# que dispara quando os builds de frontend e backend rodam em paralelo
RUN npm install -g npm@11.6.2

# Manifests primeiro para aproveitar o cache de camadas do npm ci
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# sharing=locked: serializa o cache do npm entre os builds concorrentes
# --include=dev: tsc/vite são devDependencies e o build falha sem elas
# test -x: impede que uma instalação parcial vire camada cacheada "com sucesso"
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --workspace=frontend --include=dev --no-audit --no-fund \
 && test -x node_modules/.bin/tsc && test -x node_modules/.bin/vite

COPY frontend ./frontend
RUN npm run build --workspace=frontend

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
