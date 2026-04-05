## Routing

Admin pages are cohort-scoped under `app/admin/[cohortSlug]/`. The sidebar rewrites nav hrefs by injecting the selected cohort slug (e.g. `/admin/funding` → `/admin/cohort-2024/funding`).

Rules:

- Only two global admin routes exist: `/admin/cohorts` and `/admin/settings`. Everything else is cohort-scoped.
- `buildNavHref` in `components/sidebar.tsx` handles slug injection automatically via string replace — no route registration needed for new pages.
- `extractCohortSlugFromPath` validates URL segments against actual cohort slugs from the DB. Only `cohorts` and `settings` are hardcoded exclusions.
- Founder routes (`/founder/`) are flat — no cohort slug. Backend resolves cohort from the founder's startup.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:

- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
