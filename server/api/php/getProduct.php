<?php
/**
 * Get Single Product from WordPress REST API v2
 * 
 * Endpoint: GET /server/api/php/getProduct.php
 * Query params: slug, sku, id
 */

require_once __DIR__ . '/config.php';

// Get query parameters
$slug = isset($_GET['slug']) ? $_GET['slug'] : null;
$sku = isset($_GET['sku']) ? $_GET['sku'] : null;
$id = isset($_GET['id']) ? (int)$_GET['id'] : null;

if (!$slug && !$sku && !$id) {
    sendErrorResponse('slug, sku, or id is required', 400);
}

$productId = null;
$product = null;

// Try to find product by slug using WooCommerce API
if ($slug) {
    $url = buildWcApiUrl('wc/v3/products', [
        'slug' => $slug,
        'per_page' => 1,
        'status' => 'publish'
    ]);
    
    $result = fetchWooCommerceApi($url, 'GET', null, false);
    
    if ($result['success'] && !empty($result['data']) && is_array($result['data']) && count($result['data']) > 0) {
        $product = $result['data'][0];
        $productId = $product['id'];
    }
}

// Try to find product by SKU using WooCommerce API
if (!$productId && $sku) {
    $url = buildWcApiUrl('wc/v3/products', [
        'sku' => $sku,
        'per_page' => 1,
        'status' => 'publish'
    ]);
    
    $result = fetchWooCommerceApi($url, 'GET', null, false);
    
    if ($result['success'] && !empty($result['data']) && is_array($result['data']) && count($result['data']) > 0) {
        $productId = $result['data'][0]['id'];
    }
}

// Use ID directly
if (!$productId && $id) {
    $productId = $id;
}

// Fetch full product data from WooCommerce API
if ($productId && !$product) {
    $url = buildWcApiUrl("wc/v3/products/$productId");
    $result = fetchWooCommerceApi($url, 'GET', null, false);
    
    if (!$result['success']) {
        sendErrorResponse('Product not found', 404);
    }
    
    $product = $result['data'];
}

if (!$product) {
    sendErrorResponse('Product not found', 404);
}

// Format product data
// Get featured image from _embedded
$imageUrl = null;
if (!empty($product['_embedded']['wp:featuredmedia'][0]['source_url'])) {
    $imageUrl = $product['_embedded']['wp:featuredmedia'][0]['source_url'];
} elseif (!empty($product['featured_media'])) {
    // Try to fetch media if not embedded
    $mediaUrl = buildWpApiUrl("wp/v2/media/{$product['featured_media']}");
    $mediaResult = fetchWordPressApi($mediaUrl, 'GET');
    if ($mediaResult['success'] && !empty($mediaResult['data']['source_url'])) {
        $imageUrl = $mediaResult['data']['source_url'];
    }
}

$galleryImages = [];
if ($imageUrl) {
    $galleryImages[] = ['sourceUrl' => $imageUrl];
}

// Format prices from meta fields (WordPress REST API v2)
$regularPrice = '';
$salePrice = null;

$regularPriceValue = null;
if (!empty($product['meta'])) {
    if (isset($product['meta']['_regular_price'])) {
        $regularPriceValue = $product['meta']['_regular_price'];
    } elseif (isset($product['meta']['_price'])) {
        $regularPriceValue = $product['meta']['_price'];
    }
}

if ($regularPriceValue !== null && $regularPriceValue !== '') {
    $price = (float)$regularPriceValue;
    if ($price > 0) {
        $regularPrice = '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>' . number_format(round($price)) . '</span>';
    }
}

$salePriceValue = null;
if (!empty($product['meta']) && isset($product['meta']['_sale_price']) && $product['meta']['_sale_price'] !== '') {
    $salePriceValue = $product['meta']['_sale_price'];
}

if ($salePriceValue !== null && $salePriceValue !== '') {
    $price = (float)$salePriceValue;
    if ($price > 0) {
        $regularPriceNum = $regularPriceValue ? (float)$regularPriceValue : 0;
        if ($price < $regularPriceNum || $regularPriceNum === 0) {
            $salePrice = '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>' . number_format(round($price)) . '</span>';
        }
    }
}

// Get SKU and stock from meta
$productSku = $product['slug'] ?? 'product-' . $productId;
if (!empty($product['meta']) && isset($product['meta']['_sku'])) {
    $productSku = $product['meta']['_sku'];
}

$stockQuantity = null;
$stockStatus = 'IN_STOCK';
if (!empty($product['meta'])) {
    if (isset($product['meta']['_stock'])) {
        $stockQuantity = (int)$product['meta']['_stock'];
    }
    if (isset($product['meta']['_stock_status'])) {
        $stockStatus = strtoupper($product['meta']['_stock_status']);
    }
}

// Get attributes from meta (WordPress REST API v2)
$paColor = [];
$paStyle = [];
// Attributes are typically stored in meta or taxonomy terms
// This is a simplified version - you may need to adjust based on your setup

// Get variations (simplified - WordPress REST API v2 doesn't have direct variations endpoint)
$variations = [];
// Variations would need to be fetched differently in wp/v2
        
        if ($varResult['success'] && !empty($varResult['data'])) {
            $variation = $varResult['data'];
            
            $varImageUrl = null;
            if (!empty($variation['image']['src'])) {
                $varImageUrl = $variation['image']['src'];
            }
            
            $varRegularPrice = '';
            $varSalePrice = null;
            
            $varRegularPriceValue = null;
            if (!empty($variation['regular_price']) && $variation['regular_price'] !== '') {
                $varRegularPriceValue = $variation['regular_price'];
            } elseif (!empty($variation['price']) && $variation['price'] !== '') {
                $varRegularPriceValue = $variation['price'];
            }
            
            if ($varRegularPriceValue !== null && $varRegularPriceValue !== '') {
                $price = (float)$varRegularPriceValue;
                if ($price > 0) {
                    $varRegularPrice = '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>' . number_format(round($price)) . '</span>';
                }
            }
            
            $varSalePriceValue = null;
            if (!empty($variation['sale_price']) && $variation['sale_price'] !== '') {
                $varSalePriceValue = $variation['sale_price'];
            }
            
            if ($varSalePriceValue !== null && $varSalePriceValue !== '') {
                $price = (float)$varSalePriceValue;
                if ($price > 0) {
                    $regularPriceNum = $varRegularPriceValue ? (float)$varRegularPriceValue : 0;
                    if ($price < $regularPriceNum || $regularPriceNum === 0) {
                        $varSalePrice = '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>' . number_format(round($price)) . '</span>';
                    }
                }
            }
            
            $varAttributes = [];
            if (!empty($variation['attributes']) && is_array($variation['attributes'])) {
                foreach ($variation['attributes'] as $attr) {
                    $varAttributes[] = ['value' => $attr['option'] ?? ''];
                }
            }
            
            $variations[] = [
                'databaseId' => $variation['id'],
                'salePrice' => $varSalePrice,
                'regularPrice' => $varRegularPrice,
                'stockQuantity' => isset($variation['stock_quantity']) && $variation['stock_quantity'] !== null ? (int)$variation['stock_quantity'] : null,
                'stockStatus' => strtoupper($variation['stock_status'] ?? 'instock'),
                'image' => $varImageUrl ? ['sourceUrl' => $varImageUrl] : null,
                'attributes' => ['nodes' => $varAttributes]
            ];
        }
    }
}

// Get related products from WooCommerce API
$relatedProducts = [];
if (!empty($product['categories']) && is_array($product['categories']) && count($product['categories']) > 0) {
    $mainCategoryId = $product['categories'][0]['id'];
    $relatedUrl = buildWcApiUrl('wc/v3/products', [
        'category' => $mainCategoryId,
        'per_page' => 10,
        'exclude' => $productId,
        'status' => 'publish'
    ]);
    
    $relatedResult = fetchWooCommerceApi($relatedUrl, 'GET', null, false);
    
    if ($relatedResult['success'] && !empty($relatedResult['data']) && is_array($relatedResult['data'])) {
        foreach ($relatedResult['data'] as $relatedProd) {
            $relatedImageUrl = null;
            if (!empty($relatedProd['images']) && is_array($relatedProd['images']) && count($relatedProd['images']) > 0) {
                $relatedImageUrl = $relatedProd['images'][0]['src'] ?? null;
            }
            
            $relatedRegularPrice = '';
            $relatedSalePrice = null;
            
            $relatedRegularPriceValue = null;
            if (!empty($relatedProd['regular_price']) && $relatedProd['regular_price'] !== '') {
                $relatedRegularPriceValue = $relatedProd['regular_price'];
            } elseif (!empty($relatedProd['price']) && $relatedProd['price'] !== '') {
                $relatedRegularPriceValue = $relatedProd['price'];
            }
            
            if ($relatedRegularPriceValue !== null && $relatedRegularPriceValue !== '') {
                $price = (float)$relatedRegularPriceValue;
                if ($price > 0) {
                    $relatedRegularPrice = '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>' . number_format(round($price)) . '</span>';
                }
            }
            
            $relatedSalePriceValue = null;
            if (!empty($relatedProd['sale_price']) && $relatedProd['sale_price'] !== '') {
                $relatedSalePriceValue = $relatedProd['sale_price'];
            }
            
            if ($relatedSalePriceValue !== null && $relatedSalePriceValue !== '') {
                $price = (float)$relatedSalePriceValue;
                if ($price > 0) {
                    $regularPriceNum = $relatedRegularPriceValue ? (float)$relatedRegularPriceValue : 0;
                    if ($price < $regularPriceNum || $regularPriceNum === 0) {
                        $relatedSalePrice = '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>' . number_format(round($price)) . '</span>';
                    }
                }
            }
            
            $relatedProducts[] = [
                'sku' => $relatedProd['sku'] ?? $relatedProd['slug'] ?? 'product-' . $relatedProd['id'],
                'slug' => $relatedProd['slug'],
                'name' => $relatedProd['name'] ?? '',
                'regularPrice' => $relatedRegularPrice,
                'salePrice' => $relatedSalePrice,
                'allPaStyle' => ['nodes' => []],
                'image' => $relatedImageUrl ? ['sourceUrl' => $relatedImageUrl] : null,
                'galleryImages' => ['nodes' => $relatedImageUrl ? [['sourceUrl' => $relatedImageUrl]] : []]
            ];
        }
    }
}

// Return response
sendJsonResponse([
    'product' => [
        'databaseId' => $productId,
        'sku' => $productSku,
        'slug' => $product['slug'],
        'name' => $product['name'] ?? '',
        'description' => $product['description'] ?? '',
        'regularPrice' => $regularPrice,
        'salePrice' => $salePrice,
        'stockQuantity' => $stockQuantity,
        'stockStatus' => $stockStatus,
        'status' => $product['status'] ?? 'publish',
        'image' => $imageUrl ? ['sourceUrl' => $imageUrl] : null,
        'galleryImages' => ['nodes' => $galleryImages],
        'allPaColor' => ['nodes' => $paColor],
        'allPaStyle' => ['nodes' => $paStyle],
        'related' => ['nodes' => $relatedProducts],
        'variations' => ['nodes' => $variations]
    ]
]);

?>
