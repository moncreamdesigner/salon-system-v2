<?php
declare(strict_types=1);
require_once __DIR__ . '/daily-queue.php';

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
    return json_encode(daily_queue_without_derived_fields($value), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
}

function customer_mutation_value_fingerprint(mixed $value): string
{
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
}

function customer_mutation_values_equal(mixed $left, mixed $right): bool
{
    return customer_mutation_value_fingerprint($left) === customer_mutation_value_fingerprint($right);
}

function customer_mutation_collection_key(mixed $row, string $path): ?string
{
    if (!is_array($row)) return null;
    $id = trim((string)($row['id'] ?? ''));
    if ($id !== '') return 'id:' . $id;
    if (str_ends_with($path, '/visits') && isset($row['number'])) return 'number:' . (string)$row['number'];
    if (str_ends_with($path, '/products')) {
        $code = trim((string)($row['code'] ?? ''));
        $name = trim((string)($row['name'] ?? ''));
        if ($code !== '' || $name !== '') return 'product:' . $code . ':' . $name;
    }
    $identity = [];
    foreach (['date', 'createdAt', 'registeredAt', 'kind', 'service', 'title', 'salon', 'amount', 'paidAmount', 'method', 'type'] as $key) {
        if (isset($row[$key]) && trim((string)$row[$key]) !== '') $identity[$key] = $row[$key];
    }
    if ($identity) {
        return 'legacy:' . hash('sha256', json_encode($identity, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '');
    }
    return null;
}

function customer_mutation_collection_index(array $rows, string $path): ?array
{
    $indexed = [];
    $order = [];
    $occurrences = [];
    foreach ($rows as $row) {
        $key = customer_mutation_collection_key($row, $path);
        if ($key === null) return null;
        $occurrences[$key] = ($occurrences[$key] ?? 0) + 1;
        if ($occurrences[$key] > 1) $key .= ':duplicate:' . $occurrences[$key];
        $indexed[$key] = $row;
        $order[] = $key;
    }
    return ['items' => $indexed, 'order' => $order];
}

/**
 * Three-way merge one node. The boolean in the return value indicates whether
 * the node exists after the merge; it lets the same routine handle deletions.
 */
function customer_mutation_merge_node(
    bool $baseExists,
    mixed $base,
    bool $currentExists,
    mixed $current,
    bool $proposedExists,
    mixed $proposed,
    string $path,
    array &$conflicts
): array {
    if (!$proposedExists) {
        if (!$baseExists) return [$currentExists, $current];
        if (!$currentExists || customer_mutation_values_equal($current, $base)) return [false, null];
        $conflicts[] = $path;
        return [$currentExists, $current];
    }
    if (!$baseExists) {
        if (!$currentExists || customer_mutation_values_equal($current, $proposed)) return [true, $proposed];
        $conflicts[] = $path;
        return [true, $current];
    }
    if (!$currentExists) {
        if (customer_mutation_values_equal($proposed, $base)) return [false, null];
        $conflicts[] = $path;
        return [false, null];
    }
    if (customer_mutation_values_equal($proposed, $base)) return [true, $current];
    if (customer_mutation_values_equal($current, $base) || customer_mutation_values_equal($current, $proposed)) {
        return [true, $proposed];
    }
    if (!is_array($base) || !is_array($current) || !is_array($proposed)) {
        $conflicts[] = $path;
        return [true, $current];
    }

    $baseList = array_is_list($base);
    $currentList = array_is_list($current);
    $proposedList = array_is_list($proposed);
    if ($baseList || $currentList || $proposedList) {
        if (!($baseList && $currentList && $proposedList)) {
            $conflicts[] = $path;
            return [true, $current];
        }
        $baseIndex = customer_mutation_collection_index($base, $path);
        $currentIndex = customer_mutation_collection_index($current, $path);
        $proposedIndex = customer_mutation_collection_index($proposed, $path);
        if ($baseIndex === null || $currentIndex === null || $proposedIndex === null) {
            $conflicts[] = $path;
            return [true, $current];
        }
        $keys = array_values(array_unique(array_merge(
            $proposedIndex['order'],
            $currentIndex['order'],
            $baseIndex['order']
        )));
        $mergedByKey = [];
        foreach ($keys as $key) {
            [$exists, $value] = customer_mutation_merge_node(
                array_key_exists($key, $baseIndex['items']),
                $baseIndex['items'][$key] ?? null,
                array_key_exists($key, $currentIndex['items']),
                $currentIndex['items'][$key] ?? null,
                array_key_exists($key, $proposedIndex['items']),
                $proposedIndex['items'][$key] ?? null,
                $path . '[' . $key . ']',
                $conflicts
            );
            if ($exists) $mergedByKey[$key] = $value;
        }
        $merged = [];
        foreach ($keys as $key) {
            if (array_key_exists($key, $mergedByKey)) $merged[] = $mergedByKey[$key];
        }
        return [true, $merged];
    }

    $keys = array_values(array_unique(array_merge(array_keys($base), array_keys($current), array_keys($proposed))));
    $merged = [];
    foreach ($keys as $key) {
        [$exists, $value] = customer_mutation_merge_node(
            array_key_exists($key, $base),
            $base[$key] ?? null,
            array_key_exists($key, $current),
            $current[$key] ?? null,
            array_key_exists($key, $proposed),
            $proposed[$key] ?? null,
            $path . '/' . (string)$key,
            $conflicts
        );
        if ($exists) $merged[$key] = $value;
    }
    return [true, $merged];
}

function customer_mutation_three_way_merge(array $base, array $current, array $proposed, string $path): array
{
    $conflicts = [];
    [, $merged] = customer_mutation_merge_node(true, $base, true, $current, true, $proposed, $path, $conflicts);
    return [is_array($merged) ? $merged : $current, array_values(array_unique($conflicts))];
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
        $baseSnapshot = is_array($mutation['baseSnapshot'] ?? null) ? $mutation['baseSnapshot'] : null;
        unset($mutation['mutationVersion'], $mutation['baseFingerprint'], $mutation['baseSnapshot']);
        $existing = $customerIndex[$id] ?? null;
        if ($existing !== null && $baseSnapshot !== null) {
            if (!is_string($expected) || customer_mutation_fingerprint($baseSnapshot) !== $expected) {
                $conflicts[] = ['type' => 'customer', 'id' => $id, 'reason' => 'invalid_base'];
                continue;
            }
            [$mergedMutation, $mergeConflicts] = customer_mutation_three_way_merge(
                daily_queue_without_derived_fields($baseSnapshot),
                daily_queue_without_derived_fields($existing['value']),
                daily_queue_without_derived_fields($mutation),
                'customer:' . $id
            );
            if ($mergeConflicts) {
                $conflicts[] = [
                    'type' => 'customer',
                    'id' => $id,
                    'reason' => 'same_field_changed',
                    'paths' => array_slice($mergeConflicts, 0, 20),
                ];
                continue;
            }
            $mutation = $mergedMutation;
            // The three-way merge has already compared every changed field
            // against the current server entity. Advance the expected value to
            // that locked entity so the legacy fingerprint guard below does
            // not reject a successfully merged disjoint operation.
            $expected = customer_mutation_fingerprint($existing['value']);
        }
        $mutation = daily_queue_prepare_customer_mutation($existing['value'] ?? null, $mutation);
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
        $baseSnapshot = is_array($mutation['baseSnapshot'] ?? null) ? $mutation['baseSnapshot'] : null;
        unset($mutation['mutationVersion'], $mutation['baseFingerprint'], $mutation['baseSnapshot']);
        $existing = $groupIndex[$id] ?? null;
        if ($existing !== null && $baseSnapshot !== null) {
            if (!is_string($expected) || customer_mutation_fingerprint($baseSnapshot) !== $expected) {
                $conflicts[] = ['type' => 'customerGroup', 'id' => $id, 'reason' => 'invalid_base'];
                continue;
            }
            [$mergedMutation, $mergeConflicts] = customer_mutation_three_way_merge(
                $baseSnapshot,
                $existing['value'],
                $mutation,
                'customerGroup:' . $id
            );
            if ($mergeConflicts) {
                $conflicts[] = [
                    'type' => 'customerGroup',
                    'id' => $id,
                    'reason' => 'same_field_changed',
                    'paths' => array_slice($mergeConflicts, 0, 20),
                ];
                continue;
            }
            $mutation = $mergedMutation;
            $expected = customer_mutation_fingerprint($existing['value']);
        }
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
