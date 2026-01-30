<?php
/**
 * User Login using WordPress wp_signon()
 * 
 * Endpoint: POST /server/api/php/login.php
 * Body: { username: string, password: string }
 */

header('Content-Type: application/json');

require_once '/var/www/html/wp-load.php';

function send($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['username']) || empty($input['password'])) {
    send(['error' => 'Missing credentials'], 400);
}

$credentials = [
    'user_login'    => $input['username'],
    'user_password' => $input['password'],
    'remember'      => false,
];

$user = wp_signon($credentials, false);

if (is_wp_error($user)) {
    send([
        'error' => 'Invalid login',
        'details' => $user->get_error_message()
    ], 401);
}

send([
    'success' => true,
    'user' => [
        'id'       => $user->ID,
        'username' => $user->user_login,
        'email'    => $user->user_email,
        'name'     => $user->display_name,
        'roles'    => $user->roles,
    ]
]);

?>
