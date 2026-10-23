# Repo drift: Skilltrack-New vs Tech274/sktrck365

SCRUM-153. This is a written report. It does not port code from either repository.

## Source of truth

[Tech274/Skilltrack-New](https://github.com/Tech274/Skilltrack-New) `master` is the live source for [skilltrack.co.in](https://skilltrack.co.in). Do not treat Tech274/sktrck365 as the live tree, and do not copy files across until someone with access produces a real diff and reviews each hunk.

The live README still mentions `sktrck365.lovable.app` and Lovable project `1e70e9f7-16d3-47fc-a90f-3b32dbbaa81a`. That is historical. This report does not change Lovable and does not publish.

## Access

On 23 October 2026 this environment could not read Tech274/sktrck365:

- `https://github.com/Tech274/sktrck365` returned 404
- `gh api repos/Tech274/sktrck365` returned 404
- `git clone https://github.com/Tech274/sktrck365.git` failed with repository not found
- The public Tech274 repository list visible to this token does not include `sktrck365`

A 404 from the GitHub API means the repository is private, renamed, or deleted. It is not evidence that the trees are identical, and it is not a byte diff. No file from sktrck365 was compared.

## Ticket claims, unverified

SCRUM-153 says the trees differ in these areas and that some files exist only in Skilltrack-New. Those claims are recorded here as unverified until the other repository is readable:

| Claim | Status |
| --- | --- |
| Differs: `src/integrations/supabase/auth-middleware.ts` | Unverified |
| Differs: `src/integrations/supabase/client.server.ts` | Unverified |
| Differs: `src/integrations/supabase/client.ts` | Unverified |
| Differs: `src/components/admin/*` | Unverified |
| Only in Skilltrack-New: `src/components/campaign-carousel.tsx` | Present here; other side unread |
| Only in Skilltrack-New: `src/routes/api/public/lead.ts` | Present here; other side unread |
| Only in Skilltrack-New: `src/routes/_authenticated/admin.campaigns.tsx` | Present here; other side unread |
| Only in Skilltrack-New: `src/routes/_authenticated/admin.leads.tsx` | Present here; other side unread |
| Only in Skilltrack-New: `src/routes/_authenticated/admin.sales-leads.tsx` | Present here; other side unread |

## Live admin and auth surface (Skilltrack-New `master`)

This is an inventory of the live tree, not a diff.

Auth and Supabase client:

- `src/integrations/supabase/auth-middleware.ts`
- `src/integrations/supabase/client.server.ts`
- `src/integrations/supabase/client.ts`
- `src/routes/_authenticated/route.tsx` (signed-out visitors go to `/auth` before child routes)
- `src/lib/admin-auth.server.ts` (`getAdminContext`, `assertAdminOrSuper`, `assertPermission`)
- `src/lib/super-admin.server.ts` (reads `super_admins`)

Admin UI and server functions live under:

- `src/routes/_authenticated/admin*.tsx`
- `src/components/admin/`
- `src/lib/admin*.ts` and `src/lib/admin-*.functions.ts`

Related follow-up work, not part of this comparison:

- SCRUM-147 / SCRUM-148 (another agent): leads role check and a shared `requireAdmin`. This report does not add that helper.
- SCRUM-149 audit log, SCRUM-150 list pagination, SCRUM-151 `is_admin`, SCRUM-152 nav, and SCRUM-154 CSP are separate pull requests against Skilltrack-New.

## How to produce the real diff

From a machine that can read both repositories:

```bash
git clone --depth 1 https://github.com/Tech274/Skilltrack-New.git live
git clone --depth 1 https://github.com/Tech274/sktrck365.git other
diff -rq \
  --exclude node_modules --exclude .output --exclude dist --exclude .git \
  live/src/integrations/supabase \
  other/src/integrations/supabase
diff -rq \
  --exclude node_modules --exclude .git \
  live/src/components/admin \
  other/src/components/admin
diff -rq live/src/routes/_authenticated other/src/routes/_authenticated
```

Review each hunk before copying anything. Skilltrack-New stays the source of truth for skilltrack.co.in.
