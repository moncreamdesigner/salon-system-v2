<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
require_auth();
$pdo = db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

$phone = preg_replace('/\D+/', '', (string)($_GET['phone'] ?? '')) ?? '';
$excludeId = trim((string)($_GET['excludeId'] ?? ''));
if (preg_match('/^\d{8}$/', $phone) !== 1) json_response(['ok' => true, 'exists' => false]);

$statement = $pdo->prepare("SELECT payload FROM app_sections WHERE section_key = 'customers' LIMIT 1");
$statement->execute();
$decoded = json_decode((string)($statement->fetchColumn() ?: '[]'), true);
$customers = is_array($decoded) ? $decoded : [];
foreach ($customers as $customer) {
    if (!is_array($customer) || !empty($customer['deleted']) || !empty($customer['deletedAt'])) continue;
    if ($excludeId !== '' && (string)($customer['id'] ?? '') === $excludeId) continue;
    $candidate = preg_replace('/\D+/', '', (string)($customer['phone'] ?? '')) ?? '';
    if ($candidate !== $phone) continue;
    json_response([
        'ok' => true,
        'exists' => true,
        'customer' => ['id' => $customer['id'] ?? null, 'name' => (string)($customer['name'] ?? '')],
    ]);
}

json_response(['ok' => true, 'exists' => false]);
