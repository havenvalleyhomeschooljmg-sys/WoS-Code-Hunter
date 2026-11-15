# WoS Code Hunter scanning upgrade (staging only)

This package adds a scheduled source collector; it does NOT change production automatically.

## Important deployment facts
- GitHub scheduled workflows run from the DEFAULT branch, not feature branches. A workflow in `upgrade/automatic-code-scanning` can be manually tested via workflow_dispatch once GitHub recognizes the workflow; the scheduled trigger won't run until merged to main.
- GitHub Actions scheduled jobs are best-effort, may be delayed, and can occasionally be skipped. `*/15` is a requested cadence, not a guaranteed SLA.
- The scanner writes `data/discovered.json` in GitHub. The existing Render server does NOT read this file from GitHub automatically. To show the data on the website, integrate it into the server or a static API during a separate reviewed deployment.
- This scans nine article/community websites and a public Reddit JSON feed; sources may block requests or change markup. Do not scrape private Discord or Facebook groups. Respect site terms and robots policies before enabling each source in production.
- Results are candidate codes only; game-level verification requires actual redemption. Multiple independent source mentions and community votes are supporting evidence, not proof.
- The current parser deliberately prefers precision over recall. It may miss codes in lists without explicit labels; source-specific parsing and fixtures are recommended next.

## Stage and test
1. Upload `.github/workflows/discover-codes.yml`, `scripts/scan.mjs`, and `data/discovered.json` to `upgrade/automatic-code-scanning` only.
2. Test `node scripts/scan.mjs` locally or in a GitHub Actions manual run on the feature branch.
3. Inspect the resulting JSON and failure list. Reject false positives before making any codes public.
4. Create a draft pull request; do not merge until source accuracy, rate limits, persistence, and website integration are tested.
5. When ready, separately deploy Render from the reviewed code. GitHub's scheduled collector alone will not update the existing Render app.
