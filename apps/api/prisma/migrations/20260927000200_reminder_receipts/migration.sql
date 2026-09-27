-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "receipt_checked_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "reminders_status_sent_at_idx" ON "reminders"("status", "sent_at");

