#!/bin/bash

# Script to fix WordPress settings (Home URL and Site URL)
# This script updates WordPress settings directly in the database

echo "🔧 Fixing WordPress Settings..."
echo ""

# Check if Docker container is running
if command -v docker-compose &> /dev/null; then
    if docker-compose ps 2>/dev/null | grep -q "app.*Up"; then
        echo "✅ Docker container is running"
        echo ""
        echo "📋 Running fix script in Docker container..."
        echo "----------------------------------------"
        
        # Copy fix script to container
        docker-compose exec -T app sh -c "cat > /app/fix-wordpress-settings.php << 'EOF'
$(cat fix-wordpress-settings.php)
EOF
"
        
        # Run fix script
        docker-compose exec -T app php /app/fix-wordpress-settings.php
        
        exit $?
    fi
fi

# If Docker is not available, run locally
echo "📋 Running fix script locally..."
echo "----------------------------------------"
echo "Note: This requires PHP and WordPress to be accessible"
echo ""

if command -v php &> /dev/null; then
    php fix-wordpress-settings.php
else
    echo "❌ PHP is not installed or not in PATH"
    echo ""
    echo "Please install PHP or use Docker container to run this script"
    exit 1
fi
