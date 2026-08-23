# Khalgai System V2 — бүрэн audit

Огноо: 2026-08-23  
Шалгасан commit: `5b2f6b3`  
Хамрах хүрээ: live-д deploy хийсэн web client, PHP API, өгөгдөл хадгалалт, салбарын эрх, concurrency, backup, paging/read-model, booking, SMS болон regression test.

## Товч дүгнэлт

Системийг бүхэлд нь хуучин байдлаар ажиллаж байна гэж дүгнэхгүй. Booking, хэрэглэгчийн жагсаалт/дэлгэрэнгүй, dashboard, гүйцэтгэлийн source, audit, SMS history, voucher, gift card зэрэг олон унших урсгал server-side filter, pagination эсвэл summary/read-model болсон.

Гэхдээ шинэ архитектурыг тойрч хуучин бүх-state урсгал руу ордог гурван conflict fallback үлдсэн. Мөн хэрэглэгчийн төлбөртэй үйлчилгээ устгах болон төлбөрийн дагалдах өөрчлөлтүүд customer, group, voucher, gift-card гэсэн олон section-д нэг атомик server transaction-аар хийгдэхгүй байна. Эдгээр нь ажиллагаа удаашрах, хамгаалалтын popup давтагдах, хэсэгчилсэн ledger зөрөх хамгийн өндөр эрсдэл юм.

Иймээс одоогийн хувилбарыг шууд цэвэр суурь болгон хуулж, бүх хуучин local файлыг устгах нь эрт. Эхлээд доорх P0 засваруудыг хийх, бодит PHP/MySQL орчинд concurrency/regression test хийх, дараа нь шинэ цэвэр folder үүсгэх нь зөв.

## Илэрсэн асуудлууд

### P0 — нэн түрүүнд засах

1. **Conflict үед бүх state-ийг дахин татдаг хуучин зам үлдсэн**

   `app.js`-ийн protected-data, duplicate-phone, revision-conflict гэсэн 3 салаа `serverApi("state.php")`-г section параметргүй дууддаг. Энэ нь бүх section-ийг ачаалж browser state-д нийлүүлнэ.

   Нөлөө:

   - олон MB мэдээлэл дахин татаж UI-г удаашруулна;
   - “Мэдээллийг хамгааллаа”, “Түр хүлээнэ үү” урсгал удаан үргэлжилнэ;
   - paged/read-model шинэчлэлийг conflict үед тойрч гарна;
   - салбарын эрхээр admin-only section хүсэлтгүйгээр орж ирэх боломж нээнэ.

   Нотолгоо: `app.js:1998`, `app.js:2027`, `app.js:2043`; `api/state.php:554-555`.

2. **Section заагаагүй `state.php` GET нь салбарын эрхийн шалгалтыг тойрч байна**

   `assert_sections_readable_by_user()` зөвхөн хүссэн key жагсаалтад admin-only key байгаа эсэхийг шалгана. Хоосон жагсаалттай full-state GET үед шалгах key байхгүй тул хориг ажиллахгүй. Дараа нь `scope_sections_for_user()` зарим operational array-г салбараар шүүдэг боловч admin-only section-ийг payload-аас бүрэн хасдаггүй.

   Нөлөө: performance болон мэдээллийн нууцлалын эрсдэл. UI цэс нуусан нь backend authorization биш.

   Нотолгоо: `api/state.php:274`, `api/state.php:417`, `api/state.php:554-555`.

3. **Үйлчилгээ устгах/төлбөр буцаах нь олон ledger-д атомик биш**

   Үйлчилгээ устгах үед customer history, group bonus, gift-card usage, voucher log, customer credit, audit зэрэг олон бүтэц client дээр зэрэг өөрчлөгдөнө. Гэхдээ хадгалалт нь customer entity mutation дээр төвлөрч, бусад section нь generic whole-section save/revision replay-д үлддэг.

   Нөлөө: зэрэгцээ хэрэглэгч өөрчлөлт хийх эсвэл section conflict гарахад үйлчилгээ устсан ч group bonus, gift card, voucher эсвэл credit-ийн буцаалт хэсэгчлэн үлдэх боломжтой. Энэ нь мөнгө болон урамшууллын бодит зөрүү үүсгэнэ.

   Нотолгоо: `app.js:13820-13920`, `app.js:13922`; `dirtySectionsForView()` дахь profile ownership.

### P1 — дараагийн шатанд заавал засах

4. **Profile save одоо ч олон бүхэл section бичдэг**

   Profile-ийн ердийн хадгалалт `customers`, `customerGroups`, `giftCards`, `voucherLogs`, `services` section-ийг dirty болгодог. Customer нь fingerprint/entity replay хамгаалалттай боловч дагалдах section-үүд бүхэл JSON хэвээр.

5. **Gift card, кассын хуваарь, амралт/томилолтын зарим урсгал section JSON хэвээр**

   Unique id болон conflict replay хамгаалалт нэмэгдсэн нь сайн. Гэвч 10+ салбар, олон зэрэгцээ хэрэглэгчтэй үед нэг section revision дээр үл хамаарах өөрчлөлтүүд мөргөлдөх магадлал өснө.

6. **Group засварын өмнө бүх customers + customerGroups татдаг**

   Group цэс анх summary-аар хөнгөн нээгддэг. Харин хайлт/засвар хийхэд `ensureGroupDirectorySections()` бүх хэрэглэгч болон группийг татна. Өгөгдөл өсөхөд дахин хүнд болно.

7. **Read endpoint-ийн backend эрх жигд биш**

   `audit-list`, `group-summary`, `sms-settings/history`, backup/recovery нь admin-only. Харин `gift-card-list.php` болон `customer-detail.php` нь зөвхөн нэвтэрсэн эсэхийг шалгаж байна. UI дээр харагдахгүй байсан ч direct API access-ийн дүрэм тодорхой, server-enforced байх ёстой.

8. **`app_sections` том JSON загвар write scalability-ийн хязгаар болно**

   Read-model-ууд уншилтыг хөнгөлсөн ч write талд том section JSON-г decode/merge/encode хийдэг. 2 салбарт ажиллаж болох ч 10 салбар, зэрэгцээ write өсөхөд lock/conflict болон payload өснө.

9. **Recovery хугацаа богино**

   Rolling backup 6 цаг тутам, 7 хоног/28 хувь; full backup сар тутам, 5 хувь байгаа нь сайн. Гэхдээ entity recovery journal 30 хоног, write/operation/change log 90 хоногийн дараа устдаг. Хожуу илэрсэн алдагдлыг нэг хэрэглэгчээр сэргээхэд full backup-аас гараар салгах шаардлагатай болно.

### P2 — чанар, хурд, арчилгаа

10. **Frontend bundle том**

    `app.js` ~947 KB, `styles.css` ~228 KB, `index.html` ~95 KB. Цэс бүр нэг том bundle parse хийдэг. Энэ нь эхний ачаалал болон сул төхөөрөмжид нөлөөлнө.

11. **Автомат refresh өөрөө хөнгөн боловч conflict зам нь хүнд**

    Ердийн 60 секундийн refresh revision шалгалтаар хязгаарлагдана. Асуудал нь refresh биш; revision зөрсний дараах full-state fallback юм.

12. **Тестүүдийн ихэнх нь source-regression/static contract test**

    67 Node test бүгд амжилттай. Гэхдээ эдгээр нь бодит PHP/MySQL transaction, хоёр browser зэрэг бичих, session/role, network retry болон restore-ийг бүрэн ажиллуулсан integration test биш.

## Цэс тус бүрийн audit

| Цэс/урсгал | Одоогийн төлөв | Үлдсэн эрсдэл |
|---|---|---|
| Цаг захиалга | Server-paged list, detail endpoint, authoritative availability, entity write, 1 сарын limit | Entity integration test-ийг бодит DB дээр батлах |
| Хэрэглэгчийн жагсаалт | Server-paged/filtered | Шинэ бүртгэлийн write нь customers section/entity hybrid |
| Хэрэглэгчийн дэлгэрэнгүй | Сонгосон customer + group context | Ancillary whole-section write; endpoint role/scope |
| Групп | Хөнгөн summary | Засвар/хайлт хийхэд бүх customer/group татна |
| Касс/хуваарь | Scoped section + mutation replay | Whole section collision, 10 салбарт өснө |
| Гүйцэтгэл | Сонгосон хугацааны analytics source/read-model | Зарим fallback, policy recalculation write-г DB integration test хийх |
| Dashboard | Compact server summary | Staff detail fallback болон cache invalidation-ийг integration test хийх |
| Audit | Admin-only, 100-аар pagination | 90 хоногийн retention business хэрэгцээтэй тааруулах |
| SMS | Admin-only history pagination, booking write-ээс тусгаарласан outbox | Cron/provider retry болон их хэмжээний history-г DB дээр load test хийх |
| Voucher | Paged history, role config тусдаа | Payment reversal атомик биш |
| Gift card | Paged list | Read permission; usage/reversal whole-section |
| Backup | 6 цаг rolling, 7 хоног/28; сар тутам full, 5 | Entity-level урт хугацааны restore workflow дутуу |

## Сайн ажиллаж буй хамгаалалтууд

- Generic writer transaction болон revision lock ашигладаг.
- Operation idempotency бий.
- Customer/group fingerprint conflict хамгаалалт бий.
- Booking whole-section write generic endpoint-оор хориглогдсон.
- 2 ба түүнээс олон entity гэнэт хасагдах write хамгаалалтаар блоклогдоно.
- Audit append-only merge ашигладаг.
- Салбарын касс/томилолт/амралтын мөрүүдийг merge хийхдээ бусад салбарыг хадгалдаг.
- Өнгөрсөн booking-ийг чимээгүй устгахгүй; 2 жилийн дараа archive maintenance-р шилжүүлдэг.
- SMS provider доголдсон ч booking transaction rollback хийхгүй.
- Rolling/full backup, checksum болон booking archive backup-д ордог.

## Шалгалтын үр дүн

- `node --check app.js`: амжилттай.
- `node --test tests/*.test.mjs`: 67/67 амжилттай.
- Local browser smoke: 11 цэс render хийсэн, console error 0.
- PHP binary local PATH-д байхгүй тул PHP syntax болон бодит MySQL integration test энэ audit-д ажиллуулаагүй.
- Live database-д write/restore test хийгээгүй. Audit нь production data-д read/write өөрчлөлт оруулаагүй.

## Санал болгож буй засварын дараалал

1. Full-state conflict GET-г бүрэн хориглож, зөвхөн `savingSections` + selected entity-г scoped reload/replay болгох.
2. `state.php`-ийн section-гүй GET-г admin-only legacy endpoint болгох эсвэл бүр хаах; салбарын response allowlist хэрэгжүүлэх.
3. Payment/create/delete/reversal/course-close/credit-transfer-г нэг зориулалтын server transaction API болгох.
4. Gift-card, voucher-log, group-bonus, customer-credit-д row/entity mutation API нэвтрүүлэх.
5. Kass schedule, holiday, assignment-г entity endpoint болгох.
6. Group search/edit-ийг server-side query + selected group detail болгох.
7. Бодит PHP/MySQL test орчинд 2 admin + 2 salon зэрэгцээ write, retry, network timeout, stale tab, duplicate submit, backup/restore scenario ажиллуулах.
8. Дээрх test green болсны дараа шинэ цэвэр `D:\Projects\Khalgai-System-V2` folder-т clone/copy хийж, commit/build/checksum баталгаажуулах.
9. Шинэ folder-оос local smoke + server dry-run хийсний дараа л яг нэрлэсэн хуучин folder-уудыг устгах.

## D:\Projects руу шилжүүлэх аюулгүй нөхцөл

Одоогоор workspace parent дотор нэг л project folder харагдсан: `C:\Users\Lenovo LOQ\Documents\Khalgai System V2\salon-system-live-fix`.

Шилжүүлэх үед дараах дарааллыг мөрдөнө:

1. Current commit, branch, remote, dirty status-ийг тэмдэглэх.
2. Шинэ folder үүсгэж зөвхөн Git-tracked latest файлыг оруулах.
3. `.env`, upload/media, local secrets зэрэг Git-д ороогүй шаардлагатай файлыг тусад нь жагсааж, автоматаар алдахгүй шалгах.
4. Test, local render, build/version, Git status, file checksum батлах.
5. User-аар шинэ folder зөв гэдгийг батлуулах.
6. Зөвхөн батлагдсан хуучин absolute path-ийг устгах.

Энэ audit хийх явцад ямар ч code, live data, database, deploy, local project бүтэц өөрчлөгдөөгүй.
