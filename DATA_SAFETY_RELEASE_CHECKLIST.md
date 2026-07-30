# Data safety release checklist

Энэ release нь өгөгдөл автоматаар устгах, давхар хадгалах, хуучин tab шинэ мэдээллийг дарах эрсдэлийг бууруулна. Production-д нэг алхмаар сохроор deploy хийхгүй.

## Release-ийн хамгаалалт

- Public booking-д 5000 мөрийн silent truncate байхгүй.
- Public browser зөвхөн ирээдүйн сул цаг тооцоход шаардлагатай, утасгүй мэдээлэл авна.
- Admin booking create/edit/status/delete нь server transaction, operation ID, capacity, schedule, holiday, salon эрхийн шалгалттай.
- Customer/group өөрчлөлт operation ID-тай; retry нь ижил request-ийг давхар үүсгэхгүй.
- Customer, group, booking өөрчлөлт before/after түүхтэй; тухайн entity-г бусад өгөгдөлд хүрэлгүй сэргээж болно.
- Page нээх болон жагсаалт render хийх үед production data migration автоматаар хадгалахгүй.
- Оношилгооны зураг шууд устахгүй, 30 хоногийн trash руу шилжинэ.
- Цагийн захиалга 2 жил active хадгалагдаад backup-ийн дараа archive руу шилжинэ.
- Rolling backup checksum-тай, 6 цаг тутам, 7 хоногийн 28 хувилбартай.
- Full backup browser-оос хамаарахгүйгээр CLI cron-оор үүснэ.

## Deploy-оос өмнө

1. Одоогийн database + upload-ийн full backup үүсгэж, файлын хэмжээ 0 бишийг баталгаажуулна.
2. Production-ийн одоогийн commit/build дугаарыг тэмдэглэнэ.
3. PHP/MySQL staging орчинд шинэ schema үүсэж байгааг шалгана:
   - `app_operations`
   - `app_change_events`
   - `app_booking_archive`
4. Нэг салбарын test хэрэглэгчээр дараах урсгалыг шалгана:
   - хэрэглэгч үүсгэх, засах;
   - нэг удаа, курс, оношилгоо, касс;
   - төлбөр;
   - booking үүсгэх, засах, цуцлах, устгах;
   - хоёр browser зэрэг засах conflict;
   - network response тасарсан retry.
5. Өөр салбарын эрхээр booking өөрчлөх боломжгүйг шалгана.
6. Амралтын өдөр, өнгөрсөн цаг, хаахаас 2 цагийн өмнөх хамгийн сүүлийн slot, дүүрсэн slot-ыг шалгана.
7. Бүх автомат тест болон syntax check ногоон байна.

## Нэвтрүүлэх дараалал

1. Ачаалал багатай цаг сонгоно.
2. Full backup хийнэ.
3. Code deploy хийнэ.
4. Admin login хийж schema initialization нэг удаа амжилттай дууссаныг шалгана.
5. Зөвхөн test дугаараар нэг customer, нэг booking үүсгэж refresh хийсний дараа хадгалагдсаныг шалгана.
6. Rolling болон full cron-ыг тохируулж `Run now` хийнэ.
7. Эхний 24 цагт server error log, backup heartbeat, booking/customer өөрчлөлтийн түүхийг хянана.

## Rollback

Хэрэв smoke test бүтэлгүйтвэл:

1. Салбаруудад шинэ бүртгэл түр зогсоохыг мэдэгдэнэ.
2. Өмнөх commit/build рүү code rollback хийнэ.
3. Database-г шууд бүхлээр сэргээхээс өмнө selective recovery болон өөрчлөлтийн түүхийг шалгана.
4. Зөвхөн database бүхэлдээ гэмтсэн нь батлагдсан үед deploy-ийн өмнөх full backup-ыг сэргээнэ.
5. Incident-ийн цаг, хэрэглэгч, салбар, operation/incident ID-г тэмдэглэнэ.

## Энэ release-д зориуд оруулаагүй зүйл

Customer, service, payment бүх мэдээллийг нэг дор бүрэн normalized table руу шилжүүлэх том migration хийгээгүй. Live систем дээр ийм migration-ыг PHP/MySQL staging, restore rehearsal, controlled cutover-гүй хийх нь энэ release-ээс илүү эрсдэлтэй. Одоогийн release өндөр эрсдэлтэй customer болон booking write замыг хамгаалж, дараагийн migration хийх суурийг бүрдүүлнэ.
