<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/customer-mutations.php';

verify_same_origin();
$user = require_auth();
$pdo = db();

function load_all_sections(PDO $pdo, array $keys = []): array
{
    if ($keys) {
        $placeholders = implode(',', array_fill(0, count($keys), '?'));
        $statement = $pdo->prepare("SELECT section_key, payload FROM app_sections WHERE section_key IN ($placeholders) ORDER BY section_key");
        $statement->execute($keys);
        $rows = $statement->fetchAll();
    } else {
        $rows = $pdo->query('SELECT section_key, payload FROM app_sections ORDER BY section_key')->fetchAll();
    }
    $data = [];
    foreach ($rows as $row) $data[$row['section_key']] = json_decode((string)$row['payload'], true);
    return $data;
}

function load_section_revisions(PDO $pdo, array $keys = [], bool $lock = false): array
{
    if ($keys) {
        $placeholders = implode(',', array_fill(0, count($keys), '?'));
        $statement = $pdo->prepare("SELECT section_key, revision FROM app_sections WHERE section_key IN ($placeholders)" . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute($keys);
        $rows = $statement->fetchAll();
    } else {
        $rows = $pdo->query('SELECT section_key, revision FROM app_sections ORDER BY section_key')->fetchAll();
    }
    $revisions = [];
    foreach ($rows as $row) $revisions[(string)$row['section_key']] = (int)$row['revision'];
    foreach ($keys as $key) {
        if (!array_key_exists((string)$key, $revisions)) $revisions[(string)$key] = 0;
    }
    return $revisions;
}

function recovery_entity_key(array $item, int $index, string $kind = 'generic'): string
{
    // Older salon-scoped browsers generated numeric ids from only their own
    // visible rows. The same numeric id can therefore exist in two salons.
    // Treat the salon as part of kass identity so legacy rows do not become
    // false edits/deletes when scoped rows are merged in a different order.
    if ($kind === 'kass-schedule' && isset($item['id']) && trim((string)$item['id']) !== '') {
        return 'kass-schedule:' . trim((string)($item['salon'] ?? '')) . ':' . trim((string)$item['id']);
    }
    foreach (['id', 'paymentId', 'code', 'cardNumber'] as $key) {
        if (isset($item[$key]) && trim((string)$item[$key]) !== '') return (string)$item[$key];
    }
    if (isset($item['number']) && trim((string)$item['number']) !== '') {
        return 'legacy:' . $kind . ':number:' . trim((string)$item['number']);
    }
    $identity = [];
    foreach (['date', 'createdAt', 'registeredAt', 'kind', 'service', 'title', 'salon', 'amount', 'paidAmount', 'paymentMethod', 'method'] as $key) {
        if (isset($item[$key]) && trim((string)$item[$key]) !== '') $identity[$key] = $item[$key];
    }
    if ($identity) {
        return 'legacy:' . $kind . ':' . hash('sha256', json_encode($identity, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '');
    }
    return 'index:' . $kind . ':' . $index;
}

function recovery_index(array $rows, string $kind = 'generic'): array
{
    $indexed = [];
    $occurrences = [];
    foreach ($rows as $index => $row) {
        if (!is_array($row)) continue;
        $baseKey = recovery_entity_key($row, (int)$index, $kind);
        $occurrences[$baseKey] = ($occurrences[$baseKey] ?? 0) + 1;
        $key = $occurrences[$baseKey] > 1 ? $baseKey . ':duplicate:' . $occurrences[$baseKey] : $baseKey;
        $indexed[$key] = $row;
    }
    return $indexed;
}

function record_recovery_item(PDO $pdo, int $revision, array $user, string $type, string $entityId, string $parentId, array $item): void
{
    $encoded = json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) return;
    $statement = $pdo->prepare('INSERT INTO app_recovery_journal (revision, actor_user_id, actor_username, actor_role, actor_salon, entity_type, entity_id, parent_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $statement->execute([
        $revision,
        (int)($user['id'] ?? 0) ?: null,
        (string)($user['username'] ?? ''),
        (string)($user['role'] ?? ''),
        (string)($user['salon'] ?? ''),
        $type,
        $entityId,
        $parentId,
        $encoded,
    ]);
}

function journal_removed_customer_data(PDO $pdo, int $revision, array $user, array $current, array $incoming): int
{
    $removedCount = 0;
    $oldCustomers = recovery_index(is_array($current['customers'] ?? null) ? $current['customers'] : []);
    $newCustomers = recovery_index(is_array($incoming['customers'] ?? null) ? $incoming['customers'] : []);
    foreach ($oldCustomers as $customerId => $oldCustomer) {
        if (!isset($newCustomers[$customerId])) {
            record_recovery_item($pdo, $revision, $user, 'customer', (string)$customerId, '', $oldCustomer);
            $removedCount += 1;
            continue;
        }
        $newCustomer = $newCustomers[$customerId];
        if ($oldCustomer === $newCustomer) continue;
        $oldHistory = recovery_index(is_array($oldCustomer['serviceHistory'] ?? null) ? $oldCustomer['serviceHistory'] : [], 'service');
        $newHistory = recovery_index(is_array($newCustomer['serviceHistory'] ?? null) ? $newCustomer['serviceHistory'] : [], 'service');
        foreach ($oldHistory as $historyId => $oldService) {
            if (!isset($newHistory[$historyId])) {
                record_recovery_item($pdo, $revision, $user, 'service', (string)$historyId, (string)$customerId, $oldService);
                $removedCount += 1;
                continue;
            }
            $oldPayments = recovery_index(is_array($oldService['payments'] ?? null) ? $oldService['payments'] : [], 'payment');
            $newPayments = recovery_index(is_array($newHistory[$historyId]['payments'] ?? null) ? $newHistory[$historyId]['payments'] : [], 'payment');
            foreach ($oldPayments as $paymentId => $oldPayment) {
                if (isset($newPayments[$paymentId])) continue;
                record_recovery_item(
                    $pdo,
                    $revision,
                    $user,
                    'payment',
                    (string)$paymentId,
                    (string)$customerId . '/' . (string)$historyId,
                    $oldPayment
                );
                $removedCount += 1;
            }
        }
    }
    $oldGroups = recovery_index(is_array($current['customerGroups'] ?? null) ? $current['customerGroups'] : []);
    $newGroups = recovery_index(is_array($incoming['customerGroups'] ?? null) ? $incoming['customerGroups'] : []);
    foreach ($oldGroups as $groupId => $oldGroup) {
        if (isset($newGroups[$groupId])) continue;
        record_recovery_item($pdo, $revision, $user, 'customerGroup', (string)$groupId, '', $oldGroup);
        $removedCount += 1;
    }
    return $removedCount;
}

function customer_mutation_change_events(array $current, array $incoming, array $mutations): array
{
    $events = [];
    foreach ([
        ['mutationKey' => 'profiles', 'section' => 'customers', 'type' => 'customer'],
        ['mutationKey' => 'groups', 'section' => 'customerGroups', 'type' => 'customerGroup'],
    ] as $definition) {
        $requested = is_array($mutations[$definition['mutationKey']] ?? null) ? $mutations[$definition['mutationKey']] : [];
        if (!$requested) continue;
        $beforeIndex = customer_mutation_index(is_array($current[$definition['section']] ?? null) ? $current[$definition['section']] : []);
        $afterIndex = customer_mutation_index(is_array($incoming[$definition['section']] ?? null) ? $incoming[$definition['section']] : []);
        foreach ($requested as $mutation) {
            if (!is_array($mutation)) continue;
            $entityId = trim((string)($mutation['id'] ?? ''));
            if ($entityId === '') continue;
            $before = $beforeIndex[$entityId]['value'] ?? null;
            $after = $afterIndex[$entityId]['value'] ?? null;
            if ($before === $after) continue;
            $action = $before === null ? 'create' : ($after === null ? 'delete' : 'update');
            if (
                is_array($before)
                && is_array($after)
                && empty($before['deleted'])
                && empty($before['deletedAt'])
                && (!empty($after['deleted']) || !empty($after['deletedAt']))
            ) {
                $action = 'archive';
            }
            $events[] = [
                'entityType' => $definition['type'],
                'entityId' => $entityId,
                'parentId' => '',
                'action' => $action,
                'before' => $before,
                'after' => $after,
            ];
        }
    }
    return $events;
}

function record_change_events(PDO $pdo, string $operationId, int $revision, array $events): void
{
    if ($operationId === '' || !$events) return;
    $statement = $pdo->prepare('INSERT INTO app_change_events (operation_id, revision, entity_type, entity_id, parent_id, action, before_payload, after_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($events as $event) {
        $before = array_key_exists('before', $event) && $event['before'] !== null
            ? json_encode($event['before'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            : null;
        $after = array_key_exists('after', $event) && $event['after'] !== null
            ? json_encode($event['after'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            : null;
        if ($before === false || $after === false) throw new RuntimeException('Өөрчлөлтийн түүхийг JSON болгоход алдаа гарлаа.');
        $statement->execute([
            $operationId,
            $revision,
            (string)($event['entityType'] ?? ''),
            (string)($event['entityId'] ?? ''),
            (string)($event['parentId'] ?? ''),
            (string)($event['action'] ?? 'update'),
            $before,
            $after,
        ]);
    }
}

function merge_legacy_customer_data(array $current, array $incoming): array
{
    if (is_array($incoming['customers'] ?? null)) {
        $oldCustomers = recovery_index(is_array($current['customers'] ?? null) ? $current['customers'] : []);
        $newCustomers = recovery_index($incoming['customers']);
        foreach ($oldCustomers as $customerId => $oldCustomer) {
            if (!isset($newCustomers[$customerId])) {
                $newCustomers[$customerId] = $oldCustomer;
                continue;
            }
            $newCustomer = $newCustomers[$customerId];
            $oldHistory = recovery_index(is_array($oldCustomer['serviceHistory'] ?? null) ? $oldCustomer['serviceHistory'] : [], 'service');
            $newHistory = recovery_index(is_array($newCustomer['serviceHistory'] ?? null) ? $newCustomer['serviceHistory'] : [], 'service');
            foreach ($newHistory as $historyId => $newService) {
                if (!isset($oldHistory[$historyId])) {
                    $oldHistory[$historyId] = $newService;
                    continue;
                }
                $oldService = $oldHistory[$historyId];
                $oldPayments = recovery_index(is_array($oldService['payments'] ?? null) ? $oldService['payments'] : [], 'payment');
                $newPayments = recovery_index(is_array($newService['payments'] ?? null) ? $newService['payments'] : [], 'payment');
                foreach ($newPayments as $paymentId => $newPayment) {
                    if (!isset($oldPayments[$paymentId])) $oldPayments[$paymentId] = $newPayment;
                }
                $oldHistory[$historyId]['payments'] = array_values($oldPayments);
            }
            $oldCustomer['serviceHistory'] = array_values($oldHistory);
            $newCustomers[$customerId] = $oldCustomer;
        }
        $incoming['customers'] = array_values($newCustomers);
    }
    if (is_array($incoming['customerGroups'] ?? null)) {
        $oldGroups = recovery_index(is_array($current['customerGroups'] ?? null) ? $current['customerGroups'] : []);
        $newGroups = recovery_index($incoming['customerGroups']);
        foreach ($oldGroups as $groupId => $oldGroup) {
            $newGroups[$groupId] = $oldGroup;
        }
        $incoming['customerGroups'] = array_values($newGroups);
    }
    return $incoming;
}

function item_belongs_to_salon(array $item, string $salon, string $section): bool
{
    if ($section === 'assignments') return ($item['from'] ?? '') === $salon || ($item['to'] ?? '') === $salon;
    if ($section === 'holidays') {
        $scopes = is_array($item['salons'] ?? null) ? $item['salons'] : [];
        return ($item['salon'] ?? '') === $salon || in_array($salon, $scopes, true);
    }
    return ($item['salon'] ?? '') === $salon;
}

function scope_sections_for_user(array $data, array $user): array
{
    if (($user['role'] ?? '') !== 'salon') return $data;
    $salon = (string)($user['salon'] ?? '');
    foreach (['bookings', 'kassSchedules', 'services', 'holidays', 'assignments', 'staff', 'performanceStatements', 'performanceStatementHistory', 'performanceAdjustments'] as $section) {
        if (!is_array($data[$section] ?? null)) continue;
        $data[$section] = array_values(array_filter($data[$section], static fn($item): bool =>
            is_array($item) && item_belongs_to_salon($item, $salon, $section)
        ));
    }
    return $data;
}

function merge_salon_sections(array $current, array $incoming, array $user, bool $partial = false): array
{
    if (($user['role'] ?? '') !== 'salon') return $incoming;
    $salon = (string)($user['salon'] ?? '');
    $restricted = ['salons', 'staff', 'assignments', 'generalSettings', 'homepageSettings', 'pricePolicy', 'discounts', 'voucherRoles', 'catalog', '_serviceSettings', 'diagnosisTypes', 'customerTypes', 'customerTypeRules'];
    foreach ($restricted as $section) {
        if ($partial) unset($incoming[$section]);
        elseif (array_key_exists($section, $current)) $incoming[$section] = $current[$section];
        else unset($incoming[$section]);
    }
    foreach (['bookings', 'kassSchedules', 'services', 'holidays', 'performanceStatements', 'performanceStatementHistory', 'performanceAdjustments'] as $section) {
        if ($partial && !array_key_exists($section, $incoming)) continue;
        $oldRows = is_array($current[$section] ?? null) ? $current[$section] : [];
        $newRows = is_array($incoming[$section] ?? null) ? $incoming[$section] : [];
        $preserved = array_filter($oldRows, static fn($item): bool => !is_array($item) || !item_belongs_to_salon($item, $salon, $section));
        $owned = array_filter($newRows, static fn($item): bool => is_array($item) && item_belongs_to_salon($item, $salon, $section));
        $incoming[$section] = array_values(array_merge($owned, $preserved));
    }
    return $incoming;
}

function merge_append_only_audit(array $current, array $incoming): array
{
    if (!array_key_exists('audit', $incoming) || !is_array($incoming['audit'])) return $incoming;
    $merged = [];
    $seen = [];
    foreach (array_merge($incoming['audit'], is_array($current['audit'] ?? null) ? $current['audit'] : []) as $entry) {
        if (!is_array($entry)) continue;
        $key = (string)($entry['id'] ?? $entry['paymentId'] ?? '') . '|' . (string)($entry['createdAt'] ?? '') . '|' . (string)($entry['title'] ?? '') . '|' . (string)($entry['meta'] ?? '');
        if (isset($seen[$key])) continue;
        $seen[$key] = true;
        $merged[] = $entry;
    }
    $incoming['audit'] = $merged;
    return $incoming;
}

function operational_date(array $item, array $keys): string
{
    foreach ($keys as $key) {
        $value = substr(trim((string)($item[$key] ?? '')), 0, 10);
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1) return $value;
    }
    return '';
}

function operational_item_index(array $rows, string $kind = 'generic'): array
{
    return recovery_index($rows, $kind);
}

function operational_edit_days(array $current, array $incoming): int
{
    $settings = is_array($incoming['generalSettings'] ?? null)
        ? $incoming['generalSettings']
        : (is_array($current['generalSettings'] ?? null) ? $current['generalSettings'] : []);
    return max(1, (int)($settings['dataEditDays'] ?? $settings['serviceEditDays'] ?? $settings['kassEditDays'] ?? 3));
}

function operational_cutoff(array $current, array $incoming): string
{
    $days = operational_edit_days($current, $incoming);
    $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Ulaanbaatar'));
    return $today->modify('-' . $days . ' days')->format('Y-m-d');
}

function operational_date_is_locked(string $date, string $cutoff): bool
{
    return $date !== '' && $date < $cutoff;
}

function assert_dated_section_unlocked(array $current, array $incoming, string $section, array $dateKeys, string $cutoff, string $kind = 'generic'): void
{
    if (!array_key_exists($section, $incoming)) return;
    $oldRows = operational_item_index(is_array($current[$section] ?? null) ? $current[$section] : [], $kind);
    $newRows = operational_item_index(is_array($incoming[$section] ?? null) ? $incoming[$section] : [], $kind);
    foreach ($newRows as $id => $newItem) {
        $date = operational_date($newItem, $dateKeys);
        if (!isset($oldRows[$id]) && operational_date_is_locked($date, $cutoff)) {
            throw new DomainException('3 хоногоос өмнөх огноогоор мэдээлэл нөхөж бүртгэх боломжгүй.');
        }
        if (isset($oldRows[$id]) && $oldRows[$id] !== $newItem) {
            $oldDate = operational_date($oldRows[$id], $dateKeys);
            if (operational_date_is_locked($oldDate, $cutoff)) {
                throw new DomainException('3 хоногоос өмнөх мэдээллийг засах боломжгүй.');
            }
        }
    }
    foreach ($oldRows as $id => $oldItem) {
        if (isset($newRows[$id])) continue;
        if (operational_date_is_locked(operational_date($oldItem, $dateKeys), $cutoff)) {
            throw new DomainException('3 хоногоос өмнөх мэдээллийг устгах боломжгүй.');
        }
    }
}

function service_core_for_lock(array $service): array
{
    $derived = ['payments', 'visits', 'diagnosisHistory', 'creditTransfers', 'balance', 'transferClosed', 'transferClosedAt', 'transferClosedBy', 'paymentFormOpen', 'expandedVisit', 'diagnosisOpen', 'diagnosisExpanded', 'diagnosisWorkOpen', 'diagnosisAddOpen', 'diagnosisDetailId', 'signatureOpen'];
    if (($service['kind'] ?? '') === 'course') {
        $derived = array_merge($derived, ['staff', 'price']);
    }
    foreach ($derived as $key) {
        unset($service[$key]);
    }
    return $service;
}

function assert_branch_customer_type_permissions(array $current, array $proposed, array $user): void
{
    if (($user['role'] ?? '') === 'admin') return;
    $oldCustomers = operational_item_index(is_array($current['customers'] ?? null) ? $current['customers'] : []);
    $newCustomers = operational_item_index(is_array($proposed['customers'] ?? null) ? $proposed['customers'] : []);
    foreach ($newCustomers as $customerId => $newCustomer) {
        $newType = trim((string)($newCustomer['type'] ?? ''));
        $oldType = trim((string)($oldCustomers[$customerId]['type'] ?? ''));
        if (!isset($oldCustomers[$customerId]) && $newType === 'Салбар') {
            throw new DomainException('“Салбар” төрлийн хэрэглэгчийг зөвхөн админ бүртгэнэ.');
        }
        if (isset($oldCustomers[$customerId]) && $oldType !== $newType && ($oldType === 'Салбар' || $newType === 'Салбар')) {
            throw new DomainException('“Салбар” хэрэглэгчийн төрлийг зөвхөн админ өөрчилнө.');
        }
    }
}

function operational_nested_row_for_lock(array $row): array
{
    foreach (['signatureOpen', 'diagnosisOpen', 'diagnosisExpanded', 'paymentFormOpen', 'expandedVisit'] as $key) {
        unset($row[$key]);
    }
    return $row;
}

function assert_customer_operations_unlocked(array $current, array $incoming, string $cutoff): void
{
    if (!array_key_exists('customers', $incoming)) return;
    $oldCustomers = operational_item_index(is_array($current['customers'] ?? null) ? $current['customers'] : []);
    $newCustomers = operational_item_index(is_array($incoming['customers'] ?? null) ? $incoming['customers'] : []);
    foreach ($oldCustomers as $customerId => $oldCustomer) {
        // Хэрэглэгчийг archive хийхээс бусад бүр мөсөн устгалыг ердийн хадгалалтаар зөвшөөрөхгүй.
        if (!isset($newCustomers[$customerId])) {
            throw new DomainException('Хэрэглэгчийг бүр мөсөн устгах боломжгүй. Архивлана уу.');
        }
    }
    foreach ($newCustomers as $customerId => $newCustomer) {
        if (!isset($oldCustomers[$customerId])) {
            foreach ((is_array($newCustomer['serviceHistory'] ?? null) ? $newCustomer['serviceHistory'] : []) as $service) {
                if (!is_array($service)) continue;
                if (operational_date_is_locked(operational_date($service, ['date', 'createdAt', 'registeredAt']), $cutoff)) {
                    throw new DomainException('3 хоногоос өмнөх үйлчилгээ, оношилгоог нөхөж бүртгэх боломжгүй.');
                }
                foreach (['payments', 'visits', 'diagnosisHistory'] as $nestedKey) {
                    foreach ((is_array($service[$nestedKey] ?? null) ? $service[$nestedKey] : []) as $row) {
                        if (is_array($row) && operational_date_is_locked(operational_date($row, ['date', 'createdAt', 'registeredAt']), $cutoff)) {
                            throw new DomainException('3 хоногоос өмнөх төлбөр эсвэл курсийн оролтыг нөхөж бүртгэх боломжгүй.');
                        }
                    }
                }
            }
            continue;
        }
        $oldHistory = operational_item_index(is_array($oldCustomers[$customerId]['serviceHistory'] ?? null) ? $oldCustomers[$customerId]['serviceHistory'] : [], 'service');
        $newHistory = operational_item_index(is_array($newCustomer['serviceHistory'] ?? null) ? $newCustomer['serviceHistory'] : [], 'service');
        foreach ($newHistory as $serviceId => $newService) {
            $serviceDate = operational_date($newService, ['date', 'createdAt', 'registeredAt']);
            if (!isset($oldHistory[$serviceId])) {
                if (operational_date_is_locked($serviceDate, $cutoff)) {
                    throw new DomainException('3 хоногоос өмнөх үйлчилгээ, оношилгоог нөхөж бүртгэх боломжгүй.');
                }
                continue;
            }
            $oldService = $oldHistory[$serviceId];
            $oldServiceDate = operational_date($oldService, ['date', 'createdAt', 'registeredAt']);
            if (operational_date_is_locked($oldServiceDate, $cutoff) && service_core_for_lock($oldService) !== service_core_for_lock($newService)) {
                throw new DomainException('3 хоногоос өмнөх үйлчилгээ, оношилгоог засах боломжгүй.');
            }
            foreach ([
                ['key' => 'payments', 'dates' => ['date', 'createdAt']],
                ['key' => 'visits', 'dates' => ['date', 'createdAt', 'registeredAt']],
                ['key' => 'diagnosisHistory', 'dates' => ['date', 'createdAt']]
            ] as $nested) {
                $oldRows = operational_item_index(is_array($oldService[$nested['key']] ?? null) ? $oldService[$nested['key']] : [], $nested['key']);
                $newRows = operational_item_index(is_array($newService[$nested['key']] ?? null) ? $newService[$nested['key']] : [], $nested['key']);
                foreach ($newRows as $rowId => $newRow) {
                    $rowDate = operational_date($newRow, $nested['dates']);
                    if (!isset($oldRows[$rowId]) && operational_date_is_locked($rowDate, $cutoff)) {
                        throw new DomainException('3 хоногоос өмнөх төлбөр эсвэл курсийн оролтыг нөхөж бүртгэх боломжгүй.');
                    }
                    if (
                        isset($oldRows[$rowId])
                        && operational_nested_row_for_lock($oldRows[$rowId]) !== operational_nested_row_for_lock($newRow)
                        && operational_date_is_locked(operational_date($oldRows[$rowId], $nested['dates']), $cutoff)
                    ) {
                        throw new DomainException('3 хоногоос өмнөх төлбөр эсвэл курсийн оролтыг засах боломжгүй.');
                    }
                }
                foreach ($oldRows as $rowId => $oldRow) {
                    if (!isset($newRows[$rowId]) && operational_date_is_locked(operational_date($oldRow, $nested['dates']), $cutoff)) {
                        throw new DomainException('3 хоногоос өмнөх төлбөр эсвэл курсийн оролтыг устгах боломжгүй.');
                    }
                }
            }
        }
        foreach ($oldHistory as $serviceId => $oldService) {
            if (!isset($newHistory[$serviceId]) && operational_date_is_locked(operational_date($oldService, ['date', 'createdAt', 'registeredAt']), $cutoff)) {
                throw new DomainException('3 хоногоос өмнөх үйлчилгээг устгах боломжгүй.');
            }
        }
    }
}

function assert_operational_lock(array $current, array $incoming): void
{
    $days = operational_edit_days($current, $incoming);
    $cutoff = operational_cutoff($current, $incoming);
    try {
        assert_dated_section_unlocked($current, $incoming, 'kassSchedules', ['date', 'createdAt'], $cutoff, 'kass-schedule');
        assert_dated_section_unlocked($current, $incoming, 'assignments', ['startDate', 'date'], $cutoff);
        assert_customer_operations_unlocked($current, $incoming, $cutoff);
    } catch (DomainException $error) {
        $message = preg_replace('/^3 хоногоос/u', $days . ' хоногоос', $error->getMessage());
        throw new DomainException(is_string($message) ? $message : $error->getMessage());
    }
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $revision = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision'")->fetchColumn();
    $requestedSections = array_values(array_filter(array_map('trim', explode(',', (string)($_GET['sections'] ?? ''))), static fn(string $key): bool => preg_match('/^[A-Za-z0-9_:-]{1,80}$/', $key) === 1));
    $data = scope_sections_for_user(load_all_sections($pdo, $requestedSections), $user);
    json_response([
        'ok' => true,
        'revision' => $revision,
        'scopeRevision' => scope_revision($pdo, $user),
        'sectionRevisions' => load_section_revisions($pdo, $requestedSections),
        'empty' => count($data) === 0,
        'partial' => count($requestedSections) > 0,
        'data' => $data,
    ]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'PUT') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

$payload = request_payload();
$sections = $payload['data'] ?? null;
$customerMutations = is_array($payload['customerMutations'] ?? null)
    ? $payload['customerMutations']
    : [];
$clientRevision = filter_var($payload['revision'] ?? null, FILTER_VALIDATE_INT);
$partial = ($payload['partial'] ?? false) === true;
$clientScopeRevision = filter_var($payload['scopeRevision'] ?? null, FILTER_VALIDATE_INT);
$clientSectionRevisions = is_array($payload['sectionRevisions'] ?? null) ? $payload['sectionRevisions'] : null;
$operationId = trim((string)($payload['operationId'] ?? ''));
if ($operationId !== '' && preg_match('/^[A-Za-z0-9._:-]{12,190}$/', $operationId) !== 1) {
    json_response(['ok' => false, 'message' => 'Үйлдлийн дугаар буруу байна.'], 422);
}
if (!is_array($sections) || array_is_list($sections)) {
    json_response(['ok' => false, 'message' => 'Өгөгдлийн бүтэц буруу байна.'], 422);
}
$encoded = json_encode($sections, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($encoded === false || strlen($encoded) > 50 * 1024 * 1024) {
    json_response(['ok' => false, 'message' => 'Өгөгдлийн хэмжээ хэтэрсэн байна.'], 413);
}
$encodedCustomerMutations = json_encode($customerMutations, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$customerMutationCount = count(is_array($customerMutations['profiles'] ?? null) ? $customerMutations['profiles'] : [])
    + count(is_array($customerMutations['groups'] ?? null) ? $customerMutations['groups'] : []);
if (
    $encodedCustomerMutations === false
    || strlen($encodedCustomerMutations) > 10 * 1024 * 1024
    || $customerMutationCount > 500
) {
    json_response(['ok' => false, 'message' => 'Хэрэглэгчийн өөрчлөлтийн хэмжээ хэтэрсэн байна.'], 413);
}

try {
    $pdo->beginTransaction();
    $revisionStmt = $pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision' FOR UPDATE");
    $currentRevision = (int)$revisionStmt->fetchColumn();
    if ($operationId !== '') {
        $existingOperation = $pdo->prepare('SELECT actor_user_id, result_payload FROM app_operations WHERE operation_id = ? LIMIT 1');
        $existingOperation->execute([$operationId]);
        $operationRow = $existingOperation->fetch();
        if ($operationRow) {
            if ((int)($operationRow['actor_user_id'] ?? 0) !== (int)($user['id'] ?? 0)) {
                $pdo->rollBack();
                json_response(['ok' => false, 'message' => 'Үйлдлийн дугаар өөр хэрэглэгчид хамаарч байна.'], 409);
            }
            $storedResult = json_decode((string)$operationRow['result_payload'], true);
            $pdo->rollBack();
            json_response((is_array($storedResult) ? $storedResult : ['ok' => true]) + ['idempotentReplay' => true]);
        }
    }
    $currentScopeRevision = scope_revision($pdo, $user, true);
    $incomingKeys = array_keys($sections);
    $currentSectionRevisions = load_section_revisions($pdo, $incomingKeys, true);
    $conflictingSections = [];
    if ($clientSectionRevisions !== null) {
        foreach ($incomingKeys as $key) {
            // Audit is append-only and is merged below. A write from another
            // workstation must not reject an unrelated business operation.
            if ((string)$key === 'audit') continue;
            $expected = filter_var($clientSectionRevisions[$key] ?? null, FILTER_VALIDATE_INT);
            if ($expected === false || $expected === null || (int)$expected !== (int)($currentSectionRevisions[$key] ?? 0)) {
                $conflictingSections[] = (string)$key;
            }
        }
        $conflict = count($conflictingSections) > 0;
    } else {
        $conflict = $partial
            ? ($clientScopeRevision === false || $clientScopeRevision === null || (int)$clientScopeRevision !== $currentScopeRevision)
            : ($clientRevision === false || $clientRevision === null || (int)$clientRevision !== $currentRevision);
    }
    if ($conflict) {
        $pdo->rollBack();
        json_response([
            'ok' => false,
            'conflict' => true,
            'currentRevision' => $currentRevision,
            'currentScopeRevision' => $currentScopeRevision,
            'sectionRevisions' => $currentSectionRevisions,
            'conflictingSections' => $conflictingSections,
            'message' => 'Мэдээлэл өөр хэрэглэгчийн үйлдлээр шинэчлэгдсэн байна. Хуудсыг шинэчлээд дахин оролдоно уу.'
        ], 409);
    }
    $mutationKeys = [];
    if (is_array($customerMutations['profiles'] ?? null) && count($customerMutations['profiles'])) $mutationKeys[] = 'customers';
    if (is_array($customerMutations['groups'] ?? null) && count($customerMutations['groups'])) $mutationKeys[] = 'customerGroups';
    // Operational locking is controlled by generalSettings even when a partial
    // entity mutation only sends customers/audit. Always load the setting as a
    // read dependency so the server and browser enforce the same day limit.
    $loadKeys = $partial
        ? array_values(array_unique(array_merge(array_keys($sections), $mutationKeys, ['generalSettings'])))
        : [];
    $currentSections = load_all_sections($pdo, $loadKeys);
    if ($mutationKeys) {
        [$mutatedCustomerSections, $customerMutationConflicts] = apply_customer_entity_mutations(
            $currentSections,
            $customerMutations
        );
        if ($customerMutationConflicts) {
            $duplicatePhoneConflict = null;
            foreach ($customerMutationConflicts as $customerMutationConflict) {
                if (($customerMutationConflict['reason'] ?? '') === 'duplicate_phone') {
                    $duplicatePhoneConflict = $customerMutationConflict;
                    break;
                }
            }
            $pdo->rollBack();
            json_response([
                'ok' => false,
                'conflict' => true,
                'customerConflict' => true,
                'duplicatePhone' => $duplicatePhoneConflict !== null,
                'currentRevision' => $currentRevision,
                'currentScopeRevision' => $currentScopeRevision,
                'sectionRevisions' => load_section_revisions($pdo, $mutationKeys),
                'conflictingEntities' => $customerMutationConflicts,
                'message' => $duplicatePhoneConflict !== null
                    ? 'Энэ утасны дугаартай хэрэглэгч аль хэдийн бүртгэгдсэн байна.'
                    : 'Тухайн хэрэглэгчийн мэдээллийг өөр төхөөрөмж дээр шинэчилсэн байна. Хамгийн сүүлийн мэдээллийг ачаалж, үйлдлээ дахин шалгана уу.'
            ], 409);
        }
        foreach ($mutationKeys as $key) {
            $sections[$key] = $mutatedCustomerSections[$key] ?? [];
        }
    }
    $sections = merge_salon_sections($currentSections, $sections, $user, $partial);
    $sections = merge_append_only_audit($currentSections, $sections);
    assert_branch_customer_type_permissions($currentSections, $sections, $user);
    if ($clientSectionRevisions === null) {
        // Old browser tabs do not know section revisions. Preserve existing
        // customer/service/payment rows until those tabs reload the new build.
        $sections = merge_legacy_customer_data($currentSections, $sections);
    }
    $allowProtectedOverride = ($user['role'] ?? '') === 'admin'
        && ($payload['allowBulkRemoval'] ?? false) === true
        && trim((string)($payload['removalReason'] ?? '')) !== '';
    if (!$allowProtectedOverride) assert_operational_lock($currentSections, $sections);
    $nextRevision = $currentRevision + 1;
    $changeEvents = customer_mutation_change_events($currentSections, $sections, $customerMutations);

    $removedCount = journal_removed_customer_data($pdo, $nextRevision, $user, $currentSections, $sections);
    $allowBulkRemoval = ($user['role'] ?? '') === 'admin' && ($payload['allowBulkRemoval'] ?? false) === true;
    if ($removedCount >= 2 && !$allowBulkRemoval) {
        $pdo->rollBack();
        json_response([
            'ok' => false,
            'conflict' => true,
            'dangerousChange' => true,
            'removedCount' => $removedCount,
            'message' => 'Олон хэрэглэгч, үйлчилгээ эсвэл төлбөр нэг дор хасагдах гэж байгаа тул хадгалалтыг хамгаалж зогсоолоо.',
        ], 409);
    }
    $upsert = $pdo->prepare('INSERT INTO app_sections (section_key, payload, revision) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload), revision = VALUES(revision), updated_at = CURRENT_TIMESTAMP');
    foreach ($sections as $key => $value) {
        if (!preg_match('/^[A-Za-z0-9_:-]{1,80}$/', (string)$key)) throw new RuntimeException('Section key буруу.');
        $sectionJson = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($sectionJson === false) throw new RuntimeException('JSON хөрвүүлэлт амжилтгүй.');
        $upsert->execute([(string)$key, $sectionJson, $nextRevision]);
    }
    $meta = $pdo->prepare("UPDATE app_meta SET meta_value = ? WHERE meta_key = 'revision'");
    $meta->execute([(string)$nextRevision]);
    $nextScopeRevision = bump_scope_revisions($pdo, $user, array_keys($sections));
    $writeLog = $pdo->prepare('INSERT INTO app_write_log (revision, actor_user_id, actor_username, actor_role, actor_salon, client_id, sections, removed_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $writeLog->execute([
        $nextRevision,
        (int)($user['id'] ?? 0) ?: null,
        (string)($user['username'] ?? ''),
        (string)($user['role'] ?? ''),
        (string)($user['salon'] ?? ''),
        substr(trim((string)($payload['clientId'] ?? '')), 0, 80),
        json_encode(array_keys($sections), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        $removedCount,
    ]);
    record_change_events($pdo, $operationId, $nextRevision, $changeEvents);
    $successResult = [
        'ok' => true,
        'revision' => $nextRevision,
        'scopeRevision' => $nextScopeRevision,
        'sectionRevisions' => array_fill_keys(array_keys($sections), $nextRevision),
        'savedSections' => array_keys($sections),
        'savedBy' => $user['username'] ?? 'admin',
    ];
    if ($operationId !== '') {
        $operation = $pdo->prepare('INSERT INTO app_operations (operation_id, revision, actor_user_id, actor_username, actor_role, actor_salon, sections, result_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $operation->execute([
            $operationId,
            $nextRevision,
            (int)($user['id'] ?? 0) ?: null,
            (string)($user['username'] ?? ''),
            (string)($user['role'] ?? ''),
            (string)($user['salon'] ?? ''),
            json_encode(array_keys($sections), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            json_encode($successResult, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
    }
    $pdo->commit();
    json_response($successResult);
} catch (DomainException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'protectedData' => true, 'message' => $error->getMessage()], 409);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    $incidentId = gmdate('YmdHis') . '-' . bin2hex(random_bytes(3));
    $errorCode = 'STATE_SAVE_FAILED';
    $retryable = false;
    if ($error instanceof PDOException) {
        $driverCode = (int)($error->errorInfo[1] ?? 0);
        $errorCode = match ($driverCode) {
            1205 => 'DB_LOCK_TIMEOUT',
            1213 => 'DB_DEADLOCK',
            1153, 2006 => 'DB_PAYLOAD_OR_CONNECTION',
            default => 'DB_WRITE_FAILED',
        };
        $retryable = in_array($driverCode, [1205, 1213, 2006], true);
    } elseif ($error instanceof TypeError) {
        $errorCode = 'STATE_VALIDATION_TYPE_ERROR';
    }
    error_log(sprintf(
        'Khalgai state save [%s] %s code=%s client=%s sections=%s at %s:%d',
        $incidentId,
        get_class($error) . ': ' . $error->getMessage(),
        (string)$error->getCode(),
        substr(trim((string)($payload['clientId'] ?? '')), 0, 80),
        implode(',', array_keys(is_array($sections ?? null) ? $sections : [])),
        $error->getFile(),
        $error->getLine()
    ));
    json_response([
        'ok' => false,
        'message' => 'Server хадгалалт амжилтгүй.',
        'errorCode' => $errorCode,
        'incidentId' => $incidentId,
        'retryable' => $retryable,
    ], 500);
}
