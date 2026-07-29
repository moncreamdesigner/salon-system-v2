<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$user = require_auth();
$pdo = db();

function load_all_sections(PDO $pdo, array $keys = []): array
{
    if ($keys) {
        $placeholders = implode(',', array_fill(0, count($keys), '?'));
        $statement = $pdo->prepare("SELECT section_key, payload FROM app_sections WHERE section_key IN ($placeholders) ORDER BY section_key");
        $statement->execute($keys);
        $rows = $statement->fetchAll();
    } else {
        $rows = $pdo->query('SELECT section_key, payload FROM app_sections ORDER BY section_key')->fetchAll();
    }
    $data = [];
    foreach ($rows as $row) $data[$row['section_key']] = json_decode((string)$row['payload'], true);
    return $data;
}

function load_section_revisions(PDO $pdo, array $keys = [], bool $lock = false): array
{
    if ($keys) {
        $placeholders = implode(',', array_fill(0, count($keys), '?'));
        $statement = $pdo->prepare("SELECT section_key, revision FROM app_sections WHERE section_key IN ($placeholders)" . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute($keys);
        $rows = $statement->fetchAll();
    } else {
        $rows = $pdo->query('SELECT section_key, revision FROM app_sections ORDER BY section_key')->fetchAll();
    }
    $revisions = [];
    foreach ($rows as $row) $revisions[(string)$row['section_key']] = (int)$row['revision'];
    foreach ($keys as $key) {
        if (!array_key_exists((string)$key, $revisions)) $revisions[(string)$key] = 0;
    }
    return $revisions;
}

function recovery_entity_key(array $item, int $index): string
{
    foreach (['id', 'paymentId', 'code', 'cardNumber'] as $key) {
        if (isset($item[$key]) && trim((string)$item[$key]) !== '') return (string)$item[$key];
    }
    return 'index:' . $index . ':' . hash('sha256', json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '');
}

function recovery_index(array $rows): array
{
    $indexed = [];
    foreach ($rows as $index => $row) {
        if (is_array($row)) $indexed[recovery_entity_key($row, (int)$index)] = $row;
    }
    return $indexed;
}

function record_recovery_item(PDO $pdo, int $revision, array $user, string $type, string $entityId, string $parentId, array $item): void
{
    $encoded = json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) return;
    $statement = $pdo->prepare('INSERT INTO app_recovery_journal (revision, actor_user_id, actor_username, actor_role, actor_salon, entity_type, entity_id, parent_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $statement->execute([
        $revision,
        (int)($user['id'] ?? 0) ?: null,
        (string)($user['username'] ?? ''),
        (string)($user['role'] ?? ''),
        (string)($user['salon'] ?? ''),
        $type,
        $entityId,
        $parentId,
        $encoded,
    ]);
}

function journal_removed_customer_data(PDO $pdo, int $revision, array $user, array $current, array $incoming): int
{
    $removedCount = 0;
    $oldCustomers = recovery_index(is_array($current['customers'] ?? null) ? $current['customers'] : []);
    $newCustomers = recovery_index(is_array($incoming['customers'] ?? null) ? $incoming['customers'] : []);
    foreach ($oldCustomers as $customerId => $oldCustomer) {
        if (!isset($newCustomers[$customerId])) {
            record_recovery_item($pdo, $revision, $user, 'customer', $customerId, '', $oldCustomer);
            $removedCount += 1;
            continue;
        }
        $newCustomer = $newCustomers[$customerId];
        if ($oldCustomer === $newCustomer) continue;
        $oldHistory = recovery_index(is_array($oldCustomer['serviceHistory'] ?? null) ? $oldCustomer['serviceHistory'] : []);
        $newHistory = recovery_index(is_array($newCustomer['serviceHistory'] ?? null) ? $newCustomer['serviceHistory'] : []);
        foreach ($oldHistory as $historyId => $oldService) {
            if (!isset($newHistory[$historyId])) {
                record_recovery_item($pdo, $revision, $user, 'service', $historyId, $customerId, $oldService);
                $removedCount += 1;
                continue;
            }
            $oldPayments = recovery_index(is_array($oldService['payments'] ?? null) ? $oldService['payments'] : []);
            $newPayments = recovery_index(is_array($newHistory[$historyId]['payments'] ?? null) ? $newHistory[$historyId]['payments'] : []);
            foreach ($oldPayments as $paymentId => $oldPayment) {
                if (isset($newPayments[$paymentId])) continue;
                record_recovery_item($pdo, $revision, $user, 'payment', $paymentId, $customerId . '/' . $historyId, $oldPayment);
                $removedCount += 1;
            }
        }
    }
    $oldGroups = recovery_index(is_array($current['customerGroups'] ?? null) ? $current['customerGroups'] : []);
    $newGroups = recovery_index(is_array($incoming['customerGroups'] ?? null) ? $incoming['customerGroups'] : []);
    foreach ($oldGroups as $groupId => $oldGroup) {
        if (isset($newGroups[$groupId])) continue;
        record_recovery_item($pdo, $revision, $user, 'customerGroup', $groupId, '', $oldGroup);
        $removedCount += 1;
    }
    return $removedCount;
}

function merge_legacy_customer_data(array $current, array $incoming): array
{
    if (is_array($incoming['customers'] ?? null)) {
        $oldCustomers = recovery_index(is_array($current['customers'] ?? null) ? $current['customers'] : []);
        $newCustomers = recovery_index($incoming['customers']);
        foreach ($oldCustomers as $customerId => $oldCustomer) {
            if (!isset($newCustomers[$customerId])) {
                $newCustomers[$customerId] = $oldCustomer;
                continue;
            }
            $newCustomer = $newCustomers[$customerId];
            $oldHistory = recovery_index(is_array($oldCustomer['serviceHistory'] ?? null) ? $oldCustomer['serviceHistory'] : []);
            $newHistory = recovery_index(is_array($newCustomer['serviceHistory'] ?? null) ? $newCustomer['serviceHistory'] : []);
            foreach ($newHistory as $historyId => $newService) {
                if (!isset($oldHistory[$historyId])) {
                    $oldHistory[$historyId] = $newService;
                    continue;
                }
                $oldService = $oldHistory[$historyId];
                $oldPayments = recovery_index(is_array($oldService['payments'] ?? null) ? $oldService['payments'] : []);
                $newPayments = recovery_index(is_array($newService['payments'] ?? null) ? $newService['payments'] : []);
                foreach ($newPayments as $paymentId => $newPayment) {
                    if (!isset($oldPayments[$paymentId])) $oldPayments[$paymentId] = $newPayment;
                }
                $oldHistory[$historyId]['payments'] = array_values($oldPayments);
            }
            $oldCustomer['serviceHistory'] = array_values($oldHistory);
            $newCustomers[$customerId] = $oldCustomer;
        }
        $incoming['customers'] = array_values($newCustomers);
    }
    if (is_array($incoming['customerGroups'] ?? null)) {
        $oldGroups = recovery_index(is_array($current['customerGroups'] ?? null) ? $current['customerGroups'] : []);
        $newGroups = recovery_index($incoming['customerGroups']);
        foreach ($oldGroups as $groupId => $oldGroup) {
            $newGroups[$groupId] = $oldGroup;
        }
        $incoming['customerGroups'] = array_values($newGroups);
    }
    return $incoming;
}

function item_belongs_to_salon(array $item, string $salon, string $section): bool
{
    if ($section === 'assignments') return ($item['from'] ?? '') === $salon || ($item['to'] ?? '') === $salon;
    if ($section === 'holidays') {
        $scopes = is_array($item['salons'] ?? null) ? $item['salons'] : [];
        return ($item['salon'] ?? '') === $salon || in_array($salon, $scopes, true);
    }
    return ($item['salon'] ?? '') === $salon;
}

function scope_sections_for_user(array $data, array $user): array
{
    if (($user['role'] ?? '') !== 'salon') return $data;
    $salon = (string)($user['salon'] ?? '');
    foreach (['bookings', 'kassSchedules', 'services', 'holidays', 'assignments', 'staff', 'performanceStatements', 'performanceStatementHistory', 'performanceAdjustments'] as $section) {
        if (!is_array($data[$section] ?? null)) continue;
        $data[$section] = array_values(array_filter($data[$section], static fn($item): bool =>
            is_array($item) && item_belongs_to_salon($item, $salon, $section)
        ));
    }
    return $data;
}

function merge_salon_sections(array $current, array $incoming, array $user, bool $partial = false): array
{
    if (($user['role'] ?? '') !== 'salon') return $incoming;
    $salon = (string)($user['salon'] ?? '');
    $restricted = ['salons', 'staff', 'assignments', 'generalSettings', 'homepageSettings', 'pricePolicy', 'discounts', 'voucherRoles', 'catalog', '_serviceSettings', 'diagnosisTypes', 'customerTypes', 'customerTypeRules'];
    foreach ($restricted as $section) {
        if ($partial) unset($incoming[$section]);
        elseif (array_key_exists($section, $current)) $incoming[$section] = $current[$section];
        else unset($incoming[$section]);
    }
    foreach (['bookings', 'kassSchedules', 'services', 'holidays', 'performanceStatements', 'performanceStatementHistory', 'performanceAdjustments'] as $section) {
        if ($partial && !array_key_exists($section, $incoming)) continue;
        $oldRows = is_array($current[$section] ?? null) ? $current[$section] : [];
        $newRows = is_array($incoming[$section] ?? null) ? $incoming[$section] : [];
        $preserved = array_filter($oldRows, static fn($item): bool => !is_array($item) || !item_belongs_to_salon($item, $salon, $section));
        $owned = array_filter($newRows, static fn($item): bool => is_array($item) && item_belongs_to_salon($item, $salon, $section));
        $incoming[$section] = array_values(array_merge($owned, $preserved));
    }
    return $incoming;
}

function merge_append_only_audit(array $current, array $incoming): array
{
    if (!array_key_exists('audit', $incoming) || !is_array($incoming['audit'])) return $incoming;
    $merged = [];
    $seen = [];
    foreach (array_merge($incoming['audit'], is_array($current['audit'] ?? null) ? $current['audit'] : []) as $entry) {
        if (!is_array($entry)) continue;
        $key = (string)($entry['id'] ?? $entry['paymentId'] ?? '') . '|' . (string)($entry['createdAt'] ?? '') . '|' . (string)($entry['title'] ?? '') . '|' . (string)($entry['meta'] ?? '');
        if (isset($seen[$key])) continue;
        $seen[$key] = true;
        $merged[] = $entry;
    }
    $incoming['audit'] = $merged;
    return $incoming;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $revision = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision'")->fetchColumn();
    $requestedSections = array_values(array_filter(array_map('trim', explode(',', (string)($_GET['sections'] ?? ''))), static fn(string $key): bool => preg_match('/^[A-Za-z0-9_:-]{1,80}$/', $key) === 1));
    $data = scope_sections_for_user(load_all_sections($pdo, $requestedSections), $user);
    json_response([
        'ok' => true,
        'revision' => $revision,
        'scopeRevision' => scope_revision($pdo, $user),
        'sectionRevisions' => load_section_revisions($pdo, $requestedSections),
        'empty' => count($data) === 0,
        'partial' => count($requestedSections) > 0,
        'data' => $data,
    ]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'PUT') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

$payload = request_payload();
$sections = $payload['data'] ?? null;
$clientRevision = filter_var($payload['revision'] ?? null, FILTER_VALIDATE_INT);
$partial = ($payload['partial'] ?? false) === true;
$clientScopeRevision = filter_var($payload['scopeRevision'] ?? null, FILTER_VALIDATE_INT);
$clientSectionRevisions = is_array($payload['sectionRevisions'] ?? null) ? $payload['sectionRevisions'] : null;
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
    $currentScopeRevision = scope_revision($pdo, $user, true);
    $incomingKeys = array_keys($sections);
    $currentSectionRevisions = load_section_revisions($pdo, $incomingKeys, true);
    $conflictingSections = [];
    if ($clientSectionRevisions !== null) {
        foreach ($incomingKeys as $key) {
            $expected = filter_var($clientSectionRevisions[$key] ?? null, FILTER_VALIDATE_INT);
            if ($expected === false || $expected === null || (int)$expected !== (int)($currentSectionRevisions[$key] ?? 0)) {
                $conflictingSections[] = (string)$key;
            }
        }
        $conflict = count($conflictingSections) > 0;
    } else {
        $conflict = $partial
            ? ($clientScopeRevision === false || $clientScopeRevision === null || (int)$clientScopeRevision !== $currentScopeRevision)
            : ($clientRevision === false || $clientRevision === null || (int)$clientRevision !== $currentRevision);
    }
    if ($conflict) {
        $pdo->rollBack();
        json_response([
            'ok' => false,
            'conflict' => true,
            'currentRevision' => $currentRevision,
            'currentScopeRevision' => $currentScopeRevision,
            'sectionRevisions' => $currentSectionRevisions,
            'conflictingSections' => $conflictingSections,
            'message' => 'Мэдээлэл өөр хэрэглэгчийн үйлдлээр шинэчлэгдсэн байна. Хуудсыг шинэчлээд дахин оролдоно уу.'
        ], 409);
    }
    $currentSections = load_all_sections($pdo, $partial ? array_keys($sections) : []);
    $sections = merge_salon_sections($currentSections, $sections, $user, $partial);
    $sections = merge_append_only_audit($currentSections, $sections);
    if ($clientSectionRevisions === null) {
        // Old browser tabs do not know section revisions. Preserve existing
        // customer/service/payment rows until those tabs reload the new build.
        $sections = merge_legacy_customer_data($currentSections, $sections);
    }
    $nextRevision = $currentRevision + 1;

    $removedCount = journal_removed_customer_data($pdo, $nextRevision, $user, $currentSections, $sections);
    $allowBulkRemoval = ($user['role'] ?? '') === 'admin' && ($payload['allowBulkRemoval'] ?? false) === true;
    if ($removedCount >= 2 && !$allowBulkRemoval) {
        $pdo->rollBack();
        json_response([
            'ok' => false,
            'conflict' => true,
            'dangerousChange' => true,
            'removedCount' => $removedCount,
            'message' => 'Олон хэрэглэгч, үйлчилгээ эсвэл төлбөр нэг дор хасагдах гэж байгаа тул хадгалалтыг хамгаалж зогсоолоо.',
        ], 409);
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
    $nextScopeRevision = bump_scope_revisions($pdo, $user, array_keys($sections));
    $writeLog = $pdo->prepare('INSERT INTO app_write_log (revision, actor_user_id, actor_username, actor_role, actor_salon, client_id, sections, removed_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $writeLog->execute([
        $nextRevision,
        (int)($user['id'] ?? 0) ?: null,
        (string)($user['username'] ?? ''),
        (string)($user['role'] ?? ''),
        (string)($user['salon'] ?? ''),
        substr(trim((string)($payload['clientId'] ?? '')), 0, 80),
        json_encode(array_keys($sections), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        $removedCount,
    ]);
    $pdo->exec("DELETE FROM app_recovery_journal WHERE created_at < UTC_TIMESTAMP() - INTERVAL 30 DAY");
    $pdo->exec("DELETE FROM app_write_log WHERE created_at < UTC_TIMESTAMP() - INTERVAL 90 DAY");
    $pdo->commit();
    json_response([
        'ok' => true,
        'revision' => $nextRevision,
        'scopeRevision' => $nextScopeRevision,
        'sectionRevisions' => array_fill_keys(array_keys($sections), $nextRevision),
        'savedSections' => array_keys($sections),
        'savedBy' => $user['username'] ?? 'admin',
    ]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'message' => 'Server хадгалалт амжилтгүй.'], 500);
}
