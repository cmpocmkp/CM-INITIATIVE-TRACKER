/**
 * PRP enrichment — seeds the Peshawar Revitalization Plan portfolio from the
 * official cabinet documents (Summaries for the Chief Minister, Feb–Mar 2026):
 *
 *  Doc "PESHAWAR REVITALIZATION PLAN" (master, PDA + LCB):
 *    20 projects, Rs 99,185M total / Rs 31,827M CFY requirement
 *  Doc "APPROVAL OF SCHEMES UNDER PRP (IRRIGATION DEPARTMENT)":
 *    3 projects, Rs 16,012.525M / Rs 2,900M CFY
 *  Doc C&W Warsak Road summary  → existing scheme 260387 (Rs 7,000M)
 *  Doc C&W Link Roads summary   → existing scheme 260835 (Zoo Rd 4.3km, Tehkal Rd 3.8km)
 *  Doc PHE DWSS summary         → existing scheme 251627 (3 costed components)
 *
 * Rules: schemes already in the ADP-86 list are NOT duplicated — only the
 * cabinet projects missing from the portfolio are added (owner = LG per the
 * platform convention that LG reports PRP; sector label = executing agency).
 * Work items are added only where a document enumerates them. Idempotent.
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();

// ── New PRP schemes (not in the ADP-86 list) ─────────────────
const NEW_SCHEMES: { name: string; sector: string; cost: number; cfy: number }[] = [
  // PDA block of the master summary
  { name: "Installation/Rehabilitation of Electric Poles/Lights, Cabling etc. (Ring Road, GT Road, Jamrud Road) (PRP)", sector: "Urban Dev", cost: 500, cfy: 500 },
  { name: "Miyawaki Urban Forests and Smart Artificial Forest (PRP)", sector: "Urban Dev", cost: 525, cfy: 525 },
  { name: "Construction of Underpasses at Traffic Hotspots on Ring Road (PRP)", sector: "Urban Dev", cost: 9990, cfy: 7000 },
  { name: "Development of Theme Park (PRP)", sector: "Urban Dev", cost: 2314, cfy: 200 },
  { name: "Development of Hi-tech Children Park (PRP)", sector: "Urban Dev", cost: 750, cfy: 750 },
  { name: "Construction of Pir-Zakori Cloverleaf Interchange (PRP)", sector: "Urban Dev", cost: 18000, cfy: 200 },
  { name: "F/S Transport Modelling and Public Transport (PRP)", sector: "Urban Dev", cost: 90, cfy: 90 },
  { name: "F/S Uplifting, Conservation and Restoration of Walled City (PRP)", sector: "Urban Dev", cost: 57, cfy: 57 },
  { name: "F/S of Frame of Peshawar (PRP)", sector: "Urban Dev", cost: 30, cfy: 30 },
  // LCB block
  { name: "Procurement of Additional Funeral Vehicles (LCB) (PRP)", sector: "LG", cost: 175, cfy: 175 },
  { name: "Installation of New & Repair of Old Street Lights (LCB) (PRP)", sector: "LG", cost: 300, cfy: 300 },
  { name: "Establishment of Four Slaughterhouses (LCB) (PRP)", sector: "LG", cost: 1000, cfy: 500 },
  { name: "Establishment of Fruit & Vegetable Markets (LCB) (PRP)", sector: "LG", cost: 2500, cfy: 1400 },
  // Irrigation summary
  { name: "Uplift/Dualization/Beautification of Roads and Allied Works in Kabul River Canal System and Irrigation Infrastructure, District Peshawar (PRP)", sector: "Irrigation", cost: 6636.822, cfy: 1000 },
  { name: "Clearance/Improvement and Revamping of Budni Nullah and its Allied Drainage System, District Peshawar (PRP)", sector: "Irrigation", cost: 5525.703, cfy: 1000 },
  { name: "Rehabilitation/Upgradation/Construction of Canal Patrol Road along Both Sides of Warsak Lift Canal from Detour Road (RD 45+000) to Kohat Road (RD 101+000), District Peshawar (PRP)", sector: "Irrigation", cost: 3850, cfy: 900 },
];

// ── Work items under existing ADP schemes (by ADP code) ──────
const WORK_ITEMS: { adpCode: string; items: { name: string; weight?: number; description?: string }[] }[] = [
  {
    // C&W Link Roads summary: "two link roads via Peshawar Zoo Road (4.3 Km) and Tehkal Road (3.8 Km)"
    adpCode: "260835",
    items: [
      { name: "Link Road via Peshawar Zoo Road (4.3 Km)", description: "University Road to Ring Road (Northern Section) — Zoo Road alignment, 4.3 km" },
      { name: "Link Road via Tehkal Road (3.8 Km)", description: "University Road to Ring Road (Northern Section) — Tehkal alignment, 3.8 km" },
    ],
  },
  {
    // PHE DWSS summary — P&D component table (Rs in million)
    adpCode: "251627",
    items: [
      { name: "New Water Supply Schemes", weight: 3099.113, description: "New DWSS component — Rs 3,099.113M (P&D component table)" },
      { name: "Restoration of Non-Functional Water Supply Schemes", weight: 986.867, description: "Non-functional DWSS component — Rs 986.867M" },
      { name: "Rehab/Up-gradation of Existing Water Supply Schemes", weight: 159.387, description: "Rehabilitation component — Rs 159.387M" },
    ],
  },
  {
    // Master summary project #3 — underpasses on University Road at named locations
    adpCode: "260567",
    items: [
      { name: "Ramdas-Chungi Underpass (University Road)", description: "Cabinet PRP list #3 — underpass site" },
      { name: "Lahori Chowk Underpass (University Road)", description: "Cabinet PRP list #3 — underpass site" },
    ],
  },
];

async function main() {
  const lg = await prisma.department.findUnique({ where: { key: "LG" } });
  const prp = await prisma.initiative.findUnique({ where: { number: 1 } });
  if (!lg || !prp) throw new Error("LG department / Initiative #1 not found — run the main seed first");

  let created = 0;
  let skipped = 0;
  for (const s of NEW_SCHEMES) {
    const exists = await prisma.scheme.findFirst({ where: { rawName: s.name } });
    if (exists) {
      skipped++;
      continue;
    }
    await prisma.scheme.create({
      data: {
        adpCode: null,
        name: s.name.replace(/\s*\(PRP\)\s*$/, ""),
        rawName: s.name,
        sector: s.sector,
        totalCost: s.cost,
        adpAllocation: s.cfy, // CFY funds requirement per cabinet summary
        isPRP: true,
        isPlaceholder: false,
        departmentId: lg.id,
        initiativeId: prp.id,
      },
    });
    created++;
  }
  console.log(`Schemes: ${created} created, ${skipped} already present`);

  let subCreated = 0;
  let subSkipped = 0;
  for (const group of WORK_ITEMS) {
    const scheme = await prisma.scheme.findFirst({ where: { adpCode: group.adpCode } });
    if (!scheme) {
      console.warn(`  ! scheme ${group.adpCode} not found — work items skipped`);
      continue;
    }
    for (const item of group.items) {
      const exists = await prisma.subProject.findFirst({ where: { schemeId: scheme.id, name: item.name } });
      if (exists) {
        subSkipped++;
        continue;
      }
      await prisma.subProject.create({
        data: {
          schemeId: scheme.id,
          name: item.name,
          description: item.description ?? null,
          weight: item.weight ?? null,
        },
      });
      subCreated++;
    }
  }
  console.log(`Work items: ${subCreated} created, ${subSkipped} already present`);

  const totals = await prisma.scheme.aggregate({ where: { isPRP: true }, _count: true, _sum: { totalCost: true } });
  console.log(`PRP portfolio now: ${totals._count} schemes · Rs ${Math.round(totals._sum.totalCost ?? 0).toLocaleString()}M`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
