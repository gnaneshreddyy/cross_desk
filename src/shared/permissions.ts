import type { RoomRole } from "@prisma/client";
import { prisma } from "./prisma.js";
import { HttpError } from "./http-error.js";

const writeRoles: RoomRole[] = ["owner", "editor"];

export async function requireRoomMember(userId: string, roomId: string) {
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } }
  });

  if (!member) {
    throw new HttpError(403, "You are not a member of this room");
  }

  return member;
}

export async function requireRoomWriteAccess(userId: string, roomId: string) {
  const member = await requireRoomMember(userId, roomId);
  if (!writeRoles.includes(member.role)) {
    throw new HttpError(403, "Viewer role cannot modify this resource");
  }
  return member;
}

export async function requireDocumentMember(userId: string, documentId: string) {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) {
    throw new HttpError(404, "Document not found");
  }
  const member = await requireRoomMember(userId, document.roomId);
  return { document, member };
}

export async function requireDocumentWriteAccess(userId: string, documentId: string) {
  const { document, member } = await requireDocumentMember(userId, documentId);
  if (!writeRoles.includes(member.role)) {
    throw new HttpError(403, "Viewer role cannot modify this document");
  }
  return { document, member };
}
