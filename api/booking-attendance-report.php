<?php
declare(strict_types=1);
require_once __DIR__ . '/booking-attendance.php';

function booking_attendance_report(array $bookings, array $customers, string $from, string $to, string $salon, string $today): array
{
    $arrivals = [];
    // The dashboard already owns this authoritative source. Build one lookup,
    // not a customer scan or database request for each appointment.
    foreach ($customers as $customer) {
        if (!is_array($customer) || !empty($customer['deleted']) || !empty($customer['deletedAt'])) continue;
        $phone = preg_replace('/\D+/', '', (string)($customer['phone'] ?? '')) ?? '';
        if (!preg_match('/^\d{8}$/', $phone)) continue;
        foreach ((array)($customer['serviceHistory'] ?? []) as $service) {
            if (!is_array($service)) continue;
            $events = ($service['kind'] ?? '') === 'course' ? (array)($service['visits'] ?? []) : [null];
            foreach ($events as $visit) {
                if ($visit !== null && !is_array($visit)) continue;
                $event = booking_attendance_event($service, $visit);
                if (!$event || $event['date'] < $from || $event['date'] > $to || ($salon !== '' && $event['salon'] !== $salon)) continue;
                $arrivals[booking_attendance_key($phone, $event['date'], $event['salon'])] = true;
            }
        }
    }
    $empty = static fn(): array => ['total' => 0, 'arrived' => 0, 'missed' => 0, 'waiting' => 0, 'excluded' => 0, 'unknown' => 0];
    $totals = $empty();
    $branches = [];
    $months = [];
    $phones = [];
    $seen = [];
    foreach ($bookings as $booking) {
        if (!is_array($booking)) continue;
        $date = (string)($booking['date'] ?? '');
        $branch = trim((string)($booking['salon'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date < $from || $date > $to || ($salon !== '' && $branch !== $salon)) continue;
        $identity = json_encode([$booking['id'] ?? '', $branch, $date, $booking['time'] ?? '', $booking['phone'] ?? '']);
        if (isset($seen[$identity])) continue;
        $seen[$identity] = true;
        $status = booking_attendance_status($booking, $arrivals, $today);
        $month = substr($date, 0, 7);
        $branches[$branch] ??= ['name' => $branch] + $empty();
        $months[$month] ??= ['name' => $month] + $empty();
        $totals['total']++; $totals[$status]++;
        $branches[$branch]['total']++; $branches[$branch][$status]++;
        $months[$month]['total']++; $months[$month][$status]++;
        $phone = preg_replace('/\D+/', '', (string)($booking['phone'] ?? '')) ?? '';
        if (preg_match('/^\d{8}$/', $phone)) $phones[$phone] = true;
    }
    $finish = static function (array $row): array {
        $resolved = $row['arrived'] + $row['missed'];
        return $row + ['resolved' => $resolved,
            'arrivedPercent' => $resolved ? round($row['arrived'] / $resolved * 100, 1) : null,
            'missedPercent' => $resolved ? round($row['missed'] / $resolved * 100, 1) : null];
    };
    ksort($branches); krsort($months);
    return ['from' => $from, 'to' => $to, 'totals' => $finish($totals) + ['uniqueCustomers' => count($phones)],
        'byBranch' => array_values(array_map($finish, $branches)), 'byMonth' => array_values(array_map($finish, $months))];
}
