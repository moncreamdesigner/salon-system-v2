<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
require_admin();
$pdo = db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

function audit_list_date(string $value): string
{
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1 ? $value : '';
}

$statement = $pdo->prepare("SELECT payload, revision FROM app_sections WHERE section_key = 'audit' LIMIT 1");
$statement->execute();
$stored = $statement->fetch() ?: [];
$decoded = json_decode((string)($stored['payload'] ?? '[]'), true);
$rows = is_array($decoded) ? array_values(array_filter($decoded, 'is_array')) : [];

$query = trim((string)($_GET['q'] ?? ''));
$action = trim((string)($_GET['action'] ?? ''));
$from = audit_list_date(trim((string)($_GET['from'] ?? '')));
$to = audit_list_date(trim((string)($_GET['to'] ?? '')));
$page = max(1, (int)($_GET['page'] ?? 1));
$pageSize = min(100, max(10, (int)($_GET['pageSize'] ?? 100)));

$actionTypes = [];
foreach ($rows as $row) {
    $title = trim((string)($row['title'] ?? ''));
    if ($title !== '') $actionTypes[$title] = true;
}

$filtered = array_values(array_filter($rows, static function (array $row) use ($query, $action, $from, $to): bool {
    $title = (string)($row['title'] ?? '');
    $meta = (string)($row['meta'] ?? '');
    $created = substr((string)($row['createdAt'] ?? ''), 0, 10);
    if ($action !== '' && $action !== 'all' && $title !== $action) return false;
    if ($query !== '' && mb_stripos($title . ' ' . $meta, $query, 0, 'UTF-8') === false) return false;
    if ($from !== '' && $created !== '' && $created < $from) return false;
    if ($to !== '' && $created !== '' && $created > $to) return false;
    return true;
}));

$total = count($filtered);
$pageCount = max(1, (int)ceil($total / $pageSize));
$page = min($page, $pageCount);

json_response([
    'ok' => true,
    'events' => array_slice($filtered, ($page - 1) * $pageSize, $pageSize),
    'actionTypes' => array_values(array_keys($actionTypes)),
    'page' => $page,
    'pageSize' => $pageSize,
    'pageCount' => $pageCount,
    'total' => $total,
    'revision' => (int)($stored['revision'] ?? 0),
]);
