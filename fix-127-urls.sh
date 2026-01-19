#!/bin/bash

# Script to fix 127.0.0.1 URLs issue
# This script updates the database and restarts the container

echo "🔧 Fixing 127.0.0.1 URLs Issue..."
echo ""

# Check if Docker container is running
if ! docker-compose ps | grep -q "app.*Up"; then
    echo "❌ Docker container is not running. Please start it first:"
    echo "   docker-compose up -d"
    exit 1
fi

echo "✅ Docker container is running"
echo ""

# Step 1: Update database
echo "📝 Step 1: Updating database URLs..."
echo "----------------------------------------"
echo "Please enter MySQL password when prompted:"
mysql -h 157.85.98.150 -u root -p nuxtcommerce_db < update-wordpress-urls.sql

if [ $? -eq 0 ]; then
    echo "✅ Database updated successfully!"
else
    echo "❌ Failed to update database. Please check the MySQL connection."
    echo "   You can run the SQL script manually using phpMyAdmin or MySQL Workbench"
    exit 1
fi

echo ""

# Step 2: Restart container
echo "🔄 Step 2: Restarting Docker container..."
echo "----------------------------------------"
docker-compose restart app

if [ $? -eq 0 ]; then
    echo "✅ Container restarted successfully!"
else
    echo "❌ Failed to restart container"
    exit 1
fi

echo ""
echo "✅ Done! WordPress URLs should now be fixed."
echo ""
echo "📋 Next steps:"
echo "   1. Clear browser cache"
echo "   2. Check WordPress login page"
echo "   3. Verify that CSS/JS files load correctly"
echo ""
echo "🔍 To verify the fix, run:"
echo "   docker-compose exec app php /app/check-wordpress-urls.php"
