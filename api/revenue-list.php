<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$user = require_auth();
$pdo = db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

function revenue_date(string $value): string
{
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1 ? $value : '';
}

function revenue_service_name(array $item): string
{
    $products = is_array($item['products'] ?? null) ? $item['products'] : [];
    if ($products !== []) {
        $names = [];
        foreach ($products as $product) {
            if (!is_array($product)) continue;
            $names[] = trim((string)($product['name'] ?? $product['product'] ?? 'Бүтээгдэхүүн'));
        }
        if ($names !== []) return implode(', ', $names);
    }
    return trim((string)($item['service'] ?? $item['title'] ?? 'Үйлчилгээ'));
}

function revenue_type(string $kind): string
{
    if ($kind === 'course') return 'course';
    if (in_array($kind, ['kass', 'product'], true)) return 'kass';
    return 'single';
}

function revenue_is_actual(string $method): bool
{
    $normalized = mb_strtolower(trim($method), 'UTF-8');
    $normalized = preg_replace('/\s+/u', '_', $normalized) ?? $normalized;
    return !in_array($normalized, ['bonus', 'gift_card', 'customer_credit', 'credit_transfer', 'бонус', 'бэлгийн_карт', 'шилжүүлсэн_үлдэгдлээс'], true);
}

function revenue_legacy_paid(array $item): float
{
    $total = (float)($item['price'] ?? $item['total'] ?? 0);
    if (($item['kind'] ?? '') === 'course') {
        $total = (float)($item['basePrice'] ?? $item['price'] ?? $item['total'] ?? 0);
        foreach ((is_array($item['visits'] ?? null) ? $item['visits'] : []) as $visit) {
            if (!is_array($visit)) continue;
            $total += (float)($visit['vipRoomFee'] ?? 0) + (float)($visit['masterStaffFee'] ?? 0);
        }
        $total -= (float)($item['employeeDiscountAmount'] ?? 0);
    }
    return max(0, $total - (float)($item['balance'] ?? 0));
}

$from = revenue_date(trim((string)($_GET['from'] ?? '')));
$to = revenue_date(trim((string)($_GET['to'] ?? '')));
if ($from !== '' && $to !== '' && $from > $to) {
    json_response(['ok' => false, 'message' => 'Эхлэх огноо дуусах огнооноос хойш байж болохгүй.'], 422);
}
$requestedSalon = trim((string)($_GET['salon'] ?? ''));
$salon = ($user['role'] ?? '') === 'salon' ? trim((string)($user['salon'] ?? '')) : $requestedSalon;
$page = max(1, (int)($_GET['page'] ?? 1));
$pageSize = min(100, max(10, (int)($_GET['pageSize'] ?? 100)));

$statement = $pdo->prepare("SELECT payload, revision FROM app_sections WHERE section_key = 'customers' LIMIT 1");
$statement->execute();
$stored = $statement->fetch() ?: [];
$decoded = json_decode((string)($stored['payload'] ?? '[]'), true);
$customers = is_array($decoded) ? array_values(array_filter($decoded, 'is_array')) : [];

$rows = [];
$methodTotals = [];
$typeTotals = ['single' => 0.0, 'course' => 0.0, 'kass' => 0.0];
$actualTotal = 0.0;
$actualCount = 0;

foreach ($customers as $customer) {
    if (!empty($customer['deleted']) || !empty($customer['deletedAt'])) continue;
    $history = is_array($customer['serviceHistory'] ?? null) ? $customer['serviceHistory'] : [];
    foreach ($history as $historyIndex => $item) {
        if (!is_array($item) || !empty($item['deleted'])) continue;
        $itemSalon = trim((string)($item['salon'] ?? $item['branch'] ?? $customer['salon'] ?? '—'));
        if ($salon !== '' && $itemSalon !== $salon) continue;
        $service = revenue_service_name($item);
        $kind = trim((string)($item['kind'] ?? 'single'));
        $payments = is_array($item['payments'] ?? null) ? $item['payments'] : [];
        if ($payments === []) {
            $legacyAmount = revenue_legacy_paid($item);
            if ($legacyAmount <= 0) continue;
            $payments = [[
                'id' => 'legacy',
                'amount' => $legacyAmount,
                'date' => $item['date'] ?? $customer['last'] ?? '',
                'time' => $item['time'] ?? '',
                'method' => $item['paymentMethod'] ?? 'card',
            ]];
        }
        foreach ($payments as $paymentIndex => $payment) {
            if (!is_array($payment)) continue;
            $amount = max(0, (float)($payment['paidAmount'] ?? $payment['amount'] ?? 0));
            if ($amount <= 0) continue;
            $createdAt = trim((string)($payment['createdAt'] ?? ''));
            $date = revenue_date(substr(trim((string)($payment['date'] ?? $createdAt ?? $item['date'] ?? $customer['last'] ?? '')), 0, 10));
            if ($date === '') $date = revenue_date(substr((string)($item['date'] ?? $customer['last'] ?? ''), 0, 10));
            if ($from !== '' && ($date === '' || $date < $from)) continue;
            if ($to !== '' && ($date === '' || $date > $to)) continue;
            $method = trim((string)($payment['method'] ?? 'card')) ?: 'card';
            $time = preg_match('/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/', $createdAt) === 1
                ? substr($createdAt, 11, 5)
                : trim((string)($payment['time'] ?? ''));
            $row = [
                'id' => (string)($customer['id'] ?? '') . '-' . $historyIndex . '-' . ($payment['id'] ?? $paymentIndex),
                'date' => $date,
                'time' => $time,
                'customer' => (string)($customer['name'] ?? '—'),
                'phone' => (string)($customer['phone'] ?? '—'),
                'service' => $service,
                'salon' => $itemSalon,
                'kind' => $kind,
                'method' => $method,
                'amount' => $amount,
            ];
            $rows[] = $row;
            $methodTotals[$method] = ($methodTotals[$method] ?? 0) + $amount;
            if (revenue_is_actual($method)) {
                $actualTotal += $amount;
                $actualCount++;
                $type = revenue_type($kind);
                $typeTotals[$type] += $amount;
            }
        }
    }
}

usort($rows, static fn(array $a, array $b): int => strcmp(($b['date'] ?? '') . ' ' . ($b['time'] ?? ''), ($a['date'] ?? '') . ' ' . ($a['time'] ?? '')));
$total = count($rows);
$pageCount = max(1, (int)ceil($total / $pageSize));
$page = min($page, $pageCount);

json_response([
    'ok' => true,
    'rows' => array_slice($rows, ($page - 1) * $pageSize, $pageSize),
    'summary' => [
        'actualTotal' => $actualTotal,
        'actualCount' => $actualCount,
        'methodTotals' => $methodTotals,
        'typeTotals' => $typeTotals,
    ],
    'pagination' => ['page' => $page, 'pageSize' => $pageSize, 'pageCount' => $pageCount, 'total' => $total],
    'revision' => (int)($stored['revision'] ?? 0),
]);
