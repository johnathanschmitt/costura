# Build context = raiz do monorepo (o package-lock.json fica lá)
FROM node:20-alpine AS builder
WORKDIR /app

# Manifests primeiro para aproveitar o cache de camadas do npm ci
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm ci --workspace=frontend

COPY frontend ./frontend
RUN npm run build --workspace=frontend

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
