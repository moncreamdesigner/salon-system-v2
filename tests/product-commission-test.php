<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/product-commission.php';
function commission_reject(callable $operation): void { try { $operation(); } catch (DomainException $error) { return; } throw new RuntimeException('Unsafe commission contract accepted'); }
$item = ['id' => 'sale', 'kind' => 'kass', 'cashierCommissionBasisVersion' => 1, 'cashierCommissionBase' => 100000, 'basePrice' => 100000, 'productDiscountAmount' => 20000, 'price' => 80000, 'employeeDiscountAmount' => 0, 'balance' => 80000, 'products' => [['price' => 100000, 'unitPrice' => 80000, 'qty' => 1, 'lineTotal' => 80000]], 'payments' => []];
$wrap = static fn(array $row): array => ['customers' => [['id' => 1, 'serviceHistory' => [$row]]]];
assert_product_commission_contracts([], $wrap($item));
$paid = array_merge($item, ['balance' => 0, 'payments' => [['amount' => 80000]]]);
assert_product_commission_contracts($wrap($item), $wrap($paid));
assert_product_commission_contracts($wrap($paid), $wrap($paid));
foreach (['price' => 1, 'basePrice' => 1, 'cashierCommissionBase' => 200000, 'cashierCommissionBasisVersion' => null] as $key => $value) commission_reject(fn() => assert_product_commission_contracts($wrap($paid), $wrap(array_merge($paid, [$key => $value]))));
$old = $paid;
unset($old['cashierCommissionBasisVersion'], $old['cashierCommissionBase']);
assert_product_commission_contracts($wrap($old), $wrap($old));
commission_reject(fn() => assert_product_commission_contracts($wrap($old), $wrap($paid)));
$wrongProducts = $item;
$wrongProducts['products'][0]['lineTotal'] = 1;
commission_reject(fn() => assert_product_commission_contracts([], $wrap($wrongProducts)));
$free = array_merge($item, ['price' => 0, 'balance' => 0, 'productDiscountAmount' => 100000]);
$free['products'][0]['unitPrice'] = 0;
$free['products'][0]['lineTotal'] = 0;
assert_product_commission_contracts([], $wrap($free));
echo "product-commission-test: OK\n";
