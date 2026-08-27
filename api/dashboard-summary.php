<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$user = require_auth();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

function dashboard_date(string $value): string
{
    $clean = trim($value);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $clean) === 1) return $clean;
    if (preg_match('/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/', $clean, $match) === 1) {
        $first = (int)$match[1];
        $second = (int)$match[2];
        return $first > 12
            ? sprintf('%04d-%02d-%02d', (int)$match[3], $second, $first)
            : sprintf('%04d-%02d-%02d', (int)$match[3], $first, $second);
    }
    return substr($clean, 0, 10);
}

function dashboard_event_date(array $item): string
{
    foreach (['date', 'createdAt', 'registeredAt', 'last'] as $key) {
        $date = dashboard_date((string)($item[$key] ?? ''));
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1) return $date;
    }
    return '';
}

function dashboard_month(string $date): string
{
    return preg_match('/^\d{4}-\d{2}/', $date) === 1 ? substr($date, 0, 7) : '';
}

function dashboard_scope_key(string $month, string $salon): string
{
    return $month . '|' . ($salon !== '' ? $salon : 'all');
}

function dashboard_number(mixed $value): float
{
    return is_numeric($value) ? (float)$value : 0.0;
}

function dashboard_payment_label(string $value): string
{
    $normalized = strtolower(trim(preg_replace('/\s+/', '_', $value) ?? ''));
    return [
        'card' => 'Карт', 'qpay' => 'QPay', 'transfer' => 'Данс', 'cash' => 'Бэлэн',
        'loan_app' => 'Зээлийн апп', 'bonus' => 'Бонус', 'voucher' => 'Ваучер',
        'gift_card' => 'Бэлгийн карт', 'salary' => 'Цалингаас суутгах',
        'customer_credit' => 'Шилжүүлсэн үлдэгдлээс', 'credit_transfer' => 'Шилжүүлэх / хаах',
    ][$normalized] ?? ($value !== '' ? $value : 'Тодорхойгүй');
}

function dashboard_actual_payment(string $method): bool
{
    $normalized = strtolower(trim(preg_replace('/\s+/', '_', $method) ?? ''));
    return !in_array($normalized, [
        'bonus', 'gift_card', 'customer_credit', 'credit_transfer',
        'бонус', 'бэлгийн_карт', 'шилжүүлсэн_үлдэгдлээс',
    ], true);
}

function dashboard_service_name(array $item): string
{
    $products = is_array($item['products'] ?? null) ? $item['products'] : [];
    if ($products !== []) {
        $names = [];
        foreach ($products as $product) {
            if (!is_array($product)) continue;
            $names[] = trim((string)($product['name'] ?? $product['product'] ?? 'Бүтээгдэхүүн')) ?: 'Бүтээгдэхүүн';
        }
        if ($names !== []) return implode(', ', $names);
    }
    return trim((string)($item['service'] ?? $item['title'] ?? 'Үйлчилгээ')) ?: 'Үйлчилгээ';
}

function dashboard_service_total(array $item): float
{
    if (($item['kind'] ?? '') !== 'course') return dashboard_number($item['price'] ?? $item['total'] ?? 0);
    $vip = 0.0;
    $master = 0.0;
    foreach ((is_array($item['visits'] ?? null) ? $item['visits'] : []) as $visit) {
        if (!is_array($visit)) continue;
        $vip += dashboard_number($visit['vipRoomFee'] ?? 0);
        $master += dashboard_number($visit['masterStaffFee'] ?? 0);
    }
    return max(0, dashboard_number($item['basePrice'] ?? $item['price'] ?? $item['total'] ?? 0)
        + $vip + $master - dashboard_number($item['employeeDiscountAmount'] ?? 0));
}

function dashboard_paid_amount(array $item): float
{
    $payments = is_array($item['payments'] ?? null) ? $item['payments'] : [];
    if ($payments !== []) {
        $sum = 0.0;
        foreach ($payments as $payment) {
            if (!is_array($payment)) continue;
            $amount = dashboard_number($payment['amount'] ?? 0);
            $sum += $amount ?: dashboard_number($payment['paidAmount'] ?? 0);
        }
        return $sum;
    }
    return max(0, dashboard_service_total($item) - dashboard_number($item['balance'] ?? 0));
}

function dashboard_empty_snapshot(): array
{
    return [
        'revenue' => 0, 'serviceRevenue' => 0, 'payments' => 0, 'visits' => 0,
        'products' => 0, 'newCustomers' => 0, 'outstanding' => 0, 'completion' => 0, 'occupancy' => 0,
    ];
}

function dashboard_add_number(array &$map, string $key, float $value): void
{
    $map[$key] = dashboard_number($map[$key] ?? 0) + $value;
}

function dashboard_age(array $customer, int $year): int
{
    $age = (int)($customer['age'] ?? 0);
    if ($age > 0) return $age;
    $birthYear = (int)($customer['birthYear'] ?? 0);
    return $birthYear > 1900 ? max(0, $year - $birthYear) : 0;
}

function dashboard_periods(string $month, bool $includeTotal): array
{
    $periods = $month !== '' ? [$month] : [];
    if ($includeTotal) $periods[] = 'all';
    return array_values(array_unique($periods));
}

function dashboard_minutes(string $value): int
{
    $parts = array_map('intval', explode(':', $value));
    return (($parts[0] ?? 0) * 60) + ($parts[1] ?? 0);
}

function dashboard_holiday_closed(array $holidays, string $salon, string $date): bool
{
    foreach ($holidays as $holiday) {
        if (!is_array($holiday) || trim((string)($holiday['date'] ?? '')) !== $date) continue;
        $singleSalon = trim((string)($holiday['salon'] ?? ''));
        $scope = $holiday['salons'] ?? null;
        if ($singleSalon !== '' && ($singleSalon === $salon || $singleSalon === '*')) return true;
        if ($singleSalon === '' && is_array($scope) && (in_array($salon, $scope, true) || in_array('*', $scope, true))) return true;
    }
    return false;
}

function dashboard_month_capacity(array $salon, array $holidays, string $month, DateTimeImmutable $today): int
{
    if (preg_match('/^\d{4}-\d{2}$/', $month) !== 1) return 0;
    $timezone = new DateTimeZone('Asia/Ulaanbaatar');
    $start = new DateTimeImmutable($month . '-01', $timezone);
    if ($start > $today) return 0;
    $end = $start->modify('last day of this month');
    if ($end > $today) $end = $today;
    $schedule = is_array($salon['schedule'] ?? null) ? $salon['schedule'] : [];
    $duration = max(5, (int)($schedule['duration'] ?? 30));
    $capacity = max(1, (int)($salon['slotCapacity'] ?? 1));
    $salonName = trim((string)($salon['name'] ?? ''));
    $total = 0;
    for ($date = $start; $date <= $end; $date = $date->modify('+1 day')) {
        $dateText = $date->format('Y-m-d');
        if (dashboard_holiday_closed($holidays, $salonName, $dateText)) continue;
        $weekend = in_array((int)$date->format('w'), [0, 6], true);
        $open = dashboard_minutes((string)($schedule[$weekend ? 'weekendStart' : 'workStart'] ?? ($weekend ? '10:00' : '09:00')));
        $close = dashboard_minutes((string)($schedule[$weekend ? 'weekendEnd' : 'workEnd'] ?? '19:00'));
        $latest = $close - 120;
        if ($latest < $open) continue;
        $slotTimes = intdiv($latest - $open, $duration) + 1;
        $total += $slotTimes * $capacity;
    }
    return $total;
}

function dashboard_total_capacity(array $salons, array $holidays, array $firstBookingMonths, string $scope, DateTimeImmutable $today): int
{
    $total = 0;
    foreach ($salons as $salon) {
        if (!is_array($salon)) continue;
        $name = trim((string)($salon['name'] ?? ''));
        if ($scope !== '' && $name !== $scope) continue;
        $firstMonth = trim((string)($firstBookingMonths[$name] ?? ''));
        if (preg_match('/^\d{4}-\d{2}$/', $firstMonth) !== 1) continue;
        $cursor = new DateTimeImmutable($firstMonth . '-01', new DateTimeZone('Asia/Ulaanbaatar'));
        $lastMonth = new DateTimeImmutable($today->format('Y-m') . '-01', new DateTimeZone('Asia/Ulaanbaatar'));
        for (; $cursor <= $lastMonth; $cursor = $cursor->modify('+1 month')) {
            $total += dashboard_month_capacity($salon, $holidays, $cursor->format('Y-m'), $today);
        }
    }
    return $total;
}

$today = new DateTimeImmutable('today', new DateTimeZone('Asia/Ulaanbaatar'));
$requestedPeriod = trim((string)($_GET['month'] ?? ''));
$isTotal = $requestedPeriod === 'all';
$requestedMonth = preg_match('/^\d{4}-\d{2}$/', $requestedPeriod) === 1
    ? $requestedPeriod
    : $today->format('Y-m');
$requestedSalon = trim((string)($_GET['salon'] ?? ''));
$salon = ($user['role'] ?? '') === 'salon' ? trim((string)($user['salon'] ?? '')) : $requestedSalon;
$monthStart = new DateTimeImmutable($requestedMonth . '-01', new DateTimeZone('Asia/Ulaanbaatar'));
$fromMonth = $monthStart->modify('-5 months')->format('Y-m');
$toMonth = $requestedMonth;

$keys = ['customers', 'customerGroups', 'bookings', 'holidays', 'staff', 'assignments', 'salons'];
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

$allSalons = array_values(array_filter((array)$source['salons'], 'is_array'));
if (($user['role'] ?? '') === 'salon') {
    $allSalons = array_values(array_filter($allSalons, static fn(array $item): bool => trim((string)($item['name'] ?? '')) === $salon));
}
$salonNames = array_values(array_filter(array_map(static fn(array $item): string => trim((string)($item['name'] ?? '')), $allSalons)));
$scopes = [''];
foreach ($salonNames as $name) $scopes[] = $name;
if ($salon !== '') $scopes = [$salon];

$monthsFound = [$today->format('Y-m') => true, $requestedMonth => true];
$monthKeys = [];
for ($cursor = $monthStart->modify('-5 months'); $cursor <= $monthStart; $cursor = $cursor->modify('+1 month')) {
    $monthKeys[] = $cursor->format('Y-m');
}
if ($isTotal) $monthKeys[] = 'all';

$snapshots = [];
$serviceCounts = [];
$paymentTotals = [];
$sourceTotals = [];
$topServices = [];
$bookingCounts = [];
$firstBookingMonths = [];
foreach ($monthKeys as $monthKey) {
    foreach ($scopes as $scope) {
        $key = dashboard_scope_key($monthKey, $scope);
        $snapshots[$key] = dashboard_empty_snapshot();
        $serviceCounts[$key] = ['course' => 0, 'single' => 0, 'kass' => 0, 'diagnosis' => 0];
        $paymentTotals[$key] = [];
        $sourceTotals[$key] = ['single' => 0, 'course' => 0, 'product' => 0];
        $topServices[$key] = [];
        $bookingCounts[$key] = ['total' => 0, 'active' => 0, 'confirmed' => 0, 'occupied' => 0];
    }
}

$activeCustomers = 0;
$deletedCustomers = 0;
$activeCourses = 0;
$bonusBalance = 0.0;
$activeTreatmentsBySalon = [];
$phoneCounts = [];
$genderCounts = ['Эмэгтэй' => 0, 'Эрэгтэй' => 0, 'Мэдээлэлгүй' => 0];
$ageCounts = ['18–24' => 0, '25–34' => 0, '35–44' => 0, '45–54' => 0, '55+' => 0];
$districtCounts = [];
$serviceHistoryCount = 0;
$paymentCount = 0;
$unpaidCustomers = 0;

foreach ((array)$source['customers'] as $customer) {
    if (!is_array($customer)) continue;
    if ($salon !== '') {
        $customerSalon = trim((string)($customer['registeredSalon'] ?? $customer['salon'] ?? ''));
        $currentSalon = is_array($customer['currentTreatment'] ?? null)
            ? trim((string)($customer['currentTreatment']['salon'] ?? $customer['currentTreatment']['branch'] ?? ''))
            : '';
        $customerInScope = $customerSalon === $salon || $currentSalon === $salon;
        if (!$customerInScope) {
            foreach ((is_array($customer['serviceHistory'] ?? null) ? $customer['serviceHistory'] : []) as $scopeItem) {
                if (!is_array($scopeItem)) continue;
                if (trim((string)($scopeItem['salon'] ?? $scopeItem['branch'] ?? '')) === $salon) {
                    $customerInScope = true;
                    break;
                }
            }
        }
        if (!$customerInScope) continue;
    }
    $isDeleted = !empty($customer['deleted']) || !empty($customer['deletedAt']);
    if ($isDeleted) {
        $deletedCustomers++;
    } else {
        $activeCustomers++;
        if (!empty($customer['unpaid'])) $unpaidCustomers++;
        $phone = trim((string)($customer['phone'] ?? ''));
        if ($phone !== '') $phoneCounts[$phone] = (int)($phoneCounts[$phone] ?? 0) + 1;
        $gender = trim((string)($customer['gender'] ?? ''));
        $genderCounts[array_key_exists($gender, $genderCounts) ? $gender : 'Мэдээлэлгүй']++;
        $age = dashboard_age($customer, (int)$today->format('Y'));
        if ($age >= 18 && $age <= 24) $ageCounts['18–24']++;
        elseif ($age >= 25 && $age <= 34) $ageCounts['25–34']++;
        elseif ($age >= 35 && $age <= 44) $ageCounts['35–44']++;
        elseif ($age >= 45 && $age <= 54) $ageCounts['45–54']++;
        elseif ($age >= 55) $ageCounts['55+']++;
        $district = trim((string)($customer['district'] ?? '')) ?: 'Мэдээлэлгүй';
        $districtCounts[$district] = (int)($districtCounts[$district] ?? 0) + 1;
        $bonusBalance += dashboard_number($customer['balance'] ?? 0);
        if (is_array($customer['currentTreatment'] ?? null)) {
            $treatmentSalon = trim((string)($customer['currentTreatment']['salon'] ?? $customer['currentTreatment']['branch'] ?? $customer['salon'] ?? ''));
            $activeTreatmentsBySalon[$treatmentSalon] = (int)($activeTreatmentsBySalon[$treatmentSalon] ?? 0) + 1;
        }

        $registeredDate = dashboard_event_date($customer);
        $registeredMonth = dashboard_month($registeredDate);
        if ($registeredMonth !== '') $monthsFound[$registeredMonth] = true;
        $registeredSalon = trim((string)($customer['registeredSalon'] ?? $customer['salon'] ?? ''));
        foreach (dashboard_periods($registeredMonth, $isTotal) as $period) {
            if (isset($snapshots[dashboard_scope_key($period, '')])) $snapshots[dashboard_scope_key($period, '')]['newCustomers']++;
            if ($registeredSalon !== '' && isset($snapshots[dashboard_scope_key($period, $registeredSalon)])) $snapshots[dashboard_scope_key($period, $registeredSalon)]['newCustomers']++;
        }
    }

    $hasActiveCourse = !$isDeleted && !empty($customer['activeCourse']);
    foreach ((is_array($customer['serviceHistory'] ?? null) ? $customer['serviceHistory'] : []) as $item) {
        if (!is_array($item)) continue;
        $serviceHistoryCount++;
        $includeOperationalData = !$isDeleted && empty($item['deleted']);
        if ($includeOperationalData && ($item['kind'] ?? '') === 'course' && empty($item['completed'])) $hasActiveCourse = true;
        $itemSalon = trim((string)($item['salon'] ?? $item['branch'] ?? $customer['salon'] ?? ''));
        $itemDate = dashboard_event_date($item);
        $itemMonth = dashboard_month($itemDate);
        if ($itemMonth !== '') $monthsFound[$itemMonth] = true;
        $targetScopes = [''];
        if ($itemSalon !== '') $targetScopes[] = $itemSalon;

        $kind = (string)($item['kind'] ?? 'single');
        if ($includeOperationalData) {
            foreach ($targetScopes as $scope) {
              foreach (dashboard_periods($itemMonth, $isTotal) as $period) {
                $key = dashboard_scope_key($period, $scope);
                if (!isset($snapshots[$key])) continue;
                $snapshots[$key]['outstanding'] += max(0, dashboard_number($item['balance'] ?? 0));
              }
            }
        }

        if ($includeOperationalData && $kind === 'course') {
            foreach ((is_array($item['visits'] ?? null) ? $item['visits'] : []) as $visit) {
                if (!is_array($visit) || !empty($visit['deleted'])) continue;
                $visitDate = dashboard_event_date($visit) ?: $itemDate;
                $visitMonth = dashboard_month($visitDate);
                if ($visitMonth !== '') $monthsFound[$visitMonth] = true;
                $visitSalon = trim((string)($visit['salon'] ?? $itemSalon));
                foreach (array_values(array_unique(['', $visitSalon])) as $scope) {
                    foreach (dashboard_periods($visitMonth, $isTotal) as $period) {
                        $key = dashboard_scope_key($period, $scope);
                        if (isset($serviceCounts[$key])) $serviceCounts[$key]['course']++;
                    }
                }
            }
        } elseif ($includeOperationalData && in_array($kind, ['kass', 'product'], true)) {
            $qty = 0;
            foreach ((is_array($item['products'] ?? null) ? $item['products'] : []) as $product) {
                if (!is_array($product)) continue;
                $qty += max(1, (int)($product['qty'] ?? $product['quantity'] ?? 1));
            }
            $qty = $qty ?: 1;
            foreach ($targetScopes as $scope) {
                foreach (dashboard_periods($itemMonth, $isTotal) as $period) {
                    $key = dashboard_scope_key($period, $scope);
                    if (isset($serviceCounts[$key])) $serviceCounts[$key]['kass'] += $qty;
                }
            }
        } elseif ($includeOperationalData) {
            foreach ($targetScopes as $scope) {
                foreach (dashboard_periods($itemMonth, $isTotal) as $period) {
                    $key = dashboard_scope_key($period, $scope);
                    if (isset($serviceCounts[$key])) $serviceCounts[$key]['single']++;
                }
            }
        }
        if ($includeOperationalData) {
            foreach ((is_array($item['diagnosisHistory'] ?? null) ? $item['diagnosisHistory'] : []) as $diagnosis) {
                if (!is_array($diagnosis)) continue;
                $diagnosisMonth = dashboard_month(dashboard_event_date($diagnosis));
                foreach ($targetScopes as $scope) {
                    foreach (dashboard_periods($diagnosisMonth, $isTotal) as $period) {
                        $key = dashboard_scope_key($period, $scope);
                        if (isset($serviceCounts[$key])) $serviceCounts[$key]['diagnosis']++;
                    }
                }
            }
        }

        $payments = is_array($item['payments'] ?? null) ? $item['payments'] : [];
        $paymentRows = [];
        if ($payments !== []) {
            foreach ($payments as $payment) {
                if (!is_array($payment)) continue;
                $amount = dashboard_number($payment['paidAmount'] ?? 0) ?: dashboard_number($payment['amount'] ?? 0);
                if ($amount <= 0) continue;
                $paymentRows[] = [
                    'date' => dashboard_event_date($payment) ?: $itemDate,
                    'method' => (string)($payment['method'] ?? 'card'),
                    'amount' => $amount,
                ];
            }
        } else {
            $paid = dashboard_paid_amount($item);
            if ($paid > 0) $paymentRows[] = ['date' => $itemDate, 'method' => (string)($item['paymentMethod'] ?? 'card'), 'amount' => $paid];
        }
        $serviceName = dashboard_service_name($item);
        $sourceKind = $kind === 'course' ? 'course' : (in_array($kind, ['kass', 'product'], true) ? 'product' : 'single');
        foreach ($paymentRows as $paymentRow) {
            $paymentCount++;
            $paymentMonth = dashboard_month($paymentRow['date']);
            if ($paymentMonth !== '') $monthsFound[$paymentMonth] = true;
            foreach ($targetScopes as $scope) {
              foreach (dashboard_periods($paymentMonth, $isTotal) as $period) {
                $key = dashboard_scope_key($period, $scope);
                if (!isset($snapshots[$key])) continue;
                dashboard_add_number($sourceTotals[$key], $sourceKind, $paymentRow['amount']);
                if (!dashboard_actual_payment($paymentRow['method'])) continue;
                $snapshots[$key]['revenue'] += $paymentRow['amount'];
                if ($sourceKind !== 'product') $snapshots[$key]['serviceRevenue'] += $paymentRow['amount'];
                $snapshots[$key]['payments']++;
                if ($sourceKind === 'product') $snapshots[$key]['products'] += $paymentRow['amount'];
                $label = dashboard_payment_label($paymentRow['method']);
                dashboard_add_number($paymentTotals[$key], $label, $paymentRow['amount']);
                if (!isset($topServices[$key][$serviceName])) $topServices[$key][$serviceName] = ['name' => $serviceName, 'count' => 0, 'revenue' => 0];
                $topServices[$key][$serviceName]['count']++;
                $topServices[$key][$serviceName]['revenue'] += $paymentRow['amount'];
              }
            }
        }
    }
    if ($hasActiveCourse) $activeCourses++;
}

foreach ((array)$source['bookings'] as $booking) {
    if (!is_array($booking)) continue;
    $date = dashboard_event_date($booking);
    $month = dashboard_month($date);
    if ($month !== '') $monthsFound[$month] = true;
    $bookingSalon = trim((string)($booking['salon'] ?? ''));
    if ($month !== '' && $bookingSalon !== '' && (!isset($firstBookingMonths[$bookingSalon]) || $month < $firstBookingMonths[$bookingSalon])) {
        $firstBookingMonths[$bookingSalon] = $month;
    }
    $bookingIsPastOrToday = $date !== '' && $date <= $today->format('Y-m-d');
    foreach (array_values(array_unique(['', $bookingSalon])) as $scope) {
        foreach (dashboard_periods($month, $isTotal) as $period) {
            $key = dashboard_scope_key($period, $scope);
            if (!isset($bookingCounts[$key])) continue;
            $bookingCounts[$key]['total']++;
            if (!in_array((string)($booking['status'] ?? ''), ['cancelled', 'rejected'], true)) $bookingCounts[$key]['active']++;
            if (($booking['status'] ?? '') === 'confirmed') $bookingCounts[$key]['confirmed']++;
            if ($bookingIsPastOrToday && !in_array((string)($booking['status'] ?? ''), ['cancelled', 'rejected'], true)) $bookingCounts[$key]['occupied']++;
        }
    }
}

$serviceTemplates = [
    'course' => ['name' => 'Курс эмчилгээ', 'key' => 'course', 'color' => '#60bf63'],
    'single' => ['name' => 'Нэг удаагийн үйлчилгээ', 'key' => 'single', 'color' => '#91cf86'],
    'kass' => ['name' => 'Касс бүтээгдэхүүн', 'key' => 'kass', 'color' => '#bfdcae'],
    'diagnosis' => ['name' => 'Оношилгоо', 'key' => 'diagnosis', 'color' => '#dfe9d7'],
];
$paymentColors = ['#60bf63', '#87c77e', '#b7d9aa', '#dfe9d7', '#9bcf91', '#c9dfbd', '#76b96f'];
$serviceRows = [];
$paymentRows = [];
$topRows = [];
foreach ($snapshots as $key => &$snapshot) {
    [$period, $scopeToken] = array_pad(explode('|', $key, 2), 2, 'all');
    $scopeName = $scopeToken === 'all' ? '' : $scopeToken;
    $counts = $bookingCounts[$key] ?? ['total' => 0, 'active' => 0, 'confirmed' => 0, 'occupied' => 0];
    $snapshot['completion'] = $counts['active'] ? (int)round($counts['confirmed'] / $counts['active'] * 100) : 0;
    $availableCapacity = $period === 'all'
        ? dashboard_total_capacity($allSalons, (array)$source['holidays'], $firstBookingMonths, $scopeName, $today)
        : array_sum(array_map(
            static fn(array $item): int => dashboard_month_capacity($item, (array)$source['holidays'], $period, $today),
            array_values(array_filter($allSalons, static fn(array $item): bool => $scopeName === '' || trim((string)($item['name'] ?? '')) === $scopeName))
        ));
    $snapshot['occupancy'] = $availableCapacity ? min(100, (int)round($counts['occupied'] / $availableCapacity * 100)) : 0;
    $countMap = $serviceCounts[$key] ?? [];
    $snapshot['visits'] = (int)($countMap['course'] ?? 0) + (int)($countMap['single'] ?? 0) + (int)($countMap['diagnosis'] ?? 0);
    $serviceTotal = $snapshot['visits'];
    $serviceRows[$key] = [];
    foreach ($serviceTemplates as $kind => $template) {
        $count = (int)($countMap[$kind] ?? 0);
        $serviceRows[$key][] = $template + ['count' => $count, 'share' => $serviceTotal ? (int)round($count / $serviceTotal * 100) : 0];
    }
    arsort($paymentTotals[$key]);
    $paymentTotal = array_sum($paymentTotals[$key]);
    $paymentRows[$key] = [];
    $colorIndex = 0;
    foreach ($paymentTotals[$key] as $name => $amount) {
        $paymentRows[$key][] = [
            'name' => $name, 'amount' => $amount,
            'share' => $paymentTotal ? (int)round($amount / $paymentTotal * 100) : 0,
            'color' => $paymentColors[$colorIndex++ % count($paymentColors)],
        ];
    }
    $rows = array_values($topServices[$key]);
    usort($rows, static fn(array $a, array $b): int => dashboard_number($b['revenue']) <=> dashboard_number($a['revenue']));
    $topRows[$key] = array_slice($rows, 0, 8);
}
unset($snapshot);

$todayText = $today->format('Y-m-d');
$todayBookings = [];
foreach ((array)$source['bookings'] as $booking) {
    if (!is_array($booking) || dashboard_event_date($booking) !== $todayText) continue;
    $bookingSalon = trim((string)($booking['salon'] ?? ''));
    if ($salon !== '' && $bookingSalon !== $salon) continue;
    $todayBookings[] = [
        'status' => (string)($booking['status'] ?? ''),
        'time' => (string)($booking['time'] ?? ''),
        'salon' => $bookingSalon,
    ];
}
$statusCounts = ['confirmed' => 0, 'pending' => 0, 'missed' => 0, 'cancelled' => 0];
foreach ($todayBookings as $booking) {
    $status = $booking['status'];
    if (array_key_exists($status, $statusCounts)) $statusCounts[$status]++;
}
$slotCounts = [];
foreach (['09', '11', '13', '15', '17', '19'] as $hour) $slotCounts[$hour . ':00'] = 0;
foreach ($todayBookings as $booking) {
    $hour = substr($booking['time'], 0, 2) . ':00';
    if (array_key_exists($hour, $slotCounts)) $slotCounts[$hour]++;
}
$workingStaff = count(array_filter((array)$source['staff'], static function ($item) use ($salon): bool {
    return is_array($item) && ($item['status'] ?? '') !== 'inactive' && ($salon === '' || trim((string)($item['salon'] ?? '')) === $salon);
}));
$activeAssignments = count(array_filter((array)$source['assignments'], static function ($item) use ($salon, $todayText): bool {
    return is_array($item) && ($item['status'] ?? '') !== 'cancelled'
        && trim((string)($item['startDate'] ?? '')) <= $todayText
        && trim((string)($item['endDate'] ?? '')) >= $todayText
        && ($salon === '' || trim((string)($item['to'] ?? '')) === $salon);
}));
$activeTreatments = $salon !== '' ? (int)($activeTreatmentsBySalon[$salon] ?? 0) : array_sum($activeTreatmentsBySalon);
$activeGroups = ($user['role'] ?? '') === 'salon' ? 0 : count(array_filter((array)$source['customerGroups'], static fn($group): bool => is_array($group) && count(is_array($group['members'] ?? null) ? $group['members'] : []) > 0));
$duplicatePhones = count(array_filter($phoneCounts, static fn(int $count): bool => $count > 1));
$todayStartUtc = $today->setTime(0, 0)->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
$tomorrowStartUtc = $today->modify('+1 day')->setTime(0, 0)->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
$actionSql = 'SELECT COUNT(*) FROM app_write_log WHERE created_at >= ? AND created_at < ?';
$actionParams = [$todayStartUtc, $tomorrowStartUtc];
if (($user['role'] ?? '') === 'salon') {
    $actionSql .= ' AND actor_salon = ?';
    $actionParams[] = $salon;
}
$actionStatement = db()->prepare($actionSql);
$actionStatement->execute($actionParams);
$todayActions = (int)$actionStatement->fetchColumn();
$backupCount = (int)db()->query('SELECT COUNT(*) FROM app_backups')->fetchColumn();

$demographicItem = static function (string $name, int $value, string $color) use ($activeCustomers): array {
    return ['name' => $name, 'value' => $value, 'share' => $activeCustomers ? (int)round($value / $activeCustomers * 100) : 0, 'color' => $color];
};
$demographics = [
    'genders' => [
        $demographicItem('Эмэгтэй', $genderCounts['Эмэгтэй'], '#60bf63'),
        $demographicItem('Эрэгтэй', $genderCounts['Эрэгтэй'], '#9bcf91'),
        $demographicItem('Мэдээлэлгүй', $genderCounts['Мэдээлэлгүй'], '#dfe9d7'),
    ],
    'ages' => array_map(static fn(string $name, int $value): array => ['name' => $name, 'value' => $value], array_keys($ageCounts), array_values($ageCounts)),
    'districts' => array_map(static fn(string $name, int $value): array => ['name' => $name, 'value' => $value], array_keys($districtCounts), array_values($districtCounts)),
];

$months = array_keys($monthsFound);
rsort($months);
$summary = [
    'snapshots' => $snapshots,
    'serviceRows' => $serviceRows,
    'paymentRows' => $paymentRows,
    'sourceTotals' => $sourceTotals,
    'topServices' => $topRows,
    'demographics' => $demographics,
    'customerStats' => [
        'count' => $activeCustomers, 'activeGroups' => $activeGroups,
        'activeCourses' => $activeCourses, 'bonusBalance' => $bonusBalance,
    ],
    'operations' => [
        'bookings' => count($todayBookings), 'statusCounts' => $statusCounts,
        'slotCounts' => $slotCounts, 'activeTreatments' => $activeTreatments,
        'workingStaff' => $workingStaff, 'activeAssignments' => $activeAssignments,
        'unpaidCustomers' => $unpaidCustomers,
    ],
    'system' => [
        'todayActions' => $todayActions, 'deletedCustomers' => $deletedCustomers,
        'duplicatePhones' => $duplicatePhones, 'backupCount' => $backupCount,
        'serviceHistoryCount' => $serviceHistoryCount, 'paymentCount' => $paymentCount,
        'bookingCount' => count((array)$source['bookings']), 'groupCount' => count((array)$source['customerGroups']),
    ],
];

json_response([
    'ok' => true,
    'mode' => 'dashboard-summary',
    'month' => $isTotal ? 'all' : $requestedMonth,
    'salon' => $salon,
    'months' => $months,
    'salons' => $allSalons,
    'summary' => $summary,
    'sectionRevisions' => $revisions,
]);
