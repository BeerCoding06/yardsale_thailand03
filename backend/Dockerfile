FROM node:20-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

# Install deps first for layer caching (ต้องมี package-lock.json ใน repo — รัน npm install ใน backend แล้ว commit)
COPY package.json package-lock.json* ./
# ใช้ npm install เพื่อให้เพิ่ม dependency ใหม่ได้แม้ lock ยังไม่อัปเดต — แนะนำ: รัน npm install ใน backend แล้ว commit package-lock.json แล้วสลับกลับเป็น npm ci
RUN npm install --omit=dev --no-audit --no-fund

# Copy source
COPY . .

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

EXPOSE 4000

# ให้ runtime/orchestrator ที่ไม่ส่ง compose healthcheck ยังมี probe ที่ถูกต้อง
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=15 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4000)+'/health',(r)=>{r.resume();r.on('end',()=>process.exit(r.statusCode===200?0:1));}).on('error',()=>process.exit(1))"

# Ensure graceful shutdown in containers
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]
