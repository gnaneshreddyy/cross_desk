import { prisma } from "../../shared/prisma.js";
import { contentFromYjsState, encodeStateFromContent } from "../documents/document-state.js";
import { writeAuditLog } from "../../shared/audit.js";

export async function createVersion(documentId: string, userId: string, yjsState?: Uint8Array | Buffer | null) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } }
  });

  const versionNumber = (document.versions[0]?.versionNumber ?? 0) + 1;
  const state = yjsState ? Buffer.from(yjsState) : document.yjsState;
  const content = state ? contentFromYjsState(state) : document.content;

  const version = await prisma.documentVersion.create({
    data: {
      documentId,
      versionNumber,
      content,
      yjsState: state,
      createdBy: userId
    }
  });

  await writeAuditLog({
    actorId: userId,
    roomId: document.roomId,
    documentId,
    action: "version.created",
    metadata: { versionNumber }
  });

  return version;
}

export async function restoreVersion(documentId: string, versionId: string) {
  const version = await prisma.documentVersion.findFirstOrThrow({
    where: { id: versionId, documentId }
  });

  const content = version.yjsState ? contentFromYjsState(version.yjsState) : version.content;
  const yjsState = version.yjsState ?? encodeStateFromContent(content);

  return prisma.document.update({
    where: { id: documentId },
    data: { content, yjsState }
  });
}
