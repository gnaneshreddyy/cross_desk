import { io } from "socket.io-client";
import * as Y from "yjs";

const baseUrl = process.env.API_URL ?? "http://localhost:4000";

type Json = Record<string, unknown>;

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    }
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) as Json : {};

  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return body;
}

async function main() {
  const email = `smoke-${Date.now()}@example.com`;
  const password = "Password123!";

  const registered = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "Smoke Tester", email, password })
  });
  const token = registered.token as string;

  const roomResponse = await request("/rooms", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: "Smoke Room" })
  });
  const room = roomResponse.room as { id: string };

  const documentResponse = await request(`/rooms/${room.id}/documents`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: "main.ts",
      language: "typescript",
      content: "const initial = true;\n"
    })
  });
  const document = documentResponse.document as { id: string };

  const first = io(baseUrl, { auth: { token }, transports: ["websocket"] });
  const second = io(baseUrl, { auth: { token }, transports: ["websocket"] });

  await Promise.all([waitForConnect(first), waitForConnect(second)]);
  await emitWithAck(first, "room:join", { roomId: room.id, documentId: document.id });
  await emitWithAck(second, "room:join", { roomId: room.id, documentId: document.id });

  const receivedUpdate = once(second, "document:update");

  const ydoc = new Y.Doc();
  ydoc.getText("code").insert(0, "const smoke = 'synced';\n");
  const update = Y.encodeStateAsUpdate(ydoc);

  await emitWithAck(first, "document:update", {
    roomId: room.id,
    documentId: document.id,
    update: [...update]
  });
  await receivedUpdate;

  await emitWithAck(first, "document:save", { documentId: document.id });
  await emitWithAck(first, "version:create", { documentId: document.id });

  const savedResponse = await request(`/documents/${document.id}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  const saved = savedResponse.document as { content: string };

  if (!saved.content.includes("smoke")) {
    throw new Error(`Saved document did not include realtime update: ${saved.content}`);
  }

  first.close();
  second.close();
  console.log("Smoke test passed");
}

function waitForConnect(socket: ReturnType<typeof io>) {
  return new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
}

function once(socket: ReturnType<typeof io>, event: string) {
  return new Promise<unknown>((resolve) => {
    socket.once(event, resolve);
  });
}

function emitWithAck(socket: ReturnType<typeof io>, event: string, payload: unknown) {
  return new Promise<void>((resolve, reject) => {
    socket.timeout(5000).emit(event, payload, (error: Error | null, response: { ok?: boolean; message?: string }) => {
      if (error) {
        reject(error);
        return;
      }
      if (response?.ok === false) {
        reject(new Error(response.message ?? `${event} failed`));
        return;
      }
      resolve();
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
