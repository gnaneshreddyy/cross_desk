import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

type AuditInput = {
  actorId?: string;
  roomId?: string;
  documentId?: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      roomId: input.roomId,
      documentId: input.documentId,
      action: input.action,
      metadata: input.metadata
    }
  });
}
