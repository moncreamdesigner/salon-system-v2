<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/booking-storage.php';

$isCli = PHP_SAPI === 'cli';
if (!$isCli) {
    verify_same_origin();
    $user = require_admin();
} else {
    $user = ['id' => 0, 'username' => 'cron', 'role' => 'admin', 'salon' => ''];
}
$pdo = db();
$method = $isCli ? 'CRON' : ($_SERVER['REQUEST_METHOD'] ?? 'GET');

const ROLLING_BACKUP_KEEP_COUNT = 28;
const ROLLING_BACKUP_RETENTION_DAYS = 7;

function rolling_backup_root(): string
{
    $publicRoot = realpath(__DIR__ . '/..');
    if ($publicRoot === false) throw new RuntimeException('Системийн үндсэн хавтас олдсонгүй.');
    $root = dirname($publicRoot) . DIRECTORY_SEPARATOR . 'khalgai-backups' . DIRECTORY_SEPARATOR . 'rolling';
    if (!is_dir($root) && !@mkdir($root, 0750, true) && !is_dir($root)) {
        throw new RuntimeException('Rolling backup хадгалах хавтас үүсгэж чадсангүй.');
    }
    $guard = dirname($root) . DIRECTORY_SEPARATOR . '.htaccess';
    if (!is_file($guard)) @file_put_contents($guard, "Require all denied\nDeny from all\n");
    return $root;
}

function rolling_metadata_path(string $backupPath): string
{
    return preg_replace('/\.json\.gz$/i', '.json', $backupPath) ?: ($backupPath . '.meta.json');
}

function rolling_backup_list(string $root): array
{
    $items = [];
    foreach (glob($root . DIRECTORY_SEPARATOR . 'khalgai-data-*.json.gz') ?: [] as $path) {
        if (!is_file($path)) continue;
        $metadata = [];
        $metadataPath = rolling_metadata_path($path);
        if (is_file($metadataPath)) {
            $decoded = json_decode((string)file_get_contents($metadataPath), true);
            if (is_array($decoded)) $metadata = $decoded;
        }
        $items[] = [
            'file' => basename($path),
            'createdAt' => (string)($metadata['createdAt'] ?? date('Y-m-d H:i:s', filemtime($path) ?: time())),
            'revision' => (int)($metadata['revision'] ?? 0),
            'sizeBytes' => (int)(filesize($path) ?: 0),
            'sha256' => (string)($metadata['sha256'] ?? ''),
            'reason' => (string)($metadata['reason'] ?? 'Автомат rolling backup'),
            'trigger' => (string)($metadata['trigger'] ?? 'legacy'),
            'type' => 'rolling',
        ];
    }
    usort($items, static fn(array $a, array $b): int => strcmp($b['createdAt'], $a['createdAt']));
    return $items;
}

function prune_rolling_backups(string $root): void
{
    $cutoff = time() - (ROLLING_BACKUP_RETENTION_DAYS * 86400);
    $items = rolling_backup_list($root);
    foreach ($items as $index => $item) {
        $path = $root . DIRECTORY_SEPARATOR . basename((string)$item['file']);
        $created = strtotime((string)$item['createdAt']) ?: (filemtime($path) ?: 0);
        if ($index < ROLLING_BACKUP_KEEP_COUNT && $created >= $cutoff) continue;
        @unlink($path);
        @unlink(rolling_metadata_path($path));
    }
}

function prune_media_trash(int $retentionDays = 30): int
{
    $publicRoot = realpath(__DIR__ . '/..');
    if ($publicRoot === false) return 0;
    $configuredStorage = trim((string)getenv('KHALGAI_MEDIA_STORAGE_DIR'));
    $storageRoot = $configuredStorage !== ''
        ? rtrim($configuredStorage, DIRECTORY_SEPARATOR)
        : dirname($publicRoot) . DIRECTORY_SEPARATOR . 'khalgai-media-storage';
    $trashRoot = $storageRoot . DIRECTORY_SEPARATOR . 'trash';
    if (!is_dir($trashRoot)) return 0;
    $cutoff = time() - (max(1, $retentionDays) * 86400);
    $removed = 0;
    foreach (new DirectoryIterator($trashRoot) as $fileInfo) {
        if (!$fileInfo->isFile() || $fileInfo->isLink() || $fileInfo->getMTime() >= $cutoff) continue;
        if (@unlink($fileInfo->getPathname())) $removed++;
    }
    return $removed;
}

function prune_server_history(PDO $pdo): void
{
    $pdo->exec("DELETE FROM app_recovery_journal WHERE created_at < UTC_TIMESTAMP() - INTERVAL 30 DAY");
    $pdo->exec("DELETE FROM app_write_log WHERE created_at < UTC_TIMESTAMP() - INTERVAL 90 DAY");
    $pdo->exec("DELETE FROM app_operations WHERE created_at < UTC_TIMESTAMP() - INTERVAL 90 DAY");
    $pdo->exec("DELETE FROM app_change_events WHERE created_at < UTC_TIMESTAMP() - INTERVAL 90 DAY");
}

function rolling_state_snapshot(PDO $pdo): array
{
    $data = [];
    $sectionRevisions = [];
    foreach ($pdo->query('SELECT section_key, payload, revision FROM app_sections ORDER BY section_key')->fetchAll() as $row) {
        $key = (string)$row['section_key'];
        $data[$key] = json_decode((string)$row['payload'], true);
        $sectionRevisions[$key] = (int)$row['revision'];
    }
    return [
        'system' => 'Khalgai Salon System',
        'formatVersion' => 1,
        'createdAt' => date('c'),
        'revision' => (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision'")->fetchColumn(),
        'sectionRevisions' => $sectionRevisions,
        'bookingArchive' => $pdo->query('SELECT archive_key, booking_id, salon, booking_date, booking_time, phone, status, payload, archived_revision, archived_at FROM app_booking_archive ORDER BY id')->fetchAll(),
        'data' => $data,
    ];
}

function create_rolling_backup(PDO $pdo, string $root, bool $scheduled = true, string $trigger = 'browser'): array
{
    if (!function_exists('gzencode')) throw new RuntimeException('Server дээр gzip дэмжлэг идэвхгүй байна.');
    @set_time_limit(0);
    ignore_user_abort(true);
    $intervalHours = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'backup_interval_hours'")->fetchColumn();
    if ($intervalHours < 1 || $intervalHours > 24) $intervalHours = 6;
    $existing = rolling_backup_list($root);
    if ($scheduled && $existing) {
        $latest = strtotime((string)$existing[0]['createdAt']) ?: 0;
        if ($latest > time() - ($intervalHours * 3600)) {
            return ['skipped' => true, 'backup' => $existing[0]];
        }
    }

    $lockPath = $root . DIRECTORY_SEPARATOR . '.rolling-backup.lock';
    $lock = fopen($lockPath, 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Backup ажиллагааг түгжиж чадсангүй.');
    try {
        $existing = rolling_backup_list($root);
        if ($scheduled && $existing) {
            $latest = strtotime((string)$existing[0]['createdAt']) ?: 0;
            if ($latest > time() - ($intervalHours * 3600)) {
                return ['skipped' => true, 'backup' => $existing[0]];
            }
        }
        $pdo->beginTransaction();
        try {
            $snapshot = rolling_state_snapshot($pdo);
            $pdo->commit();
        } catch (Throwable $snapshotError) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $snapshotError;
        }
        $json = json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) throw new RuntimeException('Backup JSON үүсгэж чадсангүй.');
        $compressed = gzencode($json, 6);
        if ($compressed === false) throw new RuntimeException('Backup шахаж чадсангүй.');

        $stamp = date('Ymd-His');
        $token = bin2hex(random_bytes(3));
        $filename = "khalgai-data-$stamp-$token.json.gz";
        $finalPath = $root . DIRECTORY_SEPARATOR . $filename;
        $tempPath = $finalPath . '.part';
        if (file_put_contents($tempPath, $compressed, LOCK_EX) === false || !@rename($tempPath, $finalPath)) {
            @unlink($tempPath);
            throw new RuntimeException('Backup файлыг хадгалж чадсангүй.');
        }
        $metadata = [
            'file' => $filename,
            'createdAt' => date('Y-m-d H:i:s'),
            'revision' => (int)$snapshot['revision'],
            'sizeBytes' => (int)(filesize($finalPath) ?: 0),
            'sha256' => (string)(hash_file('sha256', $finalPath) ?: ''),
            'reason' => $scheduled ? 'Автомат rolling backup' : 'Гараар үүсгэсэн rolling backup',
            'trigger' => $trigger,
            'type' => 'rolling',
        ];
        file_put_contents(rolling_metadata_path($finalPath), json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
        prune_rolling_backups($root);
        return ['skipped' => false, 'backup' => $metadata];
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function load_rolling_snapshot(string $path): array
{
    $compressed = file_get_contents($path);
    $metadataPath = rolling_metadata_path($path);
    if ($compressed !== false && is_file($metadataPath)) {
        $metadata = json_decode((string)file_get_contents($metadataPath), true);
        $expectedHash = trim((string)(is_array($metadata) ? ($metadata['sha256'] ?? '') : ''));
        if ($expectedHash !== '' && !hash_equals($expectedHash, hash('sha256', $compressed))) {
            throw new RuntimeException('Rolling backup checksum таарахгүй байна.');
        }
    }
    $json = $compressed === false ? false : gzdecode($compressed);
    $snapshot = $json === false ? null : json_decode($json, true);
    if (!is_array($snapshot) || !is_array($snapshot['data'] ?? null) || array_is_list($snapshot['data'])) {
        throw new RuntimeException('Rolling backup өгөгдөл гэмтсэн байна.');
    }
    return $snapshot;
}

try {
    $root = rolling_backup_root();
    if ($method === 'CRON') {
        $result = create_rolling_backup($pdo, $root, true, 'cron');
        // A skipped run means another valid rolling backup was created within
        // the configured interval, so maintenance can still proceed safely.
        $bookingArchive = archive_expired_bookings_maintenance($pdo);
        $trashRemoved = prune_media_trash(30);
        prune_server_history($pdo);
        $heartbeat = $pdo->prepare("INSERT INTO app_meta (meta_key, meta_value) VALUES ('last_server_cron_at', ?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)");
        $heartbeat->execute([date('Y-m-d H:i:s')]);
        fwrite(STDOUT, json_encode(['ok' => true, 'bookingArchive' => $bookingArchive, 'trashRemoved' => $trashRemoved] + $result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
        exit(0);
    }
    if ($method === 'GET') {
        $download = basename((string)($_GET['download'] ?? ''));
        if ($download !== '') {
            if (!preg_match('/^khalgai-data-[A-Za-z0-9-]+\.json\.gz$/', $download)) json_response(['ok' => false, 'message' => 'Backup файлын нэр буруу байна.'], 422);
            $path = $root . DIRECTORY_SEPARATOR . $download;
            if (!is_file($path)) json_response(['ok' => false, 'message' => 'Rolling backup олдсонгүй.'], 404);
            session_write_close();
            header('Content-Type: application/gzip');
            header('Content-Disposition: attachment; filename="' . $download . '"');
            header('Content-Length: ' . (string)(filesize($path) ?: 0));
            header('Cache-Control: no-store');
            readfile($path);
            exit;
        }
        prune_rolling_backups($root);
        $intervalHours = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'backup_interval_hours'")->fetchColumn();
        if ($intervalHours < 1 || $intervalHours > 24) $intervalHours = 6;
        $backups = rolling_backup_list($root);
        $latestCron = null;
        foreach ($backups as $backup) {
            if (($backup['trigger'] ?? '') === 'cron') {
                $latestCron = $backup;
                break;
            }
        }
        $cronHeartbeat = $pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'last_server_cron_at'")->fetchColumn();
        $cronCreatedAt = is_string($cronHeartbeat) && $cronHeartbeat !== ''
            ? $cronHeartbeat
            : (is_array($latestCron) ? (string)($latestCron['createdAt'] ?? '') : '');
        $cronCreatedTime = $cronCreatedAt !== '' ? (strtotime($cronCreatedAt) ?: 0) : 0;
        $cronHealthy = $cronCreatedTime > 0 && $cronCreatedTime >= time() - (($intervalHours * 2 + 1) * 3600);
        $bookingStats = $pdo->query("SELECT COALESCE(JSON_LENGTH(payload), 0) AS item_count, OCTET_LENGTH(payload) AS size_bytes FROM app_sections WHERE section_key = 'bookings' LIMIT 1")->fetch();
        $bookingCount = (int)($bookingStats['item_count'] ?? 0);
        $bookingSizeBytes = (int)($bookingStats['size_bytes'] ?? 0);
        $bookingCapacityLevel = $bookingSizeBytes >= 45 * 1024 * 1024
            ? 'critical'
            : ($bookingSizeBytes >= 35 * 1024 * 1024 ? 'warning' : ($bookingSizeBytes >= 25 * 1024 * 1024 ? 'notice' : 'healthy'));
        json_response([
            'ok' => true,
            'backups' => $backups,
            'settings' => ['intervalHours' => $intervalHours, 'retentionDays' => ROLLING_BACKUP_RETENTION_DAYS, 'keepCount' => ROLLING_BACKUP_KEEP_COUNT],
            'health' => [
                'serverCronHealthy' => $cronHealthy,
                'lastServerCronAt' => $cronCreatedAt,
                'bookingCount' => $bookingCount,
                'bookingSizeBytes' => $bookingSizeBytes,
                'bookingCapacityLevel' => $bookingCapacityLevel,
            ],
        ]);
    }

    if ($method === 'POST') {
        $payload = request_payload();
        $scheduled = ($payload['mode'] ?? '') !== 'manual';
        session_write_close();
        $result = create_rolling_backup($pdo, $root, $scheduled, $scheduled ? 'browser' : 'manual');
        json_response(['ok' => true] + $result);
    }

    if ($method === 'PUT') {
        $payload = request_payload();
        $filename = basename((string)($payload['file'] ?? ''));
        if (!preg_match('/^khalgai-data-[A-Za-z0-9-]+\.json\.gz$/', $filename)) json_response(['ok' => false, 'message' => 'Сэргээх backup-аа сонгоно уу.'], 422);
        $path = $root . DIRECTORY_SEPARATOR . $filename;
        if (!is_file($path)) json_response(['ok' => false, 'message' => 'Rolling backup олдсонгүй.'], 404);
        $snapshot = load_rolling_snapshot($path);

        $pdo->beginTransaction();
        try {
            $currentRevision = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision' FOR UPDATE")->fetchColumn();
            $currentRows = $pdo->query('SELECT section_key, payload FROM app_sections ORDER BY section_key')->fetchAll();
            $currentData = [];
            foreach ($currentRows as $row) $currentData[(string)$row['section_key']] = json_decode((string)$row['payload'], true);
            $preRestore = $pdo->prepare('INSERT INTO app_backups (revision, reason, payload) VALUES (?, ?, ?)');
            $preRestore->execute([$currentRevision, 'Rolling backup сэргээхийн өмнөх backup', json_encode($currentData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);

            $nextRevision = $currentRevision + 1;
            $pdo->exec('DELETE FROM app_sections');
            $insert = $pdo->prepare('INSERT INTO app_sections (section_key, payload, revision) VALUES (?, ?, ?)');
            foreach ($snapshot['data'] as $key => $value) {
                if (!preg_match('/^[A-Za-z0-9_:-]{1,80}$/', (string)$key)) throw new RuntimeException('Backup section key буруу байна.');
                $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if ($encoded === false) throw new RuntimeException('Backup section хөрвүүлж чадсангүй.');
                $insert->execute([(string)$key, $encoded, $nextRevision]);
            }
            if (is_array($snapshot['bookingArchive'] ?? null)) {
                $pdo->exec('DELETE FROM app_booking_archive');
                $archiveInsert = $pdo->prepare('INSERT INTO app_booking_archive (archive_key, booking_id, salon, booking_date, booking_time, phone, status, payload, archived_revision, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                foreach ($snapshot['bookingArchive'] as $archivedBooking) {
                    if (!is_array($archivedBooking)) continue;
                    $archiveInsert->execute([
                        (string)($archivedBooking['archive_key'] ?? ''),
                        (string)($archivedBooking['booking_id'] ?? ''),
                        (string)($archivedBooking['salon'] ?? ''),
                        (string)($archivedBooking['booking_date'] ?? ''),
                        (string)($archivedBooking['booking_time'] ?? ''),
                        (string)($archivedBooking['phone'] ?? ''),
                        (string)($archivedBooking['status'] ?? ''),
                        (string)($archivedBooking['payload'] ?? '{}'),
                        (int)($archivedBooking['archived_revision'] ?? $nextRevision),
                        (string)($archivedBooking['archived_at'] ?? gmdate('Y-m-d H:i:s')),
                    ]);
                }
            }
            $meta = $pdo->prepare("UPDATE app_meta SET meta_value = ? WHERE meta_key = 'revision'");
            $meta->execute([(string)$nextRevision]);
            $nextScopeRevision = bump_scope_revisions($pdo, $user, array_keys($snapshot['data']));
            $pdo->commit();
            json_response(['ok' => true, 'revision' => $nextRevision, 'scopeRevision' => $nextScopeRevision]);
        } catch (Throwable $restoreError) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $restoreError;
        }
    }

    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Rolling backup error: ' . $error->getMessage());
    json_response(['ok' => false, 'message' => $error->getMessage() ?: 'Rolling backup ажиллагаа амжилтгүй.'], 500);
}
