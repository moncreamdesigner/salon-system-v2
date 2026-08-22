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
if ($id === '') {
    json_response(['ok' => false, 'message' => 'Захиалга сонгоно уу.'], 422);
}

$statement = $pdo->prepare("SELECT payload, revision FROM app_sections WHERE section_key = 'bookings' LIMIT 1");
$statement->execute();
$stored = $statement->fetch() ?: [];
$decoded = json_decode((string)($stored['payload'] ?? '[]'), true);
$rows = is_array($decoded) ? array_values(array_filter($decoded, 'is_array')) : [];
$matches = array_values(array_filter($rows, static fn(array $row): bool => (string)($row['id'] ?? '') === $id));

if (count($matches) === 0) {
    json_response(['ok' => false, 'message' => 'Захиалга олдсонгүй.'], 404);
}
if (count($matches) > 1) {
    json_response(['ok' => false, 'message' => 'Ижил дугаартай захиалга давхардсан тул засах боломжгүй. Админд мэдэгдэнэ үү.'], 409);
}

$booking = $matches[0];
if (
    ($user['role'] ?? '') === 'salon'
    && trim((string)($user['salon'] ?? '')) !== trim((string)($booking['salon'] ?? ''))
) {
    json_response(['ok' => false, 'message' => 'Өөр салбарын цагийг засах эрхгүй.'], 403);
}

json_response([
    'ok' => true,
    'booking' => $booking,
    'revision' => (int)($stored['revision'] ?? 0),
]);
