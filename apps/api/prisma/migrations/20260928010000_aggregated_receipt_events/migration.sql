-- Hóa đơn gộp (Apple, Google Play, ví điện tử) liệt kê nhiều dịch vụ trong một email.
-- Mỗi dịch vụ phải thành một sự kiện riêng, nên khóa chống trùng thêm merchant_key.

-- DropIndex
DROP INDEX "subscription_events_source_ref_event_type_key";

-- CreateIndex
CREATE UNIQUE INDEX "subscription_events_source_ref_event_type_merchant_key_key" ON "subscription_events"("source_ref", "event_type", "merchant_key");
