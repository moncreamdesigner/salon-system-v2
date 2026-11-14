<?php
declare(strict_types=1);
require_once __DIR__ . '/customer-entity-store.php';

function booking_attendance_key(string $phone, string $date, string $salon): string
{
    return json_encode([$phone, $date, trim($salon)], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}

function booking_attendance_event(array $service, ?array $visit = null): ?array
{
    if (!empty($service['deleted']) || !empty($service['deletedAt'])) return null;
    if ($visit !== null) {
        if (($service['kind'] ?? '') !== 'course' || !empty($visit['deleted']) || !empty($visit['deletedAt'])) return null;
        $event = $visit;
    } else {
        if (($service['kind'] ?? '') !== 'single' || !empty($service['prepaidPending'])) return null;
        $event = $service;
    }
    if (trim((string)($event['staff'] ?? '')) === '' && empty($event['staffId'])) return null;
    $date = (string)($event['date'] ?? '');
    $salon = trim((string)($event['performedSalon'] ?? $event['salon'] ?? $service['salon'] ?? ''));
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) && $salon !== '' ? ['date' => $date, 'salon' => $salon] : null;
}

function booking_attendance_status(array $booking, array $arrivals, string $today, bool $available = true): string
{
    if (in_array($booking['status'] ?? '', ['cancelled', 'rejected'], true)) return 'excluded';
    $date = (string)($booking['date'] ?? '');
    $phone = preg_replace('/\D+/', '', (string)($booking['phone'] ?? '')) ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{8}$/', $phone)) return 'unknown';
    if ($date > $today) return 'waiting';
    if (!$available) return 'unknown';
    if (isset($arrivals[booking_attendance_key($phone, $date, (string)($booking['salon'] ?? ''))])) return 'arrived';
    return $date < $today ? 'missed' : 'waiting';
}

function booking_list_with_attendance(PDO $pdo, array $items, string $today): array
{
    // A read-only projection of saved service/visit history: no booking writes,
    // no full customer JSON, no per-row request, and no salary/slot changes.
    $phones = [];
    $dates = [];
    foreach ($items as $item) {
        if (in_array($item['status'] ?? '', ['cancelled', 'rejected'], true) || ($item['date'] ?? '') > $today) continue;
        $phone = preg_replace('/\D+/', '', (string)($item['phone'] ?? '')) ?? '';
        if (!preg_match('/^\d{8}$/', $phone) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($item['date'] ?? ''))) continue;
        $phones[$phone] = true;
        $dates[(string)$item['date']] = true;
    }
    $arrivals = [];
    $available = !$phones || entity_projection_ready($pdo);
    if ($phones && $available) {
        $phoneParams = implode(',', array_fill(0, count($phones), '?'));
        $dateParams = implode(',', array_fill(0, count($dates), '?'));
        $params = array_merge(array_keys($phones), array_keys($dates));
        $single = $pdo->prepare("SELECT c.phone, s.payload FROM app_customer_entities c JOIN app_service_entities s ON s.customer_id = c.customer_id WHERE c.archived = 0 AND c.phone IN ($phoneParams) AND s.kind = 'single' AND s.service_date IN ($dateParams)");
        $single->execute($params);
        while ($row = $single->fetch()) {
            $service = json_decode((string)$row['payload'], true);
            $event = is_array($service) ? booking_attendance_event($service) : null;
            if ($event) $arrivals[booking_attendance_key((string)$row['phone'], $event['date'], $event['salon'])] = true;
        }
        $visits = $pdo->prepare("SELECT c.phone, s.payload AS service_payload, v.payload AS visit_payload FROM app_customer_entities c JOIN app_visit_entities v ON v.customer_id = c.customer_id JOIN app_service_entities s ON s.customer_id = v.customer_id AND s.service_id = v.service_id WHERE c.archived = 0 AND c.phone IN ($phoneParams) AND v.visit_date IN ($dateParams)");
        $visits->execute($params);
        while ($row = $visits->fetch()) {
            $service = json_decode((string)$row['service_payload'], true);
            $visit = json_decode((string)$row['visit_payload'], true);
            $event = is_array($service) && is_array($visit) ? booking_attendance_event($service, $visit) : null;
            if ($event) $arrivals[booking_attendance_key((string)$row['phone'], $event['date'], $event['salon'])] = true;
        }
    }
    foreach ($items as &$item) $item['attendance'] = booking_attendance_status($item, $arrivals, $today, $available);
    unset($item);
    return $items;
}
