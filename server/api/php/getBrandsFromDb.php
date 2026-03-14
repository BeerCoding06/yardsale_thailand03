<?php
/**
 * Get product brands from WordPress database (taxonomy product_brand or pa_brand)
 * ใช้เมื่อ wp/v2/product_brand คืน 401 หรือไม่มี REST API
 *
 * Env: DB_HOST, WP_DB_NAME, WP_DB_USER, WP_DB_PASSWORD, WP_TABLE_PREFIX
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(200);
    exit();
}
if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode([]);
    exit();
}

require_once __DIR__ . '/config.php';

$dbHostEnv = getenv('DB_HOST');
$dbHost = !empty($dbHostEnv) ? $dbHostEnv : 'wp_db';
$dbPort = getenv('DB_PORT') ?: '3306';
$dbName = getenv('WP_DB_NAME') ?: 'wordpress';
$dbUser = getenv('WP_DB_USER') ?: 'wpuser';
$dbPassword = getenv('WP_DB_PASSWORD') ?: 'wppass';
$tablePrefix = getenv('WP_TABLE_PREFIX') ?: 'wp_';

$hostParts = explode(':', $dbHost);
$dbHostOnly = $hostParts[0];
if (count($hostParts) > 1) {
    $dbPort = $hostParts[1];
}

try {
    $pdo = new PDO(
        "mysql:host={$dbHostOnly};port={$dbPort};dbname={$dbName};charset=utf8mb4",
        $dbUser,
        $dbPassword,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    error_log('[getBrandsFromDb] DB connection failed: ' . $e->getMessage());
    echo json_encode([]);
    exit();
}

$termsTable = $tablePrefix . 'terms';
$taxTable = $tablePrefix . 'term_taxonomy';

// Try product_brand first (common), then pa_brand (attribute)
$taxonomies = ['product_brand', 'pa_brand', 'brand'];
$brands = [];

foreach ($taxonomies as $taxonomy) {
    $sql = "SELECT t.term_id AS id, t.name, t.slug, tt.description, tt.count
            FROM {$termsTable} t
            INNER JOIN {$taxTable} tt ON t.term_id = tt.term_id
            WHERE tt.taxonomy = ?
            ORDER BY t.name ASC";
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$taxonomy]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (!empty($rows)) {
            foreach ($rows as $row) {
                $brands[] = [
                    'id' => (int) $row['id'],
                    'name' => $row['name'] ?? '',
                    'slug' => $row['slug'] ?? '',
                    'description' => $row['description'] ?? '',
                    'count' => (int) ($row['count'] ?? 0),
                ];
            }
            break;
        }
    } catch (PDOException $e) {
        // try next taxonomy
    }
}

echo json_encode($brands);
