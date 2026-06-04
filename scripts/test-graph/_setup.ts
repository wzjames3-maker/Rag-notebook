import { prisma } from "@/lib/db";

export async function verifyGraphBuildJobTable(): Promise<void> {
  try {
    await prisma.graphBuildJob.findFirst({ take: 1 });
    console.log("[setup] GraphBuildJob table OK");
  } catch (err) {
    console.error(
      "\n[setup] FATAL: GraphBuildJob table missing or Prisma client outdated.\n" +
        "Run: npx prisma migrate deploy && npx prisma generate\n"
    );
    throw err;
  }
}

export async function verifyDatabaseConnection(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("[setup] Database connection OK");
  } catch (err) {
    console.error(
      "\n[setup] FATAL: Cannot connect to database. Is docker-compose up?\n"
    );
    throw err;
  }
}
