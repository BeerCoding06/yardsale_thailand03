#!/bin/bash
# Fix Nuxt.js startup issues

echo "=== Fix Nuxt.js Startup ==="
echo ""

# Check if .output/server/index.mjs exists
if [ ! -f ".output/server/index.mjs" ]; then
    echo "❌ .output/server/index.mjs not found!"
    echo "📝 Building Nuxt.js application..."
    
    # Check if we're in Docker
    if [ -f /.dockerenv ] || [ -n "$DOCKER_CONTAINER" ]; then
        echo "   Running inside Docker - cannot build here"
        echo "   Please rebuild the Docker image"
        exit 1
    else
        # Build Nuxt.js
        export DOCKER_BUILD=true
        export NITRO_PRESET=node-server
        pnpm build || npm run build
    fi
else
    echo "✅ .output/server/index.mjs exists"
fi

echo ""

# Check supervisor status
echo "📋 Checking supervisor status:"
if command -v supervisorctl &> /dev/null; then
    supervisorctl status
    
    # Restart Nuxt if needed
    echo ""
    echo "🔄 Restarting Nuxt.js..."
    supervisorctl restart nuxt || echo "   ⚠️  Could not restart via supervisorctl"
else
    echo "   ⚠️  supervisorctl not available"
fi

echo ""
echo "=== Done ==="
echo ""
echo "📋 Next steps:"
echo "   1. Check logs: supervisorctl tail -f nuxt"
echo "   2. Check if port 3000 is listening: netstat -tlnp | grep 3000"
echo "   3. Test: curl http://127.0.0.1:3000"
