# Build context = raiz do monorepo (o package-lock.json fica lá)
FROM node:20-alpine AS builder
WORKDIR /app

# Manifests primeiro para aproveitar o cache de camadas do npm ci
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
# --include=dev: tsc/vite são devDependencies e o build falha sem elas
# mesmo que NODE_ENV/.npmrc peçam produção
RUN npm ci --workspace=frontend --include=dev \
 && test -x node_modules/.bin/tsc && test -x node_modules/.bin/vite

COPY frontend ./frontend
RUN npm run build --workspace=frontend

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
