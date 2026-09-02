<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/customer-entity-store.php';

verify_same_origin();
$user = require_admin();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function entity_backfill_source_customers(PDO $pdo, bool $lock = false): array
{
    $statement = $pdo->prepare("SELECT payload FROM app_sections WHERE section_key = 'customers' LIMIT 1" . ($lock ? ' FOR UPDATE' : ''));
    $statement->execute();
    $customers = json_decode((string)($statement->fetchColumn() ?: '[]'), true);
    return is_array($customers) ? array_values($customers) : [];
}

function entity_backfill_source_counts(array $customers): array
{
    $counts = ['customers' => 0, 'services' => 0, 'payments' => 0, 'visits' => 0, 'kassItems' => 0, 'credits' => 0];
    foreach ($customers as $customer) {
        if (!is_array($customer) || trim((string)($customer['id'] ?? '')) === '') continue;
        $counts['customers'] += 1;
        $counts['credits'] += count(is_array($customer['creditLedger'] ?? null) ? $customer['creditLedger'] : []);
        foreach ((is_array($customer['serviceHistory'] ?? null) ? $customer['serviceHistory'] : []) as $service) {
            if (!is_array($service)) continue;
            $counts['services'] += 1;
            $counts['payments'] += count(is_array($service['payments'] ?? null) ? $service['payments'] : []);
            $counts['visits'] += count(is_array($service['visits'] ?? null) ? $service['visits'] : []);
            if ((string)($service['kind'] ?? '') === 'kass') {
                $counts['kassItems'] += count(is_array($service['products'] ?? null) ? $service['products'] : []);
            }
        }
    }
    return $counts;
}

function entity_backfill_projection_counts(PDO $pdo): array
{
    $tables = [
        'customers' => 'app_customer_entities',
        'services' => 'app_service_entities',
        'payments' => 'app_payment_entities',
        'visits' => 'app_visit_entities',
        'kassItems' => 'app_kass_sale_items',
        'credits' => 'app_customer_credit_entities',
    ];
    $counts = [];
    foreach ($tables as $key => $table) $counts[$key] = (int)$pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();
    return $counts;
}

if ($method === 'GET') {
    $source = entity_backfill_source_counts(entity_backfill_source_customers($pdo));
    $projection = entity_backfill_projection_counts($pdo);
    json_response([
        'ok' => true,
        'source' => $source,
        'projection' => $projection,
        'matches' => $source === $projection,
    ]);
}

if ($method !== 'POST') json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
$payload = request_payload();
$offset = max(0, (int)($payload['offset'] ?? 0));
$limit = max(1, min(100, (int)($payload['limit'] ?? 50)));
$expectedRevision = filter_var($payload['expectedRevision'] ?? null, FILTER_VALIDATE_INT);

try {
    $pdo->beginTransaction();
    $revision = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision' FOR UPDATE")->fetchColumn();
    if ($offset > 0 && ($expectedRevision === false || $expectedRevision === null || (int)$expectedRevision !== $revision)) {
        $pdo->rollBack();
        json_response([
            'ok' => false,
            'conflict' => true,
            'restartRequired' => true,
            'message' => 'Backfill ажиллаж байх хооронд үндсэн мэдээлэл шинэчлэгдлээ. Live мэдээллийг хамгаалж зогсоолоо; эхнээс нь дахин ажиллуулна уу.',
        ], 409);
    }
    $customers = entity_backfill_source_customers($pdo, true);
    if ($offset === 0) {
        foreach (['app_kass_sale_items', 'app_visit_entities', 'app_payment_entities', 'app_service_entities', 'app_customer_credit_entities', 'app_customer_entities'] as $projectionTable) {
            $pdo->exec("DELETE FROM {$projectionTable}");
        }
        $pdo->exec("INSERT INTO app_meta (meta_key, meta_value) VALUES ('entity_projection_ready', '0') ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)");
    }
    $batch = array_slice($customers, $offset, $limit);
    $ids = array_values(array_filter(array_map(
        static fn(mixed $customer): string => is_array($customer) ? trim((string)($customer['id'] ?? '')) : '',
        $batch
    ), static fn(string $value): bool => $value !== ''));
    project_customer_entities($pdo, $customers, $ids, $revision);
    $nextOffset = $offset + count($batch);
    $done = $nextOffset >= count($customers);
    if ($done) {
        $sourceCounts = entity_backfill_source_counts($customers);
        $projectionCounts = entity_backfill_projection_counts($pdo);
        $ready = $sourceCounts === $projectionCounts ? '1' : '0';
        $readyStatement = $pdo->prepare("INSERT INTO app_meta (meta_key, meta_value) VALUES ('entity_projection_ready', ?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)");
        $readyStatement->execute([$ready]);
    }
    $pdo->commit();
    json_response([
        'ok' => true,
        'processed' => count($ids),
        'offset' => $offset,
        'nextOffset' => $nextOffset,
        'total' => count($customers),
        'done' => $done,
        'sourceRevision' => $revision,
    ]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Entity projection backfill failed: ' . $error->getMessage());
    json_response(['ok' => false, 'message' => 'Entity projection шинэчилж чадсангүй.'], 500);
}
