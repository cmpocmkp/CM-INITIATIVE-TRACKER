/**
 * Batch enrichment #2 — structures 10 initiatives from the official documents
 * in "Waqar Sb task" (CM summaries, PPP Committee minutes, Cashless KP Annual
 * Report 2026), extracted verbatim July 2026. Idempotent by rawName.
 *
 * Initiatives covered: #3 DIK Motorway, #5 New Peshawar Valley, #8 Economic
 * Zones, #9 ITZs/Tourism, #12 Carbon Credit, #16 Outsourcing, #17 Food
 * Security, #18 Skill Development, #19 Socio-Economic Registry, #20 Cashless.
 */
import { PrismaClient, SchemeStage, SiteStatus } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();
const BASELINE = new Date(Date.UTC(2026, 6, 23)); // RIAT stamp date on all documents

type WI = {
  name: string;
  description: string;
  baseline?: { pct?: number; status?: SiteStatus; narrative?: string; bottlenecks?: string };
};
type NewScheme = {
  initiative: number;
  deptKey: string;
  sector: string;
  rawName: string;
  cost?: number | null;
  alloc?: number | null;
  stage: SchemeStage;
  workItems: WI[];
};

const SCHEMES: NewScheme[] = [
  // ── #3 Peshawar–D.I.Khan Motorway ──
  {
    initiative: 3, deptKey: "Roads", sector: "Roads",
    rawName: "Construction of Peshawar–D.I. Khan Motorway (365 Km, 6-Lane) — PPP, 8 Segments",
    cost: null, alloc: null, stage: "TENDERING",
    workItems: [
      {
        name: "Segment-wise Competitive PPP Bidding (8 Segments)",
        description:
          "11th PPP Committee (23-04-2026, CM chair): FWO negotiated bidding ANNULLED; all 8 segments to be offered separately under competitive PPP bidding, fast-track by PKHA. Corridor cost range Rs 263–536 billion by configuration; standalone BOT unviable in every configuration; viable segments 1, 7, 8 (BOT+VGF); market sounding on segments 1, 2, 7, 8. PKHA to run a road show from own sources.",
        baseline: { status: "ACTIVE", narrative: "PPP Committee decisions of 23-04-2026 approved for implementation; segment-wise procurement to be launched by PKHA." },
      },
      {
        name: "IFI / ADP Financing for Non-viable Segments (3–6)",
        description:
          "P&D, Finance and C&W to simultaneously engage ADB, World Bank and other IFIs for partial/full financing of segments 3–6, or propose ADP inclusion after market-response evaluation (PPP Committee decision, 23-04-2026).",
      },
      {
        name: "Land Acquisition Funding — Rs 21 Bn Scheme (ADP 1517/240409)",
        description:
          "Cabinet (23-12-2024) approved Rs 21,000M land acquisition & resettlement + Rs 2,000M supplementary grant (start/end points). FY2025-26 allocation only Rs 600M; Rs 120M released and UNUTILIZED (Finance, 19-01-2026). Two PC-Is (Peshawar & D.I.Khan Divisions) at PDWP 02-09-2025 — routed to current budget side. CM approved Cabinet placement 02-02-2026. FY2026-27 package-wise schemes 261301–261306 continue in ADP.",
        baseline: { status: "SLOW", narrative: "Rs 120M released against Rs 21,000M scheme; funds unutilized per Finance Department (19-01-2026).", bottlenecks: "Allocation Rs 600M = 2.9% of scheme cost; released Rs 120M unutilized; balance left to intra/inter-sectoral re-appropriation with no identified source; Cabinet decision pending." },
      },
    ],
  },
  // ── #5 New Peshawar Valley ──
  {
    initiative: 5, deptKey: "Housing", sector: "Housing",
    rawName: "New Peshawar Valley — Project Financing & Readiness (Rs 2.00 Bn Tranche-Based Loan Case)",
    cost: null, alloc: null, stage: "FEASIBILITY",
    workItems: [
      {
        name: "Rs 2.00 Bn Tranche-Based Government Loan — Cabinet Case",
        description:
          "CM Departmental Review 08-12-2025 directed: financial & repayment model, exploration of KPHA bridge financing, Project Readiness Report. Summary (Housing, 22-01-2026) seeks Cabinet placement under Rule 19(1). Finance (25-02-2026) returned SIX objections: no cash-flow model → default risk; CM-required model & readiness report missing; no bankability/phased cash requirements/risk mitigation; KPHA past liabilities unexplained; debt-servicing capacity unproven; repayment model absent (Annex III is a scan). File back with Secretary Housing since 28-02-2026.",
        baseline: { status: "HALTED", narrative: "Financing case returned by Finance with six objections (25-02-2026); file with Housing Department.", bottlenecks: "KPHA cannot self-finance: Rs 5.50 Bn allottee funds are trust money (TDRs, BoK/Alfalah); liabilities: Rs 1,027M Finance loan, ~Rs 7 Bn Jalozai land compensation (Supreme Court rate enhancement), Rs 8 Bn Hangu Township PC-I prepared." },
      },
      {
        name: "Project Readiness Report & Financial/Repayment Model",
        description: "Required by the CM's 08-12-2025 directions and demanded by Finance before any Cabinet placement — not yet produced per the record.",
      },
    ],
  },
  // ── #8 Economic Zones ──
  {
    initiative: 8, deptKey: "Industries", sector: "Industries",
    rawName: "Mohmand Marble City — Transfer & Operationalization under KPEZDMC",
    cost: null, alloc: null, stage: "EXECUTION",
    workItems: [
      {
        name: "Release of Plot Sale Proceeds (PKR 75.75M) to KPEZDMC",
        description:
          "MMC (ex-FATA Development Authority) transferred to KPEZDMC per Government decision 21-03-2019; plot-sale proceeds PKR 75.75M lying in Government Treasury since transition. Advisor-Finance meeting 02-10-2024 → Finance case 22-10-2024 → Summary (Industries, 23-02-2026); Finance endorsed 05-03-2026, P&D 24-03-2026; CM approved Cabinet placement 28-03-2026 — Cabinet decision pending.",
        baseline: { status: "SLOW", narrative: "Reconciliation complete; CM approved placement before Cabinet 28-03-2026.", bottlenecks: "PKR 75.75M held in Government Treasury since 2019 transition; awaiting Provincial Cabinet decision." },
      },
    ],
  },
  // ── #9 ITZs / Tourism ──
  {
    initiative: 9, deptKey: "Tourism", sector: "Tourism",
    rawName: "KITE (World Bank) — Mankiyal Road 24 Km & ITZ Access, District Swat (ADP 1863/170539)",
    cost: null, alloc: null, stage: "EXECUTION",
    workItems: [
      {
        name: "Road Works — Rehabilitation & Remodeling (24 Km)",
        description:
          "Mankiyal Road under KITE (World Bank-assisted, ADP 1863/170539 FY2025-26) — access to zero point of Mankiyal ITZ. Earth cutting complete on the full 24 Km and contractor being paid (C&W, 28-04-2026). Loan closes 27-04-2027; extension to December 2027 proposed.",
        baseline: { status: "ACTIVE", narrative: "Earth cutting complete on full 24 Km; contractor payments ongoing (per C&W minute 28-04-2026)." },
      },
      {
        name: "Land Acquisition (301 Kanal 13.77 Marla) — Rate Dispute",
        description:
          "Section-4 notified 15-11-2023 (DC Swat). Original tentative cost Rs 74.99M; committee-negotiated rates (07-10-2025: Rs 3.8M/kanal Mankiyal, Rs 3.5M/kanal Badai) inflate cost to Rs 1,090.88M (~14.5x). Options before Cabinet; P&D recommends fast-track re-negotiation via DC Swat by land categories (30-day report); Finance & Law concur (Law: no legal infirmity, 13-07-2026). File with Senior Member Board of Revenue since 14-07-2026.",
        baseline: { status: "HALTED", narrative: "Land unacquired and unpaid since Section-4 of 15-11-2023; case pending with SMBR then Cabinet.", bottlenecks: "14.5x cost escalation (Rs 74.99M → Rs 1,090.88M); initial Rs 91M never released; WB rules bar compulsory acquisition; loan closure 27-04-2027 at risk." },
      },
    ],
  },
  {
    initiative: 9, deptKey: "Tourism", sector: "Tourism",
    rawName: "Thandiani Integrated Tourism Project — PPP Concession (DBFOM, 50 Years)",
    cost: null, alloc: null, stage: "EXECUTION",
    workItems: [
      {
        name: "Concession Agreement Execution (Tahir Builders)",
        description:
          "9th PPP Committee (27-01-2026, CM chair) approved the Concession Agreement; CM approved minutes 06-02-2026. 400 of 1,200 Kanal demarcated (30–35% buildable). Terms: DBFOM, 50-year extendable, no VGF, asset reverts; reserve price + 5% gross revenue (min cap Rs 100M/yr; Rs 100M/yr during construction); Rs 300M guarantee bond (3-yr construction). 4 pre-qualified, 2 bids, Tahir Builders selected — Letter of Conditional Award granted. Big-4 Independent Auditor & Engineer directed (KPMG/EY/PwC-AFF).",
        baseline: { status: "ACTIVE", narrative: "Concession approved by PPP Committee 27-01-2026, CM 06-02-2026; conditional award with Tahir Builders." },
      },
      {
        name: "Utilities to Zero Point — Water 80%, Road (WB), Electricity",
        description: "Water supply to zero point 80% completed; access road under construction (World Bank financing); electricity in process; GDA to charge water; 10-for-1 tree replanting resolution; EIA done under PPP process.",
        baseline: { pct: 80, status: "ACTIVE", narrative: "Water to zero point 80% complete; road (WB) under construction; electricity in process (PPP Committee minutes 27-01-2026)." },
      },
    ],
  },
  // ── #12 Carbon Credit ──
  {
    initiative: 12, deptKey: "Forestry", sector: "Forestry",
    rawName: "Forest Carbon Credit Mapping — Carbon Removal through Forestation (PPP, USD 70M)",
    cost: null, alloc: null, stage: "TENDERING",
    workItems: [
      {
        name: "PPP Transaction — EOI (Single Stage Two Envelope)",
        description:
          "Technical feasibility approved by 9th PPP Committee 27-01-2026; CM approved minutes 06-02-2026. Three project packages (IFM & ARR types) offered to private sector under PPP; initial investment USD 70 million; revenue from year 4. Procurement authorized per approved transaction structure — next step EOI under Single Stage Two Envelope; winner = bidder offering highest Government carbon-credit share.",
        baseline: { status: "ACTIVE", narrative: "Feasibility & transaction structure approved (PPP Committee 27-01-2026; CM 06-02-2026); EOI stage next." },
      },
      {
        name: "Government Carbon Revenue Share Framework",
        description:
          "Base Government share of carbon credits: 40% (bids above win); windfall above USD 25/credit split 80:20 (Government:private). Non-carbon revenues included: tourism, timber, non-timber, scientific thinning, other forest industry revenues. Lead: CCFE&W with PPP Unit (P&D); REDD+ PD engaged.",
      },
    ],
  },
  // ── #16 Outsourcing Policy ──
  {
    initiative: 16, deptKey: "E&SE", sector: "E&SE",
    rawName: "Outsourcing of Low-Performing Government Schools — Phase-I: 500 Schools via ESEF",
    cost: null, alloc: null, stage: "EXECUTION",
    workItems: [
      {
        name: "Phase-I — 222 Winter-Zone Schools (Operational)",
        description: "Provincial Cabinet (39th meeting, 02-10-2025) approved outsourcing of low-performing schools via ESEF with phased implementation and annual budgetary allocations. Phase-I: 500 schools outsourced competitively — 222 winter-zone schools' operations commenced.",
        baseline: { pct: 100, status: "COMPLETED", narrative: "222 winter-zone schools operational under education partners (per E&SE summary 09-07-2026)." },
      },
      {
        name: "Phase-I — 278 Summer-Zone Schools (Academics from Sept 2026)",
        description: "Summer-zone academic activities commence September 2026 per academic calendar.",
      },
      {
        name: "Outsourcing Policy — Cabinet Approval",
        description:
          "Comprehensive Draft Policy prepared to institutionalize governance, M&E, PTCs, OOSC treatment, contract & financial governance, dispute resolution (Phase-I ran ad hoc). Summary 09-07-2026; Secretary signed 11-07-2026; with Law Department for views since 21-07-2026, then Cabinet.",
        baseline: { status: "ACTIVE", narrative: "Draft policy in approval chain — with Law Department since 21-07-2026." },
      },
    ],
  },
  {
    initiative: 16, deptKey: "Health", sector: "Health",
    rawName: "Outsourcing of Healthcare Facilities — Cat-D Hospitals & RHCs via KP Health Foundation",
    cost: null, alloc: null, stage: "PC1_APPROVAL",
    workItems: [
      {
        name: "Standard Agreements — Cabinet Approval",
        description:
          "Standard outsourcing agreements (General + Special parts: exit strategy, performance model, KPIs, fund-flow, monitoring, grievance redressal, risk matrix) legally vetted (Law 20-02-2025 & 25-12-2025), financially vetted (Finance 21-11-2025; endorsed 29-12-2025), P&D concurrence 13-01-2026; CM approved Cabinet placement 15-01-2026. Third-party operators via transparent procurement, 3-year terms; OOC oversight; new fund-flow mechanism notified 29-09-2025.",
        baseline: { status: "ACTIVE", narrative: "CM cleared agreements for Cabinet 15-01-2026; Cabinet approval pending. Open items: clauses 10.19/10.20 need management decision; amended Appendix-F fund-flow requires vetting." },
      },
      {
        name: "Extension to Cat-A/B/C Facilities",
        description: "Summary also seeks permission to keep updating the Standard Agreements for other facility categories (Cat-A/B/C and others).",
      },
    ],
  },
  // ── #17 Food Security ──
  {
    initiative: 17, deptKey: "Agriculture", sector: "Agriculture",
    rawName: "KP Food Security Support Project (ADB) — ADP 230058",
    cost: 25125.824, alloc: null, stage: "EXECUTION",
    workItems: [
      {
        name: "Seed & DAP Fertilizer e-Subsidy (7 Flood-Affected Districts)",
        description:
          "ECNEC approved 11-12-2023; total Rs 25,125.824M (ADB Rs 23,698.220M + GoKP Rs 1,427.604M); districts: D.I.Khan, Peshawar, Charsadda, Nowshera, Swat, Malakand, Upper Dir. Certified seed + DAP via e-subsidy; claimed wheat yield gain 10–20%; current cost-sharing 33:67.",
        baseline: { status: "ACTIVE", narrative: "Project operational under approved PC-1 (33:67 cost-sharing model)." },
      },
      {
        name: "Subsidy Ratio Revision Case (100% or 80:20)",
        description:
          "Advisor recommended 100% subsidy (09-09-2025, donor no-objection asserted). P&D (02-10-2025): change requires PC-1 REVISION via competent forum + prior economic analysis; Finance endorsed (17-10-2025). Closing note (unsigned) to inform PD KP-FSSP accordingly — with Secretary Agriculture since 22-10-2025.",
        baseline: { status: "SLOW", narrative: "Ratio change effectively declined at bureaucratic tier; PC-1 revision route required.", bottlenecks: "No movement recorded on the file for ~9 months (since 22-10-2025)." },
      },
    ],
  },
  // ── #18 Skill Development ──
  {
    initiative: 18, deptKey: "Industries", sector: "Industries",
    rawName: "Establishment of KP Skills & Workforce Authority (KP-SWA) under IC&TE",
    cost: null, alloc: null, stage: "FEASIBILITY",
    workItems: [
      {
        name: "CM Approval of Two-Tier Framework",
        description:
          "Model: (1) lean Provincial Skills Coordination Secretariat in IC&TE (Special Secretary-led); (2) autonomous KP-SWA, Board chaired by the CM — delivery, certification, standards, industry linkages, labour-market intelligence, digital skills platform. Punjab study visit 10-11-2025. Summary 18-03-2026; P&D no-objection 13-04-2026 (stakeholder input first); ACS E&A-HRM support 26-04-2026 with 4 conditions (consolidation not parallel structure, mapped finances/HR/transition, digital+LMI as core). Awaiting Secretary Social Welfare views since 04-05-2026 (marked Urgent).",
        baseline: { status: "SLOW", narrative: "Framework in consultation round ordered by Chief Secretary.", bottlenecks: "Social Welfare views pending ~2.5 months (since 04-05-2026); CM decision gated on them." },
      },
      {
        name: "Legislation — Rules of Business Amendment + KP-SWA Act",
        description: "Post-approval pathway: policy decision → RoB amendment designating IC&TE as coordinating department → enactment of KP Skills & Workforce Authority Act. Not started (gated on CM approval). Current fragmentation: KP-TEVTA (107 institutes), WWB (33), SIDB (30), Commerce (44), plus Social Welfare/Agriculture/LG/KPITB/Prisons/E&P deliverers.",
      },
    ],
  },
  // ── #20 Cashless Economy ──
  {
    initiative: 20, deptKey: "STIT", sector: "ST&IT",
    rawName: "Cashless KP — Provincial FinTech & Digital Transformation Programme (KPITB)",
    cost: null, alloc: null, stage: "EXECUTION",
    workItems: [
      {
        name: "P2G Digital Collections (Account-1 & Non-Account-1)",
        description:
          "Person-to-Government collections via 1-Link tags: Account-1 (SBP treasury) and Non-Account-1 (commercial banks e.g. BoK). Onboarding toolkits: Joinder Agreement with Finance, digital account numbers from SBP, 1-Link TAGs, PAYMIR API (2-day creation) for digitized services or Digital Muhasil invoicing for undigitized; KPITB integration-to-go-live 6 days.",
        baseline: { status: "ACTIVE", narrative: "Cashless KP Annual Report 2026: cumulative collections Rs 7,969,822,684 (Account-1) + Rs 11,314,642 (Non-Account-1) = Rs 7,981,137,326." },
      },
      {
        name: "795 Government Services Register — Digitization Pipeline",
        description:
          "Complete register of 795 services across ~30 departments (largest: Higher Education ~90, Health ~73, Livestock ~68, Home ~60) with per-service Service-Digitized / Payment-Digitized flags and digitization plans (KPITB / In-House / Outsourcing / Netsol). Clusters already digitized in Board of Revenue, Excise, Health, LG (building approvals), Minerals (Ehsas Kanknun Card, mineral testing).",
      },
      {
        name: "G2P Disbursements via SBP RAAST",
        description:
          "Salaries and vendor payments via KPITB FinTech portal integrated with SBP RAAST: BIC per department, Position Accounts at Bank of Khyber with daily clearing-cycle settlement, ~10-day onboarding (subject to RAAST team availability).",
      },
      {
        name: "Governance & Standards",
        description:
          "Supervision: ACS (General) office / Cashless & Digital Services Unit; PMRU dashboards; BPR Committee; 10 digitization teams; District Digital Champions (DC level). KPITB technology standards mandated: Laravel/React Native/.NET/Python stacks, MySQL, ISO 27001 + OWASP ASVS, KP Data Center hosting, Digital NOC within 30 days, kp.gov.pk domains.",
      },
    ],
  },
];

// Work items to add under EXISTING schemes
const EXISTING_WI: { adpCode: string; items: WI[] }[] = [
  {
    adpCode: "260600", // KP-SER (Social Welfare)
    items: [
      {
        name: "Unified KP Social Registry (CNIC-Linked)",
        description:
          "Single CNIC-linked household database integrating Sehat Sahulat, education support and social welfare programs; NADRA/federal integration-first with targeted surveys; biometric payments; shock-responsive design. KP-SER reflected in Draft ADP 2026-27 (Social Welfare) at tentative Rs 988M. Landscape: 53 programs across 12 entities.",
      },
      {
        name: "KPSRA / Social Protection Authority — Institutional Case",
        description:
          "Two parallel tracks: P&D's SP Authority Concept Note approved by PDWP 17-02-2026 at Rs 20 billion (CDWP clearance pending; WB technical assistance envisaged; draft Act to Law) vs Social Welfare's KPSRA summary (13-05-2026). Finance (09-06-2026) objects: duplication, unresolved lead-department mandate, MBS consultant hiring inconsistent with Project Implementation Policy 2022 — consolidate under one Cabinet-determined lead via normal PC-1. CS/ACS-level meeting proposed 23-06-2026; file with PSO-HRM since 09-07-2026.",
        baseline: { status: "SLOW", narrative: "Institutional home contested between Social Welfare (KPSRA) and P&D (SP Authority, Rs 20 Bn CN).", bottlenecks: "Finance objections 09-06-2026: duplication, mandate, staffing route; CDWP clearance and Law vetting pending." },
      },
    ],
  },
];

const INITIATIVE_DESCRIPTIONS: Record<number, string> = {
  3: "365 Km 6-lane PPP motorway (PKHA). FWO negotiated bidding annulled 23-04-2026; 8 segments to competitive PPP fast-track (cost range Rs 263–536 Bn; segments 1/7/8 viable with VGF; 3–6 via IFIs/ADP). Land acquisition: Rs 21 Bn Cabinet-approved scheme (23-12-2024) + FY27 package schemes 261301–306; only Rs 120M released (unutilized).",
  5: "Housing-led satellite city with main expressway packages I–II (ADP 250113/250114). Rs 2 Bn tranche-based government loan case returned by Finance (25-02-2026) with six bankability objections; KPHA cannot self-finance (trust funds; Rs 7 Bn Jalozai liability).",
  8: "KPEZDMC/SIDB zones: Daraban EZ (220796), Mullagori Marble Cluster (260608), Mohmand Marble City (PKR 75.75M proceeds release before Cabinet, CM cleared 28-03-2026). UIPT waiver for zone industries (Rs 10,000/kanal; Rs 210.7M/yr revenue impact) cleared by CM for Cabinet 05-01-2026 over Excise/Finance reservations.",
  9: "KP-CTA portfolio: KITE (World Bank) Mankiyal Road 24 Km + ITZ access — earthwork done but land acquisition halted on 14.5x rate escalation (file with SMBR); Thandiani PPP concession approved (Tahir Builders, DBFOM 50 yr, CM 06-02-2026); Galiyat chairlift (260666); Walled City F/S (251615).",
  12: "CCFE&W: Billion Tree legacy schemes (210391, 240280, 260731) plus Forest Carbon Credit PPP — feasibility approved 27-01-2026 (CM 06-02-2026): 3 IFM/ARR packages, USD 70M private investment, ≥40% Government credit share, 80:20 windfall above USD 25/credit; EOI next.",
  16: "Cabinet-approved sectoral outsourcing: E&SE Phase-I 500 schools via ESEF (222 winter-zone operational; policy with Law since 21-07-2026) and Health Cat-D/RHC standard agreements via KPHF (CM cleared for Cabinet 15-01-2026). Higher Education/Social Welfare/Tourism extensions envisaged.",
  17: "Food security portfolio: ADB KP-FSSP Rs 25.1 Bn e-subsidy in 7 flood-affected districts (subsidy-ratio revision requires PC-1 route per P&D/Finance); Bara Dam F/S (260244); divisional silos (260093); southern-districts small dams to follow ADP identification.",
  18: "KP Skills & Workforce Authority (KP-SWA) under IC&TE: two-tier framework (lean coordination secretariat + CM-chaired autonomous authority) to consolidate KP-TEVTA (107 institutes), WWB (33), SIDB (30), Commerce (44) and others. Awaiting Social Welfare views since 04-05-2026; then CM decision, RoB amendment and KP-SWA Act.",
  19: "KP-SER (988M, Draft ADP 2026-27) + Social Protection Authority Concept Note (Rs 20 Bn, PDWP 17-02-2026, CDWP pending). Institutional home contested (Social Welfare KPSRA vs P&D SP Authority); Finance requires consolidation under one Cabinet-determined lead via normal PC-1.",
  20: "Cashless KP (KPITB FinTech, ACS-General supervision): Rs 7.98 Bn cumulative P2G digital collections; register of 795 services across ~30 departments with digitization plans; PAYMIR gateway + Digital Muhasil; G2P via SBP RAAST with BoK position accounts; PMRU dashboards, BPR Committee, District Digital Champions.",
};

async function main() {
  const depts = await prisma.department.findMany({ select: { id: true, key: true } });
  const byKey = new Map(depts.map((d) => [d.key, d.id]));
  const inits = await prisma.initiative.findMany({ select: { id: true, number: true } });
  const byNum = new Map(inits.map((i) => [i.number, i.id]));

  let sCreated = 0, wCreated = 0, bCreated = 0;

  for (const s of SCHEMES) {
    const departmentId = byKey.get(s.deptKey);
    const initiativeId = byNum.get(s.initiative);
    if (!departmentId || !initiativeId) throw new Error(`missing dept/init for ${s.rawName}`);
    let scheme = await prisma.scheme.findFirst({ where: { rawName: s.rawName } });
    if (!scheme) {
      scheme = await prisma.scheme.create({
        data: {
          adpCode: null, name: s.rawName, rawName: s.rawName, sector: s.sector,
          totalCost: s.cost ?? null, adpAllocation: s.alloc ?? null,
          isPRP: false, isPlaceholder: false, stage: s.stage,
          departmentId, initiativeId,
        },
      });
      sCreated++;
    }
    for (const w of s.workItems) {
      let sp = await prisma.subProject.findFirst({ where: { schemeId: scheme.id, name: w.name } });
      if (!sp) {
        sp = await prisma.subProject.create({ data: { schemeId: scheme.id, name: w.name, description: w.description } });
        wCreated++;
      }
      if (w.baseline && !(await prisma.progressUpdate.findFirst({ where: { subProjectId: sp.id, reportDate: BASELINE } }))) {
        await prisma.progressUpdate.create({
          data: {
            subProjectId: sp.id, reportDate: BASELINE,
            physicalProgressPct: w.baseline.pct ?? null,
            siteStatus: w.baseline.status ?? "NOT_STARTED",
            narrative: w.baseline.narrative ?? null,
            bottlenecks: w.baseline.bottlenecks ?? null,
          },
        });
        bCreated++;
      }
    }
  }

  for (const g of EXISTING_WI) {
    const scheme = await prisma.scheme.findFirst({ where: { adpCode: g.adpCode } });
    if (!scheme) { console.warn("! scheme not found:", g.adpCode); continue; }
    for (const w of g.items) {
      let sp = await prisma.subProject.findFirst({ where: { schemeId: scheme.id, name: w.name } });
      if (!sp) {
        sp = await prisma.subProject.create({ data: { schemeId: scheme.id, name: w.name, description: w.description } });
        wCreated++;
      }
      if (w.baseline && !(await prisma.progressUpdate.findFirst({ where: { subProjectId: sp.id, reportDate: BASELINE } }))) {
        await prisma.progressUpdate.create({
          data: {
            subProjectId: sp.id, reportDate: BASELINE,
            physicalProgressPct: w.baseline.pct ?? null,
            siteStatus: w.baseline.status ?? "NOT_STARTED",
            narrative: w.baseline.narrative ?? null,
            bottlenecks: w.baseline.bottlenecks ?? null,
          },
        });
        bCreated++;
      }
    }
  }

  for (const [num, desc] of Object.entries(INITIATIVE_DESCRIPTIONS)) {
    await prisma.initiative.update({ where: { number: Number(num) }, data: { description: desc } });
  }

  console.log(`Schemes created: ${sCreated} | work items: ${wCreated} | documented baselines: ${bCreated}`);
  console.log("Initiative descriptions updated:", Object.keys(INITIATIVE_DESCRIPTIONS).join(", "));
  console.log("Total schemes:", await prisma.scheme.count(), "| work items:", await prisma.subProject.count());
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
