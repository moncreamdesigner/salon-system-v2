import assert from "node:assert/strict";
import fs from "node:fs";

const bookings = fs.readFileSync(new URL("../api/booking-list.php", import.meta.url), "utf8");
const bookingDetail = fs.readFileSync(new URL("../api/booking-detail.php", import.meta.url), "utf8");
const audit = fs.readFileSync(new URL("../api/audit-list.php", import.meta.url), "utf8");
const customers = fs.readFileSync(new URL("../api/customer-list.php", import.meta.url), "utf8");
const customerDetail = fs.readFileSync(new URL("../api/customer-detail.php", import.meta.url), "utf8");
const customerPhone = fs.readFileSync(new URL("../api/customer-phone.php", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(bookings, /\$pageSize = min\(100, max\(10,/, "Booking reads must be server-paginated with a bounded page size");
assert.match(bookings, /!\$historyRequested && \$rowDate < \$today/, "Past bookings must stay server-side until history is searched");
assert.match(bookings, /\(\$user\['role'\] \?\? ''\) === 'salon'/, "Salon booking reads must enforce branch scope on the server");
assert.match(audit, /\$pageSize = min\(100, max\(10,/, "Audit reads must be server-paginated with a bounded page size");
assert.match(audit, /\$actionTypes/, "Audit filters must receive action types without downloading every row");
assert.match(customers, /\$pageSize = min\(100, max\(10,/, "Customer reads must be server-paginated with a bounded page size");
assert.match(customers, /'activeCustomers'/, "Customer list must return the live-service strip separately");
assert.match(customers, /\(\$user\['role'\] \?\? ''\) === 'salon'/, "Salon customer reads must enforce branch scope on the server");
assert.match(customers, /!\$historyRequested && \$registered !== \$today/, "Customer history must stay server-side until searched");
assert.match(app, /customer-list\.php/, "Customer view must use the paged endpoint");
assert.match(app, /customers: \["customerGroups", "salons"/, "Customer view must not download the complete customer section");
assert.match(customerDetail, /'relatedCustomers'/, "Customer detail must include only the selected group context");
assert.match(customerDetail, /section_key IN \('customers', 'customerGroups'\)/, "Customer detail must read its authoritative sections on the server");
assert.match(app, /customer-detail\.php\?id=/, "Profile must load the selected customer instead of the complete directory");
assert.match(app, /profile: \["giftCards"/, "Profile view must not download every customer and group");
assert.match(customerPhone, /!empty\(\$customer\['deleted'\]\)/, "Duplicate phone lookup must ignore deleted profiles only");
assert.match(app, /customer-phone\.php\?phone=/, "Partial customer views must verify duplicate phones against the server");
assert.match(app, /customerDirectoryLoadingKey === requestKey/, "Customer filtering must reuse only an identical in-flight request");
assert.match(app, /bookingDirectoryLoadingKey === requestKey/, "Booking filtering must reuse only an identical in-flight request");
assert.match(app, /booking-detail\.php\?id=/, "Booking editing must load the authoritative selected booking from the server");
assert.match(app, /bookingInlineEditingRecord/, "Booking editing must preserve its selected record across list refreshes");
assert.match(app, /requestSequence !== bookingEditRequestSequence/, "A stale booking detail response must not open the wrong editor");
assert.match(bookingDetail, /count\(\$matches\) > 1/, "Booking detail must refuse ambiguous legacy duplicate ids");
assert.match(bookingDetail, /\$user\['role'\].*=== 'salon'/s, "Booking detail must enforce salon scope on the server");
assert.match(app, /auditDirectoryLoadingKey === requestKey/, "Audit filtering must reuse only an identical in-flight request");
assert.ok((app.match(/\.toString\(\) !== requestKey/g) || []).length >= 6, "Stale directory responses and errors must not overwrite the latest filter");

console.log("server-paged-reads.test: OK");
