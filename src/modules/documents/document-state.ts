import * as Y from "yjs";

export function createYDocFromContent(content: string) {
  const ydoc = new Y.Doc();
  ydoc.getText("code").insert(0, content);
  return ydoc;
}

export function encodeStateFromContent(content: string) {
  const ydoc = createYDocFromContent(content);
  return Buffer.from(Y.encodeStateAsUpdate(ydoc));
}

export function contentFromYjsState(state?: Uint8Array | Buffer | null) {
  if (!state) {
    return "";
  }

  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, new Uint8Array(state));
  return ydoc.getText("code").toString();
}
