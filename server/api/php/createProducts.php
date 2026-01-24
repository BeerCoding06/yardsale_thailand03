<?php
// API for creating WooCommerce products with brand, thumbnail, and gallery support

// Allow cross-origin requests (adjust as needed)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// Get POST body
$input = json_decode(file_get_contents('php://input'), true);


// Check for required fields (edit as needed, e.g., require more fields)
if (
    !isset($input['name']) ||
    !isset($input['regular_price'])
) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: name, regular_price']);
    exit();
}

// Validate stock_quantity if manage_stock is enabled
if (isset($input['manage_stock']) && $input['manage_stock'] === true) {
    if (!isset($input['stock_quantity']) || empty($input['stock_quantity']) || intval($input['stock_quantity']) <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'stock_quantity must be greater than 0 when manage_stock is enabled']);
        exit();
    }
}

// Load environment variables from .env file
$env_path = dirname(__DIR__, 2) . '/.env';

if (file_exists($env_path)) {
    $env_lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($env_lines as $line) {
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            $value = trim($value, '"\'');
            $_ENV[$key] = $value;
        }
    }
}

$base_url = $_ENV['BASE_URL'] ?? 'http://localhost/yardsale_thailand';
$wp_api_url = $_ENV['WP_MEDIA_HOST'] ?? rtrim($base_url, '/') . '/wordpress';
$wp_api_url = rtrim($wp_api_url, '/') . '/wp-json/wc/v3/products';

$auth = $_ENV['WP_BASIC_AUTH'] ?? 'cGFyYWRvbl9wb2twaW5nbWF1bmc6eDRkTCA4QUp1IHQzSHkgZzIyMyA5aTViIG9hTnk=';

if (empty($auth)) {
    http_response_code(500);
    echo json_encode(['error' => 'WP_BASIC_AUTH is not set in .env file']);
    exit();
}

// Prepare payload
$product_data = [
    'name' => $input['name'],
    'type' => $input['type'] ?? 'variable', // Use type from input or default to 'simple'
    'regular_price' => $input['regular_price'],
    'status' => $input['status'] ?? 'pending', // Use status from input or default to 'pending'
];

// Add post_author if provided (logged-in user ID)
// Note: WooCommerce REST API may not directly support post_author,
// so we'll need to update it after product creation using WordPress native functions
$post_author = null;
if (isset($input['post_author']) && !empty($input['post_author'])) {
    $post_author = intval($input['post_author']);
    error_log('[createProducts] post_author received from input: ' . $post_author);
} else {
    error_log('[createProducts] post_author not found in input. Input keys: ' . implode(', ', array_keys($input ?? [])));
}

// Generate SKU automatically if not provided
if (!isset($input['sku']) || empty($input['sku'])) {
    $sku_base = strtoupper(preg_replace('/[^a-zA-Z0-9]+/', '-', $input['name']));
    $sku_base = trim($sku_base, '-');
    $sku_timestamp = substr(time(), -6);
    $product_data['sku'] = $sku_base . '-' . $sku_timestamp;
}

// Add more fields if provided (exclude 'images' as it's handled separately)
$fields = [
    'description', 'short_description', 'manage_stock',
    'categories', 'sale_price'
];
foreach ($fields as $field) {
    if (isset($input[$field])) {
        $product_data[$field] = $input[$field];
    }
}

// Handle stock_quantity with default value of 1
if (isset($input['stock_quantity'])) {
    $product_data['stock_quantity'] = intval($input['stock_quantity']) > 0 ? intval($input['stock_quantity']) : 1;
} else {
    $product_data['stock_quantity'] = 1; // Default value
}

// Only add SKU from input if it was provided (don't override auto-generated SKU)
if (isset($input['sku']) && !empty($input['sku'])) {
    $product_data['sku'] = $input['sku'];
}

// Handle attributes (for variable products)
if (isset($input['attributes']) && is_array($input['attributes']) && !empty($input['attributes'])) {
    $product_data['attributes'] = [];
    foreach ($input['attributes'] as $attr) {
        if (isset($attr['slug']) && isset($attr['options']) && !empty($attr['options'])) {
            // For taxonomy-based attributes (pa_*), use slug as name
            $attr_name = $attr['slug'];
            $attr_options = is_array($attr['options']) ? $attr['options'] : [$attr['options']];
            
            $product_data['attributes'][] = [
                'id' => isset($attr['id']) ? intval($attr['id']) : 0,
                'name' => $attr_name,
                'slug' => $attr_name,
                'position' => isset($attr['position']) ? intval($attr['position']) : 0,
                'visible' => isset($attr['visible']) ? (bool)$attr['visible'] : true,
                'variation' => isset($attr['variation']) ? (bool)$attr['variation'] : true,
                'options' => $attr_options,
            ];
        }
    }
}

// เพิ่ม tags (ป้ายกำกับ)
if (isset($input['tags']) && !empty($input['tags'])) {
    // WooCommerce expects tags as an array of objects with 'id' or 'name'
    $product_data['tags'] = [];
    $tags = is_array($input['tags']) ? $input['tags'] : [$input['tags']];
    foreach ($tags as $tag) {
        // If tag is already an object/array with 'id' or 'name', use it directly
        if (is_array($tag) && (isset($tag['id']) || isset($tag['name']))) {
            $product_data['tags'][] = $tag;
        } elseif (is_numeric($tag)) {
            // If tag is numeric, treat as tag ID
            $product_data['tags'][] = ['id' => intval($tag)];
        } elseif (is_string($tag) && !empty($tag)) {
            // If tag is string, treat as tag name (will be created if doesn't exist)
            $product_data['tags'][] = ['name' => trim($tag)];
        }
    }
    
    // Remove empty tags array if no valid tags were added
    if (empty($product_data['tags'])) {
        unset($product_data['tags']);
    }
}

// เพิ่ม brands (แบรนด์สินค้า)
if (isset($input['brand']) && !empty($input['brand'])) {
    // WooCommerce expects brands as an array of objects with 'id' property
    $product_data['brands'] = [];
    $brands = is_array($input['brand']) ? $input['brand'] : [$input['brand']];
    foreach ($brands as $brand) {
        if (is_numeric($brand)) {
            // If brand is numeric (ID as number or string), treat as brand ID
            $brand_id = intval($brand);
            if ($brand_id > 0) {
                $product_data['brands'][] = ['id' => $brand_id];
            }
        } elseif (is_string($brand) && !empty($brand) && is_numeric($brand)) {
            // If brand is numeric string, convert to int
            $brand_id = intval($brand);
            if ($brand_id > 0) {
                $product_data['brands'][] = ['id' => $brand_id];
            }
        } elseif (is_array($brand)) {
            // If brand is already an object/array
            if (isset($brand['id'])) {
                $brand_id = intval($brand['id']);
                if ($brand_id > 0) {
                    $product_data['brands'][] = ['id' => $brand_id];
                }
            } elseif (isset($brand['name'])) {
                // If brand has name, use it (WooCommerce will find or create)
                $product_data['brands'][] = ['name' => trim($brand['name'])];
            }
        }
    }
    
    // Remove empty brands array if no valid brands were added
    if (empty($product_data['brands'])) {
        unset($product_data['brands']);
    } else {
        error_log('[createProducts] Adding brands to product: ' . json_encode($product_data['brands']));
    }
}

// Handle images - support both 'images' array and 'thumb'/'gallery' for backward compatibility
if (isset($input['images']) && is_array($input['images'])) {
    // If 'images' is provided, use it directly (but normalize format)
    $product_data['images'] = [];
    foreach ($input['images'] as $index => $img) {
        $normalized_img = [];
        
        if (is_array($img)) {
            // If already an object/array, use it directly
            if (isset($img['id'])) {
                $normalized_img['id'] = intval($img['id']);
            }
            if (isset($img['src'])) {
                $normalized_img['src'] = $img['src'];
            }
            // Add position for WooCommerce (0 = featured image)
            if (!isset($normalized_img['position'])) {
                $normalized_img['position'] = $index;
            }
        } elseif (is_numeric($img)) {
            // If numeric, treat as media ID
            $normalized_img = [
                'id' => intval($img),
                'position' => $index
            ];
        } elseif (is_string($img) && !empty($img)) {
            // If string, treat as image URL
            $normalized_img = [
                'src' => $img,
                'position' => $index
            ];
        }
        
        if (!empty($normalized_img)) {
            $product_data['images'][] = $normalized_img;
        }
    }
    
    // Log images for debugging
    error_log('[createProducts] Processed images: ' . json_encode($product_data['images'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
} else {
    // Backward compatibility: support 'thumb' and 'gallery' if 'images' is not provided
    // เพิ่ม thumb (featured image)
    if (isset($input['thumb']) && !empty($input['thumb'])) {
        // 'thumb' should be a media ID or image src (url). WooCommerce accepts an array of images for 'images'.
        // But to set featured image, it's the first item in 'images' array.
        $thumb_image = is_array($input['thumb']) ? $input['thumb'][0] : $input['thumb'];
        $thumb_prepared = [];

        // Determine if thumb is ID or URL
        if (is_numeric($thumb_image)) {
            $thumb_prepared['id'] = intval($thumb_image);
        } else {
            $thumb_prepared['src'] = $thumb_image;
        }

        // If images array exists, prepend; else, set new images array
        if (!isset($product_data['images']) || !is_array($product_data['images'])) {
            $product_data['images'] = [];
        }
        array_unshift($product_data['images'], $thumb_prepared);
    }

    // เพิ่ม gallerry (gallery images)
    // Expect 'gallery' key in the body, should be an array of image URLs or IDs (excluding the thumb)
    if (isset($input['gallery']) && is_array($input['gallery'])) {
        foreach ($input['gallery'] as $gallery_item) {
            $img = [];
            if (is_numeric($gallery_item)) {
                $img['id'] = intval($gallery_item);
            } else {
                $img['src'] = $gallery_item;
            }
            // Don't duplicate thumb if present
            if (!isset($product_data['images']) || !is_array($product_data['images'])) {
                $product_data['images'] = [];
            }
            if (!in_array($img, $product_data['images'])) {
                $product_data['images'][] = $img;
            }
        }
    }
}

// Log product data before sending (for debugging)
error_log('[createProducts] Product data: ' . json_encode($product_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
error_log('[createProducts] Images count: ' . (isset($product_data['images']) ? count($product_data['images']) : 0));
if (isset($product_data['images']) && !empty($product_data['images'])) {
    error_log('[createProducts] Images data: ' . json_encode($product_data['images'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
} else {
    error_log('[createProducts] WARNING: No images in product_data!');
    error_log('[createProducts] Input images: ' . json_encode($input['images'] ?? 'not set', JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

// Send cURL request to WooCommerce
$ch = curl_init($wp_api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($product_data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Basic ' . $auth
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);

curl_close($ch);

// Log response for debugging
error_log('[createProducts] WooCommerce response code: ' . $http_code);
error_log('[createProducts] WooCommerce response: ' . substr($response, 0, 500));

if ($error) {
    http_response_code(500);
    echo json_encode(['error' => 'cURL Error: ' . $error]);
    exit();
}

// Parse response to get product ID
$response_data = json_decode($response, true);
$product_id = null;

error_log('[createProducts] Response HTTP code: ' . $http_code);
error_log('[createProducts] Response data: ' . json_encode($response_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

if ($http_code >= 200 && $http_code < 300 && isset($response_data['id'])) {
    $product_id = intval($response_data['id']);
    error_log('[createProducts] Product created successfully with ID: ' . $product_id);
    
    // Update post_author if provided
    if ($post_author !== null && $post_author > 0) {
        error_log('[createProducts] Attempting to update post_author to: ' . $post_author . ' for product ID: ' . $product_id);
        
        // Load WordPress to use native functions
        // Path from server/api/php/createProducts.php to wordpress/wp-load.php
        $wp_load_path = __DIR__ . '/../../../wp-load.php';
        if (!file_exists($wp_load_path)) {
            // Try alternative path
            $wp_load_path = __DIR__ . '/../../../../wp-load.php';
        }
        
        error_log('[createProducts] WordPress wp-load.php path: ' . $wp_load_path);
        error_log('[createProducts] File exists: ' . (file_exists($wp_load_path) ? 'YES' : 'NO'));
        
        if (file_exists($wp_load_path)) {
            require_once($wp_load_path);
            
            // Verify WordPress is loaded
            if (!function_exists('wp_update_post')) {
                error_log('[createProducts] ERROR: wp_update_post function not found after loading WordPress');
            } else {
                error_log('[createProducts] WordPress loaded successfully, updating post_author...');
                
                // Update post_author using WordPress native function
                $update_result = wp_update_post([
                    'ID' => $product_id,
                    'post_author' => $post_author
                ], true);
                
                if (is_wp_error($update_result)) {
                    error_log('[createProducts] Failed to update post_author: ' . $update_result->get_error_message());
                } else {
                    error_log('[createProducts] Successfully updated post_author to: ' . $post_author);
                    
                    // Verify the update
                    $updated_post = get_post($product_id);
                    if ($updated_post && $updated_post->post_author == $post_author) {
                        error_log('[createProducts] Verified: post_author is now ' . $updated_post->post_author);
                    } else {
                        error_log('[createProducts] WARNING: Verification failed. Current post_author: ' . ($updated_post ? $updated_post->post_author : 'post not found'));
                    }
                }
            }
        } else {
            error_log('[createProducts] WordPress wp-load.php not found at: ' . $wp_load_path);
        }
    } else {
        error_log('[createProducts] post_author not provided or invalid. post_author value: ' . ($post_author ?? 'null'));
    }
    error_log('[createProducts] Product created successfully with ID: ' . $product_id);
    
    // Get product type from input or response
    $product_type = $input['type'] ?? ($response_data['type'] ?? 'simple');
    error_log('[createProducts] Product type: ' . $product_type);
    error_log('[createProducts] Has attributes in input: ' . (isset($input['attributes']) ? 'YES' : 'NO'));
    
    // Create variation if product type is 'variable'
    if ($product_type === 'variable') {
        error_log('[createProducts] Product is variable type, creating variation...');
        
        // Prepare variation data
        // Set default stock_quantity to 1 if not provided or <= 0
        $variation_stock_quantity = 1; // Default value
        if (isset($input['stock_quantity']) && !empty($input['stock_quantity'])) {
            $stock_qty = intval($input['stock_quantity']);
            if ($stock_qty > 0) {
                $variation_stock_quantity = $stock_qty;
            }
        }
        
        $variation_data = [
            'regular_price' => isset($input['regular_price']) && !empty($input['regular_price']) ? strval($input['regular_price']) : '',
            'sale_price' => isset($input['sale_price']) && !empty($input['sale_price']) ? strval($input['sale_price']) : '',
            'price' => isset($input['sale_price']) && !empty($input['sale_price']) ? strval($input['sale_price']) : (isset($input['regular_price']) && !empty($input['regular_price']) ? strval($input['regular_price']) : ''),
            'manage_stock' => isset($input['manage_stock']) ? (bool)$input['manage_stock'] : true,
            'stock_quantity' => $variation_stock_quantity,
            'attributes' => []
        ];
        
        // Convert attributes format from product attributes to variation attributes
        if (isset($input['attributes']) && is_array($input['attributes']) && !empty($input['attributes'])) {
            foreach ($input['attributes'] as $attr) {
                if (isset($attr['slug']) && isset($attr['options']) && !empty($attr['options'])) {
                    // Get the first option as the variation value
                    $option_value = is_array($attr['options']) ? $attr['options'][0] : $attr['options'];
                    
                    $variation_data['attributes'][] = [
                        'id' => isset($attr['id']) ? intval($attr['id']) : 0,
                        'name' => $attr['name'] ?? $attr['slug'],
                        'slug' => $attr['slug'],
                        'position' => isset($attr['position']) ? intval($attr['position']) : 0,
                        'visible' => false,
                        'variation' => false,
                        'option' => $option_value
                    ];
                }
            }
        }
        
        error_log('[createProducts] Variation attributes count: ' . count($variation_data['attributes']));
        
        // Create variation for variable product
        $base_url = $_ENV['BASE_URL'] ?? 'http://localhost/yardsale_thailand';
        $wp_base = rtrim($_ENV['WP_MEDIA_HOST'] ?? rtrim($base_url, '/') . '/wordpress', '/');
        $variation_url = $wp_base . '/wp-json/wc/v3/products/' . $product_id . '/variations';
        
        error_log('[createProducts] WP Base URL: ' . $wp_base);
        error_log('[createProducts] Product ID: ' . $product_id);
        error_log('[createProducts] Variation URL: ' . $variation_url);
        error_log('[createProducts] Variation data: ' . json_encode($variation_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        error_log('[createProducts] Auth token present: ' . (!empty($auth) ? 'YES (length: ' . strlen($auth) . ')' : 'NO'));
        error_log('[createProducts] Auth token (first 20 chars): ' . substr($auth, 0, 20));
        
        // Prepare headers with authentication
        $variation_headers = [
            'Content-Type: application/json',
            'Authorization: Basic ' . $auth
        ];
        
        error_log('[createProducts] Variation request headers: ' . json_encode([
            'Content-Type' => 'application/json',
            'Authorization' => 'Basic ' . substr($auth, 0, 20) . '...'
        ]));
        
        // Send variation creation request
        $ch_variation = curl_init($variation_url);
        curl_setopt($ch_variation, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch_variation, CURLOPT_POST, true);
        curl_setopt($ch_variation, CURLOPT_POSTFIELDS, json_encode($variation_data));
        curl_setopt($ch_variation, CURLOPT_HTTPHEADER, $variation_headers);
        curl_setopt($ch_variation, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch_variation, CURLOPT_SSL_VERIFYHOST, false);
        
        $variation_response = curl_exec($ch_variation);
        $variation_http_code = curl_getinfo($ch_variation, CURLINFO_HTTP_CODE);
        $variation_error = curl_error($ch_variation);
        $variation_info = curl_getinfo($ch_variation);
        
        curl_close($ch_variation);
        
        error_log('[createProducts] Variation cURL Info: ' . json_encode($variation_info, JSON_PRETTY_PRINT));
        error_log('[createProducts] Variation response code: ' . $variation_http_code);
        error_log('[createProducts] Variation full response: ' . $variation_response);
        
        if ($variation_error) {
            error_log('[createProducts] Variation cURL Error: ' . $variation_error);
            // Don't fail the whole request if variation creation fails, just log it
        } else if ($variation_http_code >= 200 && $variation_http_code < 300) {
            error_log('[createProducts] Variation created successfully');
            $variation_data_parsed = json_decode($variation_response, true);
            if (isset($variation_data_parsed['id'])) {
                // Add variation ID to response
                $response_data['variation_id'] = $variation_data_parsed['id'];
                $response = json_encode($response_data);
            }
        } else {
            error_log('[createProducts] Variation creation failed with code: ' . $variation_http_code);
            error_log('[createProducts] Variation error response: ' . $variation_response);
        }
    }
}

http_response_code($http_code);
echo $response;

?>