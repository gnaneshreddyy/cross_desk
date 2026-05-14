# Collaborative Code Editor Backend

Backend-first realtime collaboration service for shared code rooms. It includes JWT auth, room membership, document APIs, Yjs CRDT synchronization over Socket.IO, presence tracking, Redis pub/sub support, PostgreSQL persistence, version history, and Swagger documentation.

## Quick Start

```bash
npm install
docker compose up -d postgres redis
npm run prisma:deploy
npm run prisma:seed
npm run dev
```

The API runs on `http://localhost:4000`.

- Swagger UI: `http://localhost:4000/docs`
- Health check: `GET /health`
- WebSocket namespace: Socket.IO default namespace at `ws://localhost:4000`

## Docker-Only Run

```bash
docker compose up --build
```

The `api` service waits for PostgreSQL and Redis, applies Prisma migrations, then starts the backend.

## Demo Account

After `npm run prisma:seed`:

- Email: `demo@example.com`
- Password: `Password123!`
- Invite code: `demo-room`

## Smoke Test

With the API running:

```bash
npm run smoke
```

The smoke script registers/logs in, creates a room and document, connects two Socket.IO clients, sends a Yjs update, creates a version, and checks the saved document content through REST.

## Main REST Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /rooms`
- `GET /rooms`
- `GET /rooms/:roomId`
- `POST /rooms/:roomId/join`
- `DELETE /rooms/:roomId/members/:userId`
- `POST /rooms/:roomId/documents`
- `GET /rooms/:roomId/documents`
- `GET /documents/:documentId`
- `PATCH /documents/:documentId`
- `GET /documents/:documentId/versions`
- `POST /documents/:documentId/versions`
- `POST /documents/:documentId/versions/:versionId/restore`

## WebSocket Events

Authenticate by passing a JWT in `socket.handshake.auth.token` or an `Authorization: Bearer <token>` header.

See [docs/websocket-events.md](docs/websocket-events.md) for payloads and flow.
