<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
require_admin();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

const FULL_BACKUP_KEEP_COUNT = 2;
const FULL_BACKUP_INTERVAL_DAYS = 30;

function full_backup_paths(): array
{
    $publicRoot = realpath(__DIR__ . '/..');
    if ($publicRoot === false) throw new RuntimeException('Системийн үндсэн хавтас олдсонгүй.');
    $hostRoot = dirname($publicRoot);
    $configuredMedia = trim((string)getenv('KHALGAI_MEDIA_STORAGE_DIR'));
    $mediaRoot = $configuredMedia !== ''
        ? rtrim($configuredMedia, DIRECTORY_SEPARATOR)
        : $hostRoot . DIRECTORY_SEPARATOR . 'khalgai-media-storage';
    $backupRoot = $hostRoot . DIRECTORY_SEPARATOR . 'khalgai-backups' . DIRECTORY_SEPARATOR . 'full';
    if (!is_dir($backupRoot) && !@mkdir($backupRoot, 0750, true) && !is_dir($backupRoot)) {
        throw new RuntimeException('Full backup хадгалах хавтас үүсгэж чадсангүй.');
    }
    if (!is_file(dirname($backupRoot) . DIRECTORY_SEPARATOR . '.htaccess')) {
        @file_put_contents(dirname($backupRoot) . DIRECTORY_SEPARATOR . '.htaccess', "Require all denied\nDeny from all\n");
    }
    return compact('publicRoot', 'mediaRoot', 'backupRoot');
}

function full_backup_metadata_path(string $zipPath): string
{
    return preg_replace('/\.zip$/i', '.json', $zipPath) ?: ($zipPath . '.json');
}

function full_backup_list(string $backupRoot): array
{
    $items = [];
    foreach (glob($backupRoot . DIRECTORY_SEPARATOR . 'khalgai-full-*.zip') ?: [] as $zipPath) {
        if (!is_file($zipPath)) continue;
        $metadata = [];
        $metadataPath = full_backup_metadata_path($zipPath);
        if (is_file($metadataPath)) {
            $decoded = json_decode((string)file_get_contents($metadataPath), true);
            if (is_array($decoded)) $metadata = $decoded;
        }
        $items[] = [
            'file' => basename($zipPath),
            'createdAt' => (string)($metadata['createdAt'] ?? date('Y-m-d H:i:s', filemtime($zipPath) ?: time())),
            'sizeBytes' => (int)(filesize($zipPath) ?: 0),
            'databaseRevision' => (int)($metadata['databaseRevision'] ?? 0),
            'mediaFiles' => (int)($metadata['mediaFiles'] ?? 0),
            'diagnosisFiles' => (int)($metadata['diagnosisFiles'] ?? 0),
            'missingMediaFiles' => (int)($metadata['missingMediaFiles'] ?? 0),
            'codeFiles' => (int)($metadata['codeFiles'] ?? 0),
            'reason' => (string)($metadata['reason'] ?? 'Full backup'),
            'type' => 'full',
        ];
    }
    usort($items, static fn(array $a, array $b): int => strcmp($b['createdAt'], $a['createdAt']));
    return $items;
}

function prune_full_backups(string $backupRoot): void
{
    $items = full_backup_list($backupRoot);
    foreach (array_slice($items, FULL_BACKUP_KEEP_COUNT) as $item) {
        $zipPath = $backupRoot . DIRECTORY_SEPARATOR . basename((string)$item['file']);
        @unlink($zipPath);
        @unlink(full_backup_metadata_path($zipPath));
    }
}

function database_full_snapshot(PDO $pdo): array
{
    $sections = [];
    foreach ($pdo->query('SELECT section_key, payload, revision, updated_at FROM app_sections ORDER BY section_key')->fetchAll() as $row) {
        $sections[(string)$row['section_key']] = [
            'payload' => json_decode((string)$row['payload'], true),
            'revision' => (int)$row['revision'],
            'updatedAt' => (string)$row['updated_at'],
        ];
    }
    return [
        'system' => 'Khalgai Salon System',
        'formatVersion' => 1,
        'exportedAt' => date('c'),
        'meta' => $pdo->query('SELECT meta_key, meta_value, updated_at FROM app_meta ORDER BY meta_key')->fetchAll(),
        'users' => $pdo->query('SELECT id, username, display_name, password_hash, role, salon_name, is_active, last_login_at, created_at, updated_at FROM app_users ORDER BY id')->fetchAll(),
        'sections' => $sections,
    ];
}

function database_sql_dump(PDO $pdo): string
{
    $tables = ['app_meta', 'app_sections', 'app_users'];
    $lines = [
        '-- Khalgai Salon System full backup',
        '-- Created: ' . date('c'),
        'SET NAMES utf8mb4;',
        'SET FOREIGN_KEY_CHECKS=0;',
        '',
    ];
    foreach ($tables as $table) {
        $createRow = $pdo->query("SHOW CREATE TABLE `$table`")->fetch();
        $createSql = is_array($createRow) ? (string)array_values($createRow)[1] : '';
        $lines[] = "DROP TABLE IF EXISTS `$table`;";
        if ($createSql !== '') $lines[] = $createSql . ';';
        $rows = $pdo->query("SELECT * FROM `$table`")->fetchAll();
        foreach ($rows as $row) {
            $columns = array_map(static fn(string $column): string => '`' . str_replace('`', '``', $column) . '`', array_keys($row));
            $values = array_map(static fn($value): string => $value === null ? 'NULL' : $pdo->quote((string)$value), array_values($row));
            $lines[] = "INSERT INTO `$table` (" . implode(',', $columns) . ') VALUES (' . implode(',', $values) . ');';
        }
        $lines[] = '';
    }
    $lines[] = 'SET FOREIGN_KEY_CHECKS=1;';
    return implode("\n", $lines) . "\n";
}

function collect_media_references($value, array &$references): void
{
    if (is_array($value)) {
        foreach ($value as $item) collect_media_references($item, $references);
        return;
    }
    if (!is_string($value) || $value === '') return;
    if (str_contains($value, 'api/media.php')) {
        $query = parse_url(html_entity_decode($value), PHP_URL_QUERY);
        if (is_string($query)) {
            parse_str($query, $params);
            $scope = in_array(($params['scope'] ?? ''), ['public', 'private'], true) ? (string)$params['scope'] : '';
            $file = basename(rawurldecode((string)($params['file'] ?? '')));
            if ($scope !== '' && $file !== '') $references[] = "khalgai-media-storage/$scope/$file";
        }
    }
    if (preg_match('~(?:^|/)uploads/([^?#]+)~', $value, $matches)) {
        $file = basename(rawurldecode((string)$matches[1]));
        if ($file !== '') $references[] = "public_html/uploads/$file";
    }
}

function add_tree_to_zip(ZipArchive $zip, string $sourceRoot, string $archiveRoot, array $excludedTop = [], bool $trackMedia = false): array
{
    if (!is_dir($sourceRoot)) return ['count' => 0, 'bytes' => 0, 'files' => []];
    $sourceRoot = rtrim($sourceRoot, DIRECTORY_SEPARATOR);
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($sourceRoot, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    $count = 0;
    $bytes = 0;
    $files = [];
    foreach ($iterator as $fileInfo) {
        if (!$fileInfo->isFile() || $fileInfo->isLink()) continue;
        $path = $fileInfo->getPathname();
        $relative = ltrim(substr($path, strlen($sourceRoot)), DIRECTORY_SEPARATOR);
        $top = explode(DIRECTORY_SEPARATOR, $relative)[0] ?? '';
        if (in_array($top, $excludedTop, true)) continue;
        $archivePath = trim($archiveRoot, '/') . '/' . str_replace(DIRECTORY_SEPARATOR, '/', $relative);
        if (!$zip->addFile($path, $archivePath)) throw new RuntimeException('Backup-д файл нэмж чадсангүй: ' . $relative);
        $size = (int)$fileInfo->getSize();
        $count++;
        $bytes += $size;
        if ($trackMedia) {
            $files[] = [
                'path' => $archivePath,
                'size' => $size,
                'sha256' => hash_file('sha256', $path) ?: '',
            ];
        }
    }
    return compact('count', 'bytes', 'files');
}

function create_full_backup(PDO $pdo, string $reason, bool $scheduled = false): array
{
    if (!class_exists('ZipArchive')) throw new RuntimeException('Server дээр ZIP өргөтгөл идэвхгүй байна.');
    $paths = full_backup_paths();
    $lockPath = $paths['backupRoot'] . DIRECTORY_SEPARATOR . '.full-backup.lock';
    $lock = fopen($lockPath, 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Backup ажиллагааг түгжиж чадсангүй.');
    try {
        $existing = full_backup_list($paths['backupRoot']);
        if ($scheduled && $existing) {
            $latestTime = strtotime((string)$existing[0]['createdAt']) ?: 0;
            if ($latestTime > time() - (FULL_BACKUP_INTERVAL_DAYS * 86400)) {
                return ['skipped' => true, 'backup' => $existing[0]];
            }
        }

        @set_time_limit(0);
        ignore_user_abort(true);
        $stamp = date('Ymd-His');
        $token = bin2hex(random_bytes(4));
        $filename = "khalgai-full-$stamp-$token.zip";
        $finalPath = $paths['backupRoot'] . DIRECTORY_SEPARATOR . $filename;
        $tempPath = $finalPath . '.part';
        $zip = new ZipArchive();
        if ($zip->open($tempPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Full backup ZIP үүсгэж чадсангүй.');
        }

        $pdo->beginTransaction();
        try {
            $revision = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision'")->fetchColumn();
            $database = database_full_snapshot($pdo);
            $databaseSql = database_sql_dump($pdo);
            $pdo->commit();
        } catch (Throwable $databaseError) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $databaseError;
        }
        $databaseJson = json_encode($database, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        if ($databaseJson === false) throw new RuntimeException('Database backup JSON үүссэнгүй.');
        $zip->addFromString('database/database.json', $databaseJson);
        $zip->addFromString('database/database.sql', $databaseSql);

        $code = add_tree_to_zip($zip, $paths['publicRoot'], 'public_html', ['.git', 'uploads'], false);
        $legacyUploads = add_tree_to_zip($zip, $paths['publicRoot'] . DIRECTORY_SEPARATOR . 'uploads', 'public_html/uploads', [], true);
        $media = add_tree_to_zip($zip, $paths['mediaRoot'], 'khalgai-media-storage', [], true);
        $mediaFiles = array_merge($legacyUploads['files'], $media['files']);
        $diagnosisFiles = count(array_filter($mediaFiles, static fn(array $file): bool => str_contains((string)$file['path'], 'khalgai-media-storage/private/')));
        $referencedMedia = [];
        collect_media_references($database, $referencedMedia);
        $referencedMedia = array_values(array_unique($referencedMedia));
        $availableMedia = array_fill_keys(array_column($mediaFiles, 'path'), true);
        $missingReferencedMedia = array_values(array_filter($referencedMedia, static fn(string $path): bool => !isset($availableMedia[$path])));
        $createdAt = date('Y-m-d H:i:s');
        $manifest = [
            'system' => 'Khalgai Salon System',
            'backupType' => 'full',
            'formatVersion' => 1,
            'createdAt' => $createdAt,
            'reason' => $reason,
            'databaseRevision' => $revision,
            'codeFiles' => $code['count'],
            'mediaFiles' => count($mediaFiles),
            'diagnosisFiles' => $diagnosisFiles,
            'referencedMediaFiles' => count($referencedMedia),
            'missingReferencedMedia' => $missingReferencedMedia,
            'mediaBytes' => $legacyUploads['bytes'] + $media['bytes'],
            'mediaChecksums' => $mediaFiles,
            'restoreRoots' => [
                'public_html' => 'Системийн code болон legacy uploads',
                'khalgai-media-storage' => 'Public болон private зураг; private дотор оношилгооны зураг хадгалагдана',
                'database' => 'Database JSON болон SQL dump',
            ],
        ];
        $zip->addFromString('manifest.json', json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
        $zip->addFromString('RESTORE.txt', "1. public_html хавтсыг сайтын public_html руу сэргээнэ.\n2. khalgai-media-storage хавтсыг public_html-ийн дээд түвшинд сэргээнэ.\n3. database/database.sql файлыг тухайн database руу импортлоно.\n4. manifest.json дахь mediaChecksums-аар зураг бүрэн эсэхийг шалгана.\n");
        if (!$zip->close()) throw new RuntimeException('Full backup ZIP хааж чадсангүй.');
        if (!@rename($tempPath, $finalPath)) throw new RuntimeException('Full backup файлыг хадгалж чадсангүй.');

        $metadata = [
            'file' => $filename,
            'createdAt' => $createdAt,
            'sizeBytes' => (int)(filesize($finalPath) ?: 0),
            'databaseRevision' => $revision,
            'mediaFiles' => count($mediaFiles),
            'diagnosisFiles' => $diagnosisFiles,
            'missingMediaFiles' => count($missingReferencedMedia),
            'codeFiles' => $code['count'],
            'reason' => $reason,
            'type' => 'full',
        ];
        file_put_contents(full_backup_metadata_path($finalPath), json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        prune_full_backups($paths['backupRoot']);
        return ['skipped' => false, 'backup' => $metadata];
    } finally {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if (isset($zip) && $zip instanceof ZipArchive) @$zip->close();
        flock($lock, LOCK_UN);
        fclose($lock);
        if (isset($tempPath) && is_file($tempPath)) @unlink($tempPath);
    }
}

try {
    $paths = full_backup_paths();
    if ($method === 'GET') {
        $download = basename((string)($_GET['download'] ?? ''));
        if ($download !== '') {
            if (!preg_match('/^khalgai-full-[A-Za-z0-9-]+\.zip$/', $download)) json_response(['ok' => false, 'message' => 'Backup файлын нэр буруу байна.'], 422);
            $path = $paths['backupRoot'] . DIRECTORY_SEPARATOR . $download;
            if (!is_file($path)) json_response(['ok' => false, 'message' => 'Full backup олдсонгүй.'], 404);
            session_write_close();
            header('Content-Type: application/zip');
            header('Content-Disposition: attachment; filename="' . $download . '"');
            header('Content-Length: ' . (string)(filesize($path) ?: 0));
            header('Cache-Control: no-store');
            readfile($path);
            exit;
        }
        prune_full_backups($paths['backupRoot']);
        json_response([
            'ok' => true,
            'backups' => full_backup_list($paths['backupRoot']),
            'settings' => ['intervalDays' => FULL_BACKUP_INTERVAL_DAYS, 'keepCount' => FULL_BACKUP_KEEP_COUNT],
        ]);
    }

    if ($method === 'POST') {
        $payload = request_payload();
        $scheduled = ($payload['mode'] ?? '') === 'scheduled';
        $reason = $scheduled ? 'Сарын автомат full backup' : trim((string)($payload['reason'] ?? 'Гараар үүсгэсэн full backup'));
        $result = create_full_backup($pdo, $reason, $scheduled);
        json_response(['ok' => true] + $result);
    }

    if ($method === 'DELETE') {
        $payload = request_payload();
        $filename = basename((string)($payload['file'] ?? ''));
        if (!preg_match('/^khalgai-full-[A-Za-z0-9-]+\.zip$/', $filename)) json_response(['ok' => false, 'message' => 'Backup файлын нэр буруу байна.'], 422);
        $path = $paths['backupRoot'] . DIRECTORY_SEPARATOR . $filename;
        if (!is_file($path)) json_response(['ok' => false, 'message' => 'Full backup олдсонгүй.'], 404);
        @unlink($path);
        @unlink(full_backup_metadata_path($path));
        json_response(['ok' => true]);
    }

    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
} catch (Throwable $error) {
    error_log('Full backup error: ' . $error->getMessage());
    json_response(['ok' => false, 'message' => $error->getMessage() ?: 'Full backup үүсгэж чадсангүй.'], 500);
}
