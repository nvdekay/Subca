-- CreateEnum
CREATE TYPE "SubscriptionSource" AS ENUM ('MANUAL', 'EMAIL');

-- CreateEnum
CREATE TYPE "DetectionState" AS ENUM ('ACTIVE', 'TRIAL', 'POSSIBLY_ACTIVE', 'CANCELLED', 'EXPIRED', 'PAYMENT_ISSUE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ConnectedProvider" AS ENUM ('GMAIL');

-- CreateEnum
CREATE TYPE "ConnectedAccountStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "EmailSyncKind" AS ENUM ('INITIAL', 'INCREMENTAL');

-- CreateEnum
CREATE TYPE "EmailSyncStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailParseStatus" AS ENUM ('NO_MATCH', 'PARSED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SubscriptionEventType" AS ENUM ('SUBSCRIPTION_STARTED', 'TRIAL_STARTED', 'TRIAL_ENDING', 'PAYMENT_SUCCESS', 'RENEWAL', 'PRICE_CHANGED', 'PLAN_CHANGED', 'PAYMENT_FAILED', 'CANCELLATION_REQUESTED', 'SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_EXPIRED', 'SUBSCRIPTION_RESUMED');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('EMAIL', 'MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "InboxItemKind" AS ENUM ('CONFIRM_ACTIVE', 'TRIAL_ENDING', 'PRICE_CHANGED', 'PAYMENT_FAILED', 'POSSIBLE_DUPLICATE', 'SUBSCRIPTION_CANCELLED');

-- CreateEnum
CREATE TYPE "InboxItemStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "domains" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "confidence" SMALLINT,
ADD COLUMN     "detection_state" "DetectionState",
ADD COLUMN     "last_detected_at" TIMESTAMPTZ(6),
ADD COLUMN     "merchant_key" TEXT,
ADD COLUMN     "needs_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "review_reason" TEXT,
ADD COLUMN     "source" "SubscriptionSource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "connected_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "ConnectedProvider" NOT NULL DEFAULT 'GMAIL',
    "provider_email" TEXT NOT NULL,
    "encrypted_refresh_token" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" "ConnectedAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_history_id" TEXT,
    "last_sync_at" TIMESTAMPTZ(6),
    "initial_sync_done_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sync_runs" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "kind" "EmailSyncKind" NOT NULL,
    "status" "EmailSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "since" TIMESTAMPTZ(6),
    "scanned_count" INTEGER NOT NULL DEFAULT 0,
    "candidate_count" INTEGER NOT NULL DEFAULT 0,
    "event_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "email_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_emails" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "provider_message_id" TEXT NOT NULL,
    "sender_domain" TEXT,
    "subject_hash" TEXT,
    "received_at" TIMESTAMPTZ(6),
    "parse_status" "EmailParseStatus" NOT NULL DEFAULT 'NO_MATCH',
    "parser_version" INTEGER NOT NULL DEFAULT 1,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subscription_id" UUID,
    "source" "EventSource" NOT NULL DEFAULT 'EMAIL',
    "source_ref" TEXT,
    "event_type" "SubscriptionEventType" NOT NULL,
    "merchant_key" TEXT NOT NULL,
    "merchant_name" TEXT,
    "service_id" UUID,
    "plan_name" TEXT,
    "amount_minor" BIGINT,
    "currency" CHAR(3),
    "interval_unit" "IntervalUnit",
    "interval_count" SMALLINT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "renewal_date" DATE,
    "trial_end_date" DATE,
    "access_until" DATE,
    "confidence" SMALLINT NOT NULL DEFAULT 50,
    "extracted" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "InboxItemKind" NOT NULL,
    "subscription_id" UUID,
    "event_id" UUID,
    "payload" JSONB,
    "status" "InboxItemStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connected_accounts_status_last_sync_at_idx" ON "connected_accounts"("status", "last_sync_at");

-- CreateIndex
CREATE UNIQUE INDEX "connected_accounts_user_id_provider_provider_email_key" ON "connected_accounts"("user_id", "provider", "provider_email");

-- CreateIndex
CREATE INDEX "email_sync_runs_account_id_started_at_idx" ON "email_sync_runs"("account_id", "started_at");

-- CreateIndex
CREATE INDEX "processed_emails_account_id_received_at_idx" ON "processed_emails"("account_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "processed_emails_account_id_provider_message_id_key" ON "processed_emails"("account_id", "provider_message_id");

-- CreateIndex
CREATE INDEX "subscription_events_user_id_merchant_key_occurred_at_idx" ON "subscription_events"("user_id", "merchant_key", "occurred_at");

-- CreateIndex
CREATE INDEX "subscription_events_subscription_id_occurred_at_idx" ON "subscription_events"("subscription_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_events_source_ref_event_type_key" ON "subscription_events"("source_ref", "event_type");

-- CreateIndex
CREATE INDEX "inbox_items_user_id_status_created_at_idx" ON "inbox_items"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_merchant_key_idx" ON "subscriptions"("user_id", "merchant_key");

-- AddForeignKey
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sync_runs" ADD CONSTRAINT "email_sync_runs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_emails" ADD CONSTRAINT "processed_emails_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================================
-- Bật RLS cho các bảng mới (quy ước của dự án: mọi bảng đều bật, không có policy
-- → anon key của Supabase không đọc/ghi thẳng được, mọi truy cập đi qua API).
-- ============================================================================
ALTER TABLE "connected_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_sync_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "processed_emails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inbox_items" ENABLE ROW LEVEL SECURITY;
