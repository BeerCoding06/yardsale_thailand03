#!/bin/bash

# Script to fix 127.0.0.1 URLs in WordPress database
# Usage: ./fix-database-127-urls.sh

PRODUCTION_HOME="http://www.yardsaleth.com"
PRODUCTION_SITEURL="http://www.yardsaleth.com/wordpress"
DB_HOST="157.85.98.150"
DB_USER="root"
DB_NAME="nuxtcommerce_db"

echo "🔧 แก้ไข 127.0.0.1 URLs ใน WordPress Database"
echo "=========================================="
echo "Production Home: ${PRODUCTION_HOME}"
echo "Production SiteURL: ${PRODUCTION_SITEURL}"
echo "Database: ${DB_NAME}@${DB_HOST}"
echo ""

# ตรวจสอบว่ามี SQL file หรือไม่
if [ ! -f "fix-database-127-urls.sql" ]; then
    echo "❌ ไม่พบไฟล์ fix-database-127-urls.sql"
    exit 1
fi

# รัน SQL script
echo "📝 กำลังรัน SQL script..."
echo ""

mysql -h ${DB_HOST} -u ${DB_USER} -p ${DB_NAME} < fix-database-127-urls.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ แก้ไข URLs สำเร็จแล้ว!"
    echo ""
    echo "📋 ขั้นตอนต่อไป:"
    echo "   1. Clear browser cache (Cmd+Shift+R)"
    echo "   2. ตรวจสอบ WordPress admin: ${PRODUCTION_SITEURL}/wp-admin"
    echo "   3. ตรวจสอบว่าไม่มี redirect ไปที่ 127.0.0.1 อีก"
else
    echo ""
    echo "❌ แก้ไข URLs ไม่สำเร็จ"
    echo "   กรุณาตรวจสอบ:"
    echo "   - การเชื่อมต่อ database"
    echo "   - Username และ password"
    echo "   - หรือรัน SQL script ผ่าน phpMyAdmin"
    exit 1
fi
