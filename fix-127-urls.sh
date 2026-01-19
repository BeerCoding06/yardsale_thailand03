#!/bin/bash

# Script to fix 127.0.0.1 URLs issue
# This script checks, updates the database, and restarts the container

echo "🔧 Fixing 127.0.0.1 URLs Issue..."
echo ""

# Check if Docker container is running
echo "🔍 Checking Docker container status..."
if ! docker-compose ps 2>/dev/null | grep -q "app.*Up"; then
    echo "❌ Docker container is not running."
    echo ""
    echo "📋 Please start the container first:"
    echo "   docker-compose up -d"
    echo ""
    echo "Or if containers don't exist, rebuild them:"
    echo "   docker-compose down"
    echo "   docker-compose up -d --build"
    exit 1
fi

echo "✅ Docker container is running"
echo ""

# Step 0: Check current database URLs
echo "📋 Step 0: Checking current database URLs..."
echo "----------------------------------------"
echo "Please enter MySQL password when prompted:"
mysql -h 157.85.98.150 -u root -p nuxtcommerce_db < check-database-urls.sql

echo ""
echo "❓ Do you want to update the database URLs? (y/n)"
read -r response

if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "⏭️  Skipping database update."
    exit 0
fi

# Step 1: Update database
echo ""
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

# Step 2: Copy debug script to container
echo "📋 Step 2: Copying debug script to container..."
echo "----------------------------------------"
docker-compose exec -T app sh -c "cat > /app/debug-urls.php << 'EOF'
$(cat debug-urls.php)
EOF
"

# Step 3: Check WordPress URLs
echo ""
echo "🔍 Step 3: Checking WordPress URLs..."
echo "----------------------------------------"
docker-compose exec -T app php /app/debug-urls.php

echo ""

# Step 4: Restart container
echo "🔄 Step 4: Restarting Docker container..."
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
echo "   1. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)"
echo "   2. Check WordPress login page"
echo "   3. Verify that CSS/JS files load correctly"
echo ""
echo "🔍 To verify the fix, run:"
echo "   docker-compose exec app php /app/debug-urls.php"
