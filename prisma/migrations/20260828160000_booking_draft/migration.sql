-- Migration: server-side BookingDraft model for GDPR-safe booking form persistence.
--
-- Replaces the previous localStorage draft (which put PII in plain text in the
-- browser). Drafts now live on the server keyed by an opaque random draftId
-- stored in an HttpOnly cookie. Auto-expire after 30 days; cleaned up by
-- the nightly status-poll cron or via the API on submission.
--
-- (The audit's #7 priority fix.)

-- CreateTable
CREATE TABLE "BookingDraft" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "ipHash" TEXT,
    "userAgent" VARCHAR(256),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingDraft_draftId_key" ON "BookingDraft"("draftId");

-- CreateIndex
CREATE INDEX "BookingDraft_expiresAt_idx" ON "BookingDraft"("expiresAt");
