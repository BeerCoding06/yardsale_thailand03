#!/bin/bash
# Check Nuxt.js application status

echo "=== Check Nuxt.js Status ==="
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

# Check Node.js process
echo "1. Checking Node.js processes:"
if [ -n "$CONTAINER_NAME" ]; then
    docker-compose exec $CONTAINER_NAME ps aux | grep -E "(node|nuxt)" | grep -v grep || echo "   ❌ No Node.js processes found"
else
    ps aux | grep -E "(node|nuxt)" | grep -v grep || echo "   ❌ No Node.js processes found"
fi

echo ""

# Check port 3000
echo "2. Checking port 3000:"
if [ -n "$CONTAINER_NAME" ]; then
    docker-compose exec $CONTAINER_NAME netstat -tlnp 2>/dev/null | grep 3000 || \
    docker-compose exec $CONTAINER_NAME ss -tlnp 2>/dev/null | grep 3000 || \
    echo "   ❌ Port 3000 is not listening"
else
    netstat -tlnp 2>/dev/null | grep 3000 || \
    ss -tlnp 2>/dev/null | grep 3000 || \
    echo "   ❌ Port 3000 is not listening"
fi

echo ""

# Check if .output/server/index.mjs exists
echo "3. Checking Nuxt.js build files:"
if [ -n "$CONTAINER_NAME" ]; then
    if docker-compose exec $CONTAINER_NAME test -f /app/.output/server/index.mjs; then
        echo "   ✅ .output/server/index.mjs exists"
        docker-compose exec $CONTAINER_NAME ls -lh /app/.output/server/index.mjs
    else
        echo "   ❌ .output/server/index.mjs not found"
    fi
else
    if [ -f ".output/server/index.mjs" ]; then
        echo "   ✅ .output/server/index.mjs exists"
        ls -lh .output/server/index.mjs
    else
        echo "   ❌ .output/server/index.mjs not found"
    fi
fi

echo ""

# Test Nuxt.js endpoint
echo "4. Testing Nuxt.js endpoint:"
if [ -n "$CONTAINER_NAME" ]; then
    RESPONSE=$(docker-compose exec -T $CONTAINER_NAME curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ 2>/dev/null || echo "000")
else
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ 2>/dev/null || echo "000")
fi

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "404" ]; then
    echo "   ✅ Nuxt.js is responding (HTTP $RESPONSE)"
elif [ "$RESPONSE" = "000" ]; then
    echo "   ❌ Cannot connect to Nuxt.js (connection refused)"
else
    echo "   ⚠️  Nuxt.js returned HTTP $RESPONSE"
fi

echo ""

# Check supervisor status
echo "5. Checking supervisor status:"
if [ -n "$CONTAINER_NAME" ]; then
    docker-compose exec $CONTAINER_NAME supervisorctl status 2>/dev/null || echo "   ⚠️  supervisorctl not available"
else
    supervisorctl status 2>/dev/null || echo "   ⚠️  supervisorctl not available"
fi

echo ""
echo "=== Done ==="
