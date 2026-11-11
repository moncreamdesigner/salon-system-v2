<?php
declare(strict_types=1);

function assert_service_campaign_contracts(array $current, array $incoming): void
{
    $old = [];
    foreach ((array)($current['customers'] ?? []) as $customer) {
        if (!is_array($customer)) continue;
        foreach ((array)($customer['serviceHistory'] ?? []) as $item) {
            if (is_array($item)) $old[(string)($customer['id'] ?? '')][(string)($item['id'] ?? '')] = $item;
        }
    }
    $discounts = [];
    foreach ((array)($current['discounts'] ?? []) as $discount) {
        if (is_array($discount)) $discounts[(string)($discount['id'] ?? '')] = $discount;
    }
    foreach ((array)($incoming['customers'] ?? []) as $customer) {
        if (!is_array($customer)) continue;
        foreach ((array)($customer['serviceHistory'] ?? []) as $item) {
            if (!is_array($item) || !in_array($item['kind'] ?? '', ['single', 'course'], true)) continue;
            $previous = $old[(string)($customer['id'] ?? '')][(string)($item['id'] ?? '')] ?? null;
            if ($previous) {
                foreach (['campaignDiscountAmount', 'campaignDiscount', 'serviceCommissionBasisVersion'] as $key) {
                    if (($item[$key] ?? null) != ($previous[$key] ?? null)) throw new DomainException('Өмнө бүртгэсэн үйлчилгээний хямдралын нөхцөлийг автоматаар солих боломжгүй.');
                }
                continue;
            }
            $snapshot = $item['campaignDiscount'] ?? null;
            if (!$snapshot) {
                if ((float)($item['campaignDiscountAmount'] ?? 0) !== 0.0 || !empty($item['serviceCommissionBasisVersion'])) throw new DomainException('Үйлчилгээний хямдралын бүртгэл буруу байна.');
                continue;
            }
            $discount = is_array($snapshot) ? ($discounts[(string)($snapshot['id'] ?? '')] ?? null) : null;
            $date = substr((string)(!empty($item['prepaidPending']) ? ($item['createdAt'] ?? '') : ($item['date'] ?? '')), 0, 10);
            $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
            $key = (string)($snapshot['serviceKey'] ?? '');
            $parts = explode(':', $key, 3);
            $prefix = count($parts) === 3 && $parts[1] !== '' ? $parts[0] . ':' . $parts[1] . ':' : '';
            $selected = false;
            foreach ((array)($discount['services'] ?? []) as $selection) {
                if ($selection === $key || ($prefix !== '' && str_starts_with((string)$selection, $prefix))) $selected = true;
            }
            $valid = $discount && empty($discount['deleted']) && ($discount['active'] ?? true) !== false
                && $parsed && $parsed->format('Y-m-d') === $date && ($parts[0] ?? '') === $item['kind'] && $selected
                && ($discount['startDate'] ?? '') !== '' && $discount['startDate'] <= $date
                && (empty($discount['endDate']) || $discount['endDate'] >= $date)
                && in_array($item['salon'] ?? '', (array)($discount['salons'] ?? []), true)
                && (empty($discount['days']) || in_array($parsed->format('w'), array_map('strval', (array)$discount['days']), true));
            $percent = min(100, max(0, (float)($discount['percent'] ?? 0)));
            if (!$valid || $percent <= 0 || (float)($snapshot['percent'] ?? 0) !== $percent
                || (int)($item['serviceCommissionBasisVersion'] ?? 0) !== 1
                || (float)($item['campaignDiscountAmount'] ?? 0) !== round((float)($item['basePrice'] ?? 0) * $percent / 100)) {
                throw new DomainException('Хямдралын сонголт, огноо эсвэл хувь шинэчлэгдсэн байна. Хуудсаа шинэчлээд үйлчилгээг дахин сонгоно уу.');
            }
        }
    }
}
