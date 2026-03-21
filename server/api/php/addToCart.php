<?php
/**
 * Add Product to Cart using WooCommerce REST API
 *
 * Body:
 *   { "productId": number } — สินค้าแบบง่าย (simple)
 *   { "productId": variationId, "parentProductId": parentId } — สินค้ามีตัวเลือก (variable)
 */

require_once __DIR__ . '/config.php';

setCorsHeaders();

$input = getRequestBody();

if (empty($input)) {
    error_log('[addToCart] Error: Empty request body');
    sendErrorResponse('Request body is required', 400);
}

$body = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    sendErrorResponse('Invalid JSON in request body: ' . json_last_error_msg(), 400);
}

if (!is_array($body)) {
    sendErrorResponse('Invalid request body format', 400);
}

$productId = isset($body['productId']) ? (int) $body['productId'] : 0;
$parentProductId = isset($body['parentProductId']) ? (int) $body['parentProductId'] : 0;

if (!$productId) {
    sendErrorResponse('productId is required', 400);
}

/**
 * Build WooCommerce-style price HTML spans from raw price strings.
 *
 * @return array{0: string, 1: string|null} [ regularPriceHtml, salePriceHtml ]
 */
function addToCart_format_prices($regularPriceValue, $salePriceValue) {
    $regularPrice = '';
    $salePrice = null;

    if ($regularPriceValue !== null && $regularPriceValue !== '') {
        $price = (float) $regularPriceValue;
        if ($price > 0) {
            $regularPrice = '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>' . number_format(round($price)) . '</span>';
        }
    }

    if ($salePriceValue !== null && $salePriceValue !== '') {
        $price = (float) $salePriceValue;
        if ($price > 0) {
            $regularNum = $regularPriceValue !== null && $regularPriceValue !== '' ? (float) $regularPriceValue : 0;
            if ($price < $regularNum || $regularNum === 0) {
                $salePrice = '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>' . number_format(round($price)) . '</span>';
            }
        }
    }

    return array($regularPrice, $salePrice);
}

/** Normalize stock status to uppercase token (align with storefront) */
function addToCart_stock_status_token($status) {
    $s = isset($status) ? (string) $status : 'instock';
    return strtoupper(str_replace(array(' ', '-'), '_', $s));
}

// ----- Variable product: variation under parent -----
if ($parentProductId > 0) {
    $varUrl = buildWcApiUrl("wc/v3/products/{$parentProductId}/variations/{$productId}", [], false);
    error_log('[addToCart] Fetching variation: products/' . $parentProductId . '/variations/' . $productId);

    $varResult = fetchWooCommerceApi($varUrl, 'GET', null, false);
    if (!$varResult['success'] || empty($varResult['data'])) {
        $errorMsg = 'Variation not found';
        if (!empty($varResult['raw_response'])) {
            $errorMsg = 'API Error: ' . substr($varResult['raw_response'], 0, 200);
        }
        error_log('[addToCart] Variation fetch failed: ' . $errorMsg);
        sendErrorResponse($errorMsg, $varResult['http_code'] ?: 404);
    }

    $vari = $varResult['data'];

    $parentUrl = buildWcApiUrl("wc/v3/products/{$parentProductId}", [], false);
    $parentResult = fetchWooCommerceApi($parentUrl, 'GET', null, false);
    if (!$parentResult['success'] || empty($parentResult['data'])) {
        sendErrorResponse('Parent product not found', $parentResult['http_code'] ?: 404);
    }

    $parent = $parentResult['data'];

    $regularPriceValue = !empty($vari['regular_price']) ? $vari['regular_price'] : ($vari['price'] ?? '');
    $salePriceValue = !empty($vari['sale_price']) ? $vari['sale_price'] : null;
    list($regularPrice, $salePrice) = addToCart_format_prices($regularPriceValue, $salePriceValue);

    $imageUrl = null;
    if (!empty($vari['image']) && is_array($vari['image']) && !empty($vari['image']['src'])) {
        $imageUrl = $vari['image']['src'];
    } elseif (!empty($parent['images']) && is_array($parent['images']) && count($parent['images']) > 0) {
        $imageUrl = $parent['images'][0]['src'] ?? null;
    }

    $stockQuantity = null;
    if (isset($vari['stock_quantity']) && $vari['stock_quantity'] !== null && $vari['stock_quantity'] !== '') {
        $stockQuantity = (int) $vari['stock_quantity'];
    }
    $stockStatus = addToCart_stock_status_token($vari['stock_status'] ?? 'instock');

    $varSku = $vari['sku'] ?? ('var-' . $vari['id']);
    $displayName = !empty($vari['name']) ? $vari['name'] : (($parent['name'] ?? '') . ' — ' . $varSku);

    $key = 'var-' . $parentProductId . '-' . $productId;

    sendJsonResponse(array(
        'addToCart' => array(
            'cartItem' => array(
                'key' => $key,
                'product' => array(
                    'node' => array(
                        'id' => $parent['id'],
                        'databaseId' => (int) $parent['id'],
                        'name' => $parent['name'] ?? '',
                        'slug' => $parent['slug'] ?? '',
                        'sku' => $parent['sku'] ?? '',
                        'regularPrice' => '',
                        'salePrice' => null,
                        'image' => !empty($parent['images'][0]['src']) ? array('sourceUrl' => $parent['images'][0]['src']) : null,
                    ),
                ),
                'variation' => array(
                    'node' => array(
                        'id' => $vari['id'],
                        'databaseId' => (int) $vari['id'],
                        'name' => $displayName,
                        'slug' => $parent['slug'] ?? '',
                        'sku' => $varSku,
                        'regularPrice' => $regularPrice,
                        'salePrice' => $salePrice,
                        'stockQuantity' => $stockQuantity,
                        'stockStatus' => $stockStatus,
                        'image' => $imageUrl ? array('sourceUrl' => $imageUrl) : null,
                    ),
                    'attributes' => array(),
                ),
                'quantity' => 1,
            ),
        ),
    ));
}

// ----- Simple / external / grouped (non-variation line) -----
$url = buildWcApiUrl("wc/v3/products/$productId", [], false);
$result = fetchWooCommerceApi($url, 'GET', null, false);

if (!$result['success']) {
    $errorMsg = 'Product not found';
    if (!empty($result['raw_response'])) {
        $errorMsg = 'API Error: ' . substr($result['raw_response'], 0, 200);
    }
    error_log('[addToCart] Failed to fetch product ' . $productId . ': ' . $errorMsg);
    sendErrorResponse($errorMsg, $result['http_code'] ?: 404);
}

$product = $result['data'];

if (empty($product)) {
    sendErrorResponse('Product not found', 404);
}

$type = isset($product['type']) ? strtolower((string) $product['type']) : '';
if ($type === 'variable') {
    sendErrorResponse('This product has options — open the product page, choose a variant, then add to cart.', 400);
}

$imageUrl = null;
if (!empty($product['images']) && is_array($product['images']) && count($product['images']) > 0) {
    $imageUrl = $product['images'][0]['src'] ?? null;
}

$regularPriceValue = null;
if (!empty($product['regular_price']) && $product['regular_price'] !== '') {
    $regularPriceValue = $product['regular_price'];
} elseif (!empty($product['price']) && $product['price'] !== '') {
    $regularPriceValue = $product['price'];
}

$salePriceValue = !empty($product['sale_price']) && $product['sale_price'] !== '' ? $product['sale_price'] : null;
list($regularPrice, $salePrice) = addToCart_format_prices($regularPriceValue, $salePriceValue);

$productSku = $product['sku'] ?? $product['slug'] ?? 'product-' . $product['id'];

$stockQuantity = null;
if (isset($product['stock_quantity']) && $product['stock_quantity'] !== null && $product['stock_quantity'] !== '') {
    $stockQuantity = (int) $product['stock_quantity'];
}
$stockStatus = addToCart_stock_status_token($product['stock_status'] ?? 'instock');

$key = 'simple-' . $productId;

sendJsonResponse(array(
    'addToCart' => array(
        'cartItem' => array(
            'key' => $key,
            'product' => array(
                'node' => array(
                    'id' => $product['id'],
                    'databaseId' => (int) $product['id'],
                    'name' => $product['name'] ?? '',
                    'slug' => $product['slug'] ?? '',
                    'sku' => $productSku,
                    'regularPrice' => $regularPrice,
                    'salePrice' => $salePrice,
                    'stockQuantity' => $stockQuantity,
                    'stockStatus' => $stockStatus,
                    'image' => $imageUrl ? array('sourceUrl' => $imageUrl) : null,
                ),
            ),
            'quantity' => 1,
        ),
    ),
));
