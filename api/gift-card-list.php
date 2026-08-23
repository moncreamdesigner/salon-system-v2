<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$user = require_auth();
if (($user['role'] ?? '') === 'salon') {
    json_response(['ok' => false, 'message' => 'Бэлгийн картын жагсаалтыг харах эрхгүй байна.'], 403);
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

function gift_card_list_date(string $value): string
{
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1 ? $value : '';
}

function gift_card_list_status(array $card, string $today): string
{
    if (($card['status'] ?? '') === 'inactive') return 'inactive';
    $expiry = gift_card_list_date(trim((string)($card['expiryDate'] ?? '')));
    if ($expiry !== '' && $expiry < $today) return 'expired';
    $remaining = (float)($card['remainingAmount'] ?? $card['amount'] ?? 0);
    if ($remaining <= 0) return 'used';
    if ($remaining < (float)($card['amount'] ?? 0)) return 'partial';
    return 'fresh';
}

$number = mb_strtolower(trim((string)($_GET['number'] ?? '')), 'UTF-8');
$status = trim((string)($_GET['status'] ?? 'all'));
$from = gift_card_list_date(trim((string)($_GET['from'] ?? '')));
$to = gift_card_list_date(trim((string)($_GET['to'] ?? '')));
if ($from !== '' && $to !== '' && $from > $to) json_response(['ok' => false, 'message' => 'Огнооны дараалал буруу байна.'], 422);
$page = max(1, (int)($_GET['page'] ?? 1));
$pageSize = min(100, max(10, (int)($_GET['pageSize'] ?? 100)));
$today = (new DateTimeImmutable('today', new DateTimeZone('Asia/Ulaanbaatar')))->format('Y-m-d');

$statement = db()->prepare("SELECT payload, revision FROM app_sections WHERE section_key = 'giftCards' LIMIT 1");
$statement->execute();
$stored = $statement->fetch();
$decoded = $stored ? json_decode((string)($stored['payload'] ?? '[]'), true) : [];
$cards = array_values(array_filter(is_array($decoded) ? $decoded : [], 'is_array'));
$statusCounts = ['fresh' => 0, 'partial' => 0, 'used' => 0, 'expired' => 0, 'inactive' => 0];
$filtered = [];
foreach ($cards as $card) {
    $cardStatus = gift_card_list_status($card, $today);
    $statusCounts[$cardStatus] = ($statusCounts[$cardStatus] ?? 0) + 1;
    $createdAt = substr(trim((string)($card['createdAt'] ?? '')), 0, 10);
    if ($number !== '' && mb_stripos((string)($card['cardNumber'] ?? ''), $number, 0, 'UTF-8') === false) continue;
    if ($status !== '' && $status !== 'all' && $cardStatus !== $status) continue;
    if ($from !== '' && $createdAt < $from) continue;
    if ($to !== '' && $createdAt > $to) continue;
    $card['_directoryStatus'] = $cardStatus;
    $filtered[] = $card;
}
usort($filtered, static fn(array $a, array $b): int => strcmp((string)($b['createdAt'] ?? '') . (string)($b['id'] ?? ''), (string)($a['createdAt'] ?? '') . (string)($a['id'] ?? '')));
$total = count($filtered);
$pageCount = max(1, (int)ceil($total / $pageSize));
$page = min($page, $pageCount);

json_response([
    'ok' => true,
    'cards' => array_slice($filtered, ($page - 1) * $pageSize, $pageSize),
    'summary' => ['total' => count($cards), 'statuses' => $statusCounts],
    'pagination' => ['page' => $page, 'pageSize' => $pageSize, 'pageCount' => $pageCount, 'total' => $total],
    'sectionRevision' => (int)($stored['revision'] ?? 0),
]);
