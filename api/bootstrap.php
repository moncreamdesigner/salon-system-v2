<?php
declare(strict_types=1);

const KHALGAI_PRIVATE_CONFIG = __DIR__ . '/../../khalgai-private/config.php';

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_payload(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) json_response(['ok' => false, 'message' => 'JSON хүсэлт буруу байна.'], 400);
    return $decoded;
}

function private_config(): array
{
    if (!is_file(KHALGAI_PRIVATE_CONFIG)) {
        json_response(['ok' => false, 'configured' => false, 'message' => 'Server database тохиргоо хийгдээгүй байна.'], 503);
    }
    $config = require KHALGAI_PRIVATE_CONFIG;
    if (!is_array($config)) json_response(['ok' => false, 'configured' => false], 503);
    return $config;
}

function start_secure_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('khalgai_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function verify_same_origin(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') return;
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (!$origin || !$host || parse_url($origin, PHP_URL_HOST) !== preg_replace('/:\d+$/', '', $host)) {
        json_response(['ok' => false, 'message' => 'Хүсэлтийн эх сурвалж зөвшөөрөгдөөгүй.'], 403);
    }
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'KhalgaiSalon') {
        json_response(['ok' => false, 'message' => 'Хүсэлтийн хамгаалалт дутуу байна.'], 403);
    }
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $config = private_config();
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_name']);
    try {
        $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (Throwable $error) {
        json_response(['ok' => false, 'configured' => true, 'message' => 'Database холболт амжилтгүй.'], 503);
    }
    ensure_schema($pdo);
    return $pdo;
}

function ensure_schema(PDO $pdo): void
{
    static $ready = false;
    if ($ready) return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_meta (
        meta_key VARCHAR(64) PRIMARY KEY,
        meta_value LONGTEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_sections (
        section_key VARCHAR(80) PRIMARY KEY,
        payload LONGTEXT NOT NULL,
        revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CHECK (JSON_VALID(payload))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_scope_revisions (
        scope_key VARCHAR(190) PRIMARY KEY,
        revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_backups (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        revision BIGINT UNSIGNED NOT NULL,
        reason VARCHAR(190) NOT NULL,
        payload LONGTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_backups_created (created_at),
        CHECK (JSON_VALID(payload))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_users (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(64) NOT NULL UNIQUE,
        display_name VARCHAR(120) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        salon_name VARCHAR(190) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        last_login_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_role_active (role, is_active),
        INDEX idx_users_salon (salon_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("INSERT IGNORE INTO app_meta (meta_key, meta_value) VALUES ('revision', '0')");
    $pdo->exec("INSERT IGNORE INTO app_scope_revisions (scope_key, revision) VALUES ('global', 0)");
    $pdo->exec("INSERT IGNORE INTO app_meta (meta_key, meta_value) VALUES ('backup_interval_days', '1')");
    $pdo->exec("INSERT IGNORE INTO app_meta (meta_key, meta_value) VALUES ('backup_policy_version', '0')");
    $backupPolicyVersion = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'backup_policy_version'")->fetchColumn();
    if ($backupPolicyVersion < 2) {
        $pdo->exec("UPDATE app_meta SET meta_value = '1' WHERE meta_key = 'backup_interval_days'");
        $pdo->exec("UPDATE app_meta SET meta_value = '2' WHERE meta_key = 'backup_policy_version'");
    }
    $ready = true;
}

function revision_scope_key(array $user): string
{
    if (($user['role'] ?? '') !== 'salon') return 'global';
    return 'salon:' . trim((string)($user['salon'] ?? ''));
}

function scope_revision(PDO $pdo, array $user, bool $lock = false): int
{
    $key = revision_scope_key($user);
    $sql = 'SELECT revision FROM app_scope_revisions WHERE scope_key = ?' . ($lock ? ' FOR UPDATE' : '');
    $statement = $pdo->prepare($sql);
    $statement->execute([$key]);
    $revision = $statement->fetchColumn();
    if ($revision !== false) return (int)$revision;
    $insert = $pdo->prepare('INSERT IGNORE INTO app_scope_revisions (scope_key, revision) VALUES (?, 0)');
    $insert->execute([$key]);
    $statement->execute([$key]);
    return (int)$statement->fetchColumn();
}

function known_salon_scope_keys(PDO $pdo): array
{
    $statement = $pdo->prepare("SELECT payload FROM app_sections WHERE section_key = 'salons' LIMIT 1");
    $statement->execute();
    $salons = json_decode((string)($statement->fetchColumn() ?: '[]'), true);
    if (!is_array($salons)) return [];
    $keys = [];
    foreach ($salons as $salon) {
        $name = trim((string)($salon['name'] ?? ''));
        if ($name !== '') $keys[] = 'salon:' . $name;
    }
    return array_values(array_unique($keys));
}

function bump_scope_revisions(PDO $pdo, array $user, array $sectionKeys = [], ?string $salonOverride = null): int
{
    $sharedSections = ['customers', 'customerGroups', 'voucherRoles', 'voucherLogs', 'giftCards', 'salons', 'staff', 'assignments', 'holidays', 'homepageSettings', 'pricePolicy', 'discounts', 'customerTypes', 'customerTypeRules', '_serviceSettings'];
    $touchAllSalons = ($user['role'] ?? '') !== 'salon' || count(array_intersect($sharedSections, $sectionKeys)) > 0;
    $keys = ['global'];
    if ($touchAllSalons) $keys = array_merge($keys, known_salon_scope_keys($pdo));
    $salonName = trim((string)($salonOverride ?? (($user['role'] ?? '') === 'salon' ? ($user['salon'] ?? '') : '')));
    if ($salonName !== '') $keys[] = 'salon:' . $salonName;
    $keys = array_values(array_unique($keys));
    $upsert = $pdo->prepare('INSERT INTO app_scope_revisions (scope_key, revision) VALUES (?, 1) ON DUPLICATE KEY UPDATE revision = revision + 1, updated_at = CURRENT_TIMESTAMP');
    foreach ($keys as $key) $upsert->execute([$key]);
    $currentKey = $salonName !== '' && ($user['role'] ?? '') === 'salon' ? 'salon:' . $salonName : 'global';
    $read = $pdo->prepare('SELECT revision FROM app_scope_revisions WHERE scope_key = ?');
    $read->execute([$currentKey]);
    return (int)$read->fetchColumn();
}

function session_user_from_row(array $row): array
{
    return [
        'id' => (int)($row['id'] ?? 0),
        'username' => (string)($row['username'] ?? ''),
        'displayName' => (string)($row['display_name'] ?? $row['displayName'] ?? $row['username'] ?? ''),
        'role' => (string)($row['role'] ?? 'salon'),
        'salon' => (string)($row['salon_name'] ?? $row['salon'] ?? ''),
    ];
}

function require_auth(): array
{
    start_secure_session();
    if (empty($_SESSION['khalgai_user'])) {
        json_response(['ok' => false, 'authenticated' => false, 'message' => 'Нэвтрэх шаардлагатай.'], 401);
    }
    $sessionUser = $_SESSION['khalgai_user'];
    $userId = (int)($sessionUser['id'] ?? 0);
    if ($userId > 0) {
        $statement = db()->prepare('SELECT id, username, display_name, role, salon_name, is_active FROM app_users WHERE id = ? LIMIT 1');
        $statement->execute([$userId]);
        $row = $statement->fetch();
        if (!$row || !(bool)$row['is_active']) {
            $_SESSION = [];
            session_destroy();
            json_response(['ok' => false, 'authenticated' => false, 'message' => 'Таны хэрэглэгчийн эрх идэвхгүй болсон байна.'], 401);
        }
        $_SESSION['khalgai_user'] = session_user_from_row($row);
    }
    return $_SESSION['khalgai_user'];
}

function require_admin(): array
{
    $user = require_auth();
    if (($user['role'] ?? '') !== 'admin') {
        json_response(['ok' => false, 'message' => 'Энэ үйлдлийг зөвхөн админ хийх эрхтэй.'], 403);
    }
    return $user;
}
