<?php
declare(strict_types=1);

function prepaid_service_pending(array $item): bool
{
    return ($item['kind'] ?? '') === 'single' && ($item['prepaid'] ?? false) === true && ($item['prepaidPending'] ?? false) === true;
}

function prepaid_service_completing(array $old, array $new): bool
{
    return prepaid_service_pending($old) && ($new['prepaid'] ?? false) === true && ($new['prepaidPending'] ?? null) === false;
}

function assert_prepaid_services_preserved(array $current, array $incoming, array $user = []): void
{
    $oldCustomers = [];
    foreach ((array)($current['customers'] ?? []) as $customer) {
        if (is_array($customer)) $oldCustomers[(string)($customer['id'] ?? '')] = $customer;
    }
    $today = (new DateTimeImmutable('today', new DateTimeZone('Asia/Ulaanbaatar')))->format('Y-m-d');
    foreach ((array)($incoming['customers'] ?? []) as $customer) {
        if (!is_array($customer)) continue;
        $oldServices = [];
        foreach ((array)($oldCustomers[(string)($customer['id'] ?? '')]['serviceHistory'] ?? []) as $item) {
            if (is_array($item)) $oldServices[(string)($item['id'] ?? '')] = $item;
        }
        foreach ((array)($customer['serviceHistory'] ?? []) as $item) {
            if (!is_array($item)) continue;
            $old = $oldServices[(string)($item['id'] ?? '')] ?? null;
            if (empty($item['prepaid']) && empty($old['prepaid'])) continue;
            if (($item['prepaid'] ?? false) !== true || ($item['kind'] ?? '') !== 'single' || !is_bool($item['prepaidPending'] ?? null)) {
                throw new DomainException('Урьдчилсан үйлчилгээний төлөв буруу байна.');
            }
            if (prepaid_service_pending($item)) {
                if (!empty($item['date']) || !empty($item['staff']) || !empty($item['staffId']) || !empty($item['performedSalon'])) {
                    throw new DomainException('Урьдчилсан үйлчилгээнд огноо, ажилтан урьдчилан оноохгүй.');
                }
            } else {
                $date = (string)($item['date'] ?? '');
                $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
                if (!$parsed || $parsed->format('Y-m-d') !== $date || $date > $today || empty($item['staff']) || empty($item['performedSalon'])) {
                    throw new DomainException('Үйлчилгээ үзүүлсэн огноо, салбар, ажилтан зөв сонгоно уу.');
                }
                if (!$old || prepaid_service_completing($old, $item)) {
                    if (($user['role'] ?? '') === 'salon' && ($item['performedSalon'] ?? '') !== ($user['salon'] ?? '')) {
                        throw new DomainException('Өөр салбарт үйлчилгээ бүртгэх эрхгүй.');
                    }
                }
            }
            if (!$old) {
                if (!prepaid_service_pending($item)) throw new DomainException('Эхлээд урьдчилсан үйлчилгээг бүртгэнэ.');
                continue;
            }
            // Payments and balance can change independently, but fulfillment
            // must never reprice or move the original cash transaction.
            foreach (['kind', 'prepaid', 'salon', 'title', 'service', 'price', 'basePrice', 'createdAt', 'registeredAt', 'employeeDiscountPercent', 'employeeDiscountAmount', 'vipRoom', 'vipRoomFee', 'masterStaffFee'] as $key) {
                if (($item[$key] ?? null) != ($old[$key] ?? null)) throw new DomainException('Урьдчилсан үйлчилгээний анхны үнэ, төлбөрийн салбарыг өөрчлөх боломжгүй.');
            }
            if (!prepaid_service_pending($old)) {
                foreach (['prepaidPending', 'date', 'staff', 'staffId', 'performedSalon', 'performedAt'] as $key) {
                    if (($item[$key] ?? null) != ($old[$key] ?? null)) throw new DomainException('Энэ урьдчилсан үйлчилгээ аль хэдийн үзүүлсэн байна.');
                }
            }
        }
    }
}
