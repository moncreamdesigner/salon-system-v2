<?php
declare(strict_types=1);

// Evaluate only the pure read-model helpers, without connecting to production.
function load_payment_helper(string $file, string $name): void {
    $source = file_get_contents(__DIR__ . '/../api/' . $file);
    if (!preg_match('/function ' . $name . '\([^\n]+\n\{.*?\n\}/s', $source, $match)) {
        throw new RuntimeException('Missing helper: ' . $name);
    }
    eval($match[0]);
}
load_payment_helper('dashboard-summary.php', 'dashboard_actual_payment');
load_payment_helper('dashboard-summary.php', 'dashboard_payment_label');
load_payment_helper('revenue-list.php', 'revenue_is_actual');
if (dashboard_actual_payment('previous_payment')) {
    throw new RuntimeException('Historical payment must not count as cash revenue');
}
if (!dashboard_actual_payment('qpay')) {
    throw new RuntimeException('Normal cash revenue must remain unchanged');
}
if (dashboard_payment_label('previous_payment') !== 'Өмнө нь төлсөн') {
    throw new RuntimeException('Incorrect payment label');
}
if (function_exists('mb_strtolower')) {
    if (revenue_is_actual('previous_payment') || !revenue_is_actual('card')) {
        throw new RuntimeException('Revenue list historical-payment filtering is incorrect');
    }
} else {
    echo "Revenue list runtime check skipped: local PHP mbstring unavailable\n";
}
echo "previous-payment-test: OK\n";
