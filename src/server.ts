import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { env, corsOrigins } from "./config/env.js";
import { configureCollaboration } from "./modules/collaboration/collaboration.gateway.js";
import { flushAllDocuments } from "./modules/collaboration/collaboration.service.js";
import { prisma } from "./shared/prisma.js";

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    credentials: true
  },
  maxHttpBufferSize: 1e7
});

await configureCollaboration(io);

server.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
  console.log(`Swagger docs available at http://localhost:${env.PORT}/docs`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, flushing live documents`);
  await flushAllDocuments();
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
