FROM node:20-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

# Install deps first for layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Ensure graceful shutdown in containers
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]
