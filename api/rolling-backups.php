<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

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
            'reason' => (string)($metadata['reason'] ?? 'Автомат rolling backup'),
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
        'data' => $data,
    ];
}

function create_rolling_backup(PDO $pdo, string $root, bool $scheduled = true): array
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
            'reason' => $scheduled ? 'Автомат rolling backup' : 'Гараар үүсгэсэн rolling backup',
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
        $result = create_rolling_backup($pdo, $root, true);
        fwrite(STDOUT, json_encode(['ok' => true] + $result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
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
        json_response([
            'ok' => true,
            'backups' => rolling_backup_list($root),
            'settings' => ['intervalHours' => $intervalHours, 'retentionDays' => ROLLING_BACKUP_RETENTION_DAYS, 'keepCount' => ROLLING_BACKUP_KEEP_COUNT],
        ]);
    }

    if ($method === 'POST') {
        $payload = request_payload();
        $scheduled = ($payload['mode'] ?? '') !== 'manual';
        session_write_close();
        $result = create_rolling_backup($pdo, $root, $scheduled);
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
