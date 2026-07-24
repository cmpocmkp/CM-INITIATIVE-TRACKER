/**
 * Tags the official 112-scheme universe (CM's Priority Projects 86 + full PRP
 * program per the 9-7-26 master file) with isOfficial=true.
 *
 * The universe on the tracker resolves to exactly 112 scheme rows:
 *   - 98 coded schemes (79 from the 86 list + 19 PRP-only codes)
 *   -  7 no-code PRP items (6 KPCIP + F/S Transport Modelling)
 *   -  7 schemes carrying the full names of 5 policy rows of the 86
 *     (Mines & Minerals Company, Cashless Economy, Outsourcing Policy ×2,
 *      Skill Development / KP-SWA, ITZs → KITE + Thandiani)
 * Everything else (Swat/DIK/NPV/Marble/Carbon/Food-Security work items, TEST)
 * stays isOfficial=false — tracked under initiatives but outside the official count.
 * Idempotent.
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();

// The 98 official ADP codes — derived programmatically from the two source files
// (union of coded rows of "CM's Priority Projects (86).xlsx" and the A/B rows of
// "PRP Final ADP KPCIP Projects details 9-7-26.xlsx"). Verified all 98 exist on the tracker.
const OFFICIAL_CODES = [
  "170331","190323","190397","200049","200167","210137","210391","210487","220397","220796",
  "240280","250113","250114","250115","251297","251474","251597","251603","251604","251605",
  "251607","251611","251612","251613","251614","251615","251624","251627","251640","251641",
  "251642","260042","260093","260099","260115","260116","260117","260129","260132","260229",
  "260244","260384","260387","260435","260444","260515","260553","260556","260561","260562",
  "260564","260565","260566","260567","260568","260569","260599","260600","260608","260616",
  "260666","260672","260706","260707","260712","260714","260715","260717","260731","260778",
  "260779","260780","260792","260835","260847","260850","260853","260958","260969","261063",
  "261086","261225","261251","261258","261259","261266","261278","261282","261283","261292",
  "261301","261302","261303","261304","261305","261306","261312","261326",
] as const;

// Name fragments for the 7 no-code PRP items + 7 full-name policy schemes.
const OFFICIAL_NAME_FRAGMENTS = [
  "Additional Solid-Waste Vehicles",
  "Drains and Sewers Rehabilitation",
  "F/S Transport Modelling",
  "Improvement in Existing Landfill Sites",
  "Improvement of Water Supply System — WSSP",
  "Procurement of Electric Road Cleaners",
  "Urban Flooding Hotspots",
  "Khyber Pakhtunkhwa Miner",
  "Cashless KP",
  "Outsourcing of Healthcare Facilities",
  "Outsourcing of Low-Performing Government Schools",
  "KP Skills & Workforce Authority",
  "KITE (World Bank)",
  "Thandiani Integrated Tourism",
];

async function main() {
  await prisma.scheme.updateMany({ data: { isOfficial: false } });

  let tagged = 0;
  for (const code of OFFICIAL_CODES) {
    const r = await prisma.scheme.updateMany({
      where: { adpCode: { contains: code } },
      data: { isOfficial: true },
    });
    if (r.count === 0) console.log(`!! no scheme found for code ${code}`);
    tagged += r.count;
  }
  for (const frag of OFFICIAL_NAME_FRAGMENTS) {
    const r = await prisma.scheme.updateMany({
      where: { name: { contains: frag }, isOfficial: false },
      data: { isOfficial: true },
    });
    if (r.count === 0) console.log(`!! no scheme found for name fragment "${frag}"`);
    tagged += r.count;
  }

  const official = await prisma.scheme.count({ where: { isOfficial: true } });
  const total = await prisma.scheme.count();
  console.log(`tag operations: ${tagged}`);
  console.log(`OFFICIAL schemes: ${official} of ${total} total`);
  const unofficial = await prisma.scheme.findMany({ where: { isOfficial: false }, select: { name: true, adpCode: true } });
  console.log("non-official rows (initiative work items / sandbox):");
  for (const u of unofficial) console.log(`   - ${u.adpCode ?? "------"} ${u.name.slice(0, 66)}`);
}

main().finally(() => prisma.$disconnect());
