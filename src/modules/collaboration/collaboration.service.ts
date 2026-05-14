import * as Y from "yjs";
import { prisma } from "../../shared/prisma.js";
import { env } from "../../config/env.js";
import { contentFromYjsState } from "../documents/document-state.js";
import { createVersion } from "../versions/versions.service.js";

type LiveDocument = {
  ydoc: Y.Doc;
  saveTimer?: NodeJS.Timeout;
  snapshotTimer?: NodeJS.Timeout;
  lastEditedBy?: string;
};

const liveDocuments = new Map<string, LiveDocument>();

export function roomChannel(roomId: string, documentId: string) {
  return `room:${roomId}:document:${documentId}`;
}

export function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return new Uint8Array(value);
  }

  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }

  if (typeof value === "string") {
    return Uint8Array.from(Buffer.from(value, "base64"));
  }

  throw new Error("Invalid Yjs update payload");
}

export async function getLiveDocument(documentId: string) {
  const cached = liveDocuments.get(documentId);
  if (cached) {
    return cached;
  }

  const document = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  const ydoc = new Y.Doc();

  if (document.yjsState) {
    Y.applyUpdate(ydoc, new Uint8Array(document.yjsState));
  } else if (document.content) {
    ydoc.getText("code").insert(0, document.content);
  }

  const liveDocument: LiveDocument = { ydoc };
  liveDocument.snapshotTimer = setInterval(() => {
    if (!liveDocument.lastEditedBy) {
      return;
    }
    const state = Y.encodeStateAsUpdate(liveDocument.ydoc);
    createVersion(documentId, liveDocument.lastEditedBy, state).catch(console.error);
  }, env.SNAPSHOT_INTERVAL_MS);

  liveDocuments.set(documentId, liveDocument);
  return liveDocument;
}

export async function applyDocumentUpdate(documentId: string, update: Uint8Array, userId: string) {
  const liveDocument = await getLiveDocument(documentId);
  Y.applyUpdate(liveDocument.ydoc, update);
  liveDocument.lastEditedBy = userId;
  scheduleSave(documentId, liveDocument);
}

export async function encodeDocumentState(documentId: string) {
  const liveDocument = await getLiveDocument(documentId);
  return Y.encodeStateAsUpdate(liveDocument.ydoc);
}

export async function saveDocumentState(documentId: string) {
  const liveDocument = await getLiveDocument(documentId);
  const state = Y.encodeStateAsUpdate(liveDocument.ydoc);
  const content = contentFromYjsState(state);

  await prisma.document.update({
    where: { id: documentId },
    data: {
      content,
      yjsState: Buffer.from(state)
    }
  });

  return { state, content };
}

export async function replaceLiveDocumentState(documentId: string, yjsState: Uint8Array | Buffer) {
  const liveDocument = liveDocuments.get(documentId);
  if (!liveDocument) {
    return;
  }

  liveDocument.ydoc.destroy();
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, new Uint8Array(yjsState));
  liveDocument.ydoc = ydoc;
}

function scheduleSave(documentId: string, liveDocument: LiveDocument) {
  if (liveDocument.saveTimer) {
    clearTimeout(liveDocument.saveTimer);
  }

  liveDocument.saveTimer = setTimeout(() => {
    saveDocumentState(documentId).catch(console.error);
  }, env.AUTOSAVE_DEBOUNCE_MS);
}

export async function flushAllDocuments() {
  await Promise.all([...liveDocuments.keys()].map((documentId) => saveDocumentState(documentId)));

  for (const liveDocument of liveDocuments.values()) {
    if (liveDocument.saveTimer) {
      clearTimeout(liveDocument.saveTimer);
    }
    if (liveDocument.snapshotTimer) {
      clearInterval(liveDocument.snapshotTimer);
    }
  }
}
