import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });
const prisma = new PrismaClient();
async function main() {
  const i4 = await prisma.initiative.findFirst({ where: { number: 4 } });
  if (!i4) throw new Error("initiative #4 not found");
  console.log("initiative #4:", i4.name.slice(0, 60));
  const s = await prisma.scheme.findFirst({ where: { adpCode: { contains: "251474" } }, include: { initiative: true } });
  if (!s) throw new Error("251474 not found");
  console.log("scheme:", s.name.slice(0, 70), "| currently init #", s.initiative?.number);
  await prisma.scheme.update({ where: { id: s.id }, data: { initiativeId: i4.id } });
  console.log("RELINKED 251474 -> initiative #4");
}
main().finally(() => prisma.$disconnect());
