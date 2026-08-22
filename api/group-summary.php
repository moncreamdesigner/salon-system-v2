<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
require_admin();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

$statement = db()->query("SELECT section_key, payload, revision FROM app_sections WHERE section_key IN ('customers','customerGroups')");
$sections = [];
$revisions = [];
foreach ($statement->fetchAll() as $stored) {
    $decoded = json_decode((string)($stored['payload'] ?? '[]'), true);
    $sections[(string)$stored['section_key']] = is_array($decoded) ? $decoded : [];
    $revisions[(string)$stored['section_key']] = (int)($stored['revision'] ?? 0);
}

$customers = array_values(array_filter($sections['customers'] ?? [], 'is_array'));
$groups = array_values(array_filter($sections['customerGroups'] ?? [], 'is_array'));
$deleted = count(array_filter($customers, static fn(array $customer): bool =>
    !empty($customer['deleted']) || trim((string)($customer['deletedAt'] ?? '')) !== ''
));

json_response([
    'ok' => true,
    'summary' => [
        'groups' => count($groups),
        'deletedCustomers' => $deleted,
    ],
    'sectionRevisions' => $revisions,
]);
