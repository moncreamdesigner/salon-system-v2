<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
require_admin();
$pdo = db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

$id = (int)($_GET['id'] ?? 0);
if ($id > 0) {
    $statement = $pdo->prepare('SELECT id, revision, actor_username, actor_role, actor_salon, entity_type, entity_id, parent_id, payload, created_at FROM app_recovery_journal WHERE id = ? LIMIT 1');
    $statement->execute([$id]);
    $row = $statement->fetch();
    if (!$row) json_response(['ok' => false, 'message' => 'Recovery мэдээлэл олдсонгүй.'], 404);
    $payload = json_decode((string)$row['payload'], true);
    if (!is_array($payload)) json_response(['ok' => false, 'message' => 'Recovery мэдээлэл гэмтсэн байна.'], 422);
    json_response([
        'ok' => true,
        'entry' => [
            'id' => (int)$row['id'],
            'revision' => (int)$row['revision'],
            'actorUsername' => (string)$row['actor_username'],
            'actorRole' => (string)$row['actor_role'],
            'actorSalon' => (string)$row['actor_salon'],
            'entityType' => (string)$row['entity_type'],
            'entityId' => (string)$row['entity_id'],
            'parentId' => (string)$row['parent_id'],
            'createdAt' => (string)$row['created_at'],
            'payload' => $payload,
        ],
    ]);
}

$rows = $pdo->query('SELECT id, revision, actor_username, actor_role, actor_salon, entity_type, entity_id, parent_id, payload, created_at, OCTET_LENGTH(payload) AS size_bytes FROM app_recovery_journal ORDER BY id DESC LIMIT 100')->fetchAll();
$entries = [];
foreach ($rows as $row) {
    $item = json_decode((string)$row['payload'], true);
    $item = is_array($item) ? $item : [];
    $entries[] = [
        'id' => (int)$row['id'],
        'revision' => (int)$row['revision'],
        'actorUsername' => (string)$row['actor_username'],
        'actorRole' => (string)$row['actor_role'],
        'actorSalon' => (string)$row['actor_salon'],
        'entityType' => (string)$row['entity_type'],
        'entityId' => (string)$row['entity_id'],
        'parentId' => (string)$row['parent_id'],
        'displayName' => (string)($item['name'] ?? $item['service'] ?? $item['title'] ?? $item['phone'] ?? ''),
        'createdAt' => (string)$row['created_at'],
        'sizeBytes' => (int)$row['size_bytes'],
    ];
}

json_response(['ok' => true, 'entries' => $entries, 'retentionDays' => 30]);
