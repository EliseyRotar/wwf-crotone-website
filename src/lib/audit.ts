import { prisma } from "@/lib/prisma";

/**
 * Write a single audit-log row. Returns true on success, false on
 * failure — audit log writes must never break the main flow, so we
 * swallow errors and only log them.
 *
 * `action` is a free-form string; current callers use values like
 * "create", "update", "delete", "status_change", "payment", "login",
 * "field_change". See the AuditLog model for the canonical list.
 *
 * Phase 1 additions for per-field audit:
 *   - fieldName / oldValue / newValue are optional. When set they
 *     describe a single field change; when null the row records a
 *     coarse action (e.g. status_change) and `details` carries JSON.
 *   - ipAddress / userAgent are optional request context.
 */
export async function logAudit(params: {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<boolean> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details,
        fieldName: params.fieldName ?? null,
        // `null` means "the value was/will be null" — distinguish it
        // from "absent" by stringifying only non-null values. Undefined
        // (caller did not pass) is stored as DB NULL.
        oldValue: params.oldValue === undefined ? null : stringifyValue(params.oldValue),
        newValue: params.newValue === undefined ? null : stringifyValue(params.newValue),
        ipAddress: params.ipAddress ?? null,
        userAgent: (params.userAgent ?? "").slice(0, 256) || null
      }
    });
    return true;
  } catch (err) {
    console.error("[audit] write failed:", err);
    return false;
  }
}

/**
 * Log a per-field change. Convenience wrapper that stringifies values
 * and stamps the action to "field_change" by default.
 */
export async function logFieldChange(params: {
  userId: string;
  entity: string;
  entityId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  action?: string;
}) {
  return logAudit({
    userId: params.userId,
    action: params.action ?? "field_change",
    entity: params.entity,
    entityId: params.entityId,
    fieldName: params.fieldName,
    oldValue: stringifyValue(params.oldValue),
    newValue: stringifyValue(params.newValue),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent
  });
}

function stringifyValue(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return ""; // shouldn't happen, defensive
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
