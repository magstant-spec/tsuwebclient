FROM node:20-alpine

WORKDIR /app

# Install deps first for better caching
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci

# Copy app and prepare assets
COPY . .
RUN npm run prepare:assets

ENV WS_PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
