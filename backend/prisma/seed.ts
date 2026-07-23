/**
 * CM INITIATIVE TRACKER — database seed.
 *
 * Idempotent / create-if-missing so it is safe to run on every deploy.
 * Set FORCE_RESEED=1 to also refresh owner/initiative/cost on existing schemes.
 */
import { PrismaClient, Role, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const FORCE = process.env.FORCE_RESEED === "1";

type SeedScheme = {
  sno: number | null;
  sector: string;
  adpCode: string | null;
  name: string;
  rawName: string;
  cost: number | null;
  alloc: number | null;
  isPRP: boolean;
  isPlaceholder: boolean;
};

// ── Departments (== Sectors). Keys for the first 22 match the ADP sector label
//    exactly so schemes attach automatically. The rest are extra KP departments.
const DEPARTMENTS: { key: string; code: string; name: string; isSector: boolean }[] = [
  // Sectors present in the ADP priority list (key === ADP sector string)
  { key: "Auqaf", code: "AUQAF", name: "Auqaf, Hajj, Religious & Minority Affairs", isSector: true },
  { key: "DWSS", code: "DWSS", name: "Public Health Engineering (Drinking Water & Sanitation)", isSector: true },
  { key: "E&SE", code: "ESE", name: "Elementary & Secondary Education", isSector: true },
  { key: "E&P", code: "EP", name: "Energy & Power", isSector: true },
  { key: "Finance", code: "FIN", name: "Finance", isSector: true },
  { key: "Food", code: "FOOD", name: "Food", isSector: true },
  { key: "Forestry", code: "FOREST", name: "Environment, Forestry & Wildlife", isSector: true },
  { key: "Health", code: "HEALTH", name: "Health", isSector: true },
  { key: "Home", code: "HOME", name: "Home & Tribal Affairs", isSector: true },
  { key: "Housing", code: "HOUSING", name: "Housing", isSector: true },
  { key: "Industries", code: "IND", name: "Industries, Commerce & Technical Education", isSector: true },
  { key: "Information", code: "INFO", name: "Information & Public Relations", isSector: true },
  { key: "Livestock", code: "LIVESTOCK", name: "Livestock, Dairy & Fisheries Development", isSector: true },
  { key: "Mines", code: "MINES", name: "Minerals Development", isSector: true },
  { key: "MSD", code: "MSD", name: "Multi-Sectoral Development (P&D)", isSector: true },
  { key: "Roads", code: "CW", name: "Communication & Works (Roads)", isSector: true },
  { key: "SNGPL", code: "SNGPL", name: "Sui Northern Gas Pipelines Ltd", isSector: true },
  { key: "Social Welfare", code: "SW", name: "Social Welfare, Special Education & Women Empowerment", isSector: true },
  { key: "Sports", code: "SPORTS", name: "Sports, Culture & Youth Affairs", isSector: true },
  { key: "Tourism", code: "TOURISM", name: "Tourism, Antiquities & Museums (KP-CTA)", isSector: true },
  { key: "Transport", code: "TRANSPORT", name: "Transport & Mass Transit", isSector: true },
  { key: "Urban Dev", code: "URBAN", name: "Urban Development & Peshawar Development Authority", isSector: true },
  // Extra KP departments (owners of initiatives / to reach the full set)
  { key: "LG", code: "LG", name: "Local Government, Elections & Rural Development", isSector: false },
  { key: "STIT", code: "STIT", name: "Science & Technology and Information Technology", isSector: false },
  { key: "Irrigation", code: "IRRIGATION", name: "Irrigation", isSector: false },
  { key: "HED", code: "HED", name: "Higher Education, Archives & Libraries", isSector: false },
  { key: "Agriculture", code: "AGRI", name: "Agriculture", isSector: false },
  { key: "Population", code: "POP", name: "Population Welfare", isSector: false },
  { key: "Labour", code: "LABOUR", name: "Labour", isSector: false },
  { key: "Law", code: "LAW", name: "Law, Parliamentary Affairs & Human Rights", isSector: false },
  { key: "Revenue", code: "REVENUE", name: "Revenue & Estate", isSector: false },
  { key: "PDMA", code: "PDMA", name: "Relief, Rehabilitation & Settlement (PDMA)", isSector: false },
  { key: "Excise", code: "EXCISE", name: "Excise, Taxation & Narcotics Control", isSector: false },
  { key: "Establishment", code: "EST", name: "Establishment & Administration", isSector: false },
];

// ── The 21 CM focus initiatives + scheme-matching rules.
const INITIATIVES: {
  number: number;
  name: string;
  shortName: string;
  category: string;
  leadKey: string;
  codes: string[];
  nameIncludes: string[];
  prp?: boolean;
}[] = [
  { number: 1, name: "Peshawar Revitalization Plan", shortName: "Peshawar Revitalization", category: "Urban & Peshawar", leadKey: "LG", codes: [], nameIncludes: [], prp: true },
  { number: 2, name: "Swat Motorway Phase-II", shortName: "Swat Motorway Ph-2", category: "Motorways & Roads", leadKey: "Roads", codes: [], nameIncludes: ["swat motorway", "swat expressway"] },
  { number: 3, name: "Dera Ismail Khan (D.I.K) Motorway", shortName: "DIK Motorway", category: "Motorways & Roads", leadKey: "Roads", codes: ["261301", "261302", "261303", "261304", "261305", "261306"], nameIncludes: ["peshawar di khan motorway", "peshawar d.i. khan motorway", "d.i.khan motorway", "di khan motorway"] },
  { number: 4, name: "Linking Hakla Motorway to Indus Highway", shortName: "Hakla–Indus Link", category: "Motorways & Roads", leadKey: "Roads", codes: ["251474"], nameIncludes: ["hakla"] },
  { number: 5, name: "New Peshawar Valley", shortName: "New Peshawar Valley", category: "Urban & Peshawar", leadKey: "Housing", codes: ["250113", "250114"], nameIncludes: ["new peshawar valley"] },
  { number: 6, name: "Health City / New Hospital in Peshawar", shortName: "Health City / New Hospital", category: "Health", leadKey: "Health", codes: ["260115", "260099"], nameIncludes: ["health city", "general hospital at benazir"] },
  { number: 7, name: "Urban Railway in Peshawar", shortName: "Peshawar Urban Railway", category: "Transport", leadKey: "Transport", codes: ["260435"], nameIncludes: ["suburban rail", "peshawar valley railways", "urban rail"] },
  { number: 8, name: "Daraban Eco Zone; Mullagori & Mohmand Marble City", shortName: "Eco Zone & Marble City", category: "Economy & Industry", leadKey: "Industries", codes: ["220796", "260608"], nameIncludes: ["daraban", "mulagouri", "mullagori", "marble"] },
  { number: 9, name: "Uplift of Tourist Areas / ITZs / Skiing Resort / Master Planning", shortName: "Tourism / ITZ / Skiing", category: "Tourism & Environment", leadKey: "Tourism", codes: ["260666"], nameIncludes: ["itz", "skying", "skiing", "chairlift"] },
  { number: 10, name: "Establishment of Mines / Mineral Company", shortName: "Mines & Mineral Company", category: "Economy & Industry", leadKey: "Mines", codes: [], nameIncludes: ["mines & minerals company", "mineral company", "minerals company"] },
  { number: 11, name: "Indigenous Gas Supply to KP for Industrialisation", shortName: "Indigenous Gas Supply", category: "Energy", leadKey: "SNGPL", codes: [], nameIncludes: ["indegenous gas", "indigenous gas", "gas supply"] },
  { number: 12, name: "Billion Tree Tsunami & Carbon Credit Sale", shortName: "Billion Tree & Carbon Credit", category: "Tourism & Environment", leadKey: "Forestry", codes: ["210391", "240280", "260731"], nameIncludes: ["billion tree", "afforestation"] },
  { number: 13, name: "Transport / Electric Buses for Divisional HQs", shortName: "Electric Buses (Divisional HQs)", category: "Transport", leadKey: "Transport", codes: ["260444", "261225"], nameIncludes: ["electric bus", "brt"] },
  { number: 14, name: "Establishment of Provincial Transmission Line", shortName: "Provincial Transmission Line", category: "Energy", leadKey: "E&P", codes: [], nameIncludes: ["transmission line", "distribution company"] },
  { number: 15, name: "AI Authority Establishment & Departmental Linkages", shortName: "AI Authority", category: "Technology & Governance", leadKey: "STIT", codes: [], nameIncludes: ["ai authority", "artificial intelligence"] },
  { number: 16, name: "New Outsourcing Policy (Health, Education, Social Welfare, Tourism)", shortName: "New Outsourcing Policy", category: "Social & Governance", leadKey: "MSD", codes: [], nameIncludes: ["outsourcing policy"] },
  { number: 17, name: "Food Security: Dams / Small Dams in Southern Districts", shortName: "Food Security & Dams", category: "Food & Water", leadKey: "Irrigation", codes: ["260244", "260093"], nameIncludes: ["bara dam", "silos", "small dam"] },
  { number: 18, name: "Skill Development Projects / Initiatives", shortName: "Skill Development", category: "Social & Governance", leadKey: "MSD", codes: [], nameIncludes: ["skill development"] },
  { number: 19, name: "Socio-Economic Registry (KP-SER, like BISP)", shortName: "Socio-Economic Registry", category: "Social & Governance", leadKey: "Social Welfare", codes: ["260600", "260561"], nameIncludes: ["socio-economic registry", "social protection authority", "kp-ser", "kp-spa"] },
  { number: 20, name: "Cashless Economy", shortName: "Cashless Economy", category: "Economy & Industry", leadKey: "Finance", codes: [], nameIncludes: ["cashless"] },
  { number: 21, name: "Take-over of 5 Districts from Army (Phase-I & II)", shortName: "Districts Take-over", category: "Security & Governance", leadKey: "Home", codes: ["261278"], nameIncludes: ["security challenged districts", "strengthening of police"] },
];

function matchInitiative(row: SeedScheme): number | null {
  if (row.isPRP) return 1;
  const raw = row.rawName.toLowerCase();
  for (const init of INITIATIVES) {
    if (init.prp) continue;
    if (row.adpCode && init.codes.includes(row.adpCode)) return init.number;
    if (init.nameIncludes.some((n) => raw.includes(n))) return init.number;
  }
  return null;
}

async function ensureUser(username: string, password: string, name: string, role: Role, departmentId: string | null) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({ data: { username, passwordHash, name, role, departmentId } });
}

async function main() {
  console.log("Seeding CM INITIATIVE TRACKER ...");

  // 1) Departments (upsert by key)
  const deptByKey: Record<string, string> = {};
  for (const d of DEPARTMENTS) {
    const dept = await prisma.department.upsert({
      where: { key: d.key },
      update: { code: d.code, name: d.name, isSector: d.isSector },
      create: { key: d.key, code: d.code, name: d.name, isSector: d.isSector },
    });
    deptByKey[d.key] = dept.id;
  }
  console.log(`  Departments: ${DEPARTMENTS.length}`);

  // 2) System users
  await ensureUser(
    process.env.SUPERADMIN_USERNAME || "superadmin",
    process.env.SUPERADMIN_PASSWORD || "super@123",
    "Super Administrator",
    Role.SUPERADMIN,
    null,
  );
  await ensureUser(
    process.env.ADMIN_USERNAME || "admin",
    process.env.ADMIN_PASSWORD || "admin@123",
    "CMPO Administrator",
    Role.ADMIN,
    null,
  );

  // 3) Department users (username == department code, default password)
  const deptPwd = process.env.DEPARTMENT_DEFAULT_PASSWORD || "123456";
  for (const d of DEPARTMENTS) {
    await ensureUser(d.code, deptPwd, d.name, Role.DEPARTMENT, deptByKey[d.key]);
  }
  console.log(`  Users: system + ${DEPARTMENTS.length} department logins`);

  // 4) Initiatives (upsert by number)
  const initByNumber: Record<number, string> = {};
  for (const init of INITIATIVES) {
    const rec = await prisma.initiative.upsert({
      where: { number: init.number },
      update: {
        name: init.name,
        shortName: init.shortName,
        category: init.category,
        leadDepartmentId: deptByKey[init.leadKey] ?? null,
      },
      create: {
        number: init.number,
        name: init.name,
        shortName: init.shortName,
        category: init.category,
        leadDepartmentId: deptByKey[init.leadKey] ?? null,
      },
    });
    initByNumber[init.number] = rec.id;
  }
  console.log(`  Initiatives: ${INITIATIVES.length}`);

  // 5) Schemes (create-if-missing; owner = LG for PRP else the sector dept)
  const raw = fs.readFileSync(path.join(__dirname, "seed-data.json"), "utf-8");
  const schemes: SeedScheme[] = JSON.parse(raw);
  let created = 0;
  let updated = 0;
  let skippedNoDept = 0;

  for (const row of schemes) {
    // Rows without an ADP code are the initiatives themselves written as line
    // items (e.g. "Cashless Economy") — tracked as Initiatives, not schemes.
    if (row.isPlaceholder) continue;
    const ownerKey = row.isPRP ? "LG" : row.sector;
    const departmentId = deptByKey[ownerKey] ?? deptByKey[row.sector];
    if (!departmentId) {
      skippedNoDept++;
      console.warn(`  ! No department for sector "${row.sector}" — skipped: ${row.rawName.slice(0, 60)}`);
      continue;
    }
    const initNum = matchInitiative(row);
    const initiativeId = initNum ? initByNumber[initNum] ?? null : null;

    const existing = await prisma.scheme.findFirst({
      where: row.adpCode ? { adpCode: row.adpCode } : { rawName: row.rawName, sector: row.sector },
    });

    if (!existing) {
      await prisma.scheme.create({
        data: {
          adpCode: row.adpCode,
          name: row.name,
          rawName: row.rawName,
          sector: row.sector,
          totalCost: row.cost,
          adpAllocation: row.alloc,
          isPRP: row.isPRP,
          isPlaceholder: row.isPlaceholder,
          departmentId,
          initiativeId,
        },
      });
      created++;
    } else if (FORCE) {
      await prisma.scheme.update({
        where: { id: existing.id },
        data: { departmentId, initiativeId, totalCost: row.cost, adpAllocation: row.alloc, isPRP: row.isPRP },
      });
      updated++;
    }
  }
  console.log(`  Schemes: ${created} created, ${updated} updated, ${skippedNoDept} skipped`);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
