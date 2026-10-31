<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/event-storage.php';
verify_same_origin();
$user = require_auth();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET', 'POST'], true)) json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);

function event_rows(PDO $pdo, bool $lock = false): array {
    $statement = $pdo->query("SELECT payload FROM app_sections WHERE section_key = '_events' LIMIT 1" . ($lock ? ' FOR UPDATE' : ''));
    $raw = $statement->fetchColumn();
    if ($raw === false) return [];
    $rows = json_decode((string)$raw, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($rows) || !array_is_list($rows)) throw new RuntimeException('Event storage is not a list');
    return $rows;
}

function event_customer(PDO $pdo, string $id): array {
    if (!preg_match('/^[A-Za-z0-9._:-]{1,100}$/', $id)) throw new InvalidArgumentException('Хэрэглэгч сонгоно уу.');
    $ready = (string)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'entity_projection_ready' LIMIT 1")->fetchColumn() === '1';
    if ($ready) {
        $statement = $pdo->prepare('SELECT payload FROM app_customer_entities WHERE customer_id = ? AND archived = 0 LIMIT 1');
        $statement->execute([$id]);
        $customer = json_decode((string)$statement->fetchColumn(), true);
    } else {
        $customers = json_decode((string)$pdo->query("SELECT payload FROM app_sections WHERE section_key = 'customers' LIMIT 1")->fetchColumn(), true) ?: [];
        $customer = null;
        foreach ($customers as $candidate) if ((string)$candidate['id'] === $id) { $customer = $candidate; break; }
    }
    if (!is_array($customer) || !empty($customer['deleted']) || !empty($customer['deletedAt'])) throw new DomainException('Хэрэглэгч олдсонгүй.');
    return $customer;
}

try {
    $today = (new DateTimeImmutable('today', new DateTimeZone('Asia/Ulaanbaatar')))->format('Y-m-d');
    if ($method === 'GET') {
        $allRows = event_rows($pdo);
        if (($_GET['mode'] ?? '') === 'dashboard') {
            $mode = (string)($_GET['filter'] ?? 'month');
            $month = (string)($_GET['month'] ?? substr($today, 0, 7));
            if (!in_array($mode, ['all', 'month', 'single'], true) || !preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) throw new InvalidArgumentException('Event-ийн тайлангийн шүүлтүүр буруу байна.');
            $salon = ($user['role'] ?? '') === 'salon' ? (string)$user['salon'] : trim((string)($_GET['salon'] ?? ''));
            json_response(['ok' => true, 'summary' => event_dashboard_summary($allRows, $mode, $month, (string)($_GET['eventId'] ?? ''), $salon)]);
        }
        $rows = array_values(array_filter($allRows, static fn(array $row): bool => empty($row['deletedAt'])));
        usort($rows, static fn(array $a, array $b): int => strcmp($b['startDate'] . $b['id'], $a['startDate'] . $a['id']));
        $result = ['ok' => true, 'events' => array_map('event_public_row', $rows)];
        if (!empty($_GET['customerId'])) {
            $customerId = (string)$_GET['customerId'];
            event_customer($pdo, $customerId);
            $result['membership'] = event_membership_state($allRows, $customerId, $today);
        }
        json_response($result);
    }
    $input = request_payload();
    $id = (string)($input['id'] ?? '');
    $action = (string)($input['action'] ?? 'save');
    if (!in_array($action, ['save', 'delete', 'assign'], true)) throw new InvalidArgumentException('Event-ийн үйлдэл буруу байна.');
    if ($action !== 'assign' && (!preg_match('/^[A-Za-z0-9._:-]{1,100}$/', $id) || filter_var($input['version'] ?? null, FILTER_VALIDATE_INT) === false || (int)$input['version'] < 0)) throw new InvalidArgumentException('Event-ийн дугаар/хувилбар буруу байна.');
    $pdo->beginTransaction();
    // Use the same lock as other app-section writers, including future registration
    // mutations, so a registration and deletion cannot race each other.
    $revision = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision' FOR UPDATE")->fetchColumn();
    if ($action === 'delete') {
        $settings = json_decode((string)$pdo->query("SELECT payload FROM app_sections WHERE section_key = 'generalSettings' LIMIT 1")->fetchColumn(), true);
        $code = (string)($settings['deleteCode'] ?? '1989');
        if (!hash_equals($code, (string)($input['code'] ?? ''))) throw new InvalidArgumentException('Устгах код буруу байна.');
    }
    $rows = event_rows($pdo, true);
    $before = $rows;
    $now = (new DateTimeImmutable('now', new DateTimeZone('Asia/Ulaanbaatar')))->format(DATE_ATOM);
    if ($action === 'assign') {
        $customerId = (string)($input['customerId'] ?? '');
        $customer = event_customer($pdo, $customerId);
        $salon = ($user['role'] ?? '') === 'salon' ? (string)$user['salon'] : (string)($customer['salon'] ?? $customer['registeredSalon'] ?? '—');
        $rows = event_assign_customer($rows, $customerId, (string)($input['eventId'] ?? ''), (string)($input['token'] ?? ''), $salon, (string)$user['username'], $now, $today);
        $result = ['ok' => true, 'membership' => event_membership_state($rows, $customerId, $today)];
    } else {
        $index = null;
        foreach ($rows as $key => $row) if ((string)$row['id'] === $id) { $index = $key; break; }
        $current = $index !== null ? $rows[$index] : null;
        $saved = event_mutate($current, $input, $action, (string)$user['username'], $now);
        if ($index === null) $rows[] = $saved; else $rows[$index] = $saved;
        $result = ['ok' => true, 'event' => event_public_row($saved)];
    }
    if ($rows !== $before) {
        $nextRevision = $revision + 1;
        $statement = $pdo->prepare('INSERT INTO app_sections (section_key, payload, revision) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload), revision = VALUES(revision), updated_at = CURRENT_TIMESTAMP');
        $statement->execute(['_events', json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), $nextRevision]);
        $pdo->prepare("UPDATE app_meta SET meta_value = ? WHERE meta_key = 'revision'")->execute([(string)$nextRevision]);
        bump_scope_revisions($pdo, $user, ['_events']);
        $log = $pdo->prepare('INSERT INTO app_write_log (revision, actor_user_id, actor_username, actor_role, actor_salon, client_id, sections, removed_count) VALUES (?, ?, ?, ?, ?, ?, ?, 0)');
        $log->execute([$nextRevision, $user['id'], $user['username'], $user['role'], $user['salon'] ?? '', '', '["_events"]']);
    }
    $pdo->commit();
    json_response($result);
} catch (InvalidArgumentException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'message' => $error->getMessage()], 422);
} catch (DomainException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'message' => $error->getMessage()], 409);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Event request failed: ' . $error->getMessage());
    json_response(['ok' => false, 'message' => 'Event хадгалах/ачаалах боломжгүй байна. Дахин оролдоно уу.'], 500);
}
