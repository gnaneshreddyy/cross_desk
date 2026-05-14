import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

const spec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Collaborative Code Editor Backend API",
      version: "1.0.0"
    },
    tags: [
      { name: "Auth" },
      { name: "Rooms" },
      { name: "Documents" },
      { name: "Versions" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
    paths: {
      "/auth/register": {
        post: { tags: ["Auth"], summary: "Register a user", responses: { "201": { description: "Created" } } }
      },
      "/auth/login": {
        post: { tags: ["Auth"], summary: "Login and receive a JWT", responses: { "200": { description: "Authenticated" } } }
      },
      "/auth/me": {
        get: { tags: ["Auth"], summary: "Get current user", security: [{ bearerAuth: [] }], responses: { "200": { description: "Current user" } } }
      },
      "/rooms": {
        post: { tags: ["Rooms"], summary: "Create a room", security: [{ bearerAuth: [] }], responses: { "201": { description: "Created" } } },
        get: { tags: ["Rooms"], summary: "List rooms for current user", security: [{ bearerAuth: [] }], responses: { "200": { description: "Rooms" } } }
      },
      "/rooms/join": {
        post: { tags: ["Rooms"], summary: "Join a room by invite code", security: [{ bearerAuth: [] }], responses: { "201": { description: "Joined" } } }
      },
      "/rooms/{roomId}": {
        get: {
          tags: ["Rooms"],
          summary: "Get room details",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "roomId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Room" } }
        }
      },
      "/rooms/{roomId}/join": {
        post: {
          tags: ["Rooms"],
          summary: "Join a room by invite code",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "roomId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "201": { description: "Joined" } }
        }
      },
      "/rooms/{roomId}/members/{userId}": {
        patch: {
          tags: ["Rooms"],
          summary: "Update a room member role",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "roomId", in: "path", required: true, schema: { type: "string" } },
            { name: "userId", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: { "200": { description: "Updated" } }
        },
        delete: {
          tags: ["Rooms"],
          summary: "Remove a room member",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "roomId", in: "path", required: true, schema: { type: "string" } },
            { name: "userId", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: { "204": { description: "Removed" } }
        }
      },
      "/rooms/{roomId}/documents": {
        post: {
          tags: ["Documents"],
          summary: "Create a document in a room",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "roomId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "201": { description: "Created" } }
        },
        get: {
          tags: ["Documents"],
          summary: "List room documents",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "roomId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Documents" } }
        }
      },
      "/documents/{documentId}": {
        get: {
          tags: ["Documents"],
          summary: "Get a document",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "documentId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Document" } }
        },
        patch: {
          tags: ["Documents"],
          summary: "Update document metadata or content",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "documentId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } }
        }
      },
      "/documents/{documentId}/versions": {
        get: {
          tags: ["Versions"],
          summary: "List document versions",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "documentId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Versions" } }
        },
        post: {
          tags: ["Versions"],
          summary: "Create a document version snapshot",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "documentId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "201": { description: "Created" } }
        }
      },
      "/documents/{documentId}/versions/{versionId}/restore": {
        post: {
          tags: ["Versions"],
          summary: "Restore a previous document version",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "documentId", in: "path", required: true, schema: { type: "string" } },
            { name: "versionId", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: { "200": { description: "Restored" } }
        }
      }
    }
  },
  apis: ["src/**/*.routes.ts"]
});

export function mountSwagger(app: Express) {
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));
  app.get("/docs.json", (_req, res) => res.json(spec));
}
