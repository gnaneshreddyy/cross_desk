import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { encodeStateFromContent } from "../src/modules/documents/document-state.js";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      name: "Demo User",
      email: "demo@example.com",
      passwordHash
    }
  });

  const room = await prisma.room.upsert({
    where: { inviteCode: "demo-room" },
    update: {},
    create: {
      name: "Demo Collaboration Room",
      ownerId: user.id,
      inviteCode: "demo-room",
      members: {
        create: {
          userId: user.id,
          role: "owner"
        }
      }
    }
  });

  const existing = await prisma.document.findFirst({
    where: { roomId: room.id, title: "main.ts" }
  });

  if (!existing) {
    const content = "export function greet(name: string) {\n  return `Hello, ${name}`;\n}\n";
    await prisma.document.create({
      data: {
        roomId: room.id,
        title: "main.ts",
        language: "typescript",
        content,
        yjsState: encodeStateFromContent(content)
      }
    });
  }

  console.log("Seeded demo@example.com / Password123!");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
