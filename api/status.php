<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$config = private_config();
start_secure_session();
$user = empty($_SESSION['khalgai_user']) ? null : require_auth();
json_response([
    'ok' => true,
    'configured' => true,
    'authenticated' => $user !== null,
    'user' => $user,
    'database' => $config['db_name'] ?? '',
]);
