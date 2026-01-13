#!/bin/bash
# Test script to update product price directly
# Usage: ./test-update-price.sh <product_id> <user_id>

PRODUCT_ID=${1:-1023}
USER_ID=${2:-7}

echo "Testing API to update product price..."
echo "Product ID: $PRODUCT_ID"
echo "User ID: $USER_ID"
echo "Regular Price: 50000"
echo "Sale Price: 30000"
echo ""

curl -X POST "http://localhost/yardsale_thailand/server/api/php/updateProduct.php" \
  -H "Content-Type: application/json" \
  -d "{
    \"product_id\": $PRODUCT_ID,
    \"user_id\": $USER_ID,
    \"regular_price\": \"50000\",
    \"sale_price\": \"30000\"
  }" \
  -w "\n\nHTTP Status: %{http_code}\n"

