<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/customer-mutations.php';

verify_same_origin();
$user = require_admin();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function change_event_public_row(array $row, bool $includePayload = false): array
{
    $before = json_decode((string)($row['before_payload'] ?? ''), true);
    $after = json_decode((string)($row['after_payload'] ?? ''), true);
    $subject = is_array($after) ? $after : (is_array($before) ? $before : []);
    $result = [
        'id' => (int)($row['id'] ?? 0),
        'operationId' => (string)($row['operation_id'] ?? ''),
        'revision' => (int)($row['revision'] ?? 0),
        'entityType' => (string)($row['entity_type'] ?? ''),
        'entityId' => (string)($row['entity_id'] ?? ''),
        'parentId' => (string)($row['parent_id'] ?? ''),
        'action' => (string)($row['action'] ?? 'update'),
        'displayName' => (string)($subject['name'] ?? $subject['service'] ?? $subject['title'] ?? $subject['phone'] ?? ''),
        'phone' => (string)($subject['phone'] ?? ''),
        'salon' => (string)($subject['salon'] ?? ''),
        'canRestore' => (string)($row['entity_type'] ?? '') === 'booking'
            ? (is_array($before) || is_array($after))
            : (is_array($before) && is_array($after)),
        'createdAt' => (string)($row['created_at'] ?? ''),
    ];
    if ($includePayload) {
        $result['before'] = is_array($before) ? $before : null;
        $result['after'] = is_array($after) ? $after : null;
    }
    return $result;
}

function recovery_code_matches(PDO $pdo, string $submitted): bool
{
    $statement = $pdo->prepare("SELECT payload FROM app_sections WHERE section_key = 'generalSettings' LIMIT 1");
    $statement->execute();
    $settings = json_decode((string)($statement->fetchColumn() ?: '{}'), true);
    $expected = (string)(is_array($settings) ? ($settings['deleteCode'] ?? '1989') : '1989');
    return preg_match('/^\d{4}$/', $submitted) === 1 && hash_equals($expected, $submitted);
}

if ($method === 'GET') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id > 0) {
        $statement = $pdo->prepare('SELECT * FROM app_change_events WHERE id = ? LIMIT 1');
        $statement->execute([$id]);
        $row = $statement->fetch();
        if (!$row) json_response(['ok' => false, 'message' => 'Өөрчлөлтийн түүх олдсонгүй.'], 404);
        json_response(['ok' => true, 'event' => change_event_public_row($row, true)]);
    }

    $query = trim((string)($_GET['q'] ?? ''));
    $entityType = trim((string)($_GET['entityType'] ?? ''));
    $where = [];
    $params = [];
    if ($entityType !== '') {
        $where[] = 'entity_type = ?';
        $params[] = $entityType;
    }
    if ($query !== '') {
        $where[] = '(entity_id LIKE ? OR before_payload LIKE ? OR after_payload LIKE ?)';
        $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $query) . '%';
        array_push($params, $like, $like, $like);
    }
    $sql = 'SELECT * FROM app_change_events'
        . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
        . ' ORDER BY id DESC LIMIT 200';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    json_response([
        'ok' => true,
        'events' => array_map(static fn(array $row): array => change_event_public_row($row), $statement->fetchAll()),
        'retentionDays' => 90,
    ]);
}

if ($method !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

$payload = request_payload();
$eventId = (int)($payload['eventId'] ?? 0);
$code = trim((string)($payload['code'] ?? ''));
if ($eventId <= 0 || !recovery_code_matches($pdo, $code)) {
    json_response(['ok' => false, 'message' => $eventId <= 0 ? 'Сэргээх түүхээ сонгоно уу.' : 'Засах код буруу байна.'], 422);
}

try {
    $pdo->beginTransaction();
    $currentRevision = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision' FOR UPDATE")->fetchColumn();
    $eventStatement = $pdo->prepare('SELECT * FROM app_change_events WHERE id = ? LIMIT 1 FOR UPDATE');
    $eventStatement->execute([$eventId]);
    $event = $eventStatement->fetch();
    if (!$event) {
        $pdo->rollBack();
        json_response(['ok' => false, 'message' => 'Сэргээх түүх олдсонгүй.'], 404);
    }
    $sectionKey = match ((string)$event['entity_type']) {
        'customer' => 'customers',
        'customerGroup' => 'customerGroups',
        'booking' => 'bookings',
        default => '',
    };
    if ($sectionKey === '') {
        $pdo->rollBack();
        json_response(['ok' => false, 'message' => 'Энэ төрлийн мэдээллийг одоогоор автоматаар сэргээх боломжгүй.'], 422);
    }
    $sectionStatement = $pdo->prepare('SELECT payload FROM app_sections WHERE section_key = ? LIMIT 1 FOR UPDATE');
    $sectionStatement->execute([$sectionKey]);
    $rows = json_decode((string)($sectionStatement->fetchColumn() ?: '[]'), true);
    $rows = is_array($rows) ? array_values($rows) : [];
    $index = customer_mutation_index($rows);
    $entityId = (string)$event['entity_id'];
    $current = $index[$entityId]['value'] ?? null;
    $eventAfter = json_decode((string)($event['after_payload'] ?? ''), true);
    $eventBefore = json_decode((string)($event['before_payload'] ?? ''), true);
    if ($current !== $eventAfter) {
        $pdo->rollBack();
        json_response(['ok' => false, 'conflict' => true, 'message' => 'Энэ мэдээлэл тухайн өөрчлөлтөөс хойш дахин шинэчлэгдсэн байна. Автоматаар ухраасангүй.'], 409);
    }
    if ($eventBefore === null) {
        if (isset($index[$entityId])) array_splice($rows, (int)$index[$entityId]['index'], 1);
    } elseif (isset($index[$entityId])) {
        $rows[(int)$index[$entityId]['index']] = $eventBefore;
    } else {
        array_unshift($rows, $eventBefore);
    }
    $nextRevision = $currentRevision + 1;
    $encoded = json_encode(array_values($rows), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) throw new RuntimeException('Сэргээсэн мэдээллийг JSON болгоход алдаа гарлаа.');
    $updateSection = $pdo->prepare('UPDATE app_sections SET payload = ?, revision = ?, updated_at = CURRENT_TIMESTAMP WHERE section_key = ?');
    $updateSection->execute([$encoded, $nextRevision, $sectionKey]);
    $pdo->prepare("UPDATE app_meta SET meta_value = ? WHERE meta_key = 'revision'")->execute([(string)$nextRevision]);
    $restoreSubject = is_array($eventBefore) ? $eventBefore : (is_array($eventAfter) ? $eventAfter : []);
    $scopeRevision = bump_scope_revisions(
        $pdo,
        $user,
        [$sectionKey],
        $sectionKey === 'bookings' ? trim((string)($restoreSubject['salon'] ?? '')) : null
    );
    $operationId = 'restore:' . bin2hex(random_bytes(16));
    $result = [
        'ok' => true,
        'revision' => $nextRevision,
        'scopeRevision' => $scopeRevision,
        'restoredEventId' => $eventId,
        'entityType' => (string)$event['entity_type'],
        'entityId' => $entityId,
    ];
    $operation = $pdo->prepare('INSERT INTO app_operations (operation_id, revision, actor_user_id, actor_username, actor_role, actor_salon, sections, result_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $operation->execute([
        $operationId,
        $nextRevision,
        (int)($user['id'] ?? 0) ?: null,
        (string)($user['username'] ?? ''),
        (string)($user['role'] ?? ''),
        (string)($user['salon'] ?? ''),
        json_encode([$sectionKey]),
        json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
    $change = $pdo->prepare('INSERT INTO app_change_events (operation_id, revision, entity_type, entity_id, parent_id, action, before_payload, after_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $change->execute([
        $operationId,
        $nextRevision,
        (string)$event['entity_type'],
        $entityId,
        '',
        'restore',
        $event['after_payload'],
        $event['before_payload'],
    ]);
    $pdo->commit();
    json_response($result);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Selective recovery failed: ' . $error->getMessage());
    json_response(['ok' => false, 'message' => 'Мэдээллийг сонгон сэргээж чадсангүй.'], 500);
}
