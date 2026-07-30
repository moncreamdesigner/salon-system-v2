<?php
declare(strict_types=1);

function customer_mutation_index(array $rows): array
{
    $indexed = [];
    foreach ($rows as $index => $row) {
        if (!is_array($row)) continue;
        $id = trim((string)($row['id'] ?? ''));
        if ($id === '') continue;
        $indexed[$id] = ['index' => (int)$index, 'value' => $row];
    }
    return $indexed;
}

function customer_mutation_fingerprint(array $value): string
{
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
}

function apply_customer_entity_mutations(array $current, array $mutations): array
{
    $profiles = is_array($mutations['profiles'] ?? null) ? $mutations['profiles'] : [];
    $groups = is_array($mutations['groups'] ?? null) ? $mutations['groups'] : [];
    if (!$profiles && !$groups) return [$current, []];

    $conflicts = [];
    $customers = is_array($current['customers'] ?? null) ? array_values($current['customers']) : [];
    $customerIndex = customer_mutation_index($customers);
    foreach ($profiles as $mutation) {
        if (!is_array($mutation)) {
            $conflicts[] = ['type' => 'customer', 'id' => '', 'reason' => 'invalid'];
            continue;
        }
        $id = trim((string)($mutation['id'] ?? ''));
        if ($id === '') {
            $conflicts[] = ['type' => 'customer', 'id' => '', 'reason' => 'missing_id'];
            continue;
        }
        $expected = array_key_exists('baseFingerprint', $mutation)
            ? $mutation['baseFingerprint']
            : null;
        unset($mutation['mutationVersion'], $mutation['baseFingerprint']);
        $existing = $customerIndex[$id] ?? null;
        if ($existing === null) {
            if ($expected !== null && $expected !== '') {
                $conflicts[] = ['type' => 'customer', 'id' => $id];
                continue;
            }
            array_unshift($customers, $mutation);
            $customerIndex = customer_mutation_index($customers);
            continue;
        }
        if (customer_mutation_fingerprint($existing['value']) === customer_mutation_fingerprint($mutation)) {
            continue;
        }
        if (!is_string($expected) || customer_mutation_fingerprint($existing['value']) !== $expected) {
            $conflicts[] = ['type' => 'customer', 'id' => $id];
            continue;
        }
        $customers[$existing['index']] = $mutation;
        $customerIndex[$id] = ['index' => $existing['index'], 'value' => $mutation];
    }
    $current['customers'] = array_values($customers);

    $customerGroups = is_array($current['customerGroups'] ?? null) ? array_values($current['customerGroups']) : [];
    $groupIndex = customer_mutation_index($customerGroups);
    foreach ($groups as $mutation) {
        if (!is_array($mutation)) {
            $conflicts[] = ['type' => 'customerGroup', 'id' => '', 'reason' => 'invalid'];
            continue;
        }
        $id = trim((string)($mutation['id'] ?? ''));
        if ($id === '') {
            $conflicts[] = ['type' => 'customerGroup', 'id' => '', 'reason' => 'missing_id'];
            continue;
        }
        $expected = array_key_exists('baseFingerprint', $mutation)
            ? $mutation['baseFingerprint']
            : null;
        unset($mutation['mutationVersion'], $mutation['baseFingerprint']);
        $existing = $groupIndex[$id] ?? null;
        if ($existing === null) {
            if ($expected !== null && $expected !== '') {
                $conflicts[] = ['type' => 'customerGroup', 'id' => $id];
                continue;
            }
            array_unshift($customerGroups, $mutation);
            $groupIndex = customer_mutation_index($customerGroups);
            continue;
        }
        if (customer_mutation_fingerprint($existing['value']) === customer_mutation_fingerprint($mutation)) {
            continue;
        }
        if (!is_string($expected) || customer_mutation_fingerprint($existing['value']) !== $expected) {
            $conflicts[] = ['type' => 'customerGroup', 'id' => $id];
            continue;
        }
        $customerGroups[$existing['index']] = $mutation;
        $groupIndex[$id] = ['index' => $existing['index'], 'value' => $mutation];
    }
    $current['customerGroups'] = array_values($customerGroups);

    return [$current, $conflicts];
}
