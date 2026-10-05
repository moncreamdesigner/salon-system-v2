<?php
declare(strict_types=1);

function performance_unique_transactions(array $transactions): array
{
    $seen = [];
    $result = [];
    foreach ($transactions as $item) {
        if (!is_array($item)) continue;
        $id = trim((string)($item['id'] ?? ''));
        if ($id !== '') {
            // Mutable customer names must never identify a financial event.
            $key = json_encode([$id, (string)($item['type'] ?? ''), (string)(($item['staffId'] ?? '') ?: ($item['staff'] ?? '')), (string)($item['salon'] ?? '')], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (isset($seen[$key])) continue;
            $seen[$key] = true;
        }
        $result[] = $item;
    }
    return $result;
}

function performance_normalize_statements(array $statements): array
{
    foreach ($statements as &$statement) {
        if (!is_array($statement) || !is_array($statement['transactions'] ?? null)) continue;
        $statement['transactions'] = performance_unique_transactions($statement['transactions']);
        $revenue = 0;
        $commission = 0;
        foreach ($statement['transactions'] as $item) {
            $revenue += (float)($item['revenue'] ?? 0);
            $commission += (float)($item['commission'] ?? 0);
        }
        $statement['totalRevenue'] = (int)round($revenue);
        $statement['totalCommission'] = (int)round($commission);
    }
    unset($statement);
    return $statements;
}
