#!/bin/bash
# Script to fix nginx port 80 issue

echo "=== Fix Nginx Port 80 Issue ==="
echo ""

# Check if running in Docker
if [ -f /.dockerenv ] || [ -n "$DOCKER_CONTAINER" ]; then
    echo "📦 Running inside Docker container"
    CONTAINER_NAME="app"
else
    echo "💻 Running on host machine"
    CONTAINER_NAME=""
fi

echo ""

# 1. Check nginx status
echo "1. Checking nginx status:"
if [ -n "$CONTAINER_NAME" ]; then
    docker-compose exec $CONTAINER_NAME ps aux | grep nginx | grep -v grep || echo "   ❌ Nginx not running"
else
    ps aux | grep nginx | grep -v grep || echo "   ❌ Nginx not running"
fi

echo ""

# 2. Check port 80
echo "2. Checking port 80:"
if [ -n "$CONTAINER_NAME" ]; then
    docker-compose exec $CONTAINER_NAME netstat -tlnp 2>/dev/null | grep ":80 " || \
    docker-compose exec $CONTAINER_NAME ss -tlnp 2>/dev/null | grep ":80 " || \
    echo "   ❌ Port 80 is not listening"
else
    netstat -tlnp 2>/dev/null | grep ":80 " || \
    ss -tlnp 2>/dev/null | grep ":80 " || \
    echo "   ❌ Port 80 is not listening"
fi

echo ""

# 3. Check nginx configuration
echo "3. Testing nginx configuration:"
if [ -n "$CONTAINER_NAME" ]; then
    docker-compose exec $CONTAINER_NAME nginx -t 2>&1 || echo "   ❌ Nginx configuration error"
else
    nginx -t 2>&1 || echo "   ❌ Nginx configuration error"
fi

echo ""

# 4. Restart nginx
echo "4. Restarting nginx:"
if [ -n "$CONTAINER_NAME" ]; then
    docker-compose exec $CONTAINER_NAME supervisorctl restart nginx 2>&1 || echo "   ❌ Failed to restart nginx"
    sleep 2
    echo "   ✅ Nginx restarted"
else
    supervisorctl restart nginx 2>&1 || echo "   ❌ Failed to restart nginx"
    sleep 2
    echo "   ✅ Nginx restarted"
fi

echo ""

# 5. Check nginx status again
echo "5. Checking nginx status after restart:"
if [ -n "$CONTAINER_NAME" ]; then
    docker-compose exec $CONTAINER_NAME ps aux | grep nginx | grep -v grep || echo "   ❌ Nginx still not running"
else
    ps aux | grep nginx | grep -v grep || echo "   ❌ Nginx still not running"
fi

echo ""

# 6. Check port 80 again
echo "6. Checking port 80 after restart:"
if [ -n "$CONTAINER_NAME" ]; then
    docker-compose exec $CONTAINER_NAME netstat -tlnp 2>/dev/null | grep ":80 " || \
    docker-compose exec $CONTAINER_NAME ss -tlnp 2>/dev/null | grep ":80 " || \
    echo "   ❌ Port 80 still not listening"
else
    netstat -tlnp 2>/dev/null | grep ":80 " || \
    ss -tlnp 2>/dev/null | grep ":80 " || \
    echo "   ❌ Port 80 still not listening"
fi

echo ""

# 7. Test PHP API
echo "7. Testing PHP API:"
if [ -n "$CONTAINER_NAME" ]; then
    RESPONSE=$(docker-compose exec -T $CONTAINER_NAME curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:80/server/api/php/getCategories.php 2>/dev/null || echo "000")
    if [ "$RESPONSE" -ge 200 ] && [ "$RESPONSE" -lt 500 ]; then
        echo "   ✅ PHP API responded with HTTP $RESPONSE"
    else
        echo "   ❌ PHP API failed to respond (HTTP $RESPONSE)"
    fi
else
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:80/server/api/php/getCategories.php 2>/dev/null || echo "000")
    if [ "$RESPONSE" -ge 200 ] && [ "$RESPONSE" -lt 500 ]; then
        echo "   ✅ PHP API responded with HTTP $RESPONSE"
    else
        echo "   ❌ PHP API failed to respond (HTTP $RESPONSE)"
    fi
fi

echo ""
echo "=== Fix Complete ==="
echo ""
echo "📝 ถ้า nginx ยังไม่ทำงาน:"
echo "   1. ตรวจสอบ nginx logs: docker-compose logs app | grep nginx"
echo "   2. Restart container: docker-compose restart app"
echo "   3. ตรวจสอบว่า nginx configuration ถูกต้อง"
