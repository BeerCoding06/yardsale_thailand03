#!/bin/bash

# Script to test database connection
# This script tests the connection to MySQL database

echo "🔍 Testing Database Connection..."
echo ""

# Check if Docker container is running
if command -v docker-compose &> /dev/null; then
    if docker-compose ps 2>/dev/null | grep -q "app.*Up"; then
        echo "✅ Docker container is running"
        echo ""
        echo "📋 Testing from Docker container..."
        echo "----------------------------------------"
        
        # Copy test script to container
        docker-compose exec -T app sh -c "cat > /app/test-database-connection.php << 'EOF'
$(cat test-database-connection.php)
EOF
"
        
        # Run test script
        docker-compose exec -T app php /app/test-database-connection.php
        
        exit $?
    fi
fi

# If Docker is not available, run locally
echo "📋 Testing from local machine..."
echo "----------------------------------------"
echo "Note: This requires PHP and PDO MySQL extension"
echo ""

if command -v php &> /dev/null; then
    php test-database-connection.php
else
    echo "❌ PHP is not installed or not in PATH"
    echo ""
    echo "Please install PHP or use Docker container to test"
    exit 1
fi
