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

function customer_mutation_phone(array $value): string
{
    return preg_replace('/\D+/', '', (string)($value['phone'] ?? '')) ?: '';
}

function customer_mutation_is_active(array $value): bool
{
    return empty($value['deleted']) && trim((string)($value['deletedAt'] ?? '')) === '';
}

function customer_mutation_duplicate_phone(array $customers, array $candidate, string $candidateId): ?array
{
    if (!customer_mutation_is_active($candidate)) return null;
    $phone = customer_mutation_phone($candidate);
    if (preg_match('/^\d{8}$/', $phone) !== 1) return null;
    foreach ($customers as $customer) {
        if (!is_array($customer) || !customer_mutation_is_active($customer)) continue;
        if (trim((string)($customer['id'] ?? '')) === $candidateId) continue;
        if (customer_mutation_phone($customer) === $phone) return $customer;
    }
    return null;
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
        $phoneChanged = $existing === null
            || customer_mutation_phone($existing['value']) !== customer_mutation_phone($mutation);
        $duplicatePhoneCustomer = $phoneChanged
            ? customer_mutation_duplicate_phone($customers, $mutation, $id)
            : null;
        if ($duplicatePhoneCustomer !== null) {
            $conflicts[] = [
                'type' => 'customer',
                'id' => $id,
                'reason' => 'duplicate_phone',
                'phone' => customer_mutation_phone($mutation),
                'existingId' => (string)($duplicatePhoneCustomer['id'] ?? ''),
                'existingName' => (string)($duplicatePhoneCustomer['name'] ?? ''),
            ];
            continue;
        }
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
