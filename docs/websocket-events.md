# WebSocket Events

Socket.IO uses the default namespace. A client authenticates with:

```ts
io("http://localhost:4000", {
  auth: { token: "JWT_TOKEN" }
});
```

## Client to Server

### `room:join`

Join a collaborative document.

```json
{
  "roomId": "room-id",
  "documentId": "document-id"
}
```

Server responds by emitting `document:sync` to the joining socket.

### `room:leave`

Leave the active document room.

```json
{
  "roomId": "room-id",
  "documentId": "document-id"
}
```

### `document:update`

Send a Yjs update as a binary payload.

```json
{
  "roomId": "room-id",
  "documentId": "document-id",
  "update": "Uint8Array | number[] | base64 string"
}
```

### `document:save`

Force-save current server-side Yjs state.

```json
{
  "documentId": "document-id"
}
```

### `presence:update`

Update cursor, selection, and typing state in one payload.

```json
{
  "roomId": "room-id",
  "documentId": "document-id",
  "cursor": { "line": 8, "column": 12 },
  "selection": { "anchor": { "line": 8, "column": 12 }, "head": { "line": 8, "column": 18 } },
  "typing": true
}
```

### `presence:cursor`, `presence:selection`, `presence:typing`

Convenience events for one presence field at a time.

### `version:create`

Create a version snapshot from the current Yjs state.

```json
{
  "documentId": "document-id"
}
```

## Server to Client

- `document:sync`: current encoded Yjs state for the document.
- `document:update`: Yjs update broadcast from another participant.
- `document:saved`: emitted after a successful save.
- `presence:update`: participant presence changed.
- `presence:list`: active users in the document room.
- `room:user_joined`: user joined the document room.
- `room:user_left`: user left the document room.
- `version:created`: snapshot was created.
- `error`: structured realtime error.
