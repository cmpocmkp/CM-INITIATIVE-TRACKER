/**
 * PRP consistency pass #3 — align the tracker's PRP portfolio EXACTLY with
 * "PRP Final ADP KPCIP Projects details 9-7-26.xlsx" (38 schemes: 18 A + 20 B).
 *
 * Audit (2026-07-24) found only three gaps, fixed here:
 *  1. ADD 260616 Establishment of four Slaughter Houses in Peshawar (B) — Rs 1,000M / alloc 150M
 *  2. ADD 260672 F/S & Establishment of Fruit & Vegetable Markets (B)  — Rs 2,500M / alloc 1,000M
 *  3. TAG 261326 Shahi Khatta Drain (already on system via the 86 list) as PRP + link initiative #1
 *
 * Category B = PC-1 pending PDWP approval (budget earmarked, releases start on
 * approval) — the user's decision: everything in the PRP program is tracked.
 * Idempotent.
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();

async function main() {
  const prp = await prisma.initiative.findFirst({ where: { number: 1 } });
  if (!prp) throw new Error("Initiative #1 (PRP) not found");
  const lg = await prisma.department.findFirst({ where: { code: "LG" } });
  if (!lg) throw new Error("Department LG not found");

  const adds = [
    {
      adpCode: "260616",
      name: "Establishment of four Slaughter Houses in Peshawar (PRP)",
      totalCost: 1000,
      adpAllocation: 150,
      stage: "PC1_APPROVAL" as const,
    },
    {
      adpCode: "260672",
      name: "Feasibility Study & Establishment of Fruit & Vegetable Markets in Peshawar (PRP)",
      totalCost: 2500,
      adpAllocation: 1000,
      stage: "PC1_APPROVAL" as const,
    },
  ];

  for (const a of adds) {
    const existing = await prisma.scheme.findFirst({ where: { adpCode: a.adpCode } });
    if (existing) {
      console.log(`= ${a.adpCode} already present (${existing.name.slice(0, 50)}) — ensuring PRP link`);
      await prisma.scheme.update({
        where: { id: existing.id },
        data: { isPRP: true, initiativeId: prp.id, totalCost: a.totalCost, adpAllocation: a.adpAllocation },
      });
      continue;
    }
    await prisma.scheme.create({
      data: {
        name: a.name,
        rawName: a.name,
        adpCode: a.adpCode,
        sector: "Urban Dev",
        departmentId: lg.id,
        initiativeId: prp.id,
        isPRP: true,
        totalCost: a.totalCost,
        adpAllocation: a.adpAllocation,
        stage: a.stage,
      },
    });
    console.log(`+ added ${a.adpCode} ${a.name.slice(0, 60)}`);
  }

  const shahi = await prisma.scheme.findFirst({ where: { adpCode: { contains: "261326" } } });
  if (shahi) {
    await prisma.scheme.update({
      where: { id: shahi.id },
      data: { isPRP: true, initiativeId: prp.id },
    });
    console.log(`~ tagged 261326 Shahi Khatta as PRP → initiative #1 (dept stays ${shahi.departmentId === lg.id ? "LG" : "URBAN"})`);
  } else {
    console.log("!! 261326 not found");
  }

  const count = await prisma.scheme.count({ where: { isPRP: true } });
  const agg = await prisma.scheme.aggregate({ where: { isPRP: true }, _sum: { totalCost: true, adpAllocation: true } });
  console.log(`PRP now: ${count} schemes | cost ${agg._sum.totalCost?.toLocaleString()}M | alloc ${agg._sum.adpAllocation?.toLocaleString()}M`);
}

main().finally(() => prisma.$disconnect());
