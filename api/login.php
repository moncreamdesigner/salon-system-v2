<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
start_secure_session();
$config = private_config();
$payload = request_payload();
$now = time();
if (($now - (int)($_SESSION['login_attempt_at'] ?? 0)) < 2) {
    json_response(['ok' => false, 'message' => 'Түр хүлээгээд дахин оролдоно уу.'], 429);
}
$_SESSION['login_attempt_at'] = $now;
$username = trim((string)($payload['username'] ?? ''));
$password = (string)($payload['password'] ?? '');
$validUser = hash_equals((string)$config['app_user'], $username);
$passwordHash = hash_pbkdf2('sha256', $password, (string)$config['app_password_salt'], 120000, 64);
$validPassword = hash_equals((string)$config['app_password_hash'], $passwordHash);
if (!$validUser || !$validPassword) {
    $_SESSION['failed_logins'] = (int)($_SESSION['failed_logins'] ?? 0) + 1;
    json_response(['ok' => false, 'message' => 'Нэвтрэх нэр эсвэл нууц үг буруу байна.'], 401);
}
session_regenerate_id(true);
$_SESSION['failed_logins'] = 0;
$_SESSION['khalgai_user'] = ['username' => $username, 'role' => 'admin'];
json_response(['ok' => true, 'user' => $_SESSION['khalgai_user']]);
