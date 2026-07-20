<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$user = require_auth();
$pdo = db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $revision = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision'")->fetchColumn();
    $rows = $pdo->query('SELECT section_key, payload FROM app_sections ORDER BY section_key')->fetchAll();
    $data = [];
    foreach ($rows as $row) $data[$row['section_key']] = json_decode($row['payload'], true);
    json_response(['ok' => true, 'revision' => $revision, 'empty' => count($data) === 0, 'data' => $data]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'PUT') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

$payload = request_payload();
$sections = $payload['data'] ?? null;
if (!is_array($sections) || array_is_list($sections)) {
    json_response(['ok' => false, 'message' => 'Өгөгдлийн бүтэц буруу байна.'], 422);
}
$encoded = json_encode($sections, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($encoded === false || strlen($encoded) > 50 * 1024 * 1024) {
    json_response(['ok' => false, 'message' => 'Өгөгдлийн хэмжээ хэтэрсэн байна.'], 413);
}

try {
    $pdo->beginTransaction();
    $revisionStmt = $pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision' FOR UPDATE");
    $currentRevision = (int)$revisionStmt->fetchColumn();
    $nextRevision = $currentRevision + 1;

    $backupIntervalDays = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'backup_interval_days'")->fetchColumn();
    $allowedBackupIntervals = [0, 1, 7, 14, 30, 90];
    if (!in_array($backupIntervalDays, $allowedBackupIntervals, true)) $backupIntervalDays = 7;
    $lastBackupStatement = $pdo->prepare('SELECT created_at FROM app_backups WHERE reason = ? ORDER BY id DESC LIMIT 1');
    $lastBackupStatement->execute(['Автомат backup']);
    $lastBackup = $lastBackupStatement->fetchColumn();
    $backupDue = $backupIntervalDays > 0 && (!$lastBackup || strtotime((string)$lastBackup) <= time() - ($backupIntervalDays * 86400));
    if ($currentRevision > 0 && $backupDue) {
        $oldRows = $pdo->query('SELECT section_key, payload FROM app_sections')->fetchAll();
        $oldData = [];
        foreach ($oldRows as $row) $oldData[$row['section_key']] = json_decode($row['payload'], true);
        $backup = $pdo->prepare('INSERT INTO app_backups (revision, reason, payload) VALUES (?, ?, ?)');
        $backup->execute([$currentRevision, 'Автомат backup', json_encode($oldData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
    }

    $upsert = $pdo->prepare('INSERT INTO app_sections (section_key, payload, revision) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload), revision = VALUES(revision), updated_at = CURRENT_TIMESTAMP');
    foreach ($sections as $key => $value) {
        if (!preg_match('/^[A-Za-z0-9_:-]{1,80}$/', (string)$key)) throw new RuntimeException('Section key буруу.');
        $sectionJson = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($sectionJson === false) throw new RuntimeException('JSON хөрвүүлэлт амжилтгүй.');
        $upsert->execute([(string)$key, $sectionJson, $nextRevision]);
    }
    $meta = $pdo->prepare("UPDATE app_meta SET meta_value = ? WHERE meta_key = 'revision'");
    $meta->execute([(string)$nextRevision]);
    $pdo->exec('DELETE FROM app_backups WHERE id NOT IN (SELECT id FROM (SELECT id FROM app_backups ORDER BY id DESC LIMIT 3) AS keep_rows)');
    $pdo->commit();
    json_response(['ok' => true, 'revision' => $nextRevision, 'savedBy' => $user['username'] ?? 'admin']);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'message' => 'Server хадгалалт амжилтгүй.'], 500);
}
