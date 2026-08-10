-- Status page tables (2026-08-10)

CREATE TABLE "StatusService" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name_it" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "source_id" TEXT,
    "url" TEXT,
    "icon" TEXT,
    "description_it" TEXT,
    "description_en" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StatusService_slug_key" ON "StatusService"("slug");
CREATE INDEX "StatusService_category_display_order_idx" ON "StatusService"("category", "display_order");
CREATE INDEX "StatusService_source_source_id_idx" ON "StatusService"("source", "source_id");

CREATE TABLE "StatusSnapshot" (
    "id" BIGSERIAL NOT NULL,
    "service_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response_ms" INTEGER,
    "taken_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StatusSnapshot_service_id_taken_at_idx" ON "StatusSnapshot"("service_id", "taken_at");

CREATE TABLE "StatusPeriod" (
    "id" BIGSERIAL NOT NULL,
    "service_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "StatusPeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StatusPeriod_service_id_started_at_idx" ON "StatusPeriod"("service_id", "started_at");

CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "service_id" TEXT,
    "external_id" TEXT,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title_it" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "body_it" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Incident_status_started_at_idx" ON "Incident"("status", "started_at");
CREATE INDEX "Incident_service_id_idx" ON "Incident"("service_id");
CREATE UNIQUE INDEX "Incident_source_external_id_key" ON "Incident"("source", "external_id");

CREATE TABLE "IncidentUpdate" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "body_it" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentUpdate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IncidentUpdate_incident_id_createdAt_idx" ON "IncidentUpdate"("incident_id", "createdAt");
