import { Router } from "express";
import { z } from "zod";
import { authenticate, getCurrentUser } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../shared/async-handler.js";
import { prisma } from "../../shared/prisma.js";
import { validate } from "../../shared/validate.js";
import { requireDocumentMember, requireDocumentWriteAccess } from "../../shared/permissions.js";
import { createVersion, restoreVersion } from "./versions.service.js";
import { routeParam } from "../../shared/request.js";
import { replaceLiveDocumentState } from "../collaboration/collaboration.service.js";
import { writeAuditLog } from "../../shared/audit.js";

const router = Router();

router.use(authenticate);

router.get(
  "/documents/:documentId/versions",
  validate(z.object({ params: z.object({ documentId: z.string().min(1) }) })),
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    const documentId = routeParam(req, "documentId");
    await requireDocumentMember(user.id, documentId);

    const versions = await prisma.documentVersion.findMany({
      where: { documentId },
      include: { creator: { select: { id: true, name: true, email: true } } },
      orderBy: { versionNumber: "desc" }
    });

    res.json({ versions });
  })
);

router.post(
  "/documents/:documentId/versions",
  validate(z.object({ params: z.object({ documentId: z.string().min(1) }) })),
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    const documentId = routeParam(req, "documentId");
    await requireDocumentWriteAccess(user.id, documentId);
    const version = await createVersion(documentId, user.id);
    res.status(201).json({ version });
  })
);

router.post(
  "/documents/:documentId/versions/:versionId/restore",
  validate(z.object({ params: z.object({ documentId: z.string().min(1), versionId: z.string().min(1) }) })),
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    const documentId = routeParam(req, "documentId");
    const versionId = routeParam(req, "versionId");
    await requireDocumentWriteAccess(user.id, documentId);
    const document = await restoreVersion(documentId, versionId);
    if (document.yjsState) {
      await replaceLiveDocumentState(documentId, document.yjsState);
    }
    await writeAuditLog({ actorId: user.id, roomId: document.roomId, documentId, action: "version.restored", metadata: { versionId } });
    res.json({ document });
  })
);

export { router as versionsRouter };
