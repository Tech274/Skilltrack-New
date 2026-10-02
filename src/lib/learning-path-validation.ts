// Pure, client-safe validation for learning paths.
// Used by the editor to block saves with structural problems.

export type Step = {
  title: string;
  topics?: string[];
  estimated_hours?: number;
  resource_hints?: string[];
};
export type Assessment = { title: string; kind?: string; passing_score?: number };
export type PathDraft = {
  title: string;
  estimated_hours?: number | null;
  steps: Step[];
  prerequisites: string[];
  assessments: Assessment[];
  status?: "draft" | "published" | "archived";
};

export type Issue = {
  level: "error" | "warning";
  field: string;
  message: string;
};

export function validatePath(p: PathDraft): Issue[] {
  const issues: Issue[] = [];
  const norm = (s: string) => s.trim().toLowerCase();

  if (!p.title || p.title.trim().length < 2) {
    issues.push({ level: "error", field: "title", message: "Title is required (min 2 chars)." });
  }

  // Prerequisites
  const seenPre = new Set<string>();
  p.prerequisites.forEach((pre, i) => {
    const t = pre.trim();
    if (!t) {
      issues.push({ level: "error", field: `prerequisites[${i}]`, message: "Empty prerequisite." });
      return;
    }
    if (seenPre.has(norm(t))) {
      issues.push({ level: "warning", field: `prerequisites[${i}]`, message: `Duplicate prerequisite: "${t}".` });
    }
    seenPre.add(norm(t));
  });

  // Steps
  const seenStep = new Set<string>();
  let stepHourSum = 0;
  p.steps.forEach((s, i) => {
    if (!s.title || s.title.trim().length === 0) {
      issues.push({ level: "error", field: `steps[${i}].title`, message: `Step ${i + 1} is missing a title.` });
    } else {
      if (seenStep.has(norm(s.title))) {
        issues.push({ level: "error", field: `steps[${i}].title`, message: `Duplicate step title: "${s.title}".` });
      }
      seenStep.add(norm(s.title));
      // Step title cannot match a prerequisite (impossible self-reference)
      if (seenPre.has(norm(s.title))) {
        issues.push({
          level: "error",
          field: `steps[${i}].title`,
          message: `Step "${s.title}" is also listed as a prerequisite.`,
        });
      }
    }
    if (typeof s.estimated_hours === "number") {
      if (!Number.isFinite(s.estimated_hours) || s.estimated_hours < 0) {
        issues.push({
          level: "error",
          field: `steps[${i}].estimated_hours`,
          message: `Step ${i + 1} has invalid hours (${s.estimated_hours}).`,
        });
      } else if (s.estimated_hours > 200) {
        issues.push({
          level: "warning",
          field: `steps[${i}].estimated_hours`,
          message: `Step ${i + 1} hours seem too large (${s.estimated_hours}h).`,
        });
      } else {
        stepHourSum += s.estimated_hours;
      }
    }
  });

  if (p.steps.length === 0) {
    issues.push({ level: "warning", field: "steps", message: "Path has no steps." });
  }

  // Assessments
  if (p.assessments.length === 0) {
    issues.push({ level: "error", field: "assessments", message: "At least one assessment is required." });
  }
  const seenAsses = new Set<string>();
  p.assessments.forEach((a, i) => {
    if (!a.title || a.title.trim().length === 0) {
      issues.push({ level: "error", field: `assessments[${i}].title`, message: `Assessment ${i + 1} is missing a title.` });
    } else if (seenAsses.has(norm(a.title))) {
      issues.push({ level: "warning", field: `assessments[${i}].title`, message: `Duplicate assessment: "${a.title}".` });
    }
    seenAsses.add(norm(a.title));
    if (typeof a.passing_score === "number") {
      if (a.passing_score < 0 || a.passing_score > 100) {
        issues.push({
          level: "error",
          field: `assessments[${i}].passing_score`,
          message: `Passing score must be 0–100 (got ${a.passing_score}).`,
        });
      }
    }
  });

  // Step hours vs total
  if (stepHourSum > 0 && typeof p.estimated_hours === "number" && p.estimated_hours > 0) {
    const ratio = stepHourSum / p.estimated_hours;
    if (ratio > 1.25) {
      issues.push({
        level: "error",
        field: "estimated_hours",
        message: `Step hours total ${stepHourSum}h exceed path estimate ${p.estimated_hours}h.`,
      });
    } else if (ratio < 0.5) {
      issues.push({
        level: "warning",
        field: "estimated_hours",
        message: `Step hours total ${stepHourSum}h are much lower than path estimate ${p.estimated_hours}h.`,
      });
    }
  }

  // Publish gate
  if (p.status === "published") {
    if (p.steps.length < 2) {
      issues.push({ level: "error", field: "status", message: "Published paths need at least 2 steps." });
    }
  }

  return issues;
}

export function hasBlockingErrors(issues: Issue[]) {
  return issues.some((i) => i.level === "error");
}
