import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { validate } from "../../shared/validate.js";
import { authenticate, getCurrentUser } from "../../middleware/authenticate.js";
import { loginUser, registerUser } from "./auth.service.js";

const router = Router();

const credentialsSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a user
 *     tags: [Auth]
 */
router.post(
  "/register",
  validate(
    z.object({
      body: credentialsSchema.shape.body.extend({
        name: z.string().min(2).max(80)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    res.status(201).json(await registerUser(req.body));
  })
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login and receive a JWT
 *     tags: [Auth]
 */
router.post(
  "/login",
  validate(credentialsSchema),
  asyncHandler(async (req, res) => {
    res.json(await loginUser(req.body));
  })
);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: getCurrentUser(req) });
  })
);

export { router as authRouter };
