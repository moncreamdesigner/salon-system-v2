<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$user = require_auth();
$pdo = db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

function customer_list_date(string $value): string
{
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1 ? $value : '';
}

function customer_list_registered_date(array $customer): string
{
    $value = trim((string)($customer['registeredAt'] ?? $customer['last'] ?? ''));
    return preg_match('/^\d{4}-\d{2}-\d{2}/', $value, $match) === 1 ? $match[0] : '';
}

function customer_list_salon(array $customer): string
{
    return trim((string)($customer['registeredSalon'] ?? $customer['salon'] ?? ''));
}

function customer_list_balance(array $customer): float
{
    $history = is_array($customer['serviceHistory'] ?? null) ? $customer['serviceHistory'] : [];
    if ($history !== []) {
        $balance = 0.0;
        foreach ($history as $item) {
            if (is_array($item)) $balance += max(0, (float)($item['balance'] ?? 0));
        }
        return $balance;
    }
    return max(0, (float)($customer['currentTreatment']['paymentBalance'] ?? 0));
}

function customer_list_active_today(array $customer, string $today, string $salon): bool
{
    if ((string)($customer['dailyQueueDate'] ?? '') !== $today || (int)($customer['dailyQueueSequence'] ?? 0) <= 0) return false;
    $queueSalon = trim((string)($customer['dailyQueueSalon'] ?? customer_list_salon($customer)));
    if ($salon !== '' && $queueSalon !== $salon) return false;
    if (!empty($customer['dailyQueueVacant'])) return true;
    $history = is_array($customer['serviceHistory'] ?? null) ? $customer['serviceHistory'] : [];
    foreach ($history as $item) {
        if (!is_array($item) || !empty($item['deleted'])) continue;
        $itemDate = substr((string)($item['date'] ?? $item['createdAt'] ?? ''), 0, 10);
        if ($itemDate === $today) return true;
        foreach ((is_array($item['visits'] ?? null) ? $item['visits'] : []) as $visit) {
            if (is_array($visit) && substr((string)($visit['date'] ?? $visit['registeredAt'] ?? ''), 0, 10) === $today) return true;
        }
    }
    return !empty($customer['currentTreatment']);
}

$statement = $pdo->prepare("SELECT payload, revision FROM app_sections WHERE section_key = 'customers' LIMIT 1");
$statement->execute();
$stored = $statement->fetch() ?: [];
$decoded = json_decode((string)($stored['payload'] ?? '[]'), true);
$rows = is_array($decoded) ? array_values(array_filter($decoded, 'is_array')) : [];

$timezone = new DateTimeZone('Asia/Ulaanbaatar');
$today = (new DateTimeImmutable('today', $timezone))->format('Y-m-d');
$query = mb_strtolower(trim((string)($_GET['q'] ?? '')), 'UTF-8');
$from = customer_list_date(trim((string)($_GET['from'] ?? '')));
$to = customer_list_date(trim((string)($_GET['to'] ?? '')));
$type = trim((string)($_GET['type'] ?? 'all'));
$work = trim((string)($_GET['work'] ?? 'all'));
$sort = trim((string)($_GET['sort'] ?? 'date'));
$page = max(1, (int)($_GET['page'] ?? 1));
$pageSize = min(100, max(10, (int)($_GET['pageSize'] ?? 100)));
$salon = ($user['role'] ?? '') === 'salon' ? trim((string)($user['salon'] ?? '')) : '';
$historyRequested = $query !== '' || $from !== '' || $to !== '';

$activeRows = [];
foreach ($rows as $customer) {
    if (!empty($customer['deleted']) || !empty($customer['deletedAt'])) continue;
    if (customer_list_active_today($customer, $today, $salon)) $activeRows[] = $customer;
}

$todayRows = array_values(array_filter($rows, static function (array $customer) use ($today, $salon): bool {
    return empty($customer['deleted'])
        && empty($customer['deletedAt'])
        && customer_list_registered_date($customer) === $today
        && ($salon === '' || customer_list_salon($customer) === $salon);
}));
$serviceCounts = ['single' => 0, 'course' => 0, 'kass' => 0];
foreach ($rows as $customer) {
    if (!is_array($customer) || !empty($customer['deleted']) || !empty($customer['deletedAt'])) continue;
    foreach ((is_array($customer['serviceHistory'] ?? null) ? $customer['serviceHistory'] : []) as $item) {
        if (!is_array($item) || !empty($item['deleted'])) continue;
        $itemDate = substr((string)($item['date'] ?? $item['createdAt'] ?? ''), 0, 10);
        $itemSalon = trim((string)($item['salon'] ?? customer_list_salon($customer)));
        if ($itemDate !== $today || ($salon !== '' && $itemSalon !== $salon)) continue;
        $kind = (string)($item['kind'] ?? 'single');
        if ($kind === 'course') $serviceCounts['course']++;
        elseif ($kind === 'kass' || $kind === 'product') $serviceCounts['kass']++;
        else $serviceCounts['single']++;
    }
}

$filtered = array_values(array_filter($rows, static function (array $customer) use ($query, $from, $to, $type, $work, $today, $salon, $historyRequested): bool {
    if (!empty($customer['deleted']) || !empty($customer['deletedAt'])) return false;
    $registered = customer_list_registered_date($customer);
    if (!$historyRequested && $registered !== $today) return false;
    if (!$historyRequested && $salon !== '' && customer_list_salon($customer) !== $salon) return false;
    if ($from !== '' && $registered < $from) return false;
    if ($to !== '' && $registered > $to) return false;
    if ($type !== '' && $type !== 'all' && (string)($customer['type'] ?? '') !== $type) return false;
    if ($query !== '') {
        $haystack = mb_strtolower((string)($customer['name'] ?? '') . ' ' . (string)($customer['phone'] ?? ''), 'UTF-8');
        if (!str_contains($haystack, $query)) return false;
    }
    if ($work === 'active' && !customer_list_active_today($customer, $today, $salon)) return false;
    if ($work === 'unpaid' && customer_list_balance($customer) <= 0) return false;
    if ($work === 'group' && empty($customer['groupId'])) return false;
    if ($work === 'no-group' && !empty($customer['groupId'])) return false;
    return true;
}));

usort($filtered, static function (array $left, array $right) use ($sort): int {
    if ($sort === 'name') return strnatcasecmp((string)($left['name'] ?? ''), (string)($right['name'] ?? ''));
    $a = customer_list_registered_date($left) . ' ' . (string)($left['registeredTime'] ?? '');
    $b = customer_list_registered_date($right) . ' ' . (string)($right['registeredTime'] ?? '');
    $order = strcmp($b, $a);
    return $order !== 0 ? $order : ((int)($right['id'] ?? 0) <=> (int)($left['id'] ?? 0));
});

$total = count($filtered);
$pageCount = max(1, (int)ceil($total / $pageSize));
$page = min($page, $pageCount);

json_response([
    'ok' => true,
    'customers' => array_slice($filtered, ($page - 1) * $pageSize, $pageSize),
    'activeCustomers' => $activeRows,
    'page' => $page,
    'pageSize' => $pageSize,
    'pageCount' => $pageCount,
    'total' => $total,
    'summary' => [
        'newCustomers' => count($todayRows),
        'single' => $serviceCounts['single'],
        'course' => $serviceCounts['course'],
        'kass' => $serviceCounts['kass'],
    ],
    'revision' => (int)($stored['revision'] ?? 0),
]);
