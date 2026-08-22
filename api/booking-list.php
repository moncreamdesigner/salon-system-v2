<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$user = require_auth();
$pdo = db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

function booking_list_date(string $value): string
{
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1 ? $value : '';
}

$statement = $pdo->prepare("SELECT payload, revision FROM app_sections WHERE section_key = 'bookings' LIMIT 1");
$statement->execute();
$stored = $statement->fetch() ?: [];
$decoded = json_decode((string)($stored['payload'] ?? '[]'), true);
$rows = is_array($decoded) ? array_values(array_filter($decoded, 'is_array')) : [];

$timezone = new DateTimeZone('Asia/Ulaanbaatar');
$today = (new DateTimeImmutable('today', $timezone))->format('Y-m-d');
$query = preg_replace('/\D+/', '', trim((string)($_GET['q'] ?? ''))) ?? '';
$salon = trim((string)($_GET['salon'] ?? ''));
$status = trim((string)($_GET['status'] ?? ''));
$date = booking_list_date(trim((string)($_GET['date'] ?? '')));
$from = booking_list_date(trim((string)($_GET['from'] ?? '')));
$to = booking_list_date(trim((string)($_GET['to'] ?? '')));
$page = max(1, (int)($_GET['page'] ?? 1));
$pageSize = min(100, max(10, (int)($_GET['pageSize'] ?? 100)));
$historyRequested = $query !== '' || $date !== '' || $from !== '' || $to !== '';

if (($user['role'] ?? '') === 'salon') {
    $salon = trim((string)($user['salon'] ?? ''));
}

$filtered = array_values(array_filter($rows, static function (array $row) use ($query, $salon, $status, $date, $from, $to, $today, $historyRequested): bool {
    $rowDate = (string)($row['date'] ?? '');
    if (!$historyRequested && $rowDate < $today) return false;
    if ($query !== '' && !str_contains(preg_replace('/\D+/', '', (string)($row['phone'] ?? '')) ?? '', $query)) return false;
    if ($salon !== '' && $salon !== 'all' && (string)($row['salon'] ?? '') !== $salon) return false;
    if ($status !== '' && $status !== 'all' && (string)($row['status'] ?? '') !== $status) return false;
    if ($date !== '' && $rowDate !== $date) return false;
    if ($from !== '' && $rowDate < $from) return false;
    if ($to !== '' && $rowDate > $to) return false;
    return true;
}));

usort($filtered, static function (array $left, array $right) use ($historyRequested): int {
    $a = (string)($left['date'] ?? '') . ' ' . (string)($left['time'] ?? '');
    $b = (string)($right['date'] ?? '') . ' ' . (string)($right['time'] ?? '');
    $order = $historyRequested ? strcmp($b, $a) : strcmp($a, $b);
    if ($order !== 0) return $order;
    return strcmp((string)($left['id'] ?? ''), (string)($right['id'] ?? ''));
});

$total = count($filtered);
$summary = [
    'total' => $total,
    'confirmed' => count(array_filter($filtered, static fn(array $row): bool => (string)($row['status'] ?? '') === 'confirmed')),
    'pending' => count(array_filter($filtered, static fn(array $row): bool => (string)($row['status'] ?? '') === 'pending')),
    'today' => count(array_filter($filtered, static fn(array $row): bool => (string)($row['date'] ?? '') === $today)),
];
$pageCount = max(1, (int)ceil($total / $pageSize));
$page = min($page, $pageCount);
$items = array_slice($filtered, ($page - 1) * $pageSize, $pageSize);

json_response([
    'ok' => true,
    'bookings' => $items,
    'page' => $page,
    'pageSize' => $pageSize,
    'pageCount' => $pageCount,
    'total' => $total,
    'historyRequested' => $historyRequested,
    'summary' => $summary,
    'revision' => (int)($stored['revision'] ?? 0),
]);
