import { prisma } from "@/lib/prisma";

export async function logAudit(params: {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
}) {
  try {
    await prisma.auditLog.create({ data: params });
  } catch {
    // fail silently — audit log should never break the main flow
  }
}
