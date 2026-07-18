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
$pdo = db();
$statement = $pdo->prepare('SELECT id, username, display_name, password_hash, role, salon_name, is_active FROM app_users WHERE username = ? LIMIT 1');
$statement->execute([$username]);
$row = $statement->fetch();

if ($row) {
    $validPassword = (bool)$row['is_active'] && password_verify($password, (string)$row['password_hash']);
} else {
    $validUser = hash_equals((string)$config['app_user'], $username);
    $legacyHash = hash_pbkdf2('sha256', $password, (string)$config['app_password_salt'], 120000, 64);
    $validPassword = $validUser && hash_equals((string)$config['app_password_hash'], $legacyHash);
    if ($validPassword) {
        $insert = $pdo->prepare('INSERT INTO app_users (username, display_name, password_hash, role, salon_name, is_active, last_login_at) VALUES (?, ?, ?, ?, NULL, 1, NOW())');
        $insert->execute([$username, 'Үндсэн админ', password_hash($password, PASSWORD_DEFAULT), 'admin']);
        $statement->execute([$username]);
        $row = $statement->fetch();
    }
}

if (!$row || !$validPassword) {
    $_SESSION['failed_logins'] = (int)($_SESSION['failed_logins'] ?? 0) + 1;
    json_response(['ok' => false, 'message' => 'Нэвтрэх нэр эсвэл нууц үг буруу байна.'], 401);
}
session_regenerate_id(true);
$_SESSION['failed_logins'] = 0;
$pdo->prepare('UPDATE app_users SET last_login_at = NOW() WHERE id = ?')->execute([(int)$row['id']]);
$_SESSION['khalgai_user'] = session_user_from_row($row);
json_response(['ok' => true, 'user' => $_SESSION['khalgai_user']]);
