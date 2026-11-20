<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit;
require __DIR__ . '/../api/service-campaign-reprice.php';
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
echo "temporary-repair-test: OK\n";
