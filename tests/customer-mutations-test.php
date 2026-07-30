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

$collidingCustomer = $newCustomer;
$collidingCustomer['phone'] = '44444444';
[$collisionResult, $collisionConflicts] = apply_customer_entity_mutations($created, [
    'profiles' => [array_merge($collidingCustomer, [
        'mutationVersion' => 5,
        'baseFingerprint' => null,
    ])],
]);
expect(count($collisionConflicts) === 1, 'A reused ID with different data must be rejected.');
expect($collisionResult['customers'] === $created['customers'], 'ID collision rejection must preserve all data.');

echo "customer-mutations-test: OK\n";
