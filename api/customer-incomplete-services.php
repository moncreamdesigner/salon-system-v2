<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/customer-entity-store.php';

verify_same_origin();
$user = require_auth();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') json_response(['ok' => false], 405);
$branch = ($user['role'] ?? '') === 'salon';
$salon = trim((string)($user['salon'] ?? ''));
if ($branch && $salon === '') json_response(['ok' => false, 'message' => 'Салбарын эрх тодорхойгүй байна.'], 403);
$pdo = db();
if (!entity_projection_ready($pdo)) {
    json_response(['ok' => false, 'message' => 'Үйлчилгээний жагсаалт хараахан бэлэн биш байна.'], 503);
}

$pageSize = 30;
$page = max(1, min(100000, (int)($_GET['page'] ?? 1)));
$offset = ($page - 1) * $pageSize;
$limit = $pageSize + 1;
// Only the selected page and a look-ahead row cross the wire. The service
// projection has the founding branch and a keyed lookup for visits/payments.
$scope = $branch ? ' AND s.salon = ?' : '';
$falseValues = "('','null','0','false')";
$courseKind = "(s.kind = 'course' OR (s.kind = '' AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.title'))) LIKE '%курс%'))";
$sql = "SELECT x.customer_id, x.display_name, x.phone, x.salon, x.opened, x.title, x.pending, x.target, x.done
FROM (
    SELECT s.customer_id, s.service_id, c.display_name, c.phone, s.salon,
        COALESCE(
            NULLIF(REGEXP_SUBSTR(JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.registeredAt')), '^[0-9]{4}-[0-9]{2}-[0-9]{2}'), ''),
            NULLIF(REGEXP_SUBSTR(JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.createdAt')), '^[0-9]{4}-[0-9]{2}-[0-9]{2}'), ''),
            DATE_FORMAT(s.service_date, '%Y-%m-%d')
        ) AS opened,
        COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.service')), 'null'),
                 NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.title')), 'null'), '') AS title,
        CASE WHEN s.kind = 'single' THEN 1 ELSE 0 END AS pending,
        CASE WHEN $courseKind THEN COALESCE(
            NULLIF(CAST(REGEXP_SUBSTR(JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.visitsTotal')), '^[0-9]+$') AS UNSIGNED), 0),
            NULLIF(CAST(TRIM(SUBSTRING_INDEX(REGEXP_SUBSTR(JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.title')), '[0-9]+[[:space:]]*/[[:space:]]*[0-9]+'), '/', -1)) AS UNSIGNED), 0),
            NULLIF(CAST(REGEXP_SUBSTR(REGEXP_SUBSTR(JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.title')), '[0-9]+[[:space:]]*удаа'), '^[0-9]+') AS UNSIGNED), 0), 0
        ) ELSE 1 END AS target,
        CASE WHEN $courseKind THEN
            CASE WHEN JSON_TYPE(JSON_EXTRACT(s.payload, '$.visits')) = 'ARRAY' THEN (
                SELECT COUNT(DISTINCT CASE WHEN v.visit_number > 0 THEN CONCAT('n:', v.visit_number) ELSE v.visit_id END)
                FROM app_visit_entities v WHERE v.customer_id = s.customer_id AND v.service_id = s.service_id
                AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v.payload, '$.deleted')), '') IN $falseValues
                AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v.payload, '$.deletedAt')), '') IN $falseValues
            ) ELSE COALESCE(
                NULLIF(REGEXP_SUBSTR(JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.doneVisits')), '^[0-9]+$'), ''),
                CAST(REGEXP_SUBSTR(REGEXP_SUBSTR(JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.title')), '[0-9]+[[:space:]]*/[[:space:]]*[0-9]+'), '^[0-9]+') AS UNSIGNED), 0
            ) END
        ELSE 0 END AS done
    FROM app_service_entities s
    JOIN app_customer_entities c ON c.customer_id = s.customer_id AND c.archived = 0
    WHERE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.deleted')), '') IN $falseValues
      AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.deletedAt')), '') IN $falseValues
      AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.transferClosed')), '') IN $falseValues
      AND ($courseKind OR (
           s.kind = 'single'
           AND JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.prepaid')) = 'true'
           AND JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.prepaidPending')) = 'true'
           AND EXISTS (SELECT 1 FROM app_payment_entities p WHERE p.customer_id = s.customer_id
                       AND p.service_id = s.service_id AND p.amount > 0
                       AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.payload, '$.deleted')), '') IN $falseValues
                       AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.payload, '$.deletedAt')), '') IN $falseValues)
      ))$scope
) x
WHERE CAST(x.done AS UNSIGNED) < x.target
ORDER BY x.opened IS NULL, x.opened, x.customer_id, x.service_id
LIMIT $limit OFFSET $offset";

$query = $pdo->prepare($sql);
$query->execute($branch ? [$salon] : []);
$items = $query->fetchAll(PDO::FETCH_ASSOC);
json_response(['ok' => true, 'page' => $page, 'items' => array_slice($items, 0, $pageSize), 'hasMore' => count($items) > $pageSize]);
