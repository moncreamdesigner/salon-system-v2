<?php
declare(strict_types=1);
require_once __DIR__ . '/booking-attendance.php';

// Reuse loaded history: one pass, no database requests or changes to payroll.
function dashboard_served_customers_today(array $customers, string $today, string $salon): int
{
    $served = [];
    foreach ($customers as $index => $customer) {
        if (!is_array($customer) || !empty($customer['deleted']) || !empty($customer['deletedAt'])) continue;
        foreach ((array)($customer['serviceHistory'] ?? []) as $service) {
            if (!is_array($service)) continue;
            $events = ($service['kind'] ?? '') === 'course' ? (array)($service['visits'] ?? []) : [null];
            foreach ($events as $visit) {
                if ($visit !== null && !is_array($visit)) continue;
                $event = booking_attendance_event($service, $visit);
                if ($event && $event['date'] === $today && ($salon === '' || $event['salon'] === $salon)) {
                    $key = $customer['id'] ?? $customer['phone'] ?? $index;
                    $served[(string)$key] = true;
                    continue 3;
                }
            }
        }
    }
    return count($served);
}
