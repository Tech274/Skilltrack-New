import { certifications, type Certification } from "@/lib/certifications";

/** OEM slugs used by the Phase A doorway tiles, mapped to catalog vendors. */
export const OEM_NAMES: Record<string, string> = {
  aws: "AWS",
  azure: "Microsoft Azure",
  gcp: "Google Cloud",
  salesforce: "Salesforce",
  servicenow: "ServiceNow",
  pmi: "PMI",
  comptia: "CompTIA",
  hashicorp: "HashiCorp",
  snowflake: "Snowflake",
  databricks: "Databricks",
  cisco: "Cisco",
  kubernetes: "CNCF / Kubernetes",
};

const OEM_VENDOR_MATCH: Record<string, string[]> = {
  aws: ["amazon web services"],
  azure: ["microsoft"],
  gcp: ["google cloud"],
  salesforce: ["salesforce"],
  servicenow: ["servicenow"],
  pmi: ["pmi"],
  comptia: ["comptia"],
  hashicorp: ["hashicorp"],
  snowflake: ["snowflake"],
  databricks: ["databricks"],
  cisco: ["cisco"],
  kubernetes: ["cncf", "linux foundation"],
};

export const OEM_OPTIONS = Object.entries(OEM_NAMES).map(([slug, name]) => ({ slug, name }));

/** India-friendly CTC / payroll bands (annual). */
export const CTC_BANDS = [
  { key: "lt-4", label: "Under ₹4 LPA", mid: 3.0 },
  { key: "4-8", label: "₹4–8 LPA", mid: 6.0 },
  { key: "8-15", label: "₹8–15 LPA", mid: 11.5 },
  { key: "15-25", label: "₹15–25 LPA", mid: 20.0 },
  { key: "25-40", label: "₹25–40 LPA", mid: 32.0 },
  { key: "40-plus", label: "₹40 LPA and above", mid: 50.0 },
  { key: "outside-india", label: "Paid outside India / prefer not to say", mid: 0 },
] as const;

export const ROLE_OPTIONS = [
  "Student / fresher",
  "IT Support / Helpdesk",
  "System / Network Administrator",
  "Software Developer",
  "Cloud Engineer",
  "DevOps Engineer",
  "Data Engineer / Analyst",
  "Security Analyst",
  "Solution / Cloud Architect",
  "Project / Delivery Manager",
  "Other",
] as const;

export type Intent = "switch" | "elevate";

export interface AssessmentAnswers {
  role: string;
  ctcBand: string;
  intent: Intent;
  comments: string;
  oem: string;
  /** Optional resume text (pasted or read from .txt/.md). Keyword ranking only — not a proficiency score. */
  resumeText?: string;
}

export interface CertPick {
  slug: string;
  name: string;
  vendor: string;
  code: string;
  difficulty: string;
  cost: number;
  reason: string;
}

const ENTRY_LEVEL = new Set(["Beginner"]);

function roleAffinity(cert: Certification, role: string, intent: Intent) {
  let score = 0;
  const r = role.toLowerCase();
  if (cert.roles.some((x) => x.toLowerCase() === r)) score += 30;
  const bucket: Record<string, string[]> = {
    cloud: ["cloud engineer", "system / network administrator", "software developer", "solution / cloud architect"],
    devops: ["devops engineer", "cloud engineer", "software developer"],
    security: ["security analyst", "it support / helpdesk", "system / network administrator"],
    data: ["data engineer / analyst", "software developer"],
    ai: ["data engineer / analyst", "software developer", "cloud engineer"],
    crm: ["it support / helpdesk", "project / delivery manager", "other"],
  };
  if ((bucket[cert.categorySlug] ?? []).includes(r)) score += 18;

  if (intent === "switch") {
    // Career switchers need an approachable on-ramp.
    if (ENTRY_LEVEL.has(cert.difficulty)) score += 22;
    if (cert.difficulty === "Intermediate") score += 8;
    if (r === "student / fresher" || r === "it support / helpdesk") score += 10;
  } else {
    // Same-track elevation rewards depth.
    if (cert.difficulty === "Advanced" || cert.difficulty === "Expert") score += 20;
    if (cert.difficulty === "Intermediate") score += 10;
  }
  return score;
}

/**
 * Small keyword boost from resume text: vendor names, cert codes, roles, and skills.
 * Caps the boost so it cannot dominate OEM/role scoring. Not a proficiency meter.
 */
export function resumeKeywordBoost(
  cert: Certification,
  resumeText: string | undefined,
): { boost: number; hits: string[] } {
  if (!resumeText?.trim()) return { boost: 0, hits: [] };
  const hay = resumeText.toLowerCase();
  const hits: string[] = [];
  let boost = 0;

  const vendor = cert.vendor.toLowerCase();
  if (vendor.length >= 4 && hay.includes(vendor)) {
    boost += 8;
    hits.push(cert.vendor);
  } else {
    for (const aliases of Object.values(OEM_VENDOR_MATCH)) {
      const certMatchesOem = aliases.some((a) => vendor.includes(a));
      if (!certMatchesOem) continue;
      const resumeHit = aliases.some((a) => a.length >= 3 && hay.includes(a));
      if (resumeHit) {
        boost += 6;
        hits.push(cert.vendor);
        break;
      }
    }
  }

  const code = cert.code.toLowerCase();
  if (code.length >= 3 && hay.includes(code)) {
    boost += 10;
    hits.push(cert.code);
  }

  const name = cert.name.toLowerCase();
  if (name.length >= 10 && hay.includes(name)) {
    boost += 8;
    hits.push(cert.name);
  }

  let skillHits = 0;
  for (const skill of cert.skills) {
    const s = skill.toLowerCase();
    if (s.length < 3 || !hay.includes(s)) continue;
    skillHits += 1;
    if (hits.length < 6) hits.push(skill);
  }
  boost += Math.min(skillHits * 3, 12);

  let roleHits = 0;
  for (const role of cert.roles) {
    const r = role.toLowerCase();
    if (r.length < 4 || !hay.includes(r)) continue;
    roleHits += 1;
    if (hits.length < 8) hits.push(role);
  }
  boost += Math.min(roleHits * 4, 8);

  return { boost: Math.min(boost, 22), hits };
}

/** Rule-based top 5 from the real 12-cert catalog: OEM + role + switch/elevate (+ optional resume keywords). */
export function pickTopCertifications(answers: AssessmentAnswers): CertPick[] {
  const match = OEM_VENDOR_MATCH[answers.oem] ?? [];
  const ranked = certifications
    .map((cert) => {
      const vendorHit = match.some((m) => cert.vendor.toLowerCase().includes(m));
      let score = vendorHit ? 60 : 0;
      score += roleAffinity(cert, answers.role, answers.intent);
      score += cert.demandScore / 10;
      score += cert.roiScore / 20;

      const { boost: resumeBoost, hits: resumeHits } = resumeKeywordBoost(
        cert,
        answers.resumeText,
      );
      score += resumeBoost;

      const reasons: string[] = [];
      if (vendorHit) reasons.push(`Matches your ${OEM_NAMES[answers.oem] ?? "chosen"} track`);
      if (cert.roles.some((x) => x.toLowerCase() === answers.role.toLowerCase()))
        reasons.push(`commonly held by a ${answers.role}`);
      if (resumeBoost > 0 && resumeHits.length > 0) {
        reasons.push(`resume mentions ${resumeHits.slice(0, 3).join(", ")}`);
      }
      reasons.push(
        answers.intent === "switch"
          ? `${cert.difficulty.toLowerCase()} entry point for a switch`
          : `${cert.difficulty.toLowerCase()} depth for the next level`,
      );
      return {
        slug: cert.slug,
        name: cert.name,
        vendor: cert.vendor,
        code: cert.code,
        difficulty: cert.difficulty,
        cost: cert.cost,
        reason: reasons.join(" · "),
        _score: score,
        _salary: cert.avgSalary,
      };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);

  return ranked.map(({ _score, _salary, ...rest }) => rest);
}

export interface SalaryEstimate {
  currentBandLabel: string;
  estimatedBandLabel: string;
  hikeLowPct: number;
  hikeHighPct: number;
  targetLowLpa: number;
  targetHighLpa: number;
  note: string;
}

/** Rule-based, clearly-labelled estimates — not a guarantee, not ML. */
export function estimateSalary(answers: AssessmentAnswers): SalaryEstimate | null {
  const band = CTC_BANDS.find((b) => b.key === answers.ctcBand);
  if (!band || band.mid === 0) return null;

  const base = answers.intent === "switch" ? [10, 25] : [15, 35];
  // Higher bands see smaller percentage movement.
  const damp = band.mid >= 25 ? 0.6 : band.mid >= 15 ? 0.8 : 1;
  const low = Math.round(base[0] * damp);
  const high = Math.round(base[1] * damp);

  return {
    currentBandLabel: band.label,
    estimatedBandLabel: `₹${(band.mid * (1 + low / 100)).toFixed(1)}–${(band.mid * (1 + high / 100)).toFixed(1)} LPA`,
    hikeLowPct: low,
    hikeHighPct: high,
    targetLowLpa: Number((band.mid * (1 + low / 100)).toFixed(1)),
    targetHighLpa: Number((band.mid * (1 + high / 100)).toFixed(1)),
    note:
      answers.intent === "switch"
        ? "Switch moves usually land lower in the range for the first role, then catch up within a year."
        : "Elevation moves land higher when the certification is paired with delivery evidence on your current project.",
  };
}

export interface LadderStep {
  slug: string;
  name: string;
  code: string;
  difficulty: string;
}

const DIFFICULTY_ORDER: Record<string, number> = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
  Expert: 3,
};

/**
 * The certification ladder we actually have guides for, for one vendor —
 * ordered easiest first. Empty when we don't cover that vendor yet.
 */
export function certLadderForOem(oem: string): LadderStep[] {
  const match = OEM_VENDOR_MATCH[oem] ?? [];
  return certifications
    .filter((c) => match.some((m) => c.vendor.toLowerCase().includes(m)))
    .sort(
      (a, b) =>
        (DIFFICULTY_ORDER[a.difficulty] ?? 9) - (DIFFICULTY_ORDER[b.difficulty] ?? 9),
    )
    .map((c) => ({ slug: c.slug, name: c.name, code: c.code, difficulty: c.difficulty }));
}
