<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit;
require __DIR__ . '/../api/service-campaign-reprice.php';
require __DIR__ . '/../api/service-campaigns.php';
require __DIR__ . '/../api/prepaid-services.php';
function check(bool $valid): void { if (!$valid) throw new RuntimeException('Temporary repair assertion failed'); }
function rejects(callable $fn): void {
    try { $fn(); } catch (DomainException) { return; }
    throw new RuntimeException('Expected protected refusal');
}
$date = '2026-11-17';
$salon = 'Чингэлтэй салбар';
$service = ['id'=>'s', 'kind'=>'single', 'service'=>'Тэжээлийн эмчилгээ', 'date'=>'2026-11-18', 'salon'=>$salon,
    'basePrice'=>71900, 'price'=>71900, 'balance'=>21570, 'payments'=>[['id'=>'p', 'date'=>'2026-11-18', 'amount'=>50330]]];
$prepaid = array_replace($service, ['id'=>'p-service', 'date'=>'', 'basePrice'=>119900, 'prepaid'=>true, 'prepaidPending'=>true,
    'price'=>83930, 'balance'=>0, 'payments'=>[['id'=>'pay', 'date'=>$date, 'createdAt'=>"$date 19:53", 'method'=>'previous_payment', 'amount'=>83930]]]);
$customers = [];
foreach (temporary_repair_phones() as $i => $phone) $customers[] = ['id'=>$i+1, 'phone'=>$phone, 'serviceHistory'=>[]];
$customers[1]['serviceHistory'] = [$service];
$customers[3]['serviceHistory'] = [$prepaid];
$sections = [
    'customers'=>array_merge($customers, [['id'=>5, 'phone'=>'00000000']]),
    '_serviceSettings'=>['data'=>['single'=>[['name'=>'Тэжээлийн эмчилгээ', 'code'=>'s', 'price'=>71900]]]],
    'discounts'=>[['id'=>'d', 'name'=>'Black Friday', 'percent'=>30, 'startDate'=>'2026-11-11', 'endDate'=>$date,
        'days'=>['2'], 'salons'=>[$salon], 'services'=>['single:s:Тэжээлийн эмчилгээ']]],
];
check(temporary_repair_backup($sections) === $customers);
[, , $changes, $preview] = temporary_repair_plan($sections, ['case'=>'2','date'=>$date], '2026-11-16');
check($preview['total'] === 50330.0 && $preview['balance'] === 0 && $changes['date'] === $date);
check(array_replace($service, $changes)['payments'] === $service['payments']);
rejects(fn()=>temporary_repair_plan($sections, ['case'=>'2'], '2026-11-16'));
rejects(fn()=>temporary_repair_plan($sections, ['case'=>'5','date'=>$date], '2026-11-16'));
$bankPayment = ['id'=>'bank', 'method'=>'transfer', 'amount'=>139900, 'paidAmount'=>139900, 'bonusAmount'=>0,
    'date'=>'2026-11-19', 'groupPaymentDate'=>'2026-11-19', 'createdAt'=>'2026-11-19 15:58'];
$otherPayment = array_replace($bankPayment, ['id'=>'other', 'amount'=>1000]);
$sections['customers'][2]['serviceHistory'] = [array_replace($service, ['service'=>'Уургийн эмчилгээ', 'date'=>$date,
    'basePrice'=>139900, 'price'=>97930, 'campaignDiscountAmount'=>41970, 'balance'=>0, 'payments'=>[$bankPayment, $otherPayment]])];
$dateRequest = ['case'=>'5', 'date'=>$date];
[$ci, $si, $dateChanges, $datePreview] = temporary_repair_plan($sections, $dateRequest, '2026-11-16');
check($ci === 2 && $si === 0 && $datePreview['auditTitle'] === 'payment_date_corrected');
check($dateChanges === ['payments'=>[array_replace($bankPayment, ['date'=>$date, 'groupPaymentDate'=>$date, 'dateCorrected'=>true]), $otherPayment]]);
rejects(fn()=>temporary_repair_plan($sections, $dateRequest, '2026-11-18'));
$duplicate = $sections;
$duplicate['customers'][2]['serviceHistory'][0]['payments'][] = array_replace($bankPayment, ['id'=>'duplicate']);
rejects(fn()=>temporary_repair_plan($duplicate, $dateRequest, '2026-11-16'));
$sections['customers'][2]['serviceHistory'][0] = array_replace($sections['customers'][2]['serviceHistory'][0], $dateChanges);
rejects(fn()=>temporary_repair_plan($sections, $dateRequest, '2026-11-16'));
rejects(fn()=>temporary_repair_plan($sections, ['case'=>'2','date'=>$date], '2026-11-18'));
[, , $changes, $preview] = temporary_repair_plan($sections, ['case'=>'4'], '2026-11-16');
$expected = $prepaid['payments'];
$expected[0]['method'] = 'transfer';
$expected[0]['methodLabel'] = 'Данс';
check($changes === ['payments'=>$expected]);
$sections['customers'][3]['serviceHistory'][0] = array_replace($prepaid, $changes);
rejects(fn()=>temporary_repair_plan($sections, ['case'=>'4'], '2026-11-16'));
$sections['customers'][] = $customers[1];
rejects(fn()=>temporary_repair_backup($sections));
$splitCustomer = ['id'=>6, 'phone'=>'89085351', 'serviceHistory'=>[]];
$bank = array_replace($bankPayment, ['date'=>$date, 'createdAt'=>"$date 10:51", 'groupId'=>9, 'groupSpentAmount'=>139900,
    'groupBonusEligibleAmount'=>139900, 'groupBonusEarned'=>2798, 'groupBonusPercent'=>2, 'groupBonusUsed'=>0, 'groupPaymentDate'=>$date]);
$splitService = array_replace($service, ['service'=>'Уургийн эмчилгээ', 'basePrice'=>139900, 'price'=>139900, 'balance'=>139900, 'payments'=>[], 'date'=>'2026-11-20']);
$splitCustomer['serviceHistory'] = [
    array_replace($splitService, ['id'=>'pending', 'date'=>'', 'prepaid'=>true, 'prepaidPending'=>true, 'balance'=>0, 'payments'=>[$bank]]),
    array_replace($splitService, ['id'=>'served1', 'staff'=>'Молор-Эрдэнэ']),
    array_replace($splitService, ['id'=>'served2', 'staff'=>'Номинзул']),
];
$splitSections = ['customers'=>[$splitCustomer], 'customerGroups'=>[['id'=>9, 'spent2y'=>433300, 'bonusPool'=>8666]],
    '_serviceSettings'=>['data'=>['single'=>[['name'=>'Уургийн эмчилгээ', 'code'=>'p', 'price'=>139900]]]],
    'discounts'=>[array_replace($sections['discounts'][0], ['services'=>['single:p:Уургийн эмчилгээ']])]];
$splitRequest = ['case'=>'6', 'date'=>$date];
[, , , $splitPreview, $splitPlan] = temporary_repair_plan($splitSections, $splitRequest, $date);
$after = $splitSections;
foreach ($splitPlan['services'] as $i => $updates) $after['customers'][0]['serviceHistory'][$i] = array_replace($splitCustomer['serviceHistory'][$i], $updates);
$rows = $after['customers'][0]['serviceHistory'];
check(array_column($rows, 'price') === [97930.0, 97930.0, 97930.0] && array_column($rows, 'balance') === [0, 0, 0]);
check(array_sum(array_map(static fn($row) => $row['payments'][0]['paidAmount'], $rows)) === 293790);
check(count(array_unique(array_map(static fn($row) => $row['payments'][0]['id'], $rows))) === 3 && $rows[0]['payments'][0]['id'] === $bank['id']);
check($rows[0]['prepaidPending'] === true && $rows[0]['date'] === '' && $rows[1]['date'] === '2026-11-20' && $rows[2]['staff'] === 'Номинзул');
check($splitPlan['groupChanges']['spent2y'] === 587190.0 && $splitPlan['groupChanges']['bonusPool'] === 11745.0);
$targets = [['6','pending'], ['6','served1'], ['6','served2']];
assert_prepaid_services_preserved($splitSections, $after, [], $targets);
assert_service_campaign_contracts($splitSections, $after, $targets);
rejects(fn()=>assert_prepaid_services_preserved($splitSections, $after));
rejects(fn()=>assert_service_campaign_contracts($splitSections, $after, [['6','pending']]));
rejects(fn()=>temporary_repair_plan($after, $splitRequest, $date));
rejects(fn()=>temporary_repair_plan($splitSections, $splitRequest, '2026-11-18'));
check(temporary_repair_plan($splitSections, $splitRequest, $date)[3]['token'] === $splitPreview['token']);
$loanName = 'Гүн цэвэрлэгээ /гэмтэлтэй үсний/';
$loan = array_replace($bank, ['id'=>'loan1', 'method'=>'loan_app', 'createdAt'=>"$date 10:56", 'amount'=>59900, 'paidAmount'=>59900,
    'groupSpentAmount'=>59900, 'groupBonusEligibleAmount'=>59900, 'groupBonusEarned'=>1198]);
$loanService = array_replace($splitCustomer['serviceHistory'][0], ['id'=>'loan-service', 'service'=>$loanName, 'salon'=>'Хан-Уул салбар',
    'basePrice'=>59900, 'price'=>59900, 'createdAt'=>$date, 'payments'=>[$loan]]);
$loanSections = ['customers'=>[['id'=>7, 'phone'=>'99040277', 'serviceHistory'=>[$loanService]]],
    'customerGroups'=>[['id'=>9, 'spent2y'=>60000, 'bonusPool'=>1200]],
    '_serviceSettings'=>['data'=>['single'=>[['name'=>$loanName, 'code'=>'deep', 'price'=>59900]]]],
    'discounts'=>[array_replace($sections['discounts'][0], ['salons'=>['Хан-Уул салбар'], 'services'=>["single:deep:$loanName"]])]];
$loanReq = ['case'=>'7', 'date'=>$date];
[, , $loanChanges, , $loanMeta] = temporary_repair_plan($loanSections, $loanReq, '2026-11-21');
check($loanChanges['price'] === 41930.0 && $loanChanges['balance'] === 0);
$newLoan = $loanChanges['payments'][0];
check($newLoan === array_replace($loan, ['amount'=>41930, 'paidAmount'=>41930, 'groupSpentAmount'=>41930, 'groupBonusEligibleAmount'=>41930, 'groupBonusEarned'=>839]));
check($loanMeta['historicCorrection'] === true && $loanMeta['groupChanges'] === ['spent2y'=>42030.0, 'bonusPool'=>841.0]);
$afterLoan = $loanSections;
$afterLoan['customers'][0]['serviceHistory'][0] = array_replace($loanService, $loanChanges);
assert_prepaid_services_preserved($loanSections, $afterLoan, ['role'=>'admin'], [['7','loan-service']]);
assert_service_campaign_contracts($loanSections, $afterLoan, [['7','loan-service']]);
rejects(fn()=>temporary_repair_plan($afterLoan, $loanReq, '2026-11-21'));
rejects(fn()=>temporary_repair_plan($loanSections, ['case'=>'7','date'=>'2026-11-18'], '2026-11-21'));
echo "temporary-repair-test: OK\n";
