# WoS Code Hunter

An independent, community-built, mobile-friendly gift-code finder for Whiteout Survival players.

## Important disclaimer

WoS Code Hunter is an independent fan application. It is not affiliated with, endorsed by, sponsored by, or officially connected to Whiteout Survival, Century Games, or any of the game's developers or publishers.

Gift codes can expire, become invalid, reach redemption limits, or be restricted by region, account, or other eligibility rules. **There is no guarantee that any listed gift code will work at any time.** The app may discover unverified code candidates; community reports are not official validation. Always check redemption through the game's official channels. Do not submit passwords, login credentials, or player IDs to this app.

## License

This project is intended to be distributed under the **GNU Affero General Public License, version 3.0 (AGPL-3.0-only)**. The official license text is available at https://www.gnu.org/licenses/agpl-3.0.txt . Before publicly distributing the project, add the complete official license text to a file named `LICENSE` at the repository root. For a network-hosted modified AGPL application, ensure users can obtain the corresponding source code as required by the license.

## Free trial hosting

The included `render.yaml` sets up a free Node.js service on Render. Free services can sleep when inactive, and temporary stored codes and reports may disappear after a restart or redeploy. Automatic searches depend on third-party public pages, which may change or block requests; results may be empty or inaccurate.

## Publish from a Samsung phone

1. In **My Files > Downloads**, tap the ZIP and choose **Extract**.
2. Open https://github.com in Chrome and sign in. Create a **Public** repository named `wos-code-hunter`.
3. Upload the files from the extracted `wos-code-hunter` folder. Keep `index.html` inside a `public` folder on GitHub. Uploading folders can be difficult in a mobile browser; ask for step-by-step help if needed.
4. Open https://dashboard.render.com, sign in with GitHub, and choose **New > Blueprint**. Select the repository and verify the service is **Free** before deploying.
5. Render will give you a website address to share with alliance members.

This is a trial app, not an official or guaranteed code-verification service.
