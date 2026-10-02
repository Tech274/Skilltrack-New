import { auth, defineMcp } from "@lovable.dev/mcp-js";

import searchCertifications from "./tools/search-certifications";
import listMyCertifications from "./tools/list-my-certifications";
import trackCertification from "./tools/track-certification";
import listMilestones from "./tools/list-milestones";
import completeMilestone from "./tools/complete-milestone";
import listLearningPaths from "./tools/list-learning-paths";

// The OAuth issuer must be the direct Supabase host. Vite inlines this literal
// at build time; the fallback only keeps the value well-formed during the
// throwaway manifest-extract evaluation.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "skilltrack-365",
  title: "SkillTrack-365",
  version: "0.1.0",
  instructions:
    "Tools for SkillTrack-365, a certification and skills tracking platform. Use `search_certifications` to explore the catalog, `list_my_certifications` and `track_certification` to read and update the signed-in user's certification progress, `list_milestones` and `complete_milestone` to manage study milestones, and `list_learning_paths` to browse structured learning paths. All tools act as the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchCertifications,
    listMyCertifications,
    trackCertification,
    listMilestones,
    completeMilestone,
    listLearningPaths,
  ],
});
