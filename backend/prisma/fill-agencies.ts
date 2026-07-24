/**
 * Fills Scheme.implementingAgency for the PRP portfolio from
 * "PRP Final ADP KPCIP Projects details 9-7-26.xlsx" (Executing Agency column):
 * PDA 16 · WSSP 9 (incl. 6 KPCIP) · CMGP 4 · Irrigation 3 · PKHA 2 ·
 * Archeology / PHED / Forest / Transport 1 each. Idempotent.
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();

const BY_CODE: Record<string, string> = {
  "250115": "PDA", "251297": "WSSP", "251597": "PDA", "251607": "PDA", "251611": "PDA",
  "251612": "PDA", "251613": "CMGP", "251614": "CMGP", "251615": "Archeology", "251640": "PDA",
  "251641": "PDA", "251642": "PDA", "260564": "PDA", "260565": "PDA", "260566": "PDA",
  "260567": "PDA", "260568": "PDA", "260569": "PDA", "260616": "CMGP", "260672": "CMGP",
  "261258": "PDA", "261259": "PDA", "261326": "WSSP", "210137": "WSSP", "251627": "PHED",
  "251624": "Forest", "260387": "PKHA", "260835": "PKHA", "251603": "Irrigation",
  "251604": "Irrigation", "251605": "Irrigation",
};

const BY_NAME: Array<[string, string]> = [
  ["Procurement of Electric Road Cleaners", "WSSP"],
  ["Additional Solid-Waste Vehicles", "WSSP"],
  ["Improvement in Existing Landfill Sites", "WSSP"],
  ["Urban Flooding Hotspots", "WSSP"],
  ["Drains and Sewers Rehabilitation", "WSSP"],
  ["Improvement of Water Supply System — WSSP", "WSSP"],
  ["F/S Transport Modelling", "Transport"],
];

async function main() {
  let n = 0;
  for (const [code, agency] of Object.entries(BY_CODE)) {
    const r = await prisma.scheme.updateMany({ where: { adpCode: { contains: code } }, data: { implementingAgency: agency } });
    if (r.count === 0) console.log(`!! no scheme for code ${code}`);
    n += r.count;
  }
  for (const [frag, agency] of BY_NAME) {
    const r = await prisma.scheme.updateMany({ where: { name: { contains: frag } }, data: { implementingAgency: agency } });
    if (r.count === 0) console.log(`!! no scheme for fragment "${frag}"`);
    n += r.count;
  }
  const filled = await prisma.scheme.count({ where: { isPRP: true, implementingAgency: { not: null } } });
  const prpTotal = await prisma.scheme.count({ where: { isPRP: true } });
  console.log(`agency set on ${n} rows | PRP with agency: ${filled}/${prpTotal}`);
}

main().finally(() => prisma.$disconnect());
