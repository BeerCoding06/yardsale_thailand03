FROM node:20-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

# Install deps first for layer caching (ต้องมี package-lock.json ใน repo — รัน npm install ใน backend แล้ว commit)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

EXPOSE 4000

# สำรองเมื่อรัน image นอก compose ที่ไม่มี healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4000)+'/health',(r)=>{r.resume();r.on('end',()=>process.exit(r.statusCode===200?0:1));}).on('error',()=>process.exit(1)))"

# Ensure graceful shutdown in containers
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]
