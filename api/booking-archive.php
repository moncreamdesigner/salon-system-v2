<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
require_admin();
$pdo = db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

$query = trim((string)($_GET['q'] ?? ''));
$salon = trim((string)($_GET['salon'] ?? ''));
$from = trim((string)($_GET['from'] ?? ''));
$to = trim((string)($_GET['to'] ?? ''));
$where = [];
$params = [];
if ($query !== '') {
    $where[] = '(phone LIKE ? OR payload LIKE ?)';
    $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $query) . '%';
    array_push($params, $like, $like);
}
if ($salon !== '') {
    $where[] = 'salon = ?';
    $params[] = $salon;
}
if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) === 1) {
    $where[] = 'booking_date >= ?';
    $params[] = $from;
}
if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $to) === 1) {
    $where[] = 'booking_date <= ?';
    $params[] = $to;
}
$sql = 'SELECT id, booking_id, salon, booking_date, booking_time, phone, status, archived_revision, archived_at FROM app_booking_archive'
    . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
    . ' ORDER BY booking_date DESC, booking_time DESC, id DESC LIMIT 500';
$statement = $pdo->prepare($sql);
$statement->execute($params);
$rows = array_map(static fn(array $row): array => [
    'id' => (int)$row['id'],
    'bookingId' => (string)$row['booking_id'],
    'salon' => (string)$row['salon'],
    'date' => (string)$row['booking_date'],
    'time' => (string)$row['booking_time'],
    'phone' => (string)$row['phone'],
    'status' => (string)$row['status'],
    'archivedRevision' => (int)$row['archived_revision'],
    'archivedAt' => (string)$row['archived_at'],
], $statement->fetchAll());
$count = (int)$pdo->query('SELECT COUNT(*) FROM app_booking_archive')->fetchColumn();

json_response([
    'ok' => true,
    'bookings' => $rows,
    'totalArchived' => $count,
    'activeRetentionYears' => 2,
]);
