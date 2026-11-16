<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/booking-conflict.php';
$saved = ['id' => 1, 'date' => '2026-11-16', 'time' => '10:00', 'salon' => 'A', 'phone' => '99112233', 'status' => 'pending', 'source' => 'customer', 'slotCount' => 1];
foreach (['waiting', 'arrived', 'missed', 'unknown', 'excluded'] as $attendance) {
    $listed = $saved + ['attendance' => $attendance];
    if (!booking_snapshot_matches($saved, $listed)) throw new RuntimeException('Derived attendance falsely blocked a booking');
    if (!booking_snapshot_matches($listed, $saved)) throw new RuntimeException('Projection stripping must be symmetric');
    if (booking_persisted_snapshot($listed) !== $saved) throw new RuntimeException('Persisted fields changed');
}
foreach (['date' => '2026-11-17', 'time' => '11:00', 'salon' => 'B', 'phone' => '99112234', 'status' => 'cancelled', 'slotCount' => 2, 'futureSavedField' => 'new'] as $field => $value) {
    $updated = array_merge($saved, [$field => $value]);
    if (booking_snapshot_matches($updated, $saved + ['attendance' => 'waiting'])) throw new RuntimeException('Real concurrent change accepted: ' . $field);
}
$api = file_get_contents(__DIR__ . '/../api/bookings.php');
if (!str_contains($api, '!booking_snapshot_matches($current, $expected)')) throw new RuntimeException('Endpoint bypasses protected comparison');
if (substr_count($api, 'booking_snapshot_matches(') !== 1) throw new RuntimeException('All actions must share the comparison');
echo "booking-conflict-test: OK\n";
