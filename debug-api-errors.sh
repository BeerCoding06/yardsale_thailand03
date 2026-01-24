#!/bin/bash
# Script to debug API errors

echo "=== Debug API Errors ==="
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

# 2. Check PHP-FPM status
echo "2. Checking PHP-FPM status:"
if [ -n "$CONTAINER_NAME" ]; then
    docker-compose exec $CONTAINER_NAME ps aux | grep php-fpm | grep -v grep || echo "   ❌ PHP-FPM not running"
else
    ps aux | grep php-fpm | grep -v grep || echo "   ❌ PHP-FPM not running"
fi

echo ""

# 3. Check port 80
echo "3. Checking port 80:"
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

# 4. Test PHP API directly
echo "4. Testing PHP API directly:"
if [ -n "$CONTAINER_NAME" ]; then
    echo "   Testing getCategories.php:"
    docker-compose exec -T $CONTAINER_NAME curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1:80/server/api/php/getCategories.php || echo "   ❌ Failed to connect"
    
    echo "   Testing getProducts.php:"
    docker-compose exec -T $CONTAINER_NAME curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1:80/server/api/php/getProducts.php?page=1&per_page=21 || echo "   ❌ Failed to connect"
else
    echo "   Testing getCategories.php:"
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1:80/server/api/php/getCategories.php || echo "   ❌ Failed to connect"
    
    echo "   Testing getProducts.php:"
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1:80/server/api/php/getProducts.php?page=1&per_page=21 || echo "   ❌ Failed to connect"
fi

echo ""

# 5. Check WordPress load
echo "5. Checking WordPress load:"
if [ -n "$CONTAINER_NAME" ]; then
    docker-compose exec -T $CONTAINER_NAME php -r "require '/app/wp-load.php'; echo '✅ WordPress loaded successfully\n';" 2>&1 || echo "   ❌ WordPress failed to load"
else
    php -r "require '/app/wp-load.php'; echo '✅ WordPress loaded successfully\n';" 2>&1 || echo "   ❌ WordPress failed to load"
fi

echo ""

# 6. Check PHP API files exist
echo "6. Checking PHP API files:"
if [ -n "$CONTAINER_NAME" ]; then
    if docker-compose exec -T $CONTAINER_NAME test -f /app/server/api/php/getCategories.php; then
        echo "   ✅ getCategories.php exists"
    else
        echo "   ❌ getCategories.php not found"
    fi
    
    if docker-compose exec -T $CONTAINER_NAME test -f /app/server/api/php/getProducts.php; then
        echo "   ✅ getProducts.php exists"
    else
        echo "   ❌ getProducts.php not found"
    fi
else
    if [ -f "server/api/php/getCategories.php" ]; then
        echo "   ✅ getCategories.php exists"
    else
        echo "   ❌ getCategories.php not found"
    fi
    
    if [ -f "server/api/php/getProducts.php" ]; then
        echo "   ✅ getProducts.php exists"
    else
        echo "   ❌ getProducts.php not found"
    fi
fi

echo ""

# 7. Check Nuxt.js logs
echo "7. Recent Nuxt.js logs (last 20 lines):"
if [ -n "$CONTAINER_NAME" ]; then
    docker-compose logs --tail=20 app | grep -E "(products|categories|PHP API|Fetch error|127.0.0.1)" || echo "   No relevant logs found"
else
    echo "   Run: docker-compose logs app | grep -E '(products|categories|PHP API)'"
fi

echo ""
echo "=== Debug Complete ==="
