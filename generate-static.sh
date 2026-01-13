#!/bin/bash

# Script สำหรับ Generate Static Site

echo "🚀 กำลัง Generate Static Site..."

# ตรวจสอบ Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
  echo "❌ ต้องการ Node.js version 16 หรือสูงกว่า"
  echo "   Version ปัจจุบัน: $(node -v)"
  exit 1
fi

# ตรวจสอบ pnpm
if ! command -v pnpm &> /dev/null; then
  echo "⚠️  ไม่พบ pnpm กำลังใช้ npm แทน..."
  PACKAGE_MANAGER="npm"
else
  PACKAGE_MANAGER="pnpm"
fi

echo "📦 ใช้ Package Manager: $PACKAGE_MANAGER"

# ติดตั้ง dependencies (ถ้ายังไม่ได้ติดตั้ง)
if [ ! -d "node_modules" ]; then
  echo "📥 กำลังติดตั้ง dependencies..."
  $PACKAGE_MANAGER install
fi

# ลบ output เก่า
if [ -d ".output" ]; then
  echo "🧹 กำลังลบ output เก่า..."
  rm -rf .output
fi

# Generate static site
echo "🔨 กำลัง Generate Static Site..."
export NUXT_GENERATE=true
$PACKAGE_MANAGER generate

# ตรวจสอบผลลัพธ์
if [ -d ".output/public" ]; then
  echo "✅ Generate สำเร็จ!"
  echo "📁 ไฟล์อยู่ที่: .output/public/"
  echo ""
  echo "📊 ขนาดไฟล์:"
  du -sh .output/public
  echo ""
  echo "📝 ไฟล์ที่สำคัญ:"
  ls -lh .output/public | head -20
  echo ""
  echo "🚀 พร้อม Deploy ไปยัง FZL แล้ว!"
  echo "   Upload ไฟล์ทั้งหมดใน .output/public/ ไปยัง public_html หรือ www"
else
  echo "❌ Generate ไม่สำเร็จ กรุณาตรวจสอบ error messages"
  exit 1
fi

