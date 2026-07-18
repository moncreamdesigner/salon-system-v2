<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$currentUser = require_admin();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function public_user(array $row): array
{
    return [
        'id' => (int)($row['id'] ?? 0),
        'username' => (string)($row['username'] ?? ''),
        'displayName' => (string)($row['display_name'] ?? $row['displayName'] ?? ''),
        'role' => (string)($row['role'] ?? 'salon'),
        'salon' => (string)($row['salon_name'] ?? $row['salon'] ?? ''),
        'active' => (bool)($row['is_active'] ?? $row['active'] ?? false),
        'lastLoginAt' => $row['last_login_at'] ?? null,
        'createdAt' => $row['created_at'] ?? null,
        'legacy' => (bool)($row['legacy'] ?? false),
    ];
}

function validated_user_payload(array $payload, bool $creating): array
{
    $displayName = trim((string)($payload['displayName'] ?? ''));
    $username = strtolower(trim((string)($payload['username'] ?? '')));
    $password = (string)($payload['password'] ?? '');
    $role = (string)($payload['role'] ?? 'salon');
    $salon = trim((string)($payload['salon'] ?? ''));
    $active = !array_key_exists('active', $payload) || (bool)$payload['active'];

    if ($displayName === '' || strlen($displayName) > 360) {
        json_response(['ok' => false, 'message' => 'Хэрэглэгчийн нэрийг зөв оруулна уу.'], 422);
    }
    if (!preg_match('/^[a-z0-9._-]{3,64}$/', $username)) {
        json_response(['ok' => false, 'message' => 'Нэвтрэх нэр 3–64 тэмдэгттэй, латин үсэг, тоо, цэг, зураас ашигласан байна.'], 422);
    }
    if (!in_array($role, ['admin', 'manager', 'salon'], true)) {
        json_response(['ok' => false, 'message' => 'Хэрэглэгчийн эрх буруу байна.'], 422);
    }
    if ($role === 'salon' && $salon === '') {
        json_response(['ok' => false, 'message' => 'Салбарын эрхэд салбар сонгоно уу.'], 422);
    }
    if (($creating || $password !== '') && strlen($password) < 8) {
        json_response(['ok' => false, 'message' => 'Нууц үг хамгийн багадаа 8 тэмдэгт байна.'], 422);
    }

    return [
        'displayName' => $displayName,
        'username' => $username,
        'password' => $password,
        'role' => $role,
        'salon' => $role === 'salon' ? $salon : null,
        'active' => $active,
    ];
}

if ($method === 'GET') {
    $rows = $pdo->query("SELECT id, username, display_name, role, salon_name, is_active, last_login_at, created_at
        FROM app_users
        ORDER BY FIELD(role, 'admin', 'manager', 'salon'), is_active DESC, display_name ASC")->fetchAll();
    $users = array_map('public_user', $rows);
    if ((int)($currentUser['id'] ?? 0) === 0) {
        $config = private_config();
        $legacyUsername = (string)($config['app_user'] ?? $currentUser['username'] ?? 'admin');
        $exists = array_filter($users, static fn(array $user): bool => $user['username'] === $legacyUsername);
        if (!$exists) {
            array_unshift($users, public_user([
                'id' => 0,
                'username' => $legacyUsername,
                'displayName' => 'Үндсэн админ',
                'role' => 'admin',
                'salon' => '',
                'active' => true,
                'legacy' => true,
            ]));
        }
    }
    json_response(['ok' => true, 'users' => $users]);
}

if ($method === 'POST') {
    $data = validated_user_payload(request_payload(), true);
    try {
        $statement = $pdo->prepare('INSERT INTO app_users (username, display_name, password_hash, role, salon_name, is_active) VALUES (?, ?, ?, ?, ?, ?)');
        $statement->execute([
            $data['username'],
            $data['displayName'],
            password_hash($data['password'], PASSWORD_DEFAULT),
            $data['role'],
            $data['salon'],
            $data['active'] ? 1 : 0,
        ]);
    } catch (PDOException $error) {
        if ($error->getCode() === '23000') json_response(['ok' => false, 'message' => 'Энэ нэвтрэх нэр бүртгэлтэй байна.'], 409);
        json_response(['ok' => false, 'message' => 'Хэрэглэгч үүсгэж чадсангүй.'], 500);
    }
    json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
}

if ($method === 'PUT') {
    $payload = request_payload();
    $id = (int)($payload['id'] ?? 0);
    if ($id <= 0) {
        json_response(['ok' => false, 'message' => 'Үндсэн админыг шинэ хэлбэрээр дахин нэвтэрсний дараа засах боломжтой.'], 422);
    }
    $existingStatement = $pdo->prepare('SELECT id, username, display_name, role, salon_name, is_active FROM app_users WHERE id = ? LIMIT 1');
    $existingStatement->execute([$id]);
    $existing = $existingStatement->fetch();
    if (!$existing) json_response(['ok' => false, 'message' => 'Хэрэглэгч олдсонгүй.'], 404);

    $data = validated_user_payload($payload, false);
    $editingSelf = (int)($currentUser['id'] ?? 0) === $id;
    if ($editingSelf && (!$data['active'] || $data['role'] !== 'admin')) {
        json_response(['ok' => false, 'message' => 'Өөрийн админ эрхийг идэвхгүй болгох эсвэл өөрчлөх боломжгүй.'], 422);
    }
    if ($existing['role'] === 'admin' && ($data['role'] !== 'admin' || !$data['active'])) {
        $activeAdminCount = (int)$pdo->query("SELECT COUNT(*) FROM app_users WHERE role = 'admin' AND is_active = 1")->fetchColumn();
        if ($activeAdminCount <= 1) {
            json_response(['ok' => false, 'message' => 'Системд дор хаяж нэг идэвхтэй админ үлдэх ёстой.'], 422);
        }
    }

    try {
        if ($data['password'] !== '') {
            $statement = $pdo->prepare('UPDATE app_users SET username = ?, display_name = ?, password_hash = ?, role = ?, salon_name = ?, is_active = ? WHERE id = ?');
            $statement->execute([$data['username'], $data['displayName'], password_hash($data['password'], PASSWORD_DEFAULT), $data['role'], $data['salon'], $data['active'] ? 1 : 0, $id]);
        } else {
            $statement = $pdo->prepare('UPDATE app_users SET username = ?, display_name = ?, role = ?, salon_name = ?, is_active = ? WHERE id = ?');
            $statement->execute([$data['username'], $data['displayName'], $data['role'], $data['salon'], $data['active'] ? 1 : 0, $id]);
        }
    } catch (PDOException $error) {
        if ($error->getCode() === '23000') json_response(['ok' => false, 'message' => 'Энэ нэвтрэх нэр бүртгэлтэй байна.'], 409);
        json_response(['ok' => false, 'message' => 'Хэрэглэгчийн мэдээлэл шинэчилж чадсангүй.'], 500);
    }

    if ($editingSelf) {
        $existingStatement->execute([$id]);
        $_SESSION['khalgai_user'] = session_user_from_row($existingStatement->fetch());
    }
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
