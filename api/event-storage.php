<?php
declare(strict_types=1);

function event_fields(array $input): array
{
    $name = trim((string)($input['name'] ?? ''));
    if ($name === '' || preg_match('/^.{1,200}$/us', $name) !== 1) throw new InvalidArgumentException('Арга хэмжээний нэрийг оруулна уу (200 хүртэл тэмдэгт).');
    $dates = [];
    foreach (['startDate', 'endDate'] as $key) {
        $value = (string)($input[$key] ?? '');
        if ($key === 'endDate' && $value === '') { $dates[$key] = ''; continue; }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) throw new InvalidArgumentException('Эхлэх, дуусах огноог зөв оруулна уу.');
        $dates[$key] = $value;
    }
    if ($dates['endDate'] !== '' && $dates['endDate'] < $dates['startDate']) throw new InvalidArgumentException('Дуусах огноо эхлэх огнооноос өмнө байж болохгүй.');
    return ['name' => $name] + $dates;
}

function event_has_ended(array $event, string $today): bool
{
    return !empty($event['endDate']) && $event['endDate'] < $today;
}

function event_registration_count(array $event): int
{
    // Registrations are server-owned. Count all records, including cancelled
    // registrations: an event with registration history cannot be removed.
    if (isset($event['registrations']) && !is_array($event['registrations'])) throw new DomainException('Арга хэмжээний бүртгэлийн мэдээллийг шалгах шаардлагатай байна.');
    return count($event['registrations'] ?? []);
}

function event_public_row(array $event): array
{
    return array_intersect_key($event, array_flip(['id', 'name', 'startDate', 'endDate', 'version']))
        + ['registrationCount' => count(array_filter($event['registrations'] ?? [], 'event_registration_active')),
           'hasRegistrations' => event_registration_count($event) > 0];
}

function event_registration_active(array $registration): bool
{
    return ($registration['active'] ?? true) !== false && empty($registration['removedAt']);
}

function event_membership_state(array $events, string $customerId, string $today): array
{
    $versions = [];
    $selected = [];
    foreach ($events as $event) {
        foreach (($event['registrations'] ?? []) as $registration) {
            if ((string)($registration['customerId'] ?? '') !== $customerId) continue;
            $versions[] = [$event['id'], (int)($registration['version'] ?? 0), event_registration_active($registration)];
            if (empty($event['deletedAt']) && !event_has_ended($event, $today) && event_registration_active($registration)) $selected[] = $event;
        }
    }
    usort($selected, static fn(array $a, array $b): int => strcmp($b['startDate'] . $b['id'], $a['startDate'] . $a['id']));
    sort($versions);
    return ['eventId' => $selected[0]['id'] ?? '', 'token' => hash('sha256', json_encode($versions, JSON_THROW_ON_ERROR))];
}

function event_assign_customer(array $events, string $customerId, string $eventId, string $token, string $salon, string $actor, string $now, string $today): array
{
    $state = event_membership_state($events, $customerId, $today);
    if (!hash_equals($state['token'], $token)) {
        if ($state['eventId'] === $eventId) return $events; // successful replay
        throw new DomainException('Энэ хүний арга хэмжээний бүртгэл өөрчлөгдсөн байна. Шинэчлээд дахин оролдоно уу.');
    }
    if ($eventId !== '') {
        $target = array_values(array_filter($events, static fn(array $event): bool => $event['id'] === $eventId && empty($event['deletedAt']) && !event_has_ended($event, $today)));
        if ($target === []) throw new DomainException('Арга хэмжээ дууссан эсвэл устгагдсан байна. Өөр арга хэмжээ сонгоно уу.');
    }
    foreach ($events as &$event) {
        // Completed events retain their historical attendance when a customer
        // joins a new event. A blank choice only clears their current selection.
        if (!empty($event['deletedAt']) || event_has_ended($event, $today)) continue;
        $changed = false;
        $found = false;
        foreach ($event['registrations'] as &$registration) {
            if ((string)($registration['customerId'] ?? '') !== $customerId) continue;
            $found = true;
            $active = $event['id'] === $eventId;
            if (event_registration_active($registration) === $active) continue;
            $registration['active'] = $active;
            $registration['version'] = (int)($registration['version'] ?? 0) + 1;
            $registration['updatedAt'] = $now;
            $registration['updatedBy'] = $actor;
            if ($active) { unset($registration['removedAt']); $registration['salon'] = $salon; }
            else $registration['removedAt'] = $now;
            $changed = true;
        }
        unset($registration);
        if (!$found && $event['id'] === $eventId) {
            $event['registrations'][] = ['customerId' => $customerId, 'active' => true, 'version' => 1, 'salon' => $salon, 'registeredAt' => $now, 'createdBy' => $actor];
            $changed = true;
        }
        if ($changed) $event['version'] = (int)$event['version'] + 1;
    }
    unset($event);
    return $events;
}

function event_dashboard_summary(array $events, string $mode, string $month, string $eventId, string $salon): array
{
    $result = []; $unique = []; $salons = []; $total = 0;
    foreach ($events as $event) {
        if (!empty($event['deletedAt'])) continue;
        if ($mode === 'single' && $event['id'] !== $eventId) continue;
        // Include events overlapping the selected month, not only those starting
        // in it (e.g. an Oct 28-Nov 3 event appears in both months).
        if ($mode === 'month') {
            $first = $month . '-01';
            $last = (new DateTimeImmutable($first))->format('Y-m-t');
            if (event_has_ended($event, $first) || $event['startDate'] > $last) continue;
        }
        $count = 0;
        foreach (($event['registrations'] ?? []) as $registration) {
            if (!event_registration_active($registration)) continue;
            $branch = (string)($registration['salon'] ?? '—');
            if ($salon !== '' && $branch !== $salon) continue;
            $count++; $total++;
            $unique[(string)$registration['customerId']] = true;
            $salons[$branch] = ($salons[$branch] ?? 0) + 1;
        }
        $result[] = ['id' => $event['id'], 'name' => $event['name'], 'startDate' => $event['startDate'], 'endDate' => $event['endDate'], 'registrationCount' => $count];
    }
    usort($result, static fn(array $a, array $b): int => strcmp($b['startDate'] . $b['id'], $a['startDate'] . $a['id']));
    return ['events' => $result, 'eventCount' => count($result), 'registrations' => $total, 'customers' => count($unique), 'salons' => $salons];
}

function event_mutate(?array $current, array $input, string $action, string $actor, string $now): array
{
    $version = (int)($input['version'] ?? 0);
    if ($action === 'delete') {
        if (!$current) throw new DomainException('Арга хэмжээ олдсонгүй. Жагсаалтаа шинэчилнэ үү.');
        if (event_registration_count($current) > 0) throw new DomainException('Хүн бүртгэгдсэн арга хэмжээг устгах боломжгүй.');
        if (!empty($current['deletedAt'])) return $current;
        if ($version !== (int)$current['version']) throw new DomainException('Арга хэмжээ өөрчлөгдсөн байна. Жагсаалтаа шинэчлээд дахин оролдоно уу.');
        return array_merge($current, ['deletedAt' => $now, 'deletedBy' => $actor, 'version' => $version + 1]);
    }
    $fields = event_fields($input);
    if ($current && !empty($current['deletedAt'])) throw new DomainException('Энэ арга хэмжээ устгагдсан байна.');
    if ($current && $version !== (int)$current['version']) {
        // A retried successful creation/save must never create a second event.
        if ((int)$current['version'] === $version + 1 && event_fields($current) === $fields) return $current;
        throw new DomainException('Арга хэмжээ өөрчлөгдсөн байна. Жагсаалтаа шинэчлээд дахин оролдоно уу.');
    }
    if (!$current && $version !== 0) throw new DomainException('Засах арга хэмжээ олдсонгүй.');
    return array_merge($current ?? ['id' => $input['id'], 'registrations' => [], 'createdAt' => $now, 'createdBy' => $actor], $fields,
        ['version' => $version + 1, 'updatedAt' => $now, 'updatedBy' => $actor]);
}
