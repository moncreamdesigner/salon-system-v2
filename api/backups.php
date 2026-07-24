<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$currentUser = require_admin();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function current_state_payload(PDO $pdo): array
{
    $rows = $pdo->query('SELECT section_key, payload FROM app_sections ORDER BY section_key')->fetchAll();
    $data = [];
    foreach ($rows as $row) {
        $data[(string)$row['section_key']] = json_decode((string)$row['payload'], true);
    }
    return $data;
}

function insert_backup(PDO $pdo, int $revision, string $reason, array $data): int
{
    $encoded = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) throw new RuntimeException('Backup өгөгдлийг хөрвүүлж чадсангүй.');
    $cleanReason = trim($reason) ?: 'Гараар үүсгэсэн backup';
    $safeReason = function_exists('mb_substr')
        ? mb_substr($cleanReason, 0, 190, 'UTF-8')
        : substr($cleanReason, 0, 190);
    $statement = $pdo->prepare('INSERT INTO app_backups (revision, reason, payload) VALUES (?, ?, ?)');
    $statement->execute([$revision, $safeReason, $encoded]);
    return (int)$pdo->lastInsertId();
}

function prune_backups(PDO $pdo): void
{
    $pdo->exec('DELETE FROM app_backups WHERE id NOT IN (SELECT id FROM (SELECT id FROM app_backups ORDER BY id DESC LIMIT 7) AS keep_rows)');
}

function backup_metadata(array $row): array
{
    return [
        'id' => (int)($row['id'] ?? 0),
        'revision' => (int)($row['revision'] ?? 0),
        'reason' => (string)($row['reason'] ?? 'Backup'),
        'createdAt' => (string)($row['created_at'] ?? ''),
        'sizeBytes' => (int)($row['size_bytes'] ?? 0),
        'category' => 'all',
    ];
}

if ($method === 'GET') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id > 0) {
        $statement = $pdo->prepare('SELECT id, revision, reason, payload, created_at, OCTET_LENGTH(payload) AS size_bytes FROM app_backups WHERE id = ? LIMIT 1');
        $statement->execute([$id]);
        $row = $statement->fetch();
        if (!$row) json_response(['ok' => false, 'message' => 'Backup олдсонгүй.'], 404);
        $data = json_decode((string)$row['payload'], true);
        if (!is_array($data)) json_response(['ok' => false, 'message' => 'Backup өгөгдөл гэмтсэн байна.'], 422);
        json_response(['ok' => true, 'backup' => backup_metadata($row), 'data' => $data]);
    }

    prune_backups($pdo);
    $rows = $pdo->query('SELECT id, revision, reason, created_at, OCTET_LENGTH(payload) AS size_bytes FROM app_backups ORDER BY id DESC LIMIT 7')->fetchAll();
    $intervalDays = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'backup_interval_days'")->fetchColumn();
    if (!in_array($intervalDays, [0, 1, 7, 14, 30, 90], true)) $intervalDays = 1;
    json_response([
        'ok' => true,
        'backups' => array_map('backup_metadata', $rows),
        'settings' => ['intervalDays' => $intervalDays],
    ]);
}

if ($method === 'PATCH') {
    $payload = request_payload();
    $intervalDays = (int)($payload['intervalDays'] ?? -1);
    if (!in_array($intervalDays, [0, 1, 7, 14, 30, 90], true)) {
        json_response(['ok' => false, 'message' => 'Backup хугацааны сонголт буруу байна.'], 422);
    }
    $statement = $pdo->prepare("INSERT INTO app_meta (meta_key, meta_value) VALUES ('backup_interval_days', ?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)");
    $statement->execute([(string)$intervalDays]);
    json_response(['ok' => true, 'settings' => ['intervalDays' => $intervalDays]]);
}

if ($method === 'POST') {
    $payload = request_payload();
    $reason = (string)($payload['reason'] ?? 'Гараар үүсгэсэн backup');
    try {
        $pdo->beginTransaction();
        $revision = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision' FOR UPDATE")->fetchColumn();
        $id = insert_backup($pdo, $revision, $reason, current_state_payload($pdo));
        prune_backups($pdo);
        $pdo->commit();
        $statement = $pdo->prepare('SELECT id, revision, reason, created_at, OCTET_LENGTH(payload) AS size_bytes FROM app_backups WHERE id = ?');
        $statement->execute([$id]);
        json_response(['ok' => true, 'backup' => backup_metadata($statement->fetch() ?: [])]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        json_response(['ok' => false, 'message' => 'Server backup үүсгэж чадсангүй.'], 500);
    }
}

if ($method === 'PUT') {
    $payload = request_payload();
    $id = (int)($payload['id'] ?? 0);
    if ($id <= 0) json_response(['ok' => false, 'message' => 'Сэргээх backup-аа сонгоно уу.'], 422);
    try {
        $pdo->beginTransaction();
        $revision = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision' FOR UPDATE")->fetchColumn();
        $backupStatement = $pdo->prepare('SELECT id, payload FROM app_backups WHERE id = ? LIMIT 1 FOR UPDATE');
        $backupStatement->execute([$id]);
        $backupRow = $backupStatement->fetch();
        if (!$backupRow) {
            $pdo->rollBack();
            json_response(['ok' => false, 'message' => 'Backup олдсонгүй.'], 404);
        }
        $restoredData = json_decode((string)$backupRow['payload'], true);
        if (!is_array($restoredData) || array_is_list($restoredData)) {
            $pdo->rollBack();
            json_response(['ok' => false, 'message' => 'Backup өгөгдөл гэмтсэн байна.'], 422);
        }

        insert_backup($pdo, $revision, 'Backup сэргээхийн өмнөх автомат backup', current_state_payload($pdo));
        $nextRevision = $revision + 1;
        $pdo->exec('DELETE FROM app_sections');
        $insert = $pdo->prepare('INSERT INTO app_sections (section_key, payload, revision) VALUES (?, ?, ?)');
        foreach ($restoredData as $key => $value) {
            if (!preg_match('/^[A-Za-z0-9_:-]{1,80}$/', (string)$key)) throw new RuntimeException('Section key буруу.');
            $sectionJson = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($sectionJson === false) throw new RuntimeException('Backup section хөрвүүлж чадсангүй.');
            $insert->execute([(string)$key, $sectionJson, $nextRevision]);
        }
        $meta = $pdo->prepare("UPDATE app_meta SET meta_value = ? WHERE meta_key = 'revision'");
        $meta->execute([(string)$nextRevision]);
        prune_backups($pdo);
        $pdo->commit();
        json_response(['ok' => true, 'revision' => $nextRevision]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        json_response(['ok' => false, 'message' => 'Backup сэргээж чадсангүй.'], 500);
    }
}

if ($method === 'DELETE') {
    $payload = request_payload();
    $id = (int)($payload['id'] ?? 0);
    if ($id <= 0) json_response(['ok' => false, 'message' => 'Устгах backup-аа сонгоно уу.'], 422);
    $statement = $pdo->prepare('DELETE FROM app_backups WHERE id = ?');
    $statement->execute([$id]);
    if ($statement->rowCount() === 0) json_response(['ok' => false, 'message' => 'Backup олдсонгүй.'], 404);
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
