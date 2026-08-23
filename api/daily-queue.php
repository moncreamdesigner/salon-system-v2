<?php
declare(strict_types=1);

const DAILY_QUEUE_DERIVED_FIELDS = [
    'dailyQueueDate',
    'dailyQueueAssignedAt',
    'dailyQueueSalon',
    'dailyQueueSequence',
    'dailyQueueActiveUntil',
    'dailyQueueHadService',
    'dailyQueueServiceDeleted',
    'dailyQueueVacant',
    'dailyQueueLastTreatment',
];

function daily_queue_without_derived_fields(array $customer): array
{
    foreach (DAILY_QUEUE_DERIVED_FIELDS as $field) unset($customer[$field]);
    return $customer;
}

function daily_queue_prepare_customer_mutation(?array $existing, array $incoming): array
{
    $date = trim((string)($incoming['dailyQueueDate'] ?? ''));
    $salon = trim((string)($incoming['dailyQueueSalon'] ?? ''));
    if ($date === '' || $salon === '') return $incoming;

    $existingDate = trim((string)($existing['dailyQueueDate'] ?? ''));
    $existingSalon = trim((string)($existing['dailyQueueSalon'] ?? ''));
    $existingSequence = (int)($existing['dailyQueueSequence'] ?? 0);
    if ($existing !== null && $date === $existingDate && $salon === $existingSalon && $existingSequence > 0) {
        $incoming['dailyQueueSequence'] = $existingSequence;
        if (trim((string)($existing['dailyQueueAssignedAt'] ?? '')) !== '') {
            $incoming['dailyQueueAssignedAt'] = $existing['dailyQueueAssignedAt'];
        }
        return $incoming;
    }

    // A new date/salon assignment is only a request. The transaction assigns
    // its real sequence from the authoritative full customer collection.
    $incoming['dailyQueueSequence'] = 0;
    return $incoming;
}

function daily_queue_sort_key(array $customer): string
{
    $assignedAt = trim((string)($customer['dailyQueueAssignedAt'] ?? ''));
    if ($assignedAt !== '') return '0|' . $assignedAt;

    $registeredAt = trim((string)($customer['registeredAt'] ?? $customer['last'] ?? ''));
    $registeredTime = trim((string)($customer['registeredTime'] ?? '00:00'));
    if ($registeredAt !== '') return '1|' . substr($registeredAt, 0, 10) . 'T' . $registeredTime;

    return '2|' . str_pad((string)($customer['id'] ?? ''), 20, '0', STR_PAD_LEFT);
}

/**
 * Makes daily queue numbers canonical per date and salon.
 *
 * Existing valid gaps are preserved. If a group is already corrupted by a
 * duplicate number, the full group is rebuilt by its original assignment
 * order. New rows without a number are appended after the current maximum.
 */
function daily_queue_normalize_customers(array $customers): array
{
    $rows = array_values($customers);
    $groups = [];
    foreach ($rows as $index => $customer) {
        if (!is_array($customer)) continue;
        $date = trim((string)($customer['dailyQueueDate'] ?? ''));
        $salon = trim((string)($customer['dailyQueueSalon'] ?? ''));
        $sequence = (int)($customer['dailyQueueSequence'] ?? 0);
        $assignedAt = trim((string)($customer['dailyQueueAssignedAt'] ?? ''));
        if ($date === '' || $salon === '' || ($sequence <= 0 && $assignedAt === '')) continue;
        $groups[$date . "\x1f" . $salon][] = $index;
    }

    $changedIds = [];
    $repairedGroups = [];
    foreach ($groups as $groupKey => $indexes) {
        usort($indexes, static function (int $left, int $right) use ($rows): int {
            $order = strcmp(daily_queue_sort_key($rows[$left]), daily_queue_sort_key($rows[$right]));
            if ($order !== 0) return $order;
            return strcmp((string)($rows[$left]['id'] ?? ''), (string)($rows[$right]['id'] ?? ''));
        });

        $claimed = [];
        $duplicate = false;
        $maximum = 0;
        foreach ($indexes as $index) {
            $sequence = (int)($rows[$index]['dailyQueueSequence'] ?? 0);
            if ($sequence <= 0) continue;
            if (isset($claimed[$sequence])) $duplicate = true;
            $claimed[$sequence] = true;
            $maximum = max($maximum, $sequence);
        }

        if ($duplicate) {
            foreach ($indexes as $offset => $index) {
                $sequence = $offset + 1;
                if ((int)($rows[$index]['dailyQueueSequence'] ?? 0) === $sequence) continue;
                $rows[$index]['dailyQueueSequence'] = $sequence;
                $changedIds[(string)($rows[$index]['id'] ?? $index)] = true;
            }
            $repairedGroups[] = $groupKey;
            continue;
        }

        foreach ($indexes as $index) {
            if ((int)($rows[$index]['dailyQueueSequence'] ?? 0) > 0) continue;
            do {
                $maximum += 1;
            } while (isset($claimed[$maximum]));
            $rows[$index]['dailyQueueSequence'] = $maximum;
            $claimed[$maximum] = true;
            $changedIds[(string)($rows[$index]['id'] ?? $index)] = true;
        }
    }

    return [
        'customers' => $rows,
        'changedIds' => array_keys($changedIds),
        'repairedGroups' => $repairedGroups,
    ];
}
