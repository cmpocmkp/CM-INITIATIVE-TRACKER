/**
 * Initiative #10 (Mines & Mineral Company) — structure from the official
 * "Summary for the CM: Draft Bill of KP Minerals Development and Management
 * Company, 2025" (Minerals Development Department, Dec 2025 – Jan 2026).
 *
 * Creates one scheme under MINES (KPMDMCL establishment & operationalization,
 * already underway — company incorporated 10-09-2024) with the document's own
 * workstreams as daily-trackable work items. Idempotent.
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();

const SCHEME_RAW =
  "Establishment & Operationalization of Khyber Pakhtunkhwa Minerals Development and Management Company Ltd (KPMDMCL)";

const WORK_ITEMS: { name: string; description: string }[] = [
  {
    name: "Company Incorporation & Bank Account",
    description:
      "KPMDMCL incorporated 10-09-2024 under Companies Act 2017 §14(1)(a) per Cabinet decision 07-06-2024; BoK account No. 3005500884 opened 16-01-2025 with Rs 1M paid-up capital.",
  },
  {
    name: "KPMDMCL Act — Draft Bill Legislation",
    description:
      "Dedicated Act (5 chapters, 20 sections) instead of amending the Mines & Minerals Act 2017. Vetted by Law; Cabinet Committee on Legislation approved 04-12-2025; Finance amendments to §7 & §13(2) attached (Annex IV); CM approved placement before Provincial Cabinet 19-01-2026.",
  },
  {
    name: "Permanent Board of Directors Constitution",
    description:
      "Permanent BoD: Secretaries of Minerals, Finance, Industries, P&D + four independent private-sector directors (one preferably a woman) + CEO; Audit, HR & Remuneration and Projects committees mandated.",
  },
  {
    name: "CEO Competitive Recruitment",
    description:
      "CEO through competitive process — private-sector preference, 20+ years' experience, senior leadership background, mandatory conflict-of-interest divestment. Secretary Minerals holds interim charge.",
  },
  {
    name: "Mineral Development Fund (MDF) Establishment",
    description:
      "MDF under §13 of the draft bill: 45% of net mineral revenue surplus to MDF, 55% to Provincial Consolidated Fund; Fund Board chaired by Chief Secretary with ACS P&D as vice-chair; dedicated Fund Manager; independent annual audit.",
  },
  {
    name: "5% Carried Interest Regime (Large-Scale Titles)",
    description:
      "New §20C in Mines & Minerals Act 2017: mandatory 5% free carried, non-dilutable Government interest as condition for all large-scale mining title grants/renewals, accruing from commercial production into designated KPMDMCL account.",
  },
];

async function main() {
  const mines = await prisma.department.findUnique({ where: { key: "Mines" } });
  const init = await prisma.initiative.findUnique({ where: { number: 10 } });
  if (!mines || !init) throw new Error("MINES department / Initiative #10 not found");

  let scheme = await prisma.scheme.findFirst({ where: { rawName: SCHEME_RAW } });
  if (!scheme) {
    scheme = await prisma.scheme.create({
      data: {
        adpCode: null,
        name: SCHEME_RAW,
        rawName: SCHEME_RAW,
        sector: "Mines",
        totalCost: null, // no project cost stated in the summary (Rs 1M paid-up capital only)
        adpAllocation: null,
        isPRP: false,
        isPlaceholder: false,
        stage: "EXECUTION", // establishment/operationalization explicitly underway
        departmentId: mines.id,
        initiativeId: init.id,
      },
    });
    console.log("Scheme created:", scheme.name);
  } else {
    console.log("Scheme already present");
  }

  let created = 0;
  for (const w of WORK_ITEMS) {
    const exists = await prisma.subProject.findFirst({ where: { schemeId: scheme.id, name: w.name } });
    if (exists) continue;
    await prisma.subProject.create({ data: { schemeId: scheme.id, name: w.name, description: w.description } });
    created++;
  }
  console.log(`Work items: ${created} created (${WORK_ITEMS.length} total)`);

  await prisma.initiative.update({
    where: { id: init.id },
    data: {
      description:
        "KPMDMCL incorporated 10-09-2024; dedicated KPMDMCL Act cleared by Cabinet Committee on Legislation 04-12-2025 and approved by CM for placement before the Provincial Cabinet on 19-01-2026. Includes Mineral Development Fund (45/55 split) and 5% free carried interest in large-scale titles.",
    },
  });
  console.log("Initiative #10 description updated");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
