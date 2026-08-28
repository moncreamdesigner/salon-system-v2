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

function booking_max_advance_date(?DateTimeImmutable $today = null): DateTimeImmutable
{
    $timezone = new DateTimeZone('Asia/Ulaanbaatar');
    $base = ($today ?? new DateTimeImmutable('today', $timezone))->setTime(0, 0);
    $nextMonth = $base->modify('first day of next month');
    $day = min((int)$base->format('j'), (int)$nextMonth->format('t'));
    return $nextMonth->setDate((int)$nextMonth->format('Y'), (int)$nextMonth->format('m'), $day);
}

function booking_date_within_advance_window(DateTimeImmutable $date, DateTimeImmutable $today): bool
{
    return $date >= $today && $date <= booking_max_advance_date($today);
}

function salon_schedule_for_date(array $salon, string $date): array
{
    $defaults = [
        'workStart' => '09:00',
        'workEnd' => '19:00',
        'weekendStart' => '10:00',
        'weekendEnd' => '19:00',
        'duration' => 30,
    ];
    $base = array_merge($defaults, is_array($salon['schedule'] ?? null) ? $salon['schedule'] : []);
    $selected = null;
    $selectedDate = '';
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1) {
        foreach ((array)($salon['scheduleVersions'] ?? []) as $version) {
            if (!is_array($version)) continue;
            $effectiveFrom = trim((string)($version['effectiveFrom'] ?? ''));
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $effectiveFrom) !== 1 || $effectiveFrom > $date || $effectiveFrom < $selectedDate) continue;
            $selected = $version;
            $selectedDate = $effectiveFrom;
        }
    }
    $result = array_merge($base, is_array($selected) ? $selected : []);
    $result['duration'] = max(5, (int)($result['duration'] ?? 30));
    $result['capacity'] = max(1, (int)($result['capacity'] ?? $salon['slotCapacity'] ?? 4));
    return $result;
}

function salon_capacity_for_date(array $salon, string $date): int
{
    $schedule = salon_schedule_for_date($salon, $date);
    return max(1, (int)($schedule['capacity'] ?? $salon['slotCapacity'] ?? 4));
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
    try {
        $schemaVersion = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'schema_version'")->fetchColumn();
        if ($schemaVersion >= 8) {
            $ready = true;
            return;
        }
    } catch (Throwable $ignored) {
        // First installation: app_meta does not exist yet.
    }
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
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_recovery_journal (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        revision BIGINT UNSIGNED NOT NULL,
        actor_user_id BIGINT UNSIGNED NULL,
        actor_username VARCHAR(64) NOT NULL DEFAULT '',
        actor_role VARCHAR(20) NOT NULL DEFAULT '',
        actor_salon VARCHAR(190) NOT NULL DEFAULT '',
        entity_type VARCHAR(40) NOT NULL,
        entity_id VARCHAR(190) NOT NULL DEFAULT '',
        parent_id VARCHAR(190) NOT NULL DEFAULT '',
        payload LONGTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_recovery_created (created_at),
        INDEX idx_recovery_entity (entity_type, entity_id),
        CHECK (JSON_VALID(payload))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_write_log (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        revision BIGINT UNSIGNED NOT NULL,
        actor_user_id BIGINT UNSIGNED NULL,
        actor_username VARCHAR(64) NOT NULL DEFAULT '',
        actor_role VARCHAR(20) NOT NULL DEFAULT '',
        actor_salon VARCHAR(190) NOT NULL DEFAULT '',
        client_id VARCHAR(80) NOT NULL DEFAULT '',
        sections LONGTEXT NOT NULL,
        removed_count INT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_write_log_created (created_at),
        INDEX idx_write_log_revision (revision),
        CHECK (JSON_VALID(sections))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_operations (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        operation_id VARCHAR(190) NOT NULL UNIQUE,
        revision BIGINT UNSIGNED NOT NULL,
        actor_user_id BIGINT UNSIGNED NULL,
        actor_username VARCHAR(64) NOT NULL DEFAULT '',
        actor_role VARCHAR(20) NOT NULL DEFAULT '',
        actor_salon VARCHAR(190) NOT NULL DEFAULT '',
        sections LONGTEXT NOT NULL,
        result_payload LONGTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_operations_created (created_at),
        INDEX idx_operations_revision (revision),
        CHECK (JSON_VALID(sections)),
        CHECK (JSON_VALID(result_payload))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_change_events (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        operation_id VARCHAR(190) NOT NULL,
        revision BIGINT UNSIGNED NOT NULL,
        entity_type VARCHAR(40) NOT NULL,
        entity_id VARCHAR(190) NOT NULL DEFAULT '',
        parent_id VARCHAR(190) NOT NULL DEFAULT '',
        action VARCHAR(30) NOT NULL DEFAULT 'update',
        before_payload LONGTEXT NULL,
        after_payload LONGTEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_change_events_operation (operation_id),
        INDEX idx_change_events_entity (entity_type, entity_id),
        INDEX idx_change_events_created (created_at),
        CHECK (before_payload IS NULL OR JSON_VALID(before_payload)),
        CHECK (after_payload IS NULL OR JSON_VALID(after_payload))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_booking_archive (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        archive_key CHAR(64) NOT NULL UNIQUE,
        booking_id VARCHAR(190) NOT NULL DEFAULT '',
        salon VARCHAR(190) NOT NULL DEFAULT '',
        booking_date DATE NOT NULL,
        booking_time VARCHAR(10) NOT NULL DEFAULT '',
        phone VARCHAR(32) NOT NULL DEFAULT '',
        status VARCHAR(30) NOT NULL DEFAULT '',
        payload LONGTEXT NOT NULL,
        archived_revision BIGINT UNSIGNED NOT NULL,
        archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_booking_archive_date (booking_date),
        INDEX idx_booking_archive_salon_date (salon, booking_date),
        INDEX idx_booking_archive_phone (phone),
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
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_sms_settings (
        id TINYINT UNSIGNED PRIMARY KEY,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        api_url VARCHAR(500) NOT NULL DEFAULT '',
        token_cipher LONGTEXT NOT NULL,
        settings_json LONGTEXT NOT NULL,
        updated_by VARCHAR(64) NOT NULL DEFAULT '',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CHECK (JSON_VALID(settings_json))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_sms_messages (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        dedupe_key VARCHAR(190) NOT NULL UNIQUE,
        booking_id VARCHAR(190) NOT NULL DEFAULT '',
        event_type VARCHAR(30) NOT NULL,
        phone VARCHAR(32) NOT NULL DEFAULT '',
        salon VARCHAR(190) NOT NULL DEFAULT '',
        booking_date DATE NULL,
        booking_time VARCHAR(10) NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        scheduled_for DATETIME NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
        max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 3,
        next_attempt_at DATETIME NULL,
        last_error VARCHAR(500) NOT NULL DEFAULT '',
        provider_response TEXT NULL,
        sent_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sms_due (status, scheduled_for),
        INDEX idx_sms_retry (status, next_attempt_at),
        INDEX idx_sms_booking (booking_id),
        INDEX idx_sms_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_sms_campaigns (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(120) NOT NULL,
        message TEXT NOT NULL,
        batch_size SMALLINT UNSIGNED NOT NULL DEFAULT 50,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        total_count INT UNSIGNED NOT NULL DEFAULT 0,
        pending_count INT UNSIGNED NOT NULL DEFAULT 0,
        sent_count INT UNSIGNED NOT NULL DEFAULT 0,
        failed_count INT UNSIGNED NOT NULL DEFAULT 0,
        cancelled_count INT UNSIGNED NOT NULL DEFAULT 0,
        created_by VARCHAR(64) NOT NULL DEFAULT '',
        last_error VARCHAR(500) NOT NULL DEFAULT '',
        started_at DATETIME NULL,
        completed_at DATETIME NULL,
        next_run_at DATETIME NULL,
        lease_until DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sms_campaign_status_due (status, next_run_at),
        INDEX idx_sms_campaign_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_sms_campaign_recipients (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        campaign_id BIGINT UNSIGNED NOT NULL,
        phone VARCHAR(32) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
        max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 3,
        next_attempt_at DATETIME NULL,
        last_error VARCHAR(500) NOT NULL DEFAULT '',
        provider_response TEXT NULL,
        sent_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_sms_campaign_phone (campaign_id, phone),
        INDEX idx_sms_campaign_recipient_due (campaign_id, status, next_attempt_at),
        INDEX idx_sms_campaign_recipient_status (status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("INSERT IGNORE INTO app_meta (meta_key, meta_value) VALUES ('revision', '0')");
    $pdo->exec("INSERT IGNORE INTO app_scope_revisions (scope_key, revision) VALUES ('global', 0)");
    $pdo->exec("INSERT IGNORE INTO app_meta (meta_key, meta_value) VALUES ('backup_interval_days', '1')");
    $pdo->exec("INSERT IGNORE INTO app_meta (meta_key, meta_value) VALUES ('backup_interval_hours', '6')");
    $pdo->exec("INSERT IGNORE INTO app_meta (meta_key, meta_value) VALUES ('backup_policy_version', '0')");
    $pdo->exec("INSERT IGNORE INTO app_meta (meta_key, meta_value) VALUES ('sms_history_index_version', '0')");
    $smsHistoryIndexVersion = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'sms_history_index_version'")->fetchColumn();
    if ($smsHistoryIndexVersion < 1) {
        foreach ([
            'idx_sms_phone_created' => '(phone, created_at)',
            'idx_sms_event_created' => '(event_type, created_at)',
        ] as $indexName => $columns) {
            try {
                $pdo->exec("ALTER TABLE app_sms_messages ADD INDEX {$indexName} {$columns}");
            } catch (PDOException $error) {
                if ((int)($error->errorInfo[1] ?? 0) !== 1061) throw $error;
            }
        }
        $pdo->exec("UPDATE app_meta SET meta_value = '1' WHERE meta_key = 'sms_history_index_version'");
    }
    $backupPolicyVersion = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'backup_policy_version'")->fetchColumn();
    if ($backupPolicyVersion < 2) {
        $pdo->exec("UPDATE app_meta SET meta_value = '1' WHERE meta_key = 'backup_interval_days'");
        $pdo->exec("UPDATE app_meta SET meta_value = '2' WHERE meta_key = 'backup_policy_version'");
    }
    if ($backupPolicyVersion < 3) {
        $pdo->exec("UPDATE app_meta SET meta_value = '6' WHERE meta_key = 'backup_interval_hours'");
        $pdo->exec("UPDATE app_meta SET meta_value = '3' WHERE meta_key = 'backup_policy_version'");
    }
    $pdo->exec("INSERT INTO app_meta (meta_key, meta_value) VALUES ('schema_version', '8') ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)");
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
    $sharedSections = ['customers', 'customerGroups', 'voucherRoles', 'voucherLogs', 'giftCards', 'salons', 'staff', 'assignments', 'holidays', 'homepageSettings', 'pricePolicy', 'discounts', 'customerTypes', 'customerTypeRules', 'performanceStatements', 'performanceStatementHistory', 'performanceAdjustments', '_serviceSettings'];
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

function require_auth(bool $keepSessionOpen = false): array
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
    $authenticatedUser = $_SESSION['khalgai_user'];
    if (!$keepSessionOpen && session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
    return $authenticatedUser;
}

function require_admin(bool $keepSessionOpen = false): array
{
    $user = require_auth($keepSessionOpen);
    if (($user['role'] ?? '') !== 'admin') {
        json_response(['ok' => false, 'message' => 'Энэ үйлдлийг зөвхөн админ хийх эрхтэй.'], 403);
    }
    return $user;
}
