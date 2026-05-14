import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { authenticate, getCurrentUser } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../shared/async-handler.js";
import { prisma } from "../../shared/prisma.js";
import { validate } from "../../shared/validate.js";
import { HttpError } from "../../shared/http-error.js";
import { requireRoomMember } from "../../shared/permissions.js";
import { routeParam } from "../../shared/request.js";
import { writeAuditLog } from "../../shared/audit.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  validate(z.object({ body: z.object({ name: z.string().min(1).max(120) }) })),
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    const room = await prisma.room.create({
      data: {
        name: req.body.name,
        ownerId: user.id,
        inviteCode: nanoid(12),
        members: { create: { userId: user.id, role: "owner" } }
      },
      include: { members: true }
    });

    await writeAuditLog({ actorId: user.id, roomId: room.id, action: "room.created" });

    res.status(201).json({ room });
  })
);

router.post(
  "/join",
  validate(z.object({ body: z.object({ inviteCode: z.string().min(1) }) })),
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    const room = await prisma.room.findUnique({ where: { inviteCode: req.body.inviteCode } });
    if (!room) {
      throw new HttpError(404, "Invite code not found");
    }

    const member = await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
      update: {},
      create: { roomId: room.id, userId: user.id, role: "editor" }
    });

    await writeAuditLog({ actorId: user.id, roomId: room.id, action: "room.joined", metadata: { method: "inviteCode" } });
    res.status(201).json({ room, member });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    const rooms = await prisma.room.findMany({
      where: { members: { some: { userId: user.id } } },
      include: { owner: { select: { id: true, name: true, email: true } }, _count: { select: { members: true, documents: true } } },
      orderBy: { updatedAt: "desc" }
    });

    res.json({ rooms });
  })
);

router.get(
  "/:roomId",
  validate(z.object({ params: z.object({ roomId: z.string().min(1) }) })),
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    const roomId = routeParam(req, "roomId");
    await requireRoomMember(user.id, roomId);

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        documents: { select: { id: true, title: true, language: true, updatedAt: true } }
      }
    });

    if (!room) {
      throw new HttpError(404, "Room not found");
    }

    res.json({ room });
  })
);

router.post(
  "/:roomId/join",
  validate(
    z.object({
      params: z.object({ roomId: z.string().min(1) }),
      body: z.object({ inviteCode: z.string().optional() }).default({})
    })
  ),
  asyncHandler(async (req, res) => {
    const user = getCurrentUser(req);
    const roomId = routeParam(req, "roomId");
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new HttpError(404, "Room not found");
    }

    if (room.inviteCode !== req.body.inviteCode) {
      throw new HttpError(403, "Invalid invite code");
    }

    const member = await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
      update: {},
      create: { roomId: room.id, userId: user.id, role: "editor" }
    });

    await writeAuditLog({ actorId: user.id, roomId: room.id, action: "room.joined", metadata: { method: "roomId" } });

    res.status(201).json({ room, member });
  })
);

router.patch(
  "/:roomId/members/:userId",
  validate(
    z.object({
      params: z.object({ roomId: z.string().min(1), userId: z.string().min(1) }),
      body: z.object({ role: z.enum(["editor", "viewer"]) })
    })
  ),
  asyncHandler(async (req, res) => {
    const currentUser = getCurrentUser(req);
    const roomId = routeParam(req, "roomId");
    const userId = routeParam(req, "userId");
    const currentMember = await requireRoomMember(currentUser.id, roomId);

    if (currentMember.role !== "owner") {
      throw new HttpError(403, "Only room owners can update member roles");
    }

    if (userId === currentUser.id) {
      throw new HttpError(400, "Room owner role cannot be changed");
    }

    const member = await prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { role: req.body.role }
    });

    await writeAuditLog({
      actorId: currentUser.id,
      roomId,
      action: "room.member_role_updated",
      metadata: { userId, role: req.body.role }
    });

    res.json({ member });
  })
);

router.delete(
  "/:roomId/members/:userId",
  validate(z.object({ params: z.object({ roomId: z.string().min(1), userId: z.string().min(1) }) })),
  asyncHandler(async (req, res) => {
    const currentUser = getCurrentUser(req);
    const roomId = routeParam(req, "roomId");
    const userId = routeParam(req, "userId");
    const currentMember = await requireRoomMember(currentUser.id, roomId);

    if (currentMember.role !== "owner") {
      throw new HttpError(403, "Only room owners can remove members");
    }

    if (userId === currentUser.id) {
      throw new HttpError(400, "Room owner cannot remove themselves");
    }

    await prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId } }
    });

    await writeAuditLog({ actorId: currentUser.id, roomId, action: "room.member_removed", metadata: { userId } });

    res.status(204).send();
  })
);

export { router as roomsRouter };
