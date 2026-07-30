# Халгай системийн өгөгдлийн аюулгүй байдал, ажиллагааны аудит

Огноо: 2026-07-31
Хамрах хүрээ: одоогийн source code, сервер хадгалалт, зэрэгцээ хэрэглээ, backup/restore, салбарын эрх, зураг хадгалалт, frontend sync, автомат тест
Зорилго: өдөр тутмын ажилд саад болохгүй, 10+ салбарт өсөхөд хурдан хэвээр, өгөгдөл алдагдсан тохиолдолд салбарын Chrome файлаас хамаарахгүйгээр серверээс сэргээдэг систем болгох

## 1. Товч дүгнэлт

Одоогийн системийн хамгийн том суурь эрсдэл нь олон төрлийн мэдээллийг MySQL дотор тус бүрийн мөрөөр бус, том JSON хэсгүүдээр хадгалж байгаад байна. Хэрэглэгчийн мэдээлэл дээр саяхан entity-level mutation нэвтрүүлсэн нь өмнөх хоёр төхөөрөмжийн өөрчлөлт бие биеэ дардаг гол алдааг зөв чиглэлээр зассан. Гэхдээ bookings, kassSchedules, giftCards, voucherLogs, staff зэрэг бусад идэвхтэй хэсэг бүхлээрээ хадгалагдсаар байна.

Одоогийн хамгаалалт өгөгдлийг шууд чимээгүй дарж алдахаас хэсэгчлэн хамгаалдаг боловч:

- зөрчил үүсэхэд энгийн үйлдлийг автоматаар найдвартай дахин гүйцээдэггүй;
- устгалаас бусад засварын өмнөх утгыг сервер дээр бүрэн хадгалдаггүй;
- зураг DB хадгалалтаас өмнө бүр мөсөн устах боломжтой;
- rolling backup серверийн cron-оор ажиллаж байгаа эсэх source code-оос баталгаажаагүй, admin browser-оос ажиллах fallback-тай;
- backup-ууд үндсэн системтэй ижил hosting account дээр байна;
- 10+ салбарын үед бүх хэрэглэгчийн том JSON-ийг татаж, боловсруулж, хэсгээр нь бүхлээр бичих загвар удаашрал ба зөрчлийг нэмэгдүүлнэ.

Иймд системийг шууд томоор дахин бичих шаардлагагүй. Эхлээд сервер талд алдахгүй, давхардахгүй үйлдлийн суурь давхарга нэмж, дараа нь өндөр ачаалалтай хэсгүүдийг үе шаттайгаар тусдаа хүснэгт/API болгох нь хамгийн аюулгүй.

## 2. Баталгаатай эерэг хамгаалалтууд

- MySQL write нь transaction дотор явагдаж, global revision row-ийг `FOR UPDATE` түгждэг.
- Section revision ашиглан хуучин state-аар шинэ мэдээлэл дарахыг илрүүлдэг.
- Хэрэглэгчийн түгээмэл service/payment/profile хадгалалтад entity-level mutation болон fingerprint conflict шалгалт нэмэгдсэн.
- Салбарын эрхтэй хэрэглэгчийн bookings, kass, service зэрэг салбарын мөрүүдийг сервер дээр бусад салбараас салгаж merge хийдэг.
- Public booking endpoint transaction ашиглаж, тухайн өдрийн утасны давхардал болон slot capacity-г сервер дээр шалгадаг.
- Устсан customer/service/payment-ийг 30 хоног recovery journal-д тэмдэглэдэг.
- Rolling backup нь gzip, temp file + atomic rename, file lock, private folder хамгаалалттай.
- Restore хийхийн өмнө одоогийн төлөвийн нэмэлт backup үүсгэдэг.
- Session cookie нь Secure, HttpOnly, SameSite=Strict; write хүсэлтэд same-origin болон custom header шалгалттай.
- Одоогийн гурван JavaScript regression test амжилттай; `app.js`, `public.js`, `diagnostics.js` syntax шалгалт амжилттай.

## 3. Нэн өндөр эрсдэл

### P0-1. Backup browser-оос хамаарах эрсдэлтэй

Rolling backup endpoint CLI cron дэмждэг боловч frontend-ийн автомат дуудагч нь зөвхөн admin нэвтэрсэн, хуудас нээлттэй үед ажиллана. Full backup мөн admin хуудас нээгдэхэд шалгагдана. Hostinger cron үнэхээр тохирсон эсэхийг repository нотлохгүй.

Үр дагавар:

- admin хэдэн цаг/өдөр системд орохгүй бол backup тасалдах боломжтой;
- backup ажиллахгүй байгааг хэн ч мэдэхгүй өнгөрөх боломжтой;
- салбарын browser файл дахин recovery-ийн цорын ганц эх үүсвэр болох эрсдэлтэй.

Шийдэл:

1. Hostinger cron-оор rolling backup-ийг browser-оос үл хамааран тогтмол ажиллуулах.
2. `backup_runs` health record үүсгэж, хамгийн сүүлийн амжилт, хэмжээ, revision, checksum, алдааг серверт бичих.
3. Admin нүүрэнд “Сүүлийн backup хэвийн/хоцорсон” гэсэн жижиг төлөв л харуулах; ажилтанд popup үзүүлэхгүй.
4. Өдөрт нэг удаа backup-ийг өөр hosting/storage руу хуулдаг off-site backup нэмэх.

### P0-2. Recovery journal бүрэн үйлдлийн түүх биш

Одоогийн journal нь зөвхөн устсан customer/service/payment/group-ийн payload хадгалдаг. Засварын өмнөх утга, шинээр нэмсэн зүйл, booking, gift card, voucher, staff, schedule зэрэг өөрчлөлт бүрийг сэргээх боломжгүй. `app_write_log` нь payload/diff биш зөвхөн revision, actor, sections, removed count хадгалдаг.

Үр дагавар:

- буруу засагдсан эсвэл JSON overwrite болсон мэдээллийг яг өмнөхөөр нь сэргээх боломжгүй;
- backup хоорондын 6 цаг хүртэлх өөрчлөлт алдагдаж болно;
- “хэн, юу, өмнө нь ямар байсан, дараа нь ямар болсон” гэдгийг бүрэн тогтоох боломжгүй.

Шийдэл:

- Үйлдэл бүрийн `mutation_id`, entity type/id, салбар, actor, before, after, created_at хадгалдаг append-only `app_change_events` хүснэгт нэвтрүүлэх.
- Event болон үндсэн өгөгдлийн write-ийг нэг DB transaction-д хийх.
- Ижил `mutation_id` дахин ирвэл давхар бүртгэхгүй, өмнөх амжилттай хариуг буцаах.
- 90 хоногийн online event history, дараа нь gzip archive хадгалах.

### P0-3. Зураг устгал DB хадгалалтаас өмнө бүр мөсөн хийгддэг

Оношилгооны үйлчилгээ устгахад эхлээд media файл unlink хийгээд, дараа нь customer state хадгалж байна. DB save conflict/failure гарвал үйлчилгээ DB-д үлдэж, зураг файл нь аль хэдийн устсан байна.

Шийдэл:

- UI үйлдэл дээр файл unlink хийхгүй.
- Эхлээд DB transaction амжилттай commit хийх.
- Файлыг `media_trash`/soft-delete төлөвт 30 хоног хадгалах.
- Reference байхгүй файлыг серверийн background cleanup дараа нь устгах.
- Delete endpoint нь filename мэддэг байхад хангалттай биш, тухайн entity-тэй холбоотой эсэх болон actor-ын эрхийг шалгах.

### P0-4. Хэрэглэгчээс бусад өндөр давтамжтай хэсэг бүхэл JSON хэвээр

Bookings, kassSchedules, giftCards, voucherLogs, staff, assignments болон зарим тохиргоо section бүхлээр хадгалагдана. Revision conflict өгөгдөл дарагдахаас хамгаалах боловч тухайн хэрэглэгчийн үйлдэл серверт орохгүй, дахин хийх шаардлага үүснэ.

Шийдэл:

- Дараах дарааллаар entity endpoint болгох:
  1. bookings;
  2. service/payment/diagnosis/visit;
  3. kass transactions болон schedules;
  4. gift cards/vouchers;
  5. staff/assignments.
- Үйлдэл бүр POST/PATCH/DELETE биш, business operation хэлбэртэй байна: `create_booking`, `add_service`, `record_payment`, `add_visit`, `cancel_service`.
- Backend тухайн entity мөрийг lock хийгээд transaction дотор өөрчилнө.

## 4. Өндөр эрсдэл ба 10+ салбарын саад

### P1-1. Нэг global revision lock бүх write-ийг цуваа болгодог

Одоогоор хоёр салбарт аюулгүй талдаа боловч бүх төрлийн write нэг `app_meta.revision` мөр дээр түгжигдэнэ. 10+ салбар, public booking, kass, diagnosis, payment зэрэг зэрэг ирэхэд хүлээлт болон lock timeout өснө.

Шийдэл:

- Богино хугацаанд transaction-ийг аль болох жижиг байлгах.
- Entity table-д шилжихдээ customer/booking/payment зэрэг тусдаа row lock ашиглах.
- Global revision-ийг зөвхөн cache invalidation sequence болгох; write serialization-д ашиглахгүй.

### P1-2. Бүх customer section-ийг бүх салбар татдаг

Salon account салбарын operational хэсгээ шүүж авдаг ч customer/customerGroups shared тул бүх хэрэглэгчийн мэдээллийг татна. Өгөгдөл өсөхөд network, JSON parse, memory, render хугацаа нэмэгдэнэ. API payload limit 50 MB.

Шийдэл:

- Customer list-ийг server-side pagination/search болгох.
- Нэр/утас/салбар/огнооны index бүхий customer table ашиглах.
- Profile нээх үед зөвхөн тухайн customer, service history, payment-ийг татах.
- Dashboard aggregation-ийг raw customer JSON таталгүй сервер query-ээр авах.

### P1-3. Public bookings 5000 мөрөөр тайрагдана

Public booking үүсэхэд bookings массивыг хамгийн шинэ 5000-аар тасалдаг. Энэ нь хуучин booking history-г идэвхтэй section-ээс чимээгүй хасна. 10 салбарт 5000 нийт booking богино хугацаанд дүүрнэ.

Шийдэл:

- Booking-ийг мөр тус бүрийн хүснэгт болгох.
- Active/history-г date index-ээр query хийх.
- Retention/archival-ийг ил тод policy-оор хийх; array slice ашиглан чимээгүй устгахгүй.

### P1-4. Source migration нь login үеэр production data-г автоматаар засаж хадгалдаг

Server data ачаалахад нэр normalization, bonus rule migration, embedded image cleanup ажиллаж, өөрчлөгдсөн section-ийг автоматаар save хийдэг. Migration-г бүх browser дээр runtime хийх нь зөрчил, том write, санаандгүй өгөгдөл хувиргалт үүсгэх эрсдэлтэй.

Шийдэл:

- Migration бүрийг version-тэй server-side нэг удаагийн script болгох.
- Dry-run + backup + row counts + checksum шалгасны дараа ажиллуулах.
- Page load/render функц хэзээ ч production өгөгдөл автоматаар өөрчилж хадгалахгүй байх.

### P1-5. Server authorization нь зарим хэсэгт UI-д хэт найддаг

Salon role-ийн зарим section серверээр хязгаарлагдсан ч shared customer object бүхлээр mutation хийх боломжтой. Backend business operation түвшинд “энэ salon зөвхөн өөрийн салбарын service/payment-ийг өөрчилж байна уу” гэдгийг нарийн шалгахгүй. Manager нь salon биш тул state endpoint дээр admin-тэй төстэй өргөн хүрээнд бичих боломжтой.

Шийдэл:

- Permission matrix-ийг backend operation бүр дээр хэрэгжүүлэх.
- Customer ерөнхий profile shared байж болно; service/payment/diagnosis нь salon ownership-той тусдаа entity байна.
- Admin, manager, salon эрх тус бүрийн API integration test нэмэх.

## 5. Дунд эрсдэл ба ажиллагааны асуудал

- Revision polling идэвхтэй дэлгэц бүрт 10 секунд тутам ажиллана. 10 салбарын олон tab дээр DB request болон том JSON download өснө.
- Schema `CREATE TABLE IF NOT EXISTS` болон policy migration шалгалт API request бүрт ажиллана.
- Full backup ердөө 2 хувилбар, 30 хоногийн зайтай; нэг hosting account дээр байрлана.
- Full backup DB snapshot авсны дараа media-г цуглуулдаг тул DB ба media яг нэг агшны төлөв биш.
- Full backup хийх endpoint PHP session lock-ийг удаан барьж, admin-ийн бусад request-ийг саатуулж болно.
- Login rate limit зөвхөн тухайн session-д тул шинэ session-ээр тойрох боломжтой.
- Recovery UI 100 journal мөр л харуулдаг, entity-level restore байхгүй.
- Whole-system restore бүх section-ийг устгаад сольдог; нэг хэрэглэгч/booking сэргээхэд хэт өргөн.
- Runtime үйлдлийн error log server файлд байна, admin-д searchable incident dashboard байхгүй.

## 6. Ажилтанд саад болохгүй UX зарчим

Энгийн ажилтан transaction, revision, conflict гэсэн ойлголт мэдэх шаардлагагүй.

Хэвийн урсгал:

1. “Хадгалах” нэг удаа дарна.
2. Товч богино хугацаанд “Хадгалж байна” болно.
3. Сүлжээ түр тасарвал үйлдэл durable outbox-д үлдэж, систем автоматаар дахин илгээнэ.
4. Ижил mutation server дээр өмнө нь амжилттай орсон бол давхардуулахгүй “Хадгалагдсан” гэж баталгаажуулна.
5. Зөвхөн яг нэг мэдээллийг хоёр хүн зэрэг өөр утгаар зассан үед сонголт шаардсан conflict харуулна.

Popup биш байнгын жижиг төлөв ашиглана:

- Хадгалагдсан
- Хадгалж байна
- Сүлжээ хүлээж байна — автоматаар үргэлжилнэ
- Админ шалгах шаардлагатай (incident ID)

Browser refresh/хаалт нь амжилтгүй үйлдлийг арилгах ёсгүй. Гэхдээ recovery-ийн үндсэн эх үүсвэр browser биш server-side operation log байна.

## 7. Server-only recovery төлөвлөгөө

Admin recovery center дараах боломжтой байна:

- нэр, утас, огноо, салбар, entity төрөл, actor-аар хайх;
- entity-ийн timeline харах;
- before/after diff харах;
- устсан customer/service/payment/booking/diagnosis-ийг сонгон сэргээх;
- restore хийхийн өмнө dry-run болон нөлөөлөх мөрийн тоо харах;
- restore өөрөө шинэ event болж бүртгэгдэх;
- бүх системийг ухраахгүйгээр зөвхөн нэг entity сэргээх;
- хамгийн сүүлийн backup болон event log-ийн health status харах;
- downloadable incident package гаргах.

Recovery зорилт:

- RPO: амжилттай гэж хэрэглэгчид харуулсан үйлдэл 0 алдагдалтай.
- RTO: нэг customer/booking-ийг 5–15 минутын дотор admin-аас сэргээх.
- Бүтэн server эвдрэл: off-site backup-аас сэргээх.

## 8. Хэрэгжүүлэх хамгийн аюулгүй дараалал

### Release A — Нэн даруй, бага эрсдэлтэй суурь

- Hostinger cron-ийг баталгаажуулж, backup health heartbeat нэмэх.
- Off-site daily backup нэмэх.
- Media soft-delete/trash нэвтрүүлэх.
- Runtime auto-migration save-г зогсоож server migration болгох.
- Public booking 5000 slice-г history table/архивтай болтол чимээгүй устгалгүй болгох.
- Data-loss болон backup alarm-ийг зөвхөн admin-д харуулах.

### Release B — Operation journal ба idempotency

- `app_operations`/`app_change_events` хүснэгт.
- `mutation_id` unique index.
- Before/after event нэг transaction.
- Server outbox/retry semantics.
- Admin read-only recovery search/diff.

Энэ release хамгийн түрүүнд customer/service/payment/diagnosis/booking дээр хэрэгжинэ.

### Release C — Өндөр ачаалалтай entity tables

- customers;
- customer_services;
- payments;
- course_visits;
- diagnoses;
- bookings;
- media_assets.

Тохиргооны ховор өөрчлөгддөг жижиг section-үүд JSON хэвээр байж болно.

### Release D — 10 салбарын load ба failover тест

- 10 салбар × олон зэрэг хэрэглэгчийн write simulation;
- public/admin booking race;
- сүлжээ тасалдах/timeout/retry;
- duplicate submit/idempotency;
- DB deadlock/lock timeout;
- backup corruption/checksum;
- point-in-time/selective restore drill;
- 50k+ customer, 500k+ payment/booking dataset performance test.

## 9. Шаардлагатай автомат тестүүд

Одоогийн 3 JS regression test нь чухал боловч хангалтгүй.

Заавал нэмэх:

1. Хоёр салбар өөр хоёр customer зэрэг засахад хоёулаа хадгалагдах.
2. Нэг customer-ийн өөр service-үүд зэрэг нэмэгдэхэд аль аль нь хадгалагдах.
3. Ижил mutation 2–5 удаа retry хийхэд нэг л operation үүсэх.
4. Response тасарсан ч commit болсон үед retry duplicate үүсгэхгүй.
5. Payment, voucher, gift card нэг transaction-д бүгд эсвэл юу ч үгүй байх.
6. Diagnosis DB save бүтэлгүйтвэл зураг устахгүй байх.
7. Salon A нь Salon B-ийн service/payment-ийг өөрчилж чадахгүй байх.
8. Public болон admin booking нэг slot-д зэрэг орвол capacity хэтрэхгүй байх.
9. Backup restore checksum болон entity counts таарах.
10. Нэг entity selective restore бусад entity-д нөлөөлөхгүй байх.
11. 10 салбарын load test-д p95 save хугацаа зорилтот хэмжээнд байх.

Санал болгох performance зорилт:

- Энгийн save p95 < 500 ms;
- list/search p95 < 700 ms;
- profile open p95 < 1 s;
- dashboard p95 < 2 s;
- duplicate mutation = 0;
- acknowledged operation loss = 0.

## 10. Энэ аудитаар шууд баталгаажуулж чадаагүй зүйл

Repository-оос дараах production орчны баримтыг шалгах боломжгүй:

- Hostinger cron үнэхээр идэвхтэй эсэх;
- MySQL error/deadlock/slow query log;
- backup файлууд бодитоор хугацаандаа үүссэн эсэх;
- storage quota болон disk usage;
- Hostinger-ийн binlog/PITR боломж;
- backup-ийг өөр account/storage руу хуулдаг эсэх;
- live database-ийн одоогийн хэмжээ, table/section byte size;
- хамгийн сүүлийн restore drill амжилттай болсон эсэх.

Эдгээрийг production-д write хийхгүй read-only байдлаар тусад нь шалгах шаардлагатай.

## 11. Эцсийн үнэлгээ

Одоогийн build нь өмнөх бүхэл customer state overwrite алдаанаас илүү аюулгүй болсон. Гэхдээ “өгөгдөл алдагдах боломжгүй, server-ээс бүрэн сэргээнэ, 10 салбар даана” гэсэн түвшинд хараахан хүрээгүй.

Хамгийн зөв дараагийн алхам нь том UI өөрчлөлт эсвэл олон popup биш. Эхлээд:

1. server cron + off-site backup;
2. transaction доторх append-only operation history;
3. idempotent mutation;
4. media soft-delete;
5. customer/service/payment/booking-ийг entity API болгох;
6. selective admin recovery.

Энэ дараалал өгөгдлийн аюулгүй байдлыг нэмэхийн зэрэгцээ өдөр тутмын ажиллагааг хөнгөвчилж, салбар нэмэгдэхэд системийг удаашруулахгүй.
