<?php
declare(strict_types=1);

function entity_store_json(array $value): string
{
    $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) throw new RuntimeException('Entity projection JSON үүсгэж чадсангүй.');
    return $encoded;
}

function entity_store_customer_index(array $customers): array
{
    $indexed = [];
    foreach ($customers as $customer) {
        if (!is_array($customer)) continue;
        $id = trim((string)($customer['id'] ?? ''));
        if ($id !== '') $indexed[$id] = $customer;
    }
    return $indexed;
}

function entity_projection_ready(PDO $pdo): bool
{
    $statement = $pdo->prepare("SELECT meta_value FROM app_meta WHERE meta_key = 'entity_projection_ready' LIMIT 1");
    $statement->execute();
    return (string)($statement->fetchColumn() ?: '0') === '1';
}

function project_customer_entities(PDO $pdo, array $customers, array $customerIds, int $revision): void
{
    $ids = array_values(array_unique(array_filter(array_map(
        static fn(mixed $value): string => trim((string)$value),
        $customerIds
    ), static fn(string $value): bool => $value !== '')));
    if (!$ids) return;
    $customerIndex = entity_store_customer_index($customers);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    foreach (['app_kass_sale_items', 'app_visit_entities', 'app_payment_entities', 'app_service_entities', 'app_customer_credit_entities', 'app_customer_entities'] as $table) {
        $statement = $pdo->prepare("DELETE FROM {$table} WHERE customer_id IN ({$placeholders})");
        $statement->execute($ids);
    }

    $customerInsert = $pdo->prepare('INSERT INTO app_customer_entities (customer_id, phone, display_name, registered_salon, archived, payload, revision) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $serviceInsert = $pdo->prepare('INSERT INTO app_service_entities (customer_id, service_id, kind, salon, service_date, staff_name, payload, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $paymentInsert = $pdo->prepare('INSERT INTO app_payment_entities (customer_id, service_id, payment_id, salon, payment_date, amount, method, payload, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $visitInsert = $pdo->prepare('INSERT INTO app_visit_entities (customer_id, service_id, visit_id, visit_number, salon, visit_date, staff_name, payload, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $kassItemInsert = $pdo->prepare('INSERT INTO app_kass_sale_items (customer_id, service_id, line_id, salon, sale_date, product_code, product_name, quantity, line_total, payload, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $creditInsert = $pdo->prepare('INSERT INTO app_customer_credit_entities (customer_id, credit_id, entry_date, amount, entry_type, payload, revision) VALUES (?, ?, ?, ?, ?, ?, ?)');

    foreach ($ids as $customerId) {
        $customer = $customerIndex[$customerId] ?? null;
        if (!is_array($customer)) continue;
        $customerInsert->execute([
            $customerId,
            preg_replace('/\D+/', '', (string)($customer['phone'] ?? '')) ?: '',
            (string)($customer['name'] ?? ''),
            (string)($customer['registeredSalon'] ?? $customer['salon'] ?? ''),
            (!empty($customer['deleted']) || !empty($customer['deletedAt'])) ? 1 : 0,
            entity_store_json($customer),
            $revision,
        ]);
        $serviceOccurrences = [];
        foreach ((is_array($customer['serviceHistory'] ?? null) ? $customer['serviceHistory'] : []) as $serviceIndex => $service) {
            if (!is_array($service)) continue;
            $serviceId = trim((string)($service['id'] ?? ''));
            if ($serviceId === '') $serviceId = 'legacy-service:' . $serviceIndex . ':' . hash('sha256', entity_store_json($service));
            $serviceOccurrences[$serviceId] = ($serviceOccurrences[$serviceId] ?? 0) + 1;
            if ($serviceOccurrences[$serviceId] > 1) $serviceId .= ':duplicate:' . $serviceOccurrences[$serviceId];
            $salon = (string)($service['salon'] ?? $service['branch'] ?? '');
            $serviceDate = (string)($service['date'] ?? substr((string)($service['createdAt'] ?? ''), 0, 10));
            $serviceInsert->execute([
                $customerId,
                $serviceId,
                (string)($service['kind'] ?? ''),
                $salon,
                preg_match('/^\d{4}-\d{2}-\d{2}$/', $serviceDate) === 1 ? $serviceDate : null,
                (string)($service['staff'] ?? ''),
                entity_store_json($service),
                $revision,
            ]);
            $paymentOccurrences = [];
            foreach ((is_array($service['payments'] ?? null) ? $service['payments'] : []) as $paymentIndex => $payment) {
                if (!is_array($payment)) continue;
                $paymentId = trim((string)($payment['id'] ?? $payment['paymentId'] ?? ''));
                if ($paymentId === '') $paymentId = 'legacy-payment:' . $paymentIndex . ':' . hash('sha256', entity_store_json($payment));
                $paymentOccurrences[$paymentId] = ($paymentOccurrences[$paymentId] ?? 0) + 1;
                if ($paymentOccurrences[$paymentId] > 1) $paymentId .= ':duplicate:' . $paymentOccurrences[$paymentId];
                $paymentDate = (string)($payment['date'] ?? substr((string)($payment['createdAt'] ?? ''), 0, 10));
                $paymentInsert->execute([
                    $customerId,
                    $serviceId,
                    $paymentId,
                    $salon,
                    preg_match('/^\d{4}-\d{2}-\d{2}$/', $paymentDate) === 1 ? $paymentDate : null,
                    (float)($payment['amount'] ?? $payment['paidAmount'] ?? 0),
                    (string)($payment['method'] ?? ''),
                    entity_store_json($payment),
                    $revision,
                ]);
            }
            $visitOccurrences = [];
            foreach ((is_array($service['visits'] ?? null) ? $service['visits'] : []) as $visitIndex => $visit) {
                if (!is_array($visit)) continue;
                $visitNumber = (int)($visit['number'] ?? ($visitIndex + 1));
                $visitId = trim((string)($visit['id'] ?? ''));
                if ($visitId === '') $visitId = 'visit:' . $visitNumber;
                $visitOccurrences[$visitId] = ($visitOccurrences[$visitId] ?? 0) + 1;
                if ($visitOccurrences[$visitId] > 1) $visitId .= ':duplicate:' . $visitOccurrences[$visitId];
                $visitDate = (string)($visit['date'] ?? substr((string)($visit['createdAt'] ?? ''), 0, 10));
                $visitInsert->execute([
                    $customerId,
                    $serviceId,
                    $visitId,
                    $visitNumber,
                    (string)($visit['salon'] ?? $salon),
                    preg_match('/^\d{4}-\d{2}-\d{2}$/', $visitDate) === 1 ? $visitDate : null,
                    (string)($visit['staff'] ?? ''),
                    entity_store_json($visit),
                    $revision,
                ]);
            }
            if ((string)($service['kind'] ?? '') === 'kass') {
                $lineOccurrences = [];
                foreach ((is_array($service['products'] ?? null) ? $service['products'] : []) as $lineIndex => $line) {
                    if (!is_array($line)) continue;
                    $lineId = trim((string)($line['id'] ?? ''));
                    if ($lineId === '') $lineId = 'line:' . $lineIndex . ':' . hash('sha256', (string)($line['code'] ?? '') . '|' . (string)($line['name'] ?? ''));
                    $lineOccurrences[$lineId] = ($lineOccurrences[$lineId] ?? 0) + 1;
                    if ($lineOccurrences[$lineId] > 1) $lineId .= ':duplicate:' . $lineOccurrences[$lineId];
                    $quantity = max(1, (int)($line['qty'] ?? 1));
                    $lineTotal = (float)($line['lineTotal'] ?? ((float)($line['unitPrice'] ?? $line['price'] ?? 0) * $quantity));
                    $kassItemInsert->execute([
                        $customerId,
                        $serviceId,
                        $lineId,
                        $salon,
                        preg_match('/^\d{4}-\d{2}-\d{2}$/', $serviceDate) === 1 ? $serviceDate : null,
                        (string)($line['code'] ?? ''),
                        (string)($line['name'] ?? ''),
                        $quantity,
                        $lineTotal,
                        entity_store_json($line),
                        $revision,
                    ]);
                }
            }
        }
        $creditOccurrences = [];
        foreach ((is_array($customer['creditLedger'] ?? null) ? $customer['creditLedger'] : []) as $creditIndex => $credit) {
            if (!is_array($credit)) continue;
            $creditId = trim((string)($credit['id'] ?? ''));
            if ($creditId === '') $creditId = 'legacy-credit:' . $creditIndex . ':' . hash('sha256', entity_store_json($credit));
            $creditOccurrences[$creditId] = ($creditOccurrences[$creditId] ?? 0) + 1;
            if ($creditOccurrences[$creditId] > 1) $creditId .= ':duplicate:' . $creditOccurrences[$creditId];
            $entryDate = (string)($credit['date'] ?? substr((string)($credit['createdAt'] ?? ''), 0, 10));
            $creditInsert->execute([
                $customerId,
                $creditId,
                preg_match('/^\d{4}-\d{2}-\d{2}$/', $entryDate) === 1 ? $entryDate : null,
                (float)($credit['amount'] ?? 0),
                (string)($credit['type'] ?? ''),
                entity_store_json($credit),
                $revision,
            ]);
        }
    }
}
