-- User flow Phase 2: full registration lifecycle with email verification + receipt upload + admin approval
--
-- Adds to existing Iscrizione:
--   emailVerifiedAt, receiptUploadedAt, confirmedAt, cancelledAt, passwordHash, passwordSetAt, editsLockedAt
-- Creates:
--   IscrizioneVerificationToken (single-use email verification tokens)
--   ReceiptUpload (one row per uploaded file)
-- Adds back-relation fields on Iscrizione.
--
-- This migration is purely additive — no existing data is touched.

-- 1. New columns on Iscrizione
ALTER TABLE "Iscrizione" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Iscrizione" ADD COLUMN "receiptUploadedAt" TIMESTAMP(3);
ALTER TABLE "Iscrizione" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Iscrizione" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Iscrizione" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Iscrizione" ADD COLUMN "passwordSetAt" TIMESTAMP(3);
ALTER TABLE "Iscrizione" ADD COLUMN "editsLockedAt" TIMESTAMP(3);

-- Indexes for the new Iscrizione columns we query by
CREATE INDEX "Iscrizione_emailVerifiedAt_idx" ON "Iscrizione"("emailVerifiedAt");
CREATE INDEX "Iscrizione_confirmedAt_idx" ON "Iscrizione"("confirmedAt");

-- 2. IscrizioneVerificationToken table (single-use email verification tokens)
CREATE TABLE "IscrizioneVerificationToken" (
    "id" TEXT NOT NULL,
    "iscrizioneId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "authorizesStatus" TEXT NOT NULL DEFAULT 'email_verified',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IscrizioneVerificationToken_pkey" PRIMARY KEY ("id")
);

-- Unique index on tokenHash (lookups are by-hash only — raw token never stored)
CREATE UNIQUE INDEX "IscrizioneVerificationToken_tokenHash_key" ON "IscrizioneVerificationToken"("tokenHash");
CREATE INDEX "IscrizioneVerificationToken_iscrizioneId_idx" ON "IscrizioneVerificationToken"("iscrizioneId");
CREATE INDEX "IscrizioneVerificationToken_expiresAt_idx" ON "IscrizioneVerificationToken"("expiresAt");

-- 3. ReceiptUpload table (one row per uploaded file, stored on Cloudflare R2)
CREATE TABLE "ReceiptUpload" (
    "id" TEXT NOT NULL,
    "iscrizioneId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptUpload_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReceiptUpload_iscrizioneId_idx" ON "ReceiptUpload"("iscrizioneId");
CREATE INDEX "ReceiptUpload_type_idx" ON "ReceiptUpload"("type");
CREATE INDEX "ReceiptUpload_approvedAt_idx" ON "ReceiptUpload"("approvedAt");

-- 4. Foreign keys (additive — no ON DELETE CASCADE for approvedBy to preserve history)
ALTER TABLE "IscrizioneVerificationToken" ADD CONSTRAINT "IscrizioneVerificationToken_iscrizioneId_fkey" FOREIGN KEY ("iscrizioneId") REFERENCES "Iscrizione"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReceiptUpload" ADD CONSTRAINT "ReceiptUpload_iscrizioneId_fkey" FOREIGN KEY ("iscrizioneId") REFERENCES "Iscrizione"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReceiptUpload" ADD CONSTRAINT "ReceiptUpload_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
