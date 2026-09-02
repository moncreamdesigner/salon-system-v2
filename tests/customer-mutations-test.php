<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/../api/customer-mutations.php';

function expect(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$customerA = ['id' => 101, 'name' => 'A', 'phone' => '11111111', 'serviceHistory' => []];
$customerB = ['id' => 202, 'name' => 'B', 'phone' => '22222222', 'serviceHistory' => []];
$current = ['customers' => [$customerA, $customerB], 'customerGroups' => []];

$changedA = $customerA;
$changedA['serviceHistory'][] = ['id' => 'svc-a', 'service' => 'Нэг удаа'];
[$updated, $conflicts] = apply_customer_entity_mutations($current, [
    'profiles' => [array_merge($changedA, [
        'mutationVersion' => 1,
        'baseFingerprint' => customer_mutation_fingerprint($customerA),
    ])],
]);
expect(!$conflicts, 'Fresh customer mutation must succeed.');
expect(count($updated['customers']) === 2, 'Unrelated customers must never disappear.');
expect($updated['customers'][1] === $customerB, 'Unrelated customer data must remain byte-for-byte unchanged.');
expect(count($updated['customers'][0]['serviceHistory']) === 1, 'Target customer mutation must be applied.');

$staleA = $changedA;
$staleA['phone'] = '99999999';
[$staleResult, $staleConflicts] = apply_customer_entity_mutations($updated, [
    'profiles' => [array_merge($staleA, [
        'mutationVersion' => 2,
        'baseFingerprint' => customer_mutation_fingerprint($customerA),
    ])],
]);
expect(count($staleConflicts) === 1, 'Stale mutation must be rejected.');
expect($staleResult['customers'] === $updated['customers'], 'Rejected mutation must not alter current data.');

$newCustomer = ['id' => 303, 'name' => 'C', 'phone' => '33333333', 'serviceHistory' => []];
[$created, $createConflicts] = apply_customer_entity_mutations($updated, [
    'profiles' => [array_merge($newCustomer, [
        'mutationVersion' => 3,
        'baseFingerprint' => null,
    ])],
]);
expect(!$createConflicts, 'New customer mutation must succeed.');
expect(count($created['customers']) === 3, 'New customer must be added without replacing existing rows.');

[$duplicateResult, $duplicateConflicts] = apply_customer_entity_mutations($created, [
    'profiles' => [array_merge($newCustomer, [
        'mutationVersion' => 4,
        'baseFingerprint' => null,
    ])],
]);
expect(!$duplicateConflicts, 'An identical retry must be idempotent.');
expect($duplicateResult['customers'] === $created['customers'], 'An identical retry must not duplicate data.');

$samePhoneCustomer = ['id' => 404, 'name' => 'D', 'phone' => '33333333', 'serviceHistory' => []];
[$samePhoneResult, $samePhoneConflicts] = apply_customer_entity_mutations($created, [
    'profiles' => [array_merge($samePhoneCustomer, [
        'mutationVersion' => 5,
        'baseFingerprint' => null,
    ])],
]);
expect(count($samePhoneConflicts) === 1, 'A second active customer with the same phone must be rejected.');
expect(($samePhoneConflicts[0]['reason'] ?? '') === 'duplicate_phone', 'Duplicate phone rejection must be explicit.');
expect($samePhoneResult['customers'] === $created['customers'], 'Duplicate phone rejection must preserve all customers.');

$changedToExistingPhone = $changedA;
$changedToExistingPhone['phone'] = '22222222';
[$phoneEditResult, $phoneEditConflicts] = apply_customer_entity_mutations($updated, [
    'profiles' => [array_merge($changedToExistingPhone, [
        'mutationVersion' => 6,
        'baseFingerprint' => customer_mutation_fingerprint($changedA),
    ])],
]);
expect(count($phoneEditConflicts) === 1, 'Changing a customer to another active customer phone must be rejected.');
expect(($phoneEditConflicts[0]['reason'] ?? '') === 'duplicate_phone', 'Duplicate phone edit rejection must be explicit.');
expect($phoneEditResult['customers'] === $updated['customers'], 'Rejected phone edit must preserve all customers.');

$collidingCustomer = $newCustomer;
$collidingCustomer['phone'] = '44444444';
[$collisionResult, $collisionConflicts] = apply_customer_entity_mutations($created, [
    'profiles' => [array_merge($collidingCustomer, [
        'mutationVersion' => 7,
        'baseFingerprint' => null,
    ])],
]);
expect(count($collisionConflicts) === 1, 'A reused ID with different data must be rejected.');
expect($collisionResult['customers'] === $created['customers'], 'ID collision rejection must preserve all data.');

$mergeBase = [
    'id' => 505,
    'name' => 'Merge',
    'phone' => '55555555',
    'serviceHistory' => [[
        'id' => 'svc-base',
        'service' => 'Курс',
        'payments' => [],
        'visits' => [],
    ]],
];
$mergeCurrent = $mergeBase;
$mergeCurrent['serviceHistory'][] = [
    'id' => 'svc-remote',
    'service' => 'Касс',
    'payments' => [['id' => 'pay-remote', 'amount' => 20000]],
];
$mergeProposed = $mergeBase;
$mergeProposed['serviceHistory'][] = [
    'id' => 'svc-local',
    'service' => 'Нэг удаа',
    'payments' => [['id' => 'pay-local', 'amount' => 90000]],
];
[$mergedCustomerState, $mergedCustomerConflicts] = apply_customer_entity_mutations(
    ['customers' => [$mergeCurrent], 'customerGroups' => []],
    ['profiles' => [array_merge($mergeProposed, [
        'mutationVersion' => 8,
        'baseFingerprint' => customer_mutation_fingerprint($mergeBase),
        'baseSnapshot' => $mergeBase,
    ])]]
);
expect(!$mergedCustomerConflicts, 'Concurrent additions to different service IDs must merge.');
$mergedServiceIds = array_column($mergedCustomerState['customers'][0]['serviceHistory'], 'id');
expect(in_array('svc-remote', $mergedServiceIds, true), 'Remote service addition must remain after merge.');
expect(in_array('svc-local', $mergedServiceIds, true), 'Local service addition must be committed after merge.');

$paymentBase = $mergeBase;
$paymentCurrent = $mergeBase;
$paymentCurrent['serviceHistory'][0]['payments'][] = ['id' => 'pay-a', 'amount' => 10000];
$paymentProposed = $mergeBase;
$paymentProposed['serviceHistory'][0]['payments'][] = ['id' => 'pay-b', 'amount' => 15000];
[$mergedPaymentState, $mergedPaymentConflicts] = apply_customer_entity_mutations(
    ['customers' => [$paymentCurrent], 'customerGroups' => []],
    ['profiles' => [array_merge($paymentProposed, [
        'mutationVersion' => 9,
        'baseFingerprint' => customer_mutation_fingerprint($paymentBase),
        'baseSnapshot' => $paymentBase,
    ])]]
);
expect(!$mergedPaymentConflicts, 'Concurrent payments with different IDs must merge.');
$mergedPaymentIds = array_column($mergedPaymentState['customers'][0]['serviceHistory'][0]['payments'], 'id');
expect(in_array('pay-a', $mergedPaymentIds, true) && in_array('pay-b', $mergedPaymentIds, true), 'Both payments must remain after merge.');

$nestedCurrent = $mergeBase;
$nestedCurrent['serviceHistory'][0]['payments'][] = ['id' => 'pay-nested', 'amount' => 12000];
$nestedProposed = $mergeBase;
$nestedProposed['serviceHistory'][0]['visits'][] = ['id' => 'visit-nested', 'number' => 1, 'staff' => 'Salon 2'];
[$nestedState, $nestedConflicts] = apply_customer_entity_mutations(
    ['customers' => [$nestedCurrent], 'customerGroups' => []],
    ['profiles' => [array_merge($nestedProposed, [
        'mutationVersion' => 10,
        'baseFingerprint' => customer_mutation_fingerprint($mergeBase),
        'baseSnapshot' => $mergeBase,
    ])]]
);
expect(!$nestedConflicts, 'A concurrent payment and visit on the same service must merge.');
expect(count($nestedState['customers'][0]['serviceHistory'][0]['payments']) === 1, 'Concurrent payment must remain.');
expect(count($nestedState['customers'][0]['serviceHistory'][0]['visits']) === 1, 'Concurrent visit must be committed.');

$samePaymentBase = $mergeBase;
$samePaymentBase['serviceHistory'][0]['payments'] = [['id' => 'pay-same', 'amount' => 10000]];
$samePaymentCurrent = $samePaymentBase;
$samePaymentCurrent['serviceHistory'][0]['payments'][0]['amount'] = 20000;
$samePaymentProposed = $samePaymentBase;
$samePaymentProposed['serviceHistory'][0]['payments'][0]['amount'] = 30000;
[$samePaymentState, $samePaymentConflicts] = apply_customer_entity_mutations(
    ['customers' => [$samePaymentCurrent], 'customerGroups' => []],
    ['profiles' => [array_merge($samePaymentProposed, [
        'mutationVersion' => 11,
        'baseFingerprint' => customer_mutation_fingerprint($samePaymentBase),
        'baseSnapshot' => $samePaymentBase,
    ])]]
);
expect(count($samePaymentConflicts) === 1, 'Two edits to the same payment amount must conflict.');
expect($samePaymentState['customers'][0]['serviceHistory'][0]['payments'][0]['amount'] === 20000, 'A rejected payment collision must preserve server value.');

$deleteCurrent = $mergeBase;
$deleteCurrent['serviceHistory'][] = ['id' => 'svc-keep', 'service' => 'Remote service'];
$deleteProposed = $mergeBase;
$deleteProposed['serviceHistory'] = [];
[$deleteState, $deleteConflicts] = apply_customer_entity_mutations(
    ['customers' => [$deleteCurrent], 'customerGroups' => []],
    ['profiles' => [array_merge($deleteProposed, [
        'mutationVersion' => 12,
        'baseFingerprint' => customer_mutation_fingerprint($mergeBase),
        'baseSnapshot' => $mergeBase,
    ])]]
);
expect(!$deleteConflicts, 'Deleting an unchanged base service must not remove a separately added service.');
expect(array_column($deleteState['customers'][0]['serviceHistory'], 'id') === ['svc-keep'], 'Only the intended service may be deleted.');

$nameCurrent = $mergeBase;
$nameCurrent['name'] = 'Remote name';
$nameProposed = $mergeBase;
$nameProposed['name'] = 'Local name';
[$sameFieldState, $sameFieldConflicts] = apply_customer_entity_mutations(
    ['customers' => [$nameCurrent], 'customerGroups' => []],
    ['profiles' => [array_merge($nameProposed, [
        'mutationVersion' => 13,
        'baseFingerprint' => customer_mutation_fingerprint($mergeBase),
        'baseSnapshot' => $mergeBase,
    ])]]
);
expect(count($sameFieldConflicts) === 1, 'Concurrent edits to the same scalar field must be rejected.');
expect(($sameFieldConflicts[0]['reason'] ?? '') === 'same_field_changed', 'Same-field conflict must be explicit.');
expect($sameFieldState['customers'][0]['name'] === 'Remote name', 'Rejected same-field edit must preserve server data.');

echo "customer-mutations-test: OK\n";
