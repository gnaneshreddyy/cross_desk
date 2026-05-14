import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { prisma } from "../../shared/prisma.js";
import { HttpError } from "../../shared/http-error.js";
import { env } from "../../config/env.js";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type JwtPayload = {
  sub: string;
  email: string;
};

export function toAuthUser(user: { id: string; name: string; email: string }): AuthUser {
  return { id: user.id, name: user.name, email: user.email };
}

export function signToken(user: AuthUser) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as StringValue }
  );
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash
    }
  });

  const authUser = toAuthUser(user);
  return { user: authUser, token: signToken(authUser) };
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user) {
    throw new HttpError(401, "Invalid email or password");
  }

  const validPassword = await bcrypt.compare(input.password, user.passwordHash);
  if (!validPassword) {
    throw new HttpError(401, "Invalid email or password");
  }

  const authUser = toAuthUser(user);
  return { user: authUser, token: signToken(authUser) };
}

export async function verifyToken(token: string): Promise<AuthUser> {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      throw new HttpError(401, "User no longer exists");
    }

    return user;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(401, "Invalid or expired token");
  }
}
