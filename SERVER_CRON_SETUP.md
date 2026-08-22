# Khalgai server backup cron

Энэ тохиргоо admin browser нээлттэй эсэхээс үл хамааран backup болон maintenance ажиллуулна.

## Hostinger дээр тохируулах

Hostinger-ийн **Advanced → Cron Jobs** хэсэгт төслийн бодит absolute path-ыг ашиглан дараах ажлуудыг үүсгэнэ. Доорх `/home/ACCOUNT/domains/salon.khalgai.mn/public_html` хэсгийг Hostinger File Manager дээр харагдах бодит замаар солино.

### 1. Rolling backup — 6 цаг тутам

```sh
php /home/ACCOUNT/domains/salon.khalgai.mn/public_html/api/rolling-backups.php
```

Schedule:

```text
0 */6 * * *
```

Энэ ажил:

- сүүлийн 7 хоногийн 28 rolling backup-ыг хадгална;
- backup бүрийн SHA-256 checksum-ыг үүсгэнэ;
- 2 жилээс хуучин цагийн захиалгыг backup амжилттай болсны дараа archive руу шилжүүлнэ;
- 30 хоног болсон зургийн trash болон хугацаа дууссан техникийн түүхийг цэвэрлэнэ;
- `last_server_cron_at` heartbeat шинэчилнэ.

### 2. Full backup — өдөр бүр шалгах

```sh
php /home/ACCOUNT/domains/salon.khalgai.mn/public_html/api/full-backups.php
```

Schedule:

```text
25 3 * * *
```

Cron өдөр бүр ажиллах боловч 30 хоног болоогүй бол шинэ full backup үүсгэхгүй. Ингэснээр сарын backup browser-оос хамаарахгүй.

### 3. SMS сануулга — Монголын ажлын цагаар цаг тутам

```sh
/usr/bin/php /home/ACCOUNT/domains/salon.khalgai.mn/public_html/api/sms-reminders.php
```

Hostinger cron UTC timezone ашиглаж байвал Монголын 06:00–20:00 цагт тохирох schedule:

```text
0 22-23,0-12 * * *
```

Hostinger өөр timezone ашиглаж байвал эхлээд `date` командаар шалгаад Монголын 06:00–20:00-д тааруулна. Endpoint нь дотроо `Asia/Ulaanbaatar` timezone ашиглана. Тухайн өдөр ажиллаж буй салбаруудын хамгийн сүүлийн боломжит слот болон админы сануулах хугацаанаас хойш SMS queue-г шалгахгүй.

## Нэвтрүүлсний дараах шалгалт

1. Hostinger cron-ыг `Run now` хийж exit code 0 эсэхийг шалгана.
2. Admin → Database → Backup хэсэгт **Server backup хэвийн** болон хамгийн сүүлийн cron цаг гарсныг шалгана.
3. Шинэ rolling backup-ыг татаж, metadata дахь checksum байгаа эсэхийг шалгана.
4. Full backup жагсаалтад хамгийн сүүлийн автомат backup харагдаж байгаа эсэхийг шалгана.
5. Backup хавтас web-ээр шууд нээгдэхгүй байгааг шалгана.

## Анхаарах зүйл

- Cron command-д нууц үг, database credential бичихгүй.
- Browser URL-г cron-оор дуудахгүй; зөвхөн PHP CLI command ашиглана.
- `khalgai-backups` болон `khalgai-media-storage` хавтас Git deploy-оор солигдох ёсгүй.
- Server-ийн цагийн бүс өөр байсан ч бизнесийн огнооны логик `Asia/Ulaanbaatar`-ыг ашиглана.
