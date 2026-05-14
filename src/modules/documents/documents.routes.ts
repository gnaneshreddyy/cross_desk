import { Router } from "express";
import { z } from "zod";
import { authenticate, getCurrentUser } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../shared/async-handler.js";
import { prisma } from "../../shared/prisma.js";
import { validate } from "../../shared/validate.js";
import { requireDocumentMember, requireDocumentWriteAccess, requireRoomMember, requireRoomWriteAccess } from "../../shared/permissions.js";
import { encodeStateFromContent } from "./document-state.js";
import { routeParam } from "../../shared/request.js";
import { replaceLiveDocumentState } from "../collaboration/collaboration.service.js";
import { writeAuditLog } from "../../shared/audit.js";

const router = Router();

router.use(authenticate);

router.post(
  "/rooms/:roomId/documents",
  validate(
    z.object({
      params: z.object({ roomId: z.string().min(1) }),
      body: z.object({
        title: z.string().min(1).max(160),
        language: z.string().min(1).max(60).default("typescript"),
        content: z.string().default("")
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    const roomId = routeParam(req, "roomId");
    await requireRoomWriteAccess(user.id, roomId);

    const content = req.body.content;
    const document = await prisma.document.create({
      data: {
        roomId,
        title: req.body.title,
        language: req.body.language,
        content,
        yjsState: encodeStateFromContent(content)
      }
    });

    await writeAuditLog({ actorId: user.id, roomId, documentId: document.id, action: "document.created" });

    res.status(201).json({ document });
  })
);

router.get(
  "/rooms/:roomId/documents",
  validate(z.object({ params: z.object({ roomId: z.string().min(1) }) })),
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    const roomId = routeParam(req, "roomId");
    await requireRoomMember(user.id, roomId);

    const documents = await prisma.document.findMany({
      where: { roomId },
      select: { id: true, roomId: true, title: true, language: true, content: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" }
    });

    res.json({ documents });
  })
);

router.get(
  "/documents/:documentId",
  validate(z.object({ params: z.object({ documentId: z.string().min(1) }) })),
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    const documentId = routeParam(req, "documentId");
    const { document, member } = await requireDocumentMember(user.id, documentId);
    res.json({ document, role: member.role });
  })
);

router.patch(
  "/documents/:documentId",
  validate(
    z.object({
      params: z.object({ documentId: z.string().min(1) }),
      body: z.object({
        title: z.string().min(1).max(160).optional(),
        language: z.string().min(1).max(60).optional(),
        content: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    const documentId = routeParam(req, "documentId");
    await requireDocumentWriteAccess(user.id, documentId);

    const data: { title?: string; language?: string; content?: string; yjsState?: Buffer } = {
      title: req.body.title,
      language: req.body.language
    };

    if (typeof req.body.content === "string") {
      data.content = req.body.content;
      data.yjsState = encodeStateFromContent(req.body.content);
    }

    const document = await prisma.document.update({
      where: { id: documentId },
      data
    });

    if (data.yjsState) {
      await replaceLiveDocumentState(documentId, data.yjsState);
    }

    await writeAuditLog({
      actorId: user.id,
      roomId: document.roomId,
      documentId,
      action: "document.updated",
      metadata: { fields: Object.keys(req.body) }
    });

    res.json({ document });
  })
);

export { router as documentsRouter };
