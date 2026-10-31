<?php
declare(strict_types=1);
require __DIR__ . '/../api/event-storage.php';
function check_event(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
function rejects_event(callable $action): void {
    try { $action(); } catch (InvalidArgumentException | DomainException $error) { return; }
    throw new RuntimeException('Invalid event operation was accepted');
}
$input = ['id' => 'event-123', 'version' => 0, 'name' => 'Event test', 'startDate' => '2026-11-01', 'endDate' => '2026-11-30', 'registrations' => [['id' => 'forged']]];
$created = event_mutate(null, $input, 'save', 'admin', 'now');
check_event($created['registrations'] === [], 'Client must not overwrite registration records');
check_event(event_mutate($created, $input, 'save', 'admin', 'later') === $created, 'Retried creation must be idempotent');
$registered = $created;
$registered['registrations'] = [['customerId' => 12, 'cancelled' => true]];
rejects_event(fn() => event_mutate($registered, ['id' => 'event-123', 'version' => 1, 'registrations' => []], 'delete', 'admin', 'now'));
$edited = event_mutate($registered, array_merge($input, ['version' => 1, 'name' => 'Changed']), 'save', 'admin', 'later');
check_event($edited['registrations'] === $registered['registrations'], 'Editing must preserve all registrations');
check_event(event_public_row($edited)['registrationCount'] === 1, 'List must display registration count');
check_event(!array_key_exists('registrations', event_public_row($edited)), 'List must not leak personal registration data');
rejects_event(fn() => event_mutate($edited, array_merge($input, ['version' => 1]), 'save', 'admin', 'later'));
$deleted = event_mutate($created, ['version' => 1], 'delete', 'admin', 'now');
check_event(!empty($deleted['deletedAt']), 'Deletion must retain a recoverable tombstone');
rejects_event(fn() => event_mutate($deleted, $input, 'save', 'admin', 'later'));
rejects_event(fn() => event_fields(array_merge($input, ['endDate' => '2026-10-01'])));
rejects_event(fn() => event_fields(array_merge($input, ['startDate' => '2026-02-30'])));
rejects_event(fn() => event_fields(array_merge($input, ['name' => '  '])));
rejects_event(fn() => event_fields(array_merge($input, ['name' => str_repeat('Н', 201)])));
rejects_event(fn() => event_mutate(array_merge($created, ['registrations' => 'corrupt']), ['version' => 1], 'delete', 'admin', 'now'));

// A blank choice never registers everyone automatically.
$today = '2026-10-31';
$events = [$created, array_merge($created, ['id' => 'other', 'registrations' => []])];
$initial = event_membership_state($events, '12', $today);
check_event($initial['eventId'] === '', 'Unregistered customers must default to a blank choice');
check_event(event_assign_customer($events, '12', '', $initial['token'], 'Salon 1', 'admin', 'now', $today) === $events, 'Blank default must be a no-op');
$joined = event_assign_customer($events, '12', 'event-123', $initial['token'], 'Salon 1', 'admin', 'now', $today);
$membership = event_membership_state($joined, '12', $today);
check_event($membership['eventId'] === 'event-123', 'Explicit save must register the selected customer');
check_event(event_assign_customer($joined, '12', 'event-123', $initial['token'], 'Salon 1', 'admin', 'now', $today) === $joined, 'Network replay must not duplicate registrations');
rejects_event(fn() => event_mutate($joined[0], ['version' => $joined[0]['version']], 'delete', 'admin', 'now'));
rejects_event(fn() => event_assign_customer($joined, '12', '', $initial['token'], 'Salon 1', 'admin', 'now', $today));
// A different customer is independent: it does not invalidate customer 12's token.
$otherToken = event_membership_state($joined, '13', $today)['token'];
$joinedOther = event_assign_customer($joined, '13', 'event-123', $otherToken, 'Salon 2', 'admin', 'now', $today);
$switched = event_assign_customer($joinedOther, '12', 'other', $membership['token'], 'Salon 1', 'admin', 'later', $today);
check_event(event_membership_state($switched, '13', $today)['eventId'] === 'event-123', 'Changing one customer must preserve other customers');
check_event(event_public_row($switched[0])['registrationCount'] === 1, 'Switching removes only the old active registration');
$currentToken = event_membership_state($switched, '12', $today)['token'];
$cleared = event_assign_customer($switched, '12', '', $currentToken, 'Salon 1', 'admin', 'later', $today);
check_event(event_membership_state($cleared, '12', $today)['eventId'] === '', 'Saving blank must remove the current selection');
check_event(event_public_row($cleared[1])['registrationCount'] === 0 && event_public_row($cleared[1])['hasRegistrations'], 'Removal preserves registration history');
$ended = array_merge($created, ['id' => 'ended', 'startDate' => '2026-10-01', 'endDate' => '2026-10-30', 'registrations' => [['customerId' => '12', 'version' => 1, 'active' => true, 'salon' => 'Salon 1']]]);
$withHistory = array_merge($events, [$ended]);
$historyToken = event_membership_state($withHistory, '12', $today)['token'];
rejects_event(fn() => event_assign_customer($withHistory, '12', 'ended', $historyToken, 'Salon 1', 'admin', 'now', $today));
$historyJoined = event_assign_customer($withHistory, '12', 'other', $historyToken, 'Salon 1', 'admin', 'now', $today);
check_event($historyJoined[2]['registrations'] === $ended['registrations'], 'New events must not erase completed-event attendance');

// Monthly filters use overlap; branch scopes and unique customer totals differ
// from registration totals when one person participates in several events.
$overlap = array_merge($created, ['id' => 'overlap', 'startDate' => '2026-10-28', 'endDate' => '2026-11-03', 'registrations' => $joinedOther[0]['registrations']]);
$reportEvents = [$overlap, $joinedOther[0], $ended];
$report = event_dashboard_summary($reportEvents, 'month', '2026-11', '', '');
check_event($report['eventCount'] === 2 && $report['registrations'] === 4 && $report['customers'] === 2, 'Monthly events must count overlap and deduplicate customers');
$branchReport = event_dashboard_summary($reportEvents, 'single', '2026-11', 'overlap', 'Salon 2');
check_event($branchReport['eventCount'] === 1 && $branchReport['registrations'] === 1 && $branchReport['customers'] === 1, 'Single-event reports must honor branch filters');
$allReport = event_dashboard_summary($reportEvents, 'all', '2026-11', '', '');
check_event($allReport['eventCount'] === 3 && $allReport['registrations'] === 5, 'All-event reports must retain expired event data');
echo "events-test: OK\n";
