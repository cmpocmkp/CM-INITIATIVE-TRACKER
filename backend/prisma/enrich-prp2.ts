/**
 * PRP reconciliation #2 — aligns the portfolio with the FINAL lists:
 *   "PRP Final ADP KPCIP Projects details 9-7-26.xlsx"  (31 ADP + 6 KPCIP + 1 non-ADP)
 *   "Updated PRP list of Urban Dev & DWSS. 21-06-2026.xlsx" (status remarks)
 *
 * - Cabinet-seeded schemes get their official ADP codes, names, costs, allocations
 * - Ownership follows the file's Department column (LGE&RDD→LG, PHED→DWSS, C&W→CW,
 *   Irrigation→IRRIGATION, Forest→FOREST, Archeology→TOURISM, Transport→TRANSPORT)
 * - Lifecycle stages set from explicit status remarks (Work Commenced → Execution,
 *   bids/NIT → Tendering, PC-I/design/F/S → Feasibility etc.)
 * - "Pir-Zakori Cloverleaf" deleted: it IS ADP 251642 (Level-2 Flyover at
 *   Ring Road–GT Road intersection, summary cost Rs 18,000M)
 * - New schemes added: 251297, 251641, 261258, 261259, 210137 + six KPCIP projects
 * Idempotent.
 */
import { PrismaClient, SchemeStage } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();

type Upd = {
  match: { rawName?: string; adpCode?: string };
  set: {
    adpCode?: string;
    name?: string;
    rawName?: string;
    sector?: string;
    totalCost?: number;
    adpAllocation?: number;
    deptCode?: string;
    stage?: SchemeStage;
  };
};

const UPDATES: Upd[] = [
  // ── cabinet-seeded → official ADP identities ──
  { match: { rawName: "Construction of Underpasses at Traffic Hotspots on Ring Road (PRP)" },
    set: { adpCode: "250115", name: "Construction of Underpasses at Various Traffic Hotspots on Ring Road, Peshawar (PRP)", totalCost: 9756.694, adpAllocation: 4756.694, stage: "EXECUTION" } },
  { match: { rawName: "Installation/Rehabilitation of Electric Poles/Lights, Cabling etc. (Ring Road, GT Road, Jamrud Road) (PRP)" },
    set: { adpCode: "251612", name: "Installation/Rehabilitation of Electric Poles/Lights, Cabling etc. on Ring Road and GT/Jamrud Road (PRP)", totalCost: 569.226, adpAllocation: 0.226, stage: "TENDERING" } },
  { match: { rawName: "Miyawaki Urban Forests and Smart Artificial Forest (PRP)" },
    set: { adpCode: "251624", name: "Urban and Peri-Urban Ecosystem Restoration and Plantation Interventions under Peshawar City Revitalization Plan (PRP)", sector: "Forestry", deptCode: "FOREST", totalCost: 559.342, adpAllocation: 192.02 } },
  { match: { rawName: "Development of Theme Park (PRP)" },
    set: { adpCode: "260568", adpAllocation: 1000, stage: "FEASIBILITY" } },
  { match: { rawName: "Development of Hi-tech Children Park (PRP)" },
    set: { adpCode: "260569", adpAllocation: 750, stage: "FEASIBILITY" } },
  { match: { rawName: "F/S Transport Modelling and Public Transport (PRP)" },
    set: { sector: "Transport", deptCode: "TRANSPORT", totalCost: 90, adpAllocation: 0 } },
  { match: { rawName: "F/S Uplifting, Conservation and Restoration of Walled City (PRP)" },
    set: { adpCode: "251615", name: "Feasibility Studies, Uplifting, Conservation and Revitalization of the Walled City Peshawar (PRP)", deptCode: "TOURISM", totalCost: 30, adpAllocation: 30, stage: "FEASIBILITY" } },
  { match: { rawName: "F/S of Frame of Peshawar (PRP)" },
    set: { adpCode: "251607", name: "Consultancy for F/S & Detailed Engineering Design of 'Frame of Peshawar' (GT Road/M-1 entry) and Entry Gates at Charsadda & Kohat Roads (PRP)", totalCost: 16.614, adpAllocation: 16.614, stage: "FEASIBILITY" } },
  { match: { rawName: "Procurement of Additional Funeral Vehicles (LCB) (PRP)" },
    set: { adpCode: "251613", name: "Purchase of Funeral Vehicles incl. Fabrication/Modification of Chassis — Eastern Zone CMG Peshawar (PRP)", totalCost: 175, adpAllocation: 0.001, stage: "TENDERING" } },
  { match: { rawName: "Installation of New & Repair of Old Street Lights (LCB) (PRP)" },
    set: { adpCode: "251614", name: "Supply/Erection of Street Light Accessories/New Installation — Eastern Zone CMG Peshawar (PRP)", totalCost: 300, adpAllocation: 0.001, stage: "TENDERING" } },
  { match: { rawName: "Establishment of Four Slaughterhouses (LCB) (PRP)" },
    set: { adpCode: "260616", name: "Establishment of Four Slaughter Houses in Peshawar (PRP)", totalCost: 1000, adpAllocation: 150, stage: "NOT_STARTED" } },
  { match: { rawName: "Establishment of Fruit & Vegetable Markets (LCB) (PRP)" },
    set: { adpCode: "260672", name: "Feasibility Study & Establishment of Fruit & Vegetable Markets in Peshawar (PRP)", totalCost: 2500, adpAllocation: 1000, stage: "NOT_STARTED" } },
  // ── irrigation trio → codes + dept ──
  { match: { rawName: "Uplift/Dualization/Beautification of Roads and Allied Works in Kabul River Canal System and Irrigation Infrastructure, District Peshawar (PRP)" },
    set: { adpCode: "251603", deptCode: "IRRIGATION", totalCost: 6636.822, adpAllocation: 100, stage: "EXECUTION" } },
  { match: { rawName: "Clearance/Improvement and Revamping of Budni Nullah and its Allied Drainage System, District Peshawar (PRP)" },
    set: { adpCode: "251604", deptCode: "IRRIGATION", totalCost: 5525.703, adpAllocation: 100, stage: "EXECUTION" } },
  { match: { rawName: "Rehabilitation/Upgradation/Construction of Canal Patrol Road along Both Sides of Warsak Lift Canal from Detour Road (RD 45+000) to Kohat Road (RD 101+000), District Peshawar (PRP)" },
    set: { adpCode: "251605", deptCode: "IRRIGATION", totalCost: 3850, adpAllocation: 100, stage: "EXECUTION" } },
  // ── existing ADP-86 schemes: dept + lifecycle from remarks ──
  { match: { adpCode: "260387" }, set: { deptCode: "CW", stage: "FEASIBILITY" } },
  { match: { adpCode: "260835" }, set: { deptCode: "CW", totalCost: 5100, stage: "FEASIBILITY" } },
  { match: { adpCode: "251627" }, set: { deptCode: "DWSS", stage: "EXECUTION" } },
  { match: { adpCode: "251597" }, set: { stage: "EXECUTION" } },
  { match: { adpCode: "251611" }, set: { stage: "EXECUTION" } },
  { match: { adpCode: "251640" }, set: { stage: "TENDERING" } },
  { match: { adpCode: "251642" }, set: { stage: "TENDERING" } },
  { match: { adpCode: "260564" }, set: { stage: "FEASIBILITY" } },
  { match: { adpCode: "260565" }, set: { stage: "FEASIBILITY" } },
  { match: { adpCode: "260566" }, set: { stage: "PC1_APPROVAL" } },
  { match: { adpCode: "260567" }, set: { stage: "PC1_APPROVAL" } },
];

const NEW_SCHEMES = [
  { adpCode: "251297", raw: "Improvement of Water Supply Distribution Network in Peshawar (PRP)", sector: "Urban Dev", dept: "LG", cost: 1140.247, alloc: 300, stage: "EXECUTION" as SchemeStage },
  { adpCode: "251641", raw: "Upgrading and Uplifting Major Arterial Roads/Routes of Peshawar City, Phase-II (PRP)", sector: "Urban Dev", dept: "LG", cost: 4588.48, alloc: 96.48, stage: "TENDERING" as SchemeStage },
  { adpCode: "261258", raw: "Upgrading and Uplifting Major Arterial Roads/Routes of Peshawar City, Phase-III (PRP)", sector: "Urban Dev", dept: "LG", cost: 5600, alloc: 3000, stage: "FEASIBILITY" as SchemeStage },
  { adpCode: "261259", raw: "Upgrading and Uplifting Major Arterial Roads/Routes of Peshawar City, Phase-IV (PRP)", sector: "Urban Dev", dept: "LG", cost: 5200, alloc: 3000, stage: "FEASIBILITY" as SchemeStage },
  { adpCode: "210137", raw: "F/S for Construction of STP at Faqir Kalay Peshawar (PRP)", sector: "Urban Dev", dept: "LG", cost: 46.43, alloc: 10, stage: "FEASIBILITY" as SchemeStage },
  // KPCIP-funded (donor) — WSSP executing, LGE&RDD reporting
  { adpCode: null, raw: "Procurement of Electric Road Cleaners (KPCIP) (PRP)", sector: "Urban Dev", dept: "LG", cost: 372.51, alloc: 0, stage: "NOT_STARTED" as SchemeStage },
  { adpCode: null, raw: "Additional Solid-Waste Vehicles in Existing Jurisdiction (KPCIP) (PRP)", sector: "Urban Dev", dept: "LG", cost: 3981.41, alloc: 0, stage: "NOT_STARTED" as SchemeStage },
  { adpCode: null, raw: "Improvement in Existing Landfill Sites and Transfer Stations (KPCIP) (PRP)", sector: "Urban Dev", dept: "LG", cost: 3088.08, alloc: 0, stage: "NOT_STARTED" as SchemeStage },
  { adpCode: null, raw: "Urban Flooding Hotspots (KPCIP) (PRP)", sector: "Urban Dev", dept: "LG", cost: 1409.18, alloc: 0, stage: "NOT_STARTED" as SchemeStage },
  { adpCode: null, raw: "Drains and Sewers Rehabilitation (KPCIP) (PRP)", sector: "Urban Dev", dept: "LG", cost: 11096, alloc: 0, stage: "NOT_STARTED" as SchemeStage },
  { adpCode: null, raw: "Improvement of Water Supply System — WSSP (KPCIP) (PRP)", sector: "Urban Dev", dept: "LG", cost: 2709.69, alloc: 0, stage: "NOT_STARTED" as SchemeStage },
];

async function main() {
  const depts = await prisma.department.findMany({ select: { id: true, code: true } });
  const byCode = new Map(depts.map((d) => [d.code, d.id]));
  const prp = await prisma.initiative.findUnique({ where: { number: 1 } });
  if (!prp) throw new Error("Initiative #1 missing");

  // 1) Delete the Pir-Zakori duplicate (it is ADP 251642)
  const pir = await prisma.scheme.findFirst({
    where: { rawName: { contains: "Pir-Zakori Cloverleaf" } },
    include: { _count: { select: { updates: true, subProjects: true } } },
  });
  if (pir) {
    if (pir._count.updates || pir._count.subProjects) {
      console.log("! Pir-Zakori has data — NOT deleted, review manually");
    } else {
      await prisma.scheme.delete({ where: { id: pir.id } });
      console.log("Deleted duplicate: Pir-Zakori Cloverleaf (= ADP 251642 Level-2 Flyover)");
    }
  }

  // 2) Updates
  let updated = 0;
  for (const u of UPDATES) {
    const where = u.match.adpCode ? { adpCode: u.match.adpCode } : { rawName: u.match.rawName };
    const scheme = await prisma.scheme.findFirst({ where });
    if (!scheme) {
      console.log("  ! not found:", JSON.stringify(u.match).slice(0, 80));
      continue;
    }
    const data: Record<string, unknown> = {};
    if (u.set.adpCode) data.adpCode = u.set.adpCode;
    if (u.set.name) data.name = u.set.name;
    if (u.set.sector) data.sector = u.set.sector;
    if (u.set.totalCost != null) data.totalCost = u.set.totalCost;
    if (u.set.adpAllocation != null) data.adpAllocation = u.set.adpAllocation;
    if (u.set.deptCode) data.departmentId = byCode.get(u.set.deptCode);
    // Never downgrade a stage a department has since advanced via daily entry
    if (u.set.stage && scheme.stage === "NOT_STARTED") data.stage = u.set.stage;
    else if (u.set.stage && ["FEASIBILITY", "PC1_APPROVAL", "TENDERING"].includes(scheme.stage)) data.stage = u.set.stage;
    await prisma.scheme.update({ where: { id: scheme.id }, data });
    updated++;
  }
  console.log(`Updated ${updated} schemes (codes/names/costs/departments/stages)`);

  // 3) New schemes
  let created = 0;
  for (const n of NEW_SCHEMES) {
    const exists = await prisma.scheme.findFirst({
      where: n.adpCode ? { adpCode: n.adpCode } : { rawName: n.raw },
    });
    if (exists) continue;
    await prisma.scheme.create({
      data: {
        adpCode: n.adpCode,
        name: n.raw,
        rawName: n.raw,
        sector: n.sector,
        totalCost: n.cost,
        adpAllocation: n.alloc,
        isPRP: true,
        isPlaceholder: false,
        stage: n.stage,
        departmentId: byCode.get(n.dept) as string,
        initiativeId: prp.id,
      },
    });
    created++;
  }
  console.log(`Created ${created} new schemes (incl. 6 KPCIP)`);

  const prpAgg = await prisma.scheme.aggregate({ where: { isPRP: true }, _count: true, _sum: { totalCost: true, adpAllocation: true } });
  console.log(`PRP portfolio: ${prpAgg._count} schemes · cost Rs ${Math.round(prpAgg._sum.totalCost ?? 0).toLocaleString()}M · alloc Rs ${Math.round(prpAgg._sum.adpAllocation ?? 0).toLocaleString()}M`);
  console.log("Total schemes:", await prisma.scheme.count());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
