<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$user = require_auth();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

function analytics_date(string $value): string
{
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1 ? $value : '';
}

function analytics_event_date(array $item): string
{
    foreach (['date', 'createdAt', 'registeredAt', 'last'] as $key) {
        $value = substr(trim((string)($item[$key] ?? '')), 0, 10);
        if (analytics_date($value) !== '') return $value;
    }
    return '';
}

function analytics_in_range(string $date, string $from, string $to): bool
{
    return $date !== '' && $date >= $from && $date <= $to;
}

function analytics_service_relevant(array $item, string $from, string $to): bool
{
    if (analytics_in_range(analytics_event_date($item), $from, $to)) return true;
    foreach (['payments', 'visits', 'diagnosisHistory'] as $key) {
        foreach ((is_array($item[$key] ?? null) ? $item[$key] : []) as $entry) {
            if (is_array($entry) && analytics_in_range(analytics_event_date($entry), $from, $to)) return true;
        }
    }
    return false;
}

function analytics_months_from_service(array $item, array &$months): void
{
    $date = analytics_event_date($item);
    if ($date !== '') $months[substr($date, 0, 7)] = true;
    foreach (['payments', 'visits', 'diagnosisHistory'] as $key) {
        foreach ((is_array($item[$key] ?? null) ? $item[$key] : []) as $entry) {
            if (!is_array($entry)) continue;
            $entryDate = analytics_event_date($entry);
            if ($entryDate !== '') $months[substr($entryDate, 0, 7)] = true;
        }
    }
}

function analytics_pick(array $item, array $keys): array
{
    return array_intersect_key($item, array_fill_keys($keys, true));
}

function analytics_compact_payment(array $payment): array
{
    return analytics_pick($payment, [
        'id', 'date', 'createdAt', 'time', 'method', 'amount', 'paidAmount',
        'bonusAmount', 'voucherLogId', 'voucherRoleId', 'referenceLabel'
    ]);
}

function analytics_compact_visit(array $visit): array
{
    return analytics_pick($visit, [
        'id', 'date', 'createdAt', 'deleted', 'staff', 'staffId', 'salon',
        'vipRoomFee', 'masterStaffFee'
    ]);
}

function analytics_compact_service(array $item): array
{
    $copy = analytics_pick($item, [
        'id', 'kind', 'deleted', 'date', 'createdAt', 'time', 'salon', 'branch',
        'title', 'service', 'staff', 'staffId', 'visitsTotal', 'basePrice', 'price',
        'total', 'balance', 'employeeDiscountAmount', 'vipRoomFee', 'masterStaffFee',
        'paymentMethod', 'referenceLabel'
    ]);
    $copy['payments'] = array_values(array_map(
        static fn(array $payment): array => analytics_compact_payment($payment),
        array_values(array_filter(is_array($item['payments'] ?? null) ? $item['payments'] : [], 'is_array'))
    ));
    $copy['visits'] = array_values(array_map(
        static fn(array $visit): array => analytics_compact_visit($visit),
        array_values(array_filter(is_array($item['visits'] ?? null) ? $item['visits'] : [], 'is_array'))
    ));
    $copy['diagnosisHistory'] = array_values(array_map(
        static fn(array $entry): array => analytics_pick($entry, ['date', 'createdAt']),
        array_values(array_filter(is_array($item['diagnosisHistory'] ?? null) ? $item['diagnosisHistory'] : [], 'is_array'))
    ));
    $copy['products'] = array_values(array_map(
        static fn(array $product): array => analytics_pick($product, ['name', 'product', 'qty', 'quantity']),
        array_values(array_filter(is_array($item['products'] ?? null) ? $item['products'] : [], 'is_array'))
    ));
    return $copy;
}

function analytics_compact_customer(array $customer, array $history): array
{
    $copy = analytics_pick($customer, [
        'id', 'name', 'phone', 'type', 'salon', 'registeredSalon', 'registeredAt',
        'last', 'deleted', 'deletedAt', 'gender', 'birthYear', 'age', 'district'
    ]);
    if (is_array($customer['currentTreatment'] ?? null)) {
        $copy['currentTreatment'] = analytics_pick($customer['currentTreatment'], ['salon', 'branch']);
    }
    $copy['serviceHistory'] = array_values(array_map(
        static fn(array $item): array => analytics_compact_service($item),
        $history
    ));
    return $copy;
}

$mode = ($_GET['mode'] ?? '') === 'dashboard' ? 'dashboard' : 'performance';
$today = new DateTimeImmutable('today', new DateTimeZone('Asia/Ulaanbaatar'));
$requestedMonth = preg_match('/^\d{4}-\d{2}$/', (string)($_GET['month'] ?? '')) === 1
    ? (string)$_GET['month']
    : $today->format('Y-m');
$monthStart = new DateTimeImmutable($requestedMonth . '-01', new DateTimeZone('Asia/Ulaanbaatar'));
$from = $mode === 'dashboard' ? $monthStart->modify('-5 months')->format('Y-m-d') : $monthStart->modify('-1 month')->format('Y-m-d');
$to = $monthStart->modify('last day of this month')->format('Y-m-d');
$explicitFrom = analytics_date(trim((string)($_GET['from'] ?? '')));
$explicitTo = analytics_date(trim((string)($_GET['to'] ?? '')));
if ($mode === 'performance' && $explicitFrom !== '' && $explicitTo !== '') {
    if ($explicitFrom > $explicitTo) json_response(['ok' => false, 'message' => 'Огнооны дарааллыг шалгана уу.'], 422);
    $from = $explicitFrom;
    $to = $explicitTo;
}
$requestedSalon = trim((string)($_GET['salon'] ?? ''));
$salon = ($user['role'] ?? '') === 'salon' ? trim((string)($user['salon'] ?? '')) : $requestedSalon;

$keys = ['customers', 'bookings', 'services', 'kassSchedules', 'staff', 'assignments', 'salons', 'pricePolicy', 'voucherRoles', 'voucherLogs', 'performanceStatements', 'performanceAdjustments', 'generalSettings'];
$placeholders = implode(',', array_fill(0, count($keys), '?'));
$statement = db()->prepare("SELECT section_key, payload, revision FROM app_sections WHERE section_key IN ($placeholders)");
$statement->execute($keys);
$source = [];
$revisions = [];
foreach ($statement->fetchAll() as $row) {
    $decoded = json_decode((string)($row['payload'] ?? '[]'), true);
    $source[(string)$row['section_key']] = is_array($decoded) ? $decoded : [];
    $revisions[(string)$row['section_key']] = (int)($row['revision'] ?? 0);
}
foreach ($keys as $key) $source[$key] ??= [];
if (($user['role'] ?? '') === 'salon') {
    $source['salons'] = array_values(array_filter((array)$source['salons'], static fn($item): bool => is_array($item) && trim((string)($item['name'] ?? '')) === $salon));
}

$availableMonths = [$today->format('Y-m') => true];
$voucherLogIds = [];
$compactCustomers = [];
foreach ((array)$source['customers'] as $customer) {
    if (!is_array($customer)) continue;
    $history = [];
    foreach ((is_array($customer['serviceHistory'] ?? null) ? $customer['serviceHistory'] : []) as $item) {
        if (!is_array($item)) continue;
        analytics_months_from_service($item, $availableMonths);
        $itemSalon = trim((string)($item['salon'] ?? $item['branch'] ?? $customer['salon'] ?? ''));
        if ($salon !== '' && $itemSalon !== $salon) continue;
        if (!analytics_service_relevant($item, $from, $to)) continue;
        foreach ((is_array($item['payments'] ?? null) ? $item['payments'] : []) as $payment) {
            if (is_array($payment) && trim((string)($payment['voucherLogId'] ?? '')) !== '') {
                $voucherLogIds[(string)$payment['voucherLogId']] = true;
            }
        }
        $history[] = $item;
    }
    $registeredDate = analytics_event_date($customer);
    if ($registeredDate !== '') $availableMonths[substr($registeredDate, 0, 7)] = true;
    $customerSalon = trim((string)($customer['registeredSalon'] ?? $customer['salon'] ?? ''));
    $registeredRelevant = analytics_in_range($registeredDate, $from, $to) && ($salon === '' || $customerSalon === $salon);
    $includeCompact = $mode === 'dashboard' && ($registeredRelevant || $history !== []);
    if ($history === [] && !$includeCompact) continue;
    $compactCustomers[] = analytics_compact_customer($customer, $history);
}
$source['customers'] = $compactCustomers;

$source['bookings'] = array_values(array_filter((array)$source['bookings'], static function ($item) use ($from, $to, $salon, &$availableMonths): bool {
    if (!is_array($item)) return false;
    $date = analytics_event_date($item);
    if ($date !== '') $availableMonths[substr($date, 0, 7)] = true;
    return analytics_in_range($date, $from, $to) && ($salon === '' || trim((string)($item['salon'] ?? '')) === $salon);
}));
$source['services'] = array_values(array_filter((array)$source['services'], static function ($item) use ($from, $to, $salon): bool {
    if (!is_array($item)) return false;
    return analytics_in_range(analytics_event_date($item), $from, $to) && ($salon === '' || trim((string)($item['salon'] ?? '')) === $salon);
}));
$source['kassSchedules'] = array_values(array_filter((array)$source['kassSchedules'], static function ($item) use ($from, $to, $salon): bool {
    if (!is_array($item)) return false;
    return analytics_in_range(analytics_event_date($item), $from, $to) && ($salon === '' || trim((string)($item['salon'] ?? '')) === $salon);
}));
$source['assignments'] = array_values(array_filter((array)$source['assignments'], static function ($item) use ($from, $to, $salon): bool {
    if (!is_array($item)) return false;
    $overlaps = trim((string)($item['startDate'] ?? '')) <= $to && trim((string)($item['endDate'] ?? '')) >= $from;
    return $overlaps && ($salon === '' || trim((string)($item['to'] ?? '')) === $salon || trim((string)($item['from'] ?? '')) === $salon);
}));
$referencedStaffIds = [];
$referencedStaffNames = [];
foreach ($compactCustomers as $customer) {
    foreach ((is_array($customer['serviceHistory'] ?? null) ? $customer['serviceHistory'] : []) as $item) {
        if (!is_array($item)) continue;
        $staffId = trim((string)($item['staffId'] ?? ''));
        $staffName = trim((string)($item['staff'] ?? ''));
        if ($staffId !== '') $referencedStaffIds[$staffId] = true;
        if ($staffName !== '') $referencedStaffNames[$staffName] = true;
        foreach ((is_array($item['visits'] ?? null) ? $item['visits'] : []) as $visit) {
            if (!is_array($visit)) continue;
            $visitStaffId = trim((string)($visit['staffId'] ?? ''));
            $visitStaffName = trim((string)($visit['staff'] ?? ''));
            if ($visitStaffId !== '') $referencedStaffIds[$visitStaffId] = true;
            if ($visitStaffName !== '') $referencedStaffNames[$visitStaffName] = true;
        }
    }
}
foreach ((array)$source['kassSchedules'] as $schedule) {
    if (!is_array($schedule)) continue;
    $staffName = trim((string)($schedule['staff'] ?? ''));
    if ($staffName !== '') $referencedStaffNames[$staffName] = true;
}
foreach ((array)$source['assignments'] as $assignment) {
    if (!is_array($assignment)) continue;
    $staffId = trim((string)($assignment['staffId'] ?? ''));
    $staffName = trim((string)($assignment['staff'] ?? ''));
    if ($staffId !== '') $referencedStaffIds[$staffId] = true;
    if ($staffName !== '') $referencedStaffNames[$staffName] = true;
}
$source['staff'] = array_values(array_filter((array)$source['staff'], static function ($item) use ($salon, $referencedStaffIds, $referencedStaffNames): bool {
    if (!is_array($item)) return false;
    if ($salon === '' || trim((string)($item['salon'] ?? '')) === $salon) return true;
    return isset($referencedStaffIds[trim((string)($item['id'] ?? ''))]) || isset($referencedStaffNames[trim((string)($item['name'] ?? ''))]);
}));
$source['voucherLogs'] = array_values(array_filter((array)$source['voucherLogs'], static fn($item): bool => is_array($item) && isset($voucherLogIds[(string)($item['id'] ?? '')])));
$source['performanceStatements'] = array_values(array_filter((array)$source['performanceStatements'], static fn($item): bool => is_array($item) && trim((string)($item['month'] ?? '')) >= substr($from, 0, 7) && trim((string)($item['month'] ?? '')) <= substr($to, 0, 7) && ($salon === '' || trim((string)($item['salon'] ?? '')) === $salon)));
$source['performanceStatementHistory'] = [];
$source['performanceAdjustments'] = array_values(array_filter((array)$source['performanceAdjustments'], static fn($item): bool => is_array($item) && analytics_in_range(analytics_event_date($item), $from, $to) && ($salon === '' || trim((string)($item['salon'] ?? '')) === $salon)));

$months = array_keys($availableMonths);
rsort($months);
json_response([
    'ok' => true,
    'mode' => $mode,
    'from' => $from,
    'to' => $to,
    'month' => $requestedMonth,
    'salon' => $salon,
    'months' => $months,
    'data' => $source,
    'sectionRevisions' => $revisions,
]);
