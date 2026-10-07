# 🚀 Adding Your App to Tooly

Tooly is a community-driven PS5 Homebrew App & Payload Updater. If you are a developer, you can list your payload, emulator, homebrew app, or PC companion tool in our registry so users can discover, install, and update it directly from the Tooly dashboard.

## Option 1: Submit to Homebrew.page (Recommended for Apps)
Tooly automatically syncs with the canonical `homebrew.page` catalog. If your app is a native PS5 `.pkg` or `.elf` and you want maximum visibility, submit it to their repository:
👉 [blackbearreloaded/ps5-homebrew-catalog](https://github.com/blackbearreloaded/ps5-homebrew-catalog/blob/main/docs/submitting.md)

Once accepted there, Tooly will pick it up automatically.

## Option 2: Add directly to Tooly Registry (For Payloads & Custom Tools)
If your tool is a payload (`.bin`), a PC companion app, a cheat daemon, or something experimental, you can submit it directly to Tooly.

### The easiest way: Open an Issue
Simply go to our **Issues** tab, select **Submit a New App / Payload**, and fill out the form. We will review it and add it to the registry for you.

### Alternative: Submit a Pull Request
If you prefer, you can fork the repository and edit `src/data/registry.json` directly. Add your app to the end of the JSON array following this strict schema:

```json
{
  "id": "your-app-id",
  "slug": "your-app-id",
  "name": "My Private Payload",
  "description": "Short description of what the tool does (max 100 chars).",
  "developer": "YourName",
  "category": "payload", 
  "titleId": null, 
  "githubRepo": null,
  "directUrl": "https://dl.your-domain.com/releases/payload.bin",
  "version": "1.0.0",
  "releaseNotes": "Initial private release",
  "firmwareMin": "1.00",
  "firmwareMax": "13.60",
  "tags": ["payload", "custom-tag"]
}
```

### Schema Details
| Field | Type | Description |
|---|---|---|
| `category` | string | Must be one of: `"utility"`, `"payload"`, `"emulator"`, `"game"`, `"media"`, `"tool"`. |
| `githubRepo` | string | The `owner/repo` string for public GitHub apps. |
| `directUrl` | string | **(Private Apps)** Direct HTTP(S) link to the PKG/BIN if not on GitHub (e.g. Cloudflare R2). |
| `version` | string | **(Private Apps)** Current version of your app. |
| `releaseNotes` | string | **(Private Apps)** Optional changelog. |

### 🛠️ Automating Updates via Webhook (For Private Apps)
If your app uses `directUrl`, Tooly won't check GitHub for updates. Instead, you can update Tooly's registry automatically whenever you release a new version using our Webhook!

Just send a `POST` request to GitHub's `repository_dispatch` endpoint from your CI/CD pipeline (or a simple curl script):

```bash
curl -X POST https://api.github.com/repos/YOUR_ORG/tooly/dispatches \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token YOUR_PERSONAL_ACCESS_TOKEN" \
  -d '{"event_type": "update_app_version", "client_payload": { "app_id": "your-app-id", "version": "1.2.0", "url": "https://dl.your-domain.com/v1.2.0/app.pkg", "notes": "Bug fixes and improvements" }}'
```
This will trigger a GitHub Action in our repo that instantly updates `registry.json` with your new version and URL!

### 3. Open a Pull Request
Submit your PR with a brief description of your tool. We merge daily!
