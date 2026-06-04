import { prisma } from "@/lib/db";
import { deleteTestUser } from "./helpers/test-user";

export async function cleanupAllTestData(): Promise<void> {
  const testUsers = await prisma.user.findMany({
    where: { email: { startsWith: "tg_" } },
    select: { id: true },
  });

  for (const u of testUsers) {
    try {
      await deleteTestUser(u.id);
      console.log(`[teardown] Cleaned up test user ${u.id}`);
    } catch (err) {
      console.error(`[teardown] Failed to clean up ${u.id}:`, err);
    }
  }

  console.log(`[teardown] Cleaned up ${testUsers.length} test users`);
  await prisma.$disconnect();
}
