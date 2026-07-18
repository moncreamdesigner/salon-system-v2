<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
start_secure_session();
$_SESSION = [];
session_destroy();
json_response(['ok' => true]);

