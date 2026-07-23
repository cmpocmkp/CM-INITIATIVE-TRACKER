/**
 * Initiative #2 (Swat Motorway Phase-II) — structure from the official C&W
 * "Summary for the CM: Construction Swat Motorway Phase-II Chakdara–Fatehpur
 * (80 Km) on PPP mode — bridge financing for PSDP land acquisition scheme"
 * (Mar–Apr 2026). Two schemes under CW + documented baseline. Idempotent.
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();
const BASELINE = new Date(Date.UTC(2026, 6, 23)); // RIAT date on the summary

const LAND_RAW = "Land Acquisition for Swat Motorway Phase-II (PSDP)";
const PPP_RAW = "Construction of Swat Motorway Phase-II from Chakdara to Fatehpur (80 Km) — PPP Mode";

async function main() {
  const cw = await prisma.department.findUnique({ where: { key: "Roads" } });
  const init = await prisma.initiative.findUnique({ where: { number: 2 } });
  if (!cw || !init) throw new Error("CW department / Initiative #2 not found");

  // ── Scheme A: PSDP land acquisition (ECNEC 16-07-2020, Rs 20,000M) ──
  let land = await prisma.scheme.findFirst({ where: { rawName: LAND_RAW } });
  if (!land) {
    land = await prisma.scheme.create({
      data: {
        adpCode: null, // PSDP (federal), not KP ADP
        name: LAND_RAW,
        rawName: LAND_RAW,
        sector: "Roads",
        totalCost: 20000,
        adpAllocation: 15, // CFY 2025-26 PSDP allocation (token)
        isPRP: false,
        isPlaceholder: false,
        stage: "EXECUTION", // acquisition underway — 52 of 80 Km awarded
        departmentId: cw.id,
        initiativeId: init.id,
      },
    });
    console.log("Scheme created:", land.name);
  }
  const landItems = [
    {
      name: "Section-11 Award — 52 Km ROW (Malakand & Swat)",
      description:
        "Section-4 imposed on entire 80 Km ROW; Section-11 award announced for 52 Km after fund release — 65% encumbrance-free ROW per Finance (C&W summary cites 56% of land area). Rs 8,200M released to date; Rs 3,100M short for the acquired 5,650 Kanal.",
    },
    {
      name: "Remaining ROW Acquisition (28 Km / 40%) — Rs 11,800M Bridge Financing",
      description:
        "Balance Rs 11,800M sought as bridge financing (supplementary grant) — P&D concurred 24-03-2026; Finance requires routing via PPP Committee under PPP Act 2020 and de-linking from financial close; Chief Secretary sought C&W response 26-04-2026.",
    },
  ];
  for (const w of landItems) {
    const exists = await prisma.subProject.findFirst({ where: { schemeId: land.id, name: w.name } });
    if (!exists) await prisma.subProject.create({ data: { schemeId: land.id, name: w.name, description: w.description } });
  }

  // Documented baseline on the land scheme: 65% ROW awarded, Rs 8,200M released.
  const hasBase = await prisma.progressUpdate.findFirst({ where: { schemeId: land.id, reportDate: BASELINE } });
  if (!hasBase) {
    await prisma.progressUpdate.create({
      data: {
        schemeId: land.id,
        reportDate: BASELINE,
        phase: "Land Acquisition",
        physicalProgressPct: 65,
        siteStatus: "SLOW",
        fundsReleased: 8200,
        narrative:
          "Baseline per C&W Summary for CM (Mar–Apr 2026): Section-11 award for 52 of 80 Km (65% ROW per Finance); Rs 8,200M released against Rs 20,000M ECNEC-approved cost.",
        bottlenecks:
          "Rs 11,800M balance unfunded (CFY PSDP allocation only Rs 15M); Rs 3,100M short for acquired 5,650 Kanal; bridge-financing case pending — Finance requires PPP Committee route; C&W response awaited (CS note 26-04-2026).",
      },
    });
    console.log("baseline seeded on land scheme (65%, Rs 8,200M released)");
  }

  // ── Scheme B: the PPP construction concession ──
  let ppp = await prisma.scheme.findFirst({ where: { rawName: PPP_RAW } });
  if (!ppp) {
    ppp = await prisma.scheme.create({
      data: {
        adpCode: null,
        name: PPP_RAW,
        rawName: PPP_RAW,
        sector: "Roads",
        totalCost: null, // concession-financed; no construction cost stated in the summary
        adpAllocation: null,
        isPRP: false,
        isPlaceholder: false,
        stage: "TENDERING", // pre-financial-close
        departmentId: cw.id,
        initiativeId: init.id,
      },
    });
    console.log("Scheme created:", ppp.name);
  }
  const pppItems = [
    {
      name: "Financial Close — UBL Term Sheet",
      description:
        "Concessionaire M/S SMART concluding negotiation with UBL for project facility (term sheet); conditions include confirmation of 100% land acquisition post financial close — under Provincial Govt review. 60% ROW condition precedent already met per Finance (65% available).",
    },
    {
      name: "Construction Chakdara–Fatehpur (80 Km)",
      description: "Physical construction under the PPP concession — commences after financial close.",
    },
  ];
  for (const w of pppItems) {
    const exists = await prisma.subProject.findFirst({ where: { schemeId: ppp.id, name: w.name } });
    if (!exists) await prisma.subProject.create({ data: { schemeId: ppp.id, name: w.name, description: w.description } });
  }

  await prisma.initiative.update({
    where: { id: init.id },
    data: {
      description:
        "80 Km Chakdara–Fatehpur motorway on PPP (concessionaire M/S SMART). Land acquisition PSDP scheme Rs 20,000M (ECNEC 16-07-2020): 52/80 Km ROW awarded (65%), Rs 8,200M released, Rs 11,800M bridge financing sought. Financial close in last leg (UBL term sheet); Finance requires PPP Committee routing.",
    },
  });
  console.log("Initiative #2 description updated");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
