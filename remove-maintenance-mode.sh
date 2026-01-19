#!/bin/bash

# Script to remove WordPress maintenance mode
# This script removes the .maintenance file that causes the maintenance message

echo "🔧 Removing WordPress Maintenance Mode..."
echo ""

# Check if Docker container is running
if ! docker-compose ps | grep -q "app.*Up"; then
    echo "❌ Docker container is not running. Please start it first:"
    echo "   docker-compose up -d"
    exit 1
fi

echo "✅ Docker container is running"
echo ""

# Remove .maintenance file from Docker container
echo "📝 Removing .maintenance file from container..."
docker-compose exec -T app rm -f /app/wordpress/.maintenance

if [ $? -eq 0 ]; then
    echo "✅ Maintenance file removed from container"
else
    echo "⚠️  Could not remove file from container (may not exist)"
fi

# Also remove from local directory if it exists
if [ -f "wordpress/.maintenance" ]; then
    echo "📝 Removing .maintenance file from local directory..."
    rm -f wordpress/.maintenance
    echo "✅ Maintenance file removed from local directory"
else
    echo "ℹ️  No .maintenance file in local directory"
fi

echo ""
echo "✅ Done! WordPress should no longer be in maintenance mode."
echo ""
echo "🔄 If the issue persists, try restarting the container:"
echo "   docker-compose restart app"
