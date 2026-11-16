FROM node:20-alpine

WORKDIR /app

# Copy package descriptors
COPY backend/package*.json ./backend/

WORKDIR /app/backend
RUN npm install --omit=dev || true

WORKDIR /app
COPY backend ./backend
COPY agents ./agents
COPY config ./config
COPY data ./data
COPY scripts ./scripts

WORKDIR /app/backend

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "src/server.js"]

