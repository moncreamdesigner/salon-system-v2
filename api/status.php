<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$config = private_config();
start_secure_session();
json_response([
    'ok' => true,
    'configured' => true,
    'authenticated' => !empty($_SESSION['khalgai_user']),
    'user' => $_SESSION['khalgai_user'] ?? null,
    'database' => $config['db_name'] ?? '',
]);

