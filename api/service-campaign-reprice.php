<?php
declare(strict_types=1);

// Temporary, explicitly bounded repair queue. Never accept a client-supplied
// customer, financial amount, payment method, or discount percentage.
function temporary_repair_phones(): array
{
    return ['91111399', '96480248', '86906077', '99098082'];
}

function temporary_repair_backup(array $sections): array
{
    $profiles = [];
    foreach (temporary_repair_phones() as $phone) {
        $matched = array_values(array_filter((array)($sections['customers'] ?? []), static fn($row) =>
            is_array($row) && empty($row['deleted']) && empty($row['deletedAt']) && (string)($row['phone'] ?? '') === $phone));
        if (count($matched) !== 1) throw new DomainException('Дөрвөн хэрэглэгчийн бүртгэлийг нэг утгаар таньж чадсангүй. Хуулбар үүсгээгүй.');
        $profiles[] = $matched[0];
    }
    return $profiles;
}

function temporary_repair_plan(array $sections, array $request, string $cutoff): array
{
    $case = (string)($request['case'] ?? '');
    $cases = [
        '1' => ['Хуурай үсний курс эмчилгээ', 'course', 449900, '2026-11-17'],
        '2' => ['Тэжээлийн эмчилгээ', 'single', 71900, '2026-11-18'],
        '3' => ['Уургийн эмчилгээ', 'single', 139900, '2026-11-19'],
        '4' => ['Тэжээлийн эмчилгээ', 'single', 119900, ''],
        '5' => ['Уургийн эмчилгээ', 'single', 139900, '2026-11-17'],
    ];
    if (!isset($cases[$case])) throw new DomainException('Энэ бүртгэл түр засварын жагсаалтад байхгүй.');
    [$name, $kind, $base, $date] = $cases[$case];
    $phone = temporary_repair_phones()[$case === '5' ? 2 : (int)$case - 1];
    $customers = array_filter((array)($sections['customers'] ?? []), static fn($row) =>
        is_array($row) && empty($row['deleted']) && empty($row['deletedAt']) && (string)($row['phone'] ?? '') === $phone);
    if (count($customers) !== 1) throw new DomainException('Утасны дугаараар нэг бүртгэл олдсонгүй.');
    $ci = array_key_first($customers);
    $customer = $customers[$ci];
    $services = array_filter((array)($customer['serviceHistory'] ?? []), static fn($row) =>
        is_array($row) && empty($row['deleted']) && empty($row['deletedAt']) && empty($row['transferClosed'])
        && ($row['kind'] ?? '') === $kind && ($row['service'] ?? $row['title'] ?? '') === $name
        && ($row['salon'] ?? '') === 'Чингэлтэй салбар' && (float)($row['basePrice'] ?? 0) === (float)$base
        && (string)($row['date'] ?? '') === $date && !empty($row['id']));
    if (count($services) !== 1) throw new DomainException('Тохирох нэг үйлчилгээ олдсонгүй. Бүртгэл өөрчлөгдсөн байж болно.');
    $si = array_key_first($services);
    $service = $services[$si];
    if ($case === '5') {
        if (($request['date'] ?? '') !== $date || $date < $cutoff
            || (float)($service['price'] ?? 0) !== 97930.0 || (float)($service['campaignDiscountAmount'] ?? 0) !== 41970.0) {
            throw new DomainException('Төлбөрийн огноо, хямдрал эсвэл засварлах хугацааг шалгана уу.');
        }
        $payments = (array)($service['payments'] ?? []);
        $matched = array_filter($payments, static fn($p) => is_array($p) && !empty($p['id'])
            && empty($p['deleted']) && empty($p['deletedAt']) && empty($p['reversedAt']) && empty($p['bonusAmount'])
            && ($p['method'] ?? '') === 'transfer' && (float)($p['amount'] ?? 0) === 139900.0
            && (float)($p['paidAmount'] ?? 0) === 139900.0 && ($p['createdAt'] ?? '') === '2026-11-19 15:58'
            && ($p['date'] ?? '') === '2026-11-19' && ($p['groupPaymentDate'] ?? '') === '2026-11-19');
        if (count($matched) !== 1) throw new DomainException('Засах нэг төлбөр олдсонгүй. Өмнө нь зассан байж болно.');
        $pi = array_key_first($matched);
        $payments[$pi]['date'] = $date;
        $payments[$pi]['groupPaymentDate'] = $date;
        $payments[$pi]['dateCorrected'] = true;
        $changes = ['payments' => $payments];
        $preview = ['summary' => '139,900₮ · Данс · Төлбөрийн огноо 2026-11-19 → 2026-11-17. Дүн, анх бүртгэсэн цаг, хямдрал хэвээр.', 'date' => $date, 'auditTitle' => 'payment_date_corrected'];
    } elseif ($case === '4') {
        if (($service['prepaidPending'] ?? false) !== true) throw new DomainException('Урьдчилсан үйлчилгээний төлөв өөрчлөгдсөн байна.');
        $payments = (array)($service['payments'] ?? []);
        $matched = array_filter($payments, static fn($p) => is_array($p) && ($p['method'] ?? '') === 'previous_payment'
            && (float)($p['paidAmount'] ?? $p['amount'] ?? 0) === 83930.0 && ($p['createdAt'] ?? '') === '2026-11-17 19:53'
            && ($p['date'] ?? '') === '2026-11-17' && empty($p['bonusAmount']) && !empty($p['id']));
        if (count($matched) !== 1 || '2026-11-17' < $cutoff) throw new DomainException('Тохирох төлбөр олдсонгүй эсвэл засварлах хугацаа дууссан.');
        $pi = array_key_first($matched);
        $payments[$pi]['method'] = 'transfer';
        $payments[$pi]['methodLabel'] = 'Данс';
        $changes = ['payments' => $payments];
        $preview = ['summary' => '83,930₮ · 2026-11-17 19:53 · Өмнө нь төлсөн → Данс. 17-ны кассын орлогод тооцно. Дүн, огноо, урьдчилсан төлөв хэвээр.', 'date' => '2026-11-17'];
    } else {
        if (($request['date'] ?? '') !== '2026-11-17') throw new DomainException('Үйлчилгээ авсан 11-р сарын 17-ны огноог баталгаажуулна уу.');
        if ($date < $cutoff) throw new DomainException('Эх бүртгэлийн засварлах хугацаа дууссан байна.');
        [, , $changes, $preview] = service_campaign_reprice_plan($sections, [
            'customerId' => $customer['id'], 'serviceId' => $service['id'], 'date' => '2026-11-17',
        ], $cutoff, true);
        if ((float)$preview['percent'] !== 30.0 || strtolower((string)preg_replace('/[\s_-]+/', '', $preview['campaign'])) !== 'blackfriday') {
            throw new DomainException('Black Friday 30%-ийн тохиргоотой таарсангүй.');
        }
        $changes['date'] = '2026-11-17';
        $preview['oldDate'] = $date;
    }
    $preview['token'] = hash('sha256', json_encode([$case, $customer['id'], $service, $changes], JSON_THROW_ON_ERROR));
    return [$ci, $si, $changes, $preview];
}

function service_campaign_reprice_plan(array $sections, array $request, string $cutoff, bool $useRequestedDate = false): array
{
    $customerId = (string)($request['customerId'] ?? '');
    $serviceId = (string)($request['serviceId'] ?? '');
    $customers = array_filter((array)($sections['customers'] ?? []), static fn($row) =>
        is_array($row) && $customerId !== '' && (string)($row['id'] ?? '') === $customerId);
    if (count($customers) !== 1) throw new DomainException('Хэрэглэгчийн бүртгэл тодорхойгүй байна.');
    $ci = array_key_first($customers);
    $customer = $customers[$ci];
    $services = array_filter((array)($customer['serviceHistory'] ?? []), static fn($row) =>
        is_array($row) && $serviceId !== '' && (string)($row['id'] ?? '') === $serviceId);
    if (count($services) !== 1 || !empty($customer['deleted']) || !empty($customer['deletedAt'])) throw new DomainException('Үйлчилгээ олдсонгүй.');
    $si = array_key_first($services);
    $service = $services[$si];
    $kind = $service['kind'] ?? '';
    $date = (string)($useRequestedDate ? ($request['date'] ?? '') : ($service['date'] ?? ''));
    $day = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    $salon = (string)($service['salon'] ?? '');
    if (!in_array($kind, ['single', 'course'], true) || !$day || $day->format('Y-m-d') !== $date
        || $salon === '' || $date !== ($request['date'] ?? '') || !empty($service['deleted']) || !empty($service['deletedAt'])
        || !empty($service['transferClosed']) || !empty($service['prepaid'])) {
        throw new DomainException('Үйлчилгээний хадгалсан огноо, төлөвийг шалгана уу.');
    }
    if ($date < $cutoff) throw new DomainException('Засварлах хугацаа дууссан байна.');
    $clean = static fn(string $name): string => trim(preg_replace('/\s+/u', ' ', preg_replace(
        ['/\s*\/\s*\d+\s*удаагийн\s*оролт\s*\/\s*/iu', '/\s*\/\s*хүүхэд\s*\/\s*/iu', '/\s*[Хх]үүхэд\s*/u'], ' ', $name) ?? $name) ?? $name);
    $name = $clean((string)($service['service'] ?? $service['title'] ?? ''));
    $keys = [];
    $priceKeys = [];
    foreach ((array)($sections['_serviceSettings']['data'][$kind] ?? []) as $entry) {
        if (!is_array($entry) || $name === '') continue;
        $names = array_map($clean, array_map('strval', array_merge([$entry['name'] ?? ''], (array)($entry['previousNames'] ?? []))));
        if (!in_array($name, $names, true)) continue;
        $code = (string)($entry['code'] ?? '');
        $key = $kind . ':' . $code . ':' . ($entry['name'] ?? '');
        $keys[$key] = $code !== '' ? $kind . ':' . $code . ':' : '';
        foreach (array_merge([$entry], (array)($entry['priceVersions'] ?? [])) as $version) {
            if (is_array($version) && (float)($version['price'] ?? 0) === (float)($service['basePrice'] ?? 0)) $priceKeys[$key] = $keys[$key];
        }
    }
    if (count($keys) > 1 && count($priceKeys) === 1) $keys = $priceKeys;
    if (count($keys) !== 1) throw new DomainException('Каталогийн үйлчилгээг нэг утгаар таньж чадсангүй. Үйлчилгээний нэр, кодыг шалгана уу.');
    $key = array_key_first($keys);
    $prefix = $keys[$key];
    $eligible = [];
    foreach ((array)($sections['discounts'] ?? []) as $discount) {
        if (!is_array($discount) || empty($discount['id']) || !empty($discount['deleted']) || ($discount['active'] ?? true) === false
            || empty($discount['startDate']) || $discount['startDate'] > $date || (!empty($discount['endDate']) && $discount['endDate'] < $date)
            || !in_array($salon, (array)($discount['salons'] ?? []), true)
            || (!empty($discount['days']) && !in_array($day->format('w'), array_map('strval', (array)$discount['days']), true))
            || (float)($discount['percent'] ?? 0) <= 0) continue;
        foreach ((array)($discount['services'] ?? []) as $selection) {
            if ($selection === $key || ($prefix !== '' && str_starts_with((string)$selection, $prefix))) {
                $eligible[] = $discount;
                break;
            }
        }
    }
    usort($eligible, static fn($a, $b) => (float)$b['percent'] <=> (float)$a['percent'] ?: strcmp((string)$a['id'], (string)$b['id']));
    $campaign = $eligible[0] ?? null;
    if (!$campaign) throw new DomainException('Энэ өдөр, салбар, үйлчилгээнд тохирох хадгалсан хямдрал алга.');
    $base = (float)($service['basePrice'] ?? 0);
    if ($base <= 0) throw new DomainException('Үйлчилгээний анхны үндсэн үнэ байхгүй байна.');
    $employee = (float)($service['employeeDiscountAmount'] ?? 0);
    $extras = 0;
    if ($kind === 'course') {
        foreach ((array)($service['visits'] ?? []) as $visit) {
            $extras += (float)($visit['vipRoomFee'] ?? 0) + (float)($visit['masterStaffFee'] ?? 0);
        }
    } else {
        $extras = (float)($service['vipRoomFee'] ?? 0) + (float)($service['masterStaffFee'] ?? 0);
    }
    $oldDiscount = (float)($service['campaignDiscountAmount'] ?? 0);
    $oldTotal = $kind === 'course' ? max(0, $base + $extras - $employee - $oldDiscount) : (float)($service['price'] ?? 0);
    $percent = min(100, (float)$campaign['percent']);
    $amount = round($base * $percent / 100);
    $total = max(0, $base + $extras - $employee - $amount);
    $payments = (array)($service['payments'] ?? []);
    $paid = $payments ? array_sum(array_map(static fn($row) => (float)(($row['amount'] ?? 0) ?: ($row['paidAmount'] ?? 0)), $payments))
        : max(0, $oldTotal - (float)($service['balance'] ?? 0));
    if (!$payments && $paid > $total) throw new DomainException('Төлбөрийн задаргаагүй хуучин бичлэгт илүү төлөлт үүсэх тул автоматаар тооцохгүй.');
    $balance = max(0, $total - $paid);
    $snapshot = ['id' => $campaign['id'], 'name' => (string)($campaign['name'] ?? ''), 'percent' => $percent, 'serviceKey' => $key];
    $changes = ['campaignDiscount' => $snapshot, 'campaignDiscountAmount' => $amount, 'serviceCommissionBasisVersion' => 1, 'balance' => $balance];
    if ($kind === 'single') $changes['price'] = $total;
    if (array_replace($service, $changes) == $service) throw new DomainException('Энэ хямдрал аль хэдийн тооцогдсон байна.');
    $basis = static fn(float $discount): float => $base - $employee - $discount > 0
        ? $base * min(1, $paid / ($base - $employee - $discount)) : 0;
    $preview = ['date' => $date, 'salon' => $salon, 'service' => $name, 'campaign' => $snapshot['name'], 'percent' => $percent,
        'oldTotal' => $oldTotal, 'total' => $total, 'paid' => $paid, 'balance' => $balance, 'overpaid' => max(0, $paid - $total),
        'basisDelta' => $basis($amount) - ((int)($service['serviceCommissionBasisVersion'] ?? 0) === 1 ? $basis($oldDiscount) : min($base, $paid)),
        'token' => hash('sha256', json_encode([$customerId, $service, $changes], JSON_THROW_ON_ERROR))];
    return [$ci, $si, $changes, $preview];
}
