/**
 * CMPO sandbox — a TEST department + practice schemes so the CMPO team can
 * try the daily-entry flow end to end without touching real departments.
 *
 *   npx tsx backend/prisma/cmpo-test.ts          → create (idempotent)
 *   npx tsx backend/prisma/cmpo-test.ts remove   → delete the sandbox + all its data
 *
 * Everything is prefixed "TEST" and carries token costs so provincial
 * rollups are barely affected.
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();
const KEY = "CMPO-TEST";

async function remove() {
  const dept = await prisma.department.findUnique({ where: { key: KEY } });
  if (!dept) {
    console.log("No sandbox found.");
    return;
  }
  await prisma.scheme.deleteMany({ where: { departmentId: dept.id } }); // cascades updates + work items
  await prisma.user.deleteMany({ where: { departmentId: dept.id } });
  await prisma.department.delete({ where: { id: dept.id } });
  console.log("CMPO sandbox removed (department, user, schemes, all entries).");
}

async function create() {
  const dept = await prisma.department.upsert({
    where: { key: KEY },
    update: {},
    create: { key: KEY, code: "CMPO", name: "CMPO — Test / Sandbox", isSector: false },
  });

  const username = "CMPO";
  const existing = await prisma.user.findUnique({ where: { username } });
  if (!existing) {
    await prisma.user.create({
      data: {
        username,
        passwordHash: await bcrypt.hash("123456", 10),
        name: "CMPO Test User",
        role: "DEPARTMENT",
        departmentId: dept.id,
      },
    });
  }

  const schemes = [
    { rawName: "TEST — Sample Road Project (CMPO practice, not a real scheme)", cost: 100, alloc: 50 },
    { rawName: "TEST — Sample Building Project (CMPO practice, not a real scheme)", cost: 60, alloc: 30 },
  ];
  const created: string[] = [];
  for (const s of schemes) {
    const exists = await prisma.scheme.findFirst({ where: { rawName: s.rawName } });
    if (exists) {
      created.push(exists.id);
      continue;
    }
    const rec = await prisma.scheme.create({
      data: {
        adpCode: null,
        name: s.rawName.replace("TEST — ", "TEST: "),
        rawName: s.rawName,
        sector: "TEST",
        totalCost: s.cost,
        adpAllocation: s.alloc,
        isPRP: false,
        isPlaceholder: false,
        departmentId: dept.id,
      },
    });
    created.push(rec.id);
  }

  // One practice work item under the road project
  const road = created[0];
  const sub = await prisma.subProject.findFirst({ where: { schemeId: road, name: "TEST Work Item — Sample Underpass" } });
  if (!sub) {
    await prisma.subProject.create({
      data: { schemeId: road, name: "TEST Work Item — Sample Underpass", weight: 60, description: "Practice work item — try phase, %, manpower here" },
    });
  }

  console.log("CMPO sandbox ready:");
  console.log("  login    : CMPO / 123456");
  console.log("  schemes  : 2 TEST schemes (one with a work item)");
  console.log("  remove   : npx tsx backend/prisma/cmpo-test.ts remove");
}

(process.argv[2] === "remove" ? remove() : create())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
