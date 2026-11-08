# CYANBOX · Servicio cliente (React + Vite) para el entorno Docker
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN rm -f .env && cp .env.example .env
EXPOSE 5173
# --sin-verificar: dentro del contenedor "localhost" no es la API; la verifica el navegador.
CMD ["node", "iniciar.mjs", "produccion", "--sin-verificar"]
