<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$user = require_auth();
$pdo = db();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);

function voucher_list_date(string $value): string
{
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1 ? $value : '';
}

$from = voucher_list_date(trim((string)($_GET['from'] ?? '')));
$to = voucher_list_date(trim((string)($_GET['to'] ?? '')));
if ($from !== '' && $to !== '' && $from > $to) json_response(['ok' => false, 'message' => 'Огнооны дараалал буруу байна.'], 422);
$customer = mb_strtolower(trim((string)($_GET['customer'] ?? '')), 'UTF-8');
$phone = preg_replace('/\D+/', '', (string)($_GET['phone'] ?? '')) ?? '';
$role = trim((string)($_GET['role'] ?? ''));
$page = max(1, (int)($_GET['page'] ?? 1));
$pageSize = min(100, max(10, (int)($_GET['pageSize'] ?? 100)));

$statement = $pdo->query("SELECT section_key, payload, revision FROM app_sections WHERE section_key IN ('voucherLogs','voucherRoles','customers')");
$sections = [];
$revisions = [];
foreach ($statement->fetchAll() as $stored) {
    $decoded = json_decode((string)($stored['payload'] ?? '[]'), true);
    $sections[(string)$stored['section_key']] = is_array($decoded) ? $decoded : [];
    $revisions[(string)$stored['section_key']] = (int)($stored['revision'] ?? 0);
}
$storedLogs = array_values(array_filter($sections['voucherLogs'] ?? [], 'is_array'));
$roles = array_values(array_filter($sections['voucherRoles'] ?? [], 'is_array'));
$customers = array_values(array_filter($sections['customers'] ?? [], 'is_array'));

$rolesById = [];
foreach ($roles as $roleItem) {
    $roleId = trim((string)($roleItem['id'] ?? ''));
    if ($roleId !== '') $rolesById[$roleId] = $roleItem;
}
$storedByPayment = [];
$storedWithoutPayment = [];
foreach ($storedLogs as $storedLog) {
    $paymentId = trim((string)($storedLog['paymentId'] ?? ''));
    if ($paymentId !== '') $storedByPayment[$paymentId] = $storedLog;
    else $storedWithoutPayment[] = $storedLog;
}

// Payment history is the authoritative voucher source. The separate legacy
// log can be lost by an old scoped browser write, while the actual payment
// remains attached to the customer's service. Rebuild the read model without
// mutating customer or payment data.
$logs = [];
$seenPayments = [];
foreach ($customers as $customerItem) {
    $history = is_array($customerItem['serviceHistory'] ?? null) ? $customerItem['serviceHistory'] : [];
    foreach ($history as $serviceItem) {
        if (!is_array($serviceItem)) continue;
        $payments = is_array($serviceItem['payments'] ?? null) ? $serviceItem['payments'] : [];
        foreach ($payments as $paymentItem) {
            if (!is_array($paymentItem)) continue;
            $method = mb_strtolower(trim((string)($paymentItem['method'] ?? '')), 'UTF-8');
            if (!in_array($method, ['voucher', 'ваучер'], true)) continue;
            $paymentId = trim((string)($paymentItem['id'] ?? ''));
            if ($paymentId === '' || isset($seenPayments[$paymentId])) continue;
            $seenPayments[$paymentId] = true;
            $snapshot = $storedByPayment[$paymentId] ?? [];
            $roleId = trim((string)($paymentItem['voucherRoleId'] ?? $snapshot['roleId'] ?? ''));
            $roleItem = $rolesById[$roleId] ?? [];
            $createdAt = trim((string)($paymentItem['createdAt'] ?? ''));
            $logs[] = [
                'id' => (string)($snapshot['id'] ?? $paymentItem['voucherLogId'] ?? ('voucher-payment-' . $paymentId)),
                'paymentId' => $paymentId,
                'date' => (string)($paymentItem['date'] ?? $snapshot['date'] ?? substr($createdAt, 0, 10)),
                'time' => (string)($snapshot['time'] ?? (strlen($createdAt) >= 16 ? substr($createdAt, 11, 5) : '')),
                'salon' => (string)($snapshot['salon'] ?? $serviceItem['salon'] ?? $serviceItem['branch'] ?? ''),
                'customer' => (string)($snapshot['customer'] ?? $customerItem['name'] ?? ''),
                'phone' => (string)($snapshot['phone'] ?? $customerItem['phone'] ?? ''),
                'roleId' => $roleId,
                'roleName' => (string)($snapshot['roleName'] ?? $roleItem['name'] ?? $paymentItem['referenceLabel'] ?? ''),
                'rolePosition' => (string)($snapshot['rolePosition'] ?? $roleItem['position'] ?? ''),
                'amount' => (float)($paymentItem['paidAmount'] ?? $paymentItem['amount'] ?? $snapshot['amount'] ?? 0),
                'note' => (string)($snapshot['note'] ?? $serviceItem['service'] ?? $serviceItem['title'] ?? ''),
            ];
        }
    }
}
// Preserve truly historical rows that predate payment identifiers.
$logs = array_merge($logs, $storedWithoutPayment);

$roleEntries = [];
$seen = [];
$maxRoleId = 0;
foreach ($roles as $item) {
    $maxRoleId = max($maxRoleId, (int)($item['id'] ?? 0));
    $key = 'id:' . (string)($item['id'] ?? '');
    if ($key === 'id:') continue;
    $roleEntries[] = ['value' => $key, 'label' => trim((string)($item['name'] ?? '')) . (trim((string)($item['position'] ?? '')) !== '' ? ' · ' . trim((string)$item['position']) : '')];
    $seen[$key] = true;
}

$filtered = [];
foreach ($logs as $log) {
    $roleId = trim((string)($log['roleId'] ?? ''));
    if (ctype_digit($roleId)) $maxRoleId = max($maxRoleId, (int)$roleId);
    $roleKey = $roleId !== '' ? 'id:' . $roleId : 'legacy:' . rawurlencode(mb_strtolower(trim((string)($log['roleName'] ?? '')) . "\0" . trim((string)($log['rolePosition'] ?? '')), 'UTF-8'));
    if (!isset($seen[$roleKey])) {
        $label = trim((string)($log['roleName'] ?? 'Нэргүй эрх')) . (trim((string)($log['rolePosition'] ?? '')) !== '' ? ' · ' . trim((string)$log['rolePosition']) : '') . ' · Түүхэн';
        $roleEntries[] = ['value' => $roleKey, 'label' => $label];
        $seen[$roleKey] = true;
    }
    $date = substr(trim((string)($log['date'] ?? $log['createdAt'] ?? '')), 0, 10);
    if ($from !== '' && $date < $from) continue;
    if ($to !== '' && $date > $to) continue;
    if ($customer !== '' && mb_stripos((string)($log['customer'] ?? ''), $customer, 0, 'UTF-8') === false) continue;
    if ($phone !== '' && !str_contains(preg_replace('/\D+/', '', (string)($log['phone'] ?? '')) ?? '', $phone)) continue;
    if ($role !== '' && $roleKey !== $role) continue;
    $filtered[] = $log;
}
usort($filtered, static fn(array $a, array $b): int => strcmp((string)($b['date'] ?? '') . (string)($b['time'] ?? ''), (string)($a['date'] ?? '') . (string)($a['time'] ?? '')));
$total = count($filtered);
$totalAmount = array_reduce($filtered, static fn(float $sum, array $item): float => $sum + (float)($item['amount'] ?? 0), 0.0);
$pageCount = max(1, (int)ceil($total / $pageSize));
$page = min($page, $pageCount);

json_response([
    'ok' => true,
    'logs' => array_slice($filtered, ($page - 1) * $pageSize, $pageSize),
    'roleEntries' => $roleEntries,
    'maxRoleId' => $maxRoleId,
    'pagination' => ['page' => $page, 'pageSize' => $pageSize, 'pageCount' => $pageCount, 'total' => $total],
    'summary' => ['amount' => $totalAmount],
    'sectionRevisions' => $revisions,
]);
