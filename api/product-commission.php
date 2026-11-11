<?php
declare(strict_types=1);

function product_commission_paid(array $item): float
{
    $payments = is_array($item['payments'] ?? null) ? $item['payments'] : [];
    if ($payments !== []) return array_sum(array_map(static fn($row): float => is_array($row) ? (float)($row['amount'] ?? $row['paidAmount'] ?? 0) : 0.0, $payments));
    return max(0.0, (float)($item['price'] ?? 0) - (float)($item['balance'] ?? 0));
}

function assert_product_commission_contracts(array $current, array $incoming): void
{
    $old = [];
    foreach ((array)($current['customers'] ?? []) as $customer) {
        if (!is_array($customer)) continue;
        foreach ((array)($customer['serviceHistory'] ?? []) as $item) {
            if (is_array($item)) $old[(string)($customer['id'] ?? '')][(string)($item['id'] ?? '')] = $item;
        }
    }
    foreach ((array)($incoming['customers'] ?? []) as $customer) {
        if (!is_array($customer)) continue;
        foreach ((array)($customer['serviceHistory'] ?? []) as $item) {
            if (!is_array($item)) continue;
            $previous = $old[(string)($customer['id'] ?? '')][(string)($item['id'] ?? '')] ?? null;
            $hasBasis = ($item['cashierCommissionBasisVersion'] ?? null) === 1;
            $hadBasis = ($previous['cashierCommissionBasisVersion'] ?? null) === 1;
            if (!$hasBasis && !$hadBasis) continue;
            if (!$hasBasis || !in_array($item['kind'] ?? '', ['kass', 'product'], true)) throw new DomainException('Барааны урамшууллын суурийн нөхцөл буруу байна.');
            if ($previous && product_commission_paid($previous) > 0) {
                if (!$hadBasis) throw new DomainException('Өмнө төлбөр орсон борлуулалтын урамшууллыг шинэ дүрмээр солих боломжгүй.');
                foreach (['price', 'basePrice', 'cashierCommissionBase', 'products', 'productDiscountAmount', 'employeeDiscountAmount'] as $key) {
                    if (($item[$key] ?? null) != ($previous[$key] ?? null)) throw new DomainException('Төлбөр орсон борлуулалтын үнэ, урамшууллын суурийг өөрчлөх боломжгүй.');
                }
            }
            $base = 0.0;
            $total = 0.0;
            foreach ((array)($item['products'] ?? []) as $product) {
                if (!is_array($product)) continue;
                $qty = (float)($product['qty'] ?? 0);
                $price = (float)($product['price'] ?? -1);
                $unitPrice = (float)($product['unitPrice'] ?? -1);
                if ($qty < 1 || floor($qty) !== $qty || $price < 0 || $unitPrice < 0 || $unitPrice > $price || abs((float)($product['lineTotal'] ?? -1) - $unitPrice * $qty) > 0.01) {
                    throw new DomainException('Барааны үндсэн болон хямдарсан үнийн тооцоо зөрүүтэй байна.');
                }
                $base += $price * $qty;
                $total += $unitPrice * $qty;
            }
            if (abs((float)($item['cashierCommissionBase'] ?? -1) - $base) > 0.01 || abs((float)($item['basePrice'] ?? -1) - $base) > 0.01
                || abs((float)($item['productDiscountAmount'] ?? -1) - ($base - $total)) > 0.01
                || abs((float)($item['price'] ?? -1) - max(0, $total - (float)($item['employeeDiscountAmount'] ?? 0))) > 0.01) {
                throw new DomainException('Борлуулалтын төлбөр болон үндсэн үнээс бодох урамшууллын суурь зөрүүтэй байна.');
            }
        }
    }
}
