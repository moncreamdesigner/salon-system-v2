<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$user = require_auth();
$pdo = db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

$id = trim((string)($_GET['id'] ?? ''));
if ($id === '') json_response(['ok' => false, 'message' => 'Хэрэглэгч сонгоно уу.'], 422);

$statement = $pdo->prepare("SELECT section_key, payload, revision FROM app_sections WHERE section_key IN ('customers', 'customerGroups')");
$statement->execute();
$sections = [];
$revisions = [];
foreach ($statement->fetchAll() as $row) {
    $decoded = json_decode((string)($row['payload'] ?? '[]'), true);
    $sections[(string)$row['section_key']] = is_array($decoded) ? array_values(array_filter($decoded, 'is_array')) : [];
    $revisions[(string)$row['section_key']] = (int)($row['revision'] ?? 0);
}

$customers = $sections['customers'] ?? [];
$groups = $sections['customerGroups'] ?? [];
$selected = null;
foreach ($customers as $customer) {
    if ((string)($customer['id'] ?? '') === $id && empty($customer['deleted']) && empty($customer['deletedAt'])) {
        $selected = $customer;
        break;
    }
}
if ($selected === null) json_response(['ok' => false, 'message' => 'Хэрэглэгч олдсонгүй.'], 404);

if (($user['role'] ?? '') === 'salon') {
    $salon = trim((string)($user['salon'] ?? ''));
    $registeredSalon = trim((string)($selected['registeredSalon'] ?? $selected['salon'] ?? ''));
    $queueSalon = trim((string)($selected['dailyQueueSalon'] ?? ''));
    $hasSalonHistory = false;
    foreach ((is_array($selected['serviceHistory'] ?? null) ? $selected['serviceHistory'] : []) as $historyItem) {
        if (trim((string)($historyItem['salon'] ?? $historyItem['branch'] ?? '')) === $salon) {
            $hasSalonHistory = true;
            break;
        }
    }
    if ($salon === '' || ($registeredSalon !== $salon && $queueSalon !== $salon && !$hasSalonHistory)) {
        json_response(['ok' => false, 'message' => 'Энэ хэрэглэгчийн мэдээллийг харах эрхгүй байна.'], 403);
    }
}

$group = null;
$groupId = trim((string)($selected['groupId'] ?? ''));
if ($groupId !== '') {
    foreach ($groups as $candidate) {
        if ((string)($candidate['id'] ?? '') === $groupId) {
            $group = $candidate;
            break;
        }
    }
}

$relatedIds = [$id => true];
if (is_array($group)) {
    foreach ((is_array($group['members'] ?? null) ? $group['members'] : []) as $memberId) {
        $relatedIds[(string)$memberId] = true;
    }
    if (!empty($group['adminCustomerId'])) $relatedIds[(string)$group['adminCustomerId']] = true;
}
$related = array_values(array_filter($customers, static function (array $customer) use ($relatedIds): bool {
    return isset($relatedIds[(string)($customer['id'] ?? '')]) && empty($customer['deleted']) && empty($customer['deletedAt']);
}));

json_response([
    'ok' => true,
    'customer' => $selected,
    'relatedCustomers' => $related,
    'group' => $group,
    'sectionRevisions' => $revisions,
]);
