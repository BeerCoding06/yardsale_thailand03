#!/bin/bash

# Script to check and fix WordPress URLs
# This script helps debug and fix 127.0.0.1 URL issues

echo "🔍 Checking WordPress URL Configuration..."
echo ""

# Check if Docker container is running
if ! docker-compose ps | grep -q "app.*Up"; then
    echo "❌ Docker container is not running. Please start it first:"
    echo "   docker-compose up -d"
    exit 1
fi

echo "✅ Docker container is running"
echo ""

# Copy PHP scripts to container if they don't exist
echo "📋 Copying PHP scripts to container..."
docker-compose exec -T app sh -c "if [ ! -f /app/check-env-vars.php ]; then cat > /app/check-env-vars.php << 'ENVEOF'
$(cat check-env-vars.php)
ENVEOF
fi"

docker-compose exec -T app sh -c "if [ ! -f /app/check-wordpress-urls.php ]; then cat > /app/check-wordpress-urls.php << 'WPEOF'
$(cat check-wordpress-urls.php)
WPEOF
fi"

# Check environment variables
echo "📋 Checking Environment Variables..."
echo "----------------------------------------"
docker-compose exec -T app php /app/check-env-vars.php
echo ""

# Check WordPress URLs
echo "📋 Checking WordPress URLs..."
echo "----------------------------------------"
docker-compose exec -T app php /app/check-wordpress-urls.php
echo ""

# Ask if user wants to update database
echo "❓ Do you want to update the database URLs? (y/n)"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo ""
    echo "📝 Updating database URLs..."
    echo "----------------------------------------"
    echo "Please enter MySQL password when prompted:"
    mysql -h 157.85.98.150 -u root -p nuxtcommerce_db < update-wordpress-urls.sql
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Database updated successfully!"
        echo ""
        echo "🔄 Please restart the Docker container to apply changes:"
        echo "   docker-compose restart app"
    else
        echo ""
        echo "❌ Failed to update database. Please check the MySQL connection."
    fi
else
    echo ""
    echo "⏭️  Skipping database update."
fi

echo ""
echo "✅ Done!"
