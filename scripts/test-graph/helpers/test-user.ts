import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
}

export async function createTestUser(suffix?: string): Promise<TestUser> {
  const ts = suffix ?? Date.now().toString(36);
  const username = `tg_${ts}`;
  const email = `tg_${ts}@test.local`;
  const password = "TestGraph!2026";
  const hash = await bcrypt.hash(password, 4);

  const user = await prisma.user.create({
    data: { username, email, password: hash },
  });

  return { id: user.id, username, email, password };
}

export async function deleteTestUser(userId: string): Promise<void> {
  await prisma.knowledgeChunk.deleteMany({ where: { userId } });
  await prisma.knowledgeDocument.deleteMany({ where: { userId } });
  await prisma.graphRelationship.deleteMany({ where: { userId } });
  await prisma.graphEntity.deleteMany({ where: { userId } });
  await prisma.graphCommunityReport.deleteMany({ where: { userId } });
  await prisma.graphCommunity.deleteMany({ where: { userId } });
  await prisma.graphBuildJob.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}
