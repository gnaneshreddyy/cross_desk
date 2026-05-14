export type CursorPosition = {
  line: number;
  column: number;
};

export type SelectionRange = {
  anchor: CursorPosition;
  head: CursorPosition;
};

export type PresenceState = {
  userId: string;
  name: string;
  email: string;
  socketId: string;
  roomId: string;
  documentId: string;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  typing?: boolean;
  updatedAt: string;
};

const presenceBySocket = new Map<string, PresenceState>();

function key(roomId: string, documentId: string) {
  return `${roomId}:${documentId}`;
}

export function upsertPresence(state: Omit<PresenceState, "updatedAt"> & Partial<Pick<PresenceState, "updatedAt">>) {
  const presence: PresenceState = {
    ...state,
    updatedAt: new Date().toISOString()
  };
  presenceBySocket.set(state.socketId, presence);
  return presence;
}

export function patchPresence(socketId: string, patch: Partial<Pick<PresenceState, "cursor" | "selection" | "typing">>) {
  const current = presenceBySocket.get(socketId);
  if (!current) {
    return undefined;
  }
  return upsertPresence({ ...current, ...patch });
}

export function removePresence(socketId: string) {
  const current = presenceBySocket.get(socketId);
  presenceBySocket.delete(socketId);
  return current;
}

export function listPresence(roomId: string, documentId: string) {
  const target = key(roomId, documentId);
  return [...presenceBySocket.values()].filter((presence) => key(presence.roomId, presence.documentId) === target);
}
