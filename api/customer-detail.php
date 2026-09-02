<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/customer-entity-store.php';

verify_same_origin();
$user = require_auth();
$pdo = db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

$id = trim((string)($_GET['id'] ?? ''));
if ($id === '') json_response(['ok' => false, 'message' => 'Хэрэглэгч сонгоно уу.'], 422);

$projectionReady = entity_projection_ready($pdo);
$statement = $pdo->prepare("SELECT section_key, payload, revision FROM app_sections WHERE section_key IN ('customers', 'customerGroups')");
$statement->execute();
$sections = [];
$revisions = [];
foreach ($statement->fetchAll() as $row) {
    $sectionKey = (string)$row['section_key'];
    // Once the projection has passed count parity, avoid decoding the entire
    // multi-megabyte customer section just to open one profile.
    if (!($projectionReady && $sectionKey === 'customers')) {
        $decoded = json_decode((string)($row['payload'] ?? '[]'), true);
        $sections[$sectionKey] = is_array($decoded) ? array_values(array_filter($decoded, 'is_array')) : [];
    }
    $revisions[$sectionKey] = (int)($row['revision'] ?? 0);
}

$customers = $sections['customers'] ?? [];
$groups = $sections['customerGroups'] ?? [];
$selected = null;
if ($projectionReady) {
    $selectedStatement = $pdo->prepare('SELECT payload FROM app_customer_entities WHERE customer_id = ? AND archived = 0 LIMIT 1');
    $selectedStatement->execute([$id]);
    $selectedPayload = $selectedStatement->fetchColumn();
    $decodedSelected = $selectedPayload !== false ? json_decode((string)$selectedPayload, true) : null;
    if (is_array($decodedSelected)) $selected = $decodedSelected;
} else {
    foreach ($customers as $customer) {
        if ((string)($customer['id'] ?? '') === $id && empty($customer['deleted']) && empty($customer['deletedAt'])) {
            $selected = $customer;
            break;
        }
    }
}
if ($selected === null) json_response(['ok' => false, 'message' => 'Хэрэглэгч олдсонгүй.'], 404);


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
$related = [];
if ($projectionReady) {
    $ids = array_keys($relatedIds);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $relatedStatement = $pdo->prepare("SELECT payload FROM app_customer_entities WHERE archived = 0 AND customer_id IN ({$placeholders}) ORDER BY customer_id");
    $relatedStatement->execute($ids);
    foreach ($relatedStatement->fetchAll() as $row) {
        $decodedCustomer = json_decode((string)($row['payload'] ?? ''), true);
        if (is_array($decodedCustomer)) $related[] = $decodedCustomer;
    }
} else {
    $related = array_values(array_filter($customers, static function (array $customer) use ($relatedIds): bool {
        return isset($relatedIds[(string)($customer['id'] ?? '')]) && empty($customer['deleted']) && empty($customer['deletedAt']);
    }));
}

json_response([
    'ok' => true,
    'customer' => $selected,
    'relatedCustomers' => $related,
    'group' => $group,
    'sectionRevisions' => $revisions,
]);
