import type { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { env } from "../../config/env.js";
import { verifyToken, type AuthUser } from "../auth/auth.service.js";
import { requireDocumentMember, requireDocumentWriteAccess } from "../../shared/permissions.js";
import { HttpError } from "../../shared/http-error.js";
import { applyDocumentUpdate, encodeDocumentState, roomChannel, saveDocumentState, toUint8Array } from "./collaboration.service.js";
import { listPresence, patchPresence, removePresence, upsertPresence } from "../presence/presence.service.js";
import { createVersion } from "../versions/versions.service.js";
import {
  documentSavePayloadSchema,
  documentUpdatePayloadSchema,
  joinPayloadSchema,
  parseSocketPayload,
  presenceUpdatePayloadSchema,
  versionCreatePayloadSchema
} from "./collaboration.schemas.js";

type AuthedSocket = Socket & {
  user?: AuthUser;
  activeRoom?: { roomId: string; documentId: string; channel: string };
};

type JoinPayload = {
  roomId: string;
  documentId: string;
};

export async function configureCollaboration(io: Server) {
  if (env.REDIS_URL) {
    const pubClient = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 750,
      maxRetriesPerRequest: 1
    });
    const subClient = pubClient.duplicate();
    const onRedisError = (error: Error) => {
      console.warn(`Redis adapter unavailable: ${error.message}`);
    };
    pubClient.on("error", onRedisError);
    subClient.on("error", onRedisError);

    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      await pubClient.ping();
      io.adapter(createAdapter(pubClient, subClient));
      console.log("Socket.IO Redis adapter enabled");
    } catch (error) {
      console.warn(
        `Socket.IO Redis adapter disabled; running with in-memory realtime only. ${
          error instanceof Error ? error.message : "Redis connection failed"
        }`
      );
      pubClient.disconnect();
      subClient.disconnect();
    }
  }

  io.use(async (socket: AuthedSocket, next) => {
    try {
      const token =
        typeof socket.handshake.auth.token === "string"
          ? socket.handshake.auth.token
          : socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");

      if (!token) {
        throw new HttpError(401, "Missing WebSocket token");
      }

      socket.user = await verifyToken(token);
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("WebSocket authentication failed"));
    }
  });

  io.on("connection", (socket: AuthedSocket) => {
    socket.on("room:join", async (payload: JoinPayload, ack?: (response: unknown) => void) => {
      try {
        payload = parseSocketPayload(joinPayloadSchema, payload);
        const user = requireSocketUser(socket);
        const { document } = await requireDocumentMember(user.id, payload.documentId);
        if (document.roomId !== payload.roomId) {
          throw new HttpError(400, "Document does not belong to room");
        }

        const channel = roomChannel(payload.roomId, payload.documentId);
        await socket.join(channel);
        socket.activeRoom = { ...payload, channel };

        const presence = upsertPresence({
          socketId: socket.id,
          userId: user.id,
          name: user.name,
          email: user.email,
          roomId: payload.roomId,
          documentId: payload.documentId,
          typing: false
        });

        const state = await encodeDocumentState(payload.documentId);
        socket.emit("document:sync", { documentId: payload.documentId, state: [...state] });
        socket.to(channel).emit("room:user_joined", { user: presence });
        io.to(channel).emit("presence:list", { users: listPresence(payload.roomId, payload.documentId) });
        ack?.({ ok: true });
      } catch (error) {
        emitSocketError(socket, error, ack);
      }
    });

    socket.on("room:leave", async (_payload: JoinPayload | undefined, ack?: (response: unknown) => void) => {
      const active = socket.activeRoom;
      if (active) {
        await socket.leave(active.channel);
        const presence = removePresence(socket.id);
        socket.to(active.channel).emit("room:user_left", { user: presence });
        io.to(active.channel).emit("presence:list", { users: listPresence(active.roomId, active.documentId) });
        socket.activeRoom = undefined;
      }
      ack?.({ ok: true });
    });

    socket.on("document:update", async (payload: JoinPayload & { update: unknown }, ack?: (response: unknown) => void) => {
      try {
        payload = parseSocketPayload(documentUpdatePayloadSchema, payload);
        const user = requireSocketUser(socket);
        await requireDocumentWriteAccess(user.id, payload.documentId);
        const update = toUint8Array(payload.update);
        await applyDocumentUpdate(payload.documentId, update, user.id);

        const channel = roomChannel(payload.roomId, payload.documentId);
        socket.to(channel).emit("document:update", {
          documentId: payload.documentId,
          update: [...update],
          userId: user.id
        });
        ack?.({ ok: true });
      } catch (error) {
        emitSocketError(socket, error, ack);
      }
    });

    socket.on("document:save", async (payload: { documentId: string }, ack?: (response: unknown) => void) => {
      try {
        payload = parseSocketPayload(documentSavePayloadSchema, payload);
        const user = requireSocketUser(socket);
        await requireDocumentWriteAccess(user.id, payload.documentId);
        const saved = await saveDocumentState(payload.documentId);
        socket.emit("document:saved", { documentId: payload.documentId, content: saved.content });
        ack?.({ ok: true });
      } catch (error) {
        emitSocketError(socket, error, ack);
      }
    });

    socket.on("presence:update", (payload: Record<string, unknown>, ack?: (response: unknown) => void) => {
      try {
        const parsed = parseSocketPayload(presenceUpdatePayloadSchema, payload);
        broadcastPresence(io, socket, parsed);
        ack?.({ ok: true });
      } catch (error) {
        emitSocketError(socket, error, ack);
      }
    });

    socket.on("presence:cursor", (cursor: unknown, ack?: (response: unknown) => void) => {
      try {
        const parsed = parseSocketPayload(presenceUpdatePayloadSchema.pick({ cursor: true }).required(), { cursor });
        broadcastPresence(io, socket, parsed);
        ack?.({ ok: true });
      } catch (error) {
        emitSocketError(socket, error, ack);
      }
    });
    socket.on("presence:selection", (selection: unknown, ack?: (response: unknown) => void) => {
      try {
        const parsed = parseSocketPayload(presenceUpdatePayloadSchema.pick({ selection: true }).required(), { selection });
        broadcastPresence(io, socket, parsed);
        ack?.({ ok: true });
      } catch (error) {
        emitSocketError(socket, error, ack);
      }
    });
    socket.on("presence:typing", (typing: boolean, ack?: (response: unknown) => void) => {
      try {
        const parsed = parseSocketPayload(presenceUpdatePayloadSchema.pick({ typing: true }).required(), { typing });
        broadcastPresence(io, socket, parsed);
        ack?.({ ok: true });
      } catch (error) {
        emitSocketError(socket, error, ack);
      }
    });

    socket.on("version:create", async (payload: { documentId: string }, ack?: (response: unknown) => void) => {
      try {
        payload = parseSocketPayload(versionCreatePayloadSchema, payload);
        const user = requireSocketUser(socket);
        await requireDocumentWriteAccess(user.id, payload.documentId);
        const state = await encodeDocumentState(payload.documentId);
        const version = await createVersion(payload.documentId, user.id, state);
        io.to(socket.activeRoom?.channel ?? socket.id).emit("version:created", { version });
        ack?.({ ok: true, version });
      } catch (error) {
        emitSocketError(socket, error, ack);
      }
    });

    socket.on("disconnect", () => {
      const active = socket.activeRoom;
      const presence = removePresence(socket.id);
      if (active) {
        socket.to(active.channel).emit("room:user_left", { user: presence });
        io.to(active.channel).emit("presence:list", { users: listPresence(active.roomId, active.documentId) });
      }
    });
  });
}

function requireSocketUser(socket: AuthedSocket) {
  if (!socket.user) {
    throw new HttpError(401, "WebSocket authentication required");
  }
  return socket.user;
}

function broadcastPresence(io: Server, socket: AuthedSocket, patch: Parameters<typeof patchPresence>[1]) {
  const presence = patchPresence(socket.id, patch);
  if (!presence || !socket.activeRoom) {
    return;
  }
  io.to(socket.activeRoom.channel).emit("presence:update", { user: presence });
}

function emitSocketError(socket: Socket, error: unknown, ack?: (response: unknown) => void) {
  const message = error instanceof Error ? error.message : "Realtime operation failed";
  const payload = { ok: false, message };
  socket.emit("error", payload);
  ack?.(payload);
}
