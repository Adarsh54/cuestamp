# Local development

Cuestamp uses a Vite frontend and a small Node API that runs the same handlers as Vercel Functions. **Start both processes to test login and account features.** A frontend-only preview does not provide working authentication.

## Quick start on an already configured machine

Use Node.js 24 (the version used for local verification) and npm. From the repository root:

```sh
npm ci
```

Start the API in one terminal:

```sh
npm run dev:api
```

Start the frontend in another:

```sh
VITE_API_ENABLED=true npm run dev -- --port 5190 --strictPort
```

Open **http://127.0.0.1:5190/**. Vite proxies `/api` to **http://127.0.0.1:3001**. Keep the host and port exact: `localhost` and `127.0.0.1` are different cookie origins. `--strictPort` prevents Vite from silently moving to a port that WorkOS does not recognize.

## First-time configuration

Create `.env.local` in the repository root. This file is ignored by Git. The values below are placeholders; get credentials from the development services, never from the production environment.

```dotenv
APP_URL=http://127.0.0.1:5190
VITE_API_ENABLED=true
WORKOS_CLIENT_ID=<staging-client-id>
WORKOS_API_KEY=<staging-api-key>
SESSION_SECRET=<random-secret-at-least-32-characters>
DATABASE_URL=<neon-development-connection-string-with-TLS>
```

Generate a session secret with `openssl rand -base64 48` and save it as `SESSION_SECRET`. Keep it stable between restarts; changing it invalidates existing local sessions. Never commit credentials or prefix server secrets with `VITE_`, which exposes values to frontend code. The API startup command reads `.env.local`; Vite also reads it. Restart both processes after changing configuration.

### WorkOS

1. Select **Staging** in the Cuestamp WorkOS project.
2. Copy the staging application client ID and API key into `.env.local`.
3. Under the application's **Redirects**, allow this exact URI:
   `http://127.0.0.1:5190/api/auth?action=callback`
4. Ensure the authentication methods you want to test are enabled. Email/password is enabled in the existing staging environment.

Existing staging environment: `environment_01M2MF0JB2D5ME8DH5MKMRKWSZ`.

Staging users and sessions are separate from production. A production account does not automatically exist locally. Complete signup or a staging social-login flow when testing for the first time. Start each test from the app's Log in or Sign up button rather than reusing an old AuthKit URL; authorization state expires.

### Neon

Use the **local-development** branch of the **cuestamp** Neon project:

- Project: `damp-forest-37558489`
- Branch: `br-withered-violet-a5u6xm3o`

This branch was created from the production schema without production rows. Copy its connection string using the branch's Connect dialog and put it in `DATABASE_URL`. Keep the TLS parameters in the connection string.

For a new branch, or after pulling new migrations:

```sh
npm run db:migrate
```

Check the connection targets the development branch before migrating. Login also requires a working database because the callback creates or updates the user's profile.

### Media storage is a separate setup step

This machine has staging login, the development database, and the private **cuestamp-media-development** Blob store configured. The store is connected only to the Vercel Development environment.

- Small-file browser processing and manual cue editing work without Blob storage.
- Saving uploaded media to an account and processing files over 100 MB require the development store’s server-side `BLOB_READ_WRITE_TOKEN` in `.env.local`. Restart the API after adding or changing it.
- Matching against a large file also uploads its reference files.
- On another machine, pull the Vercel Development environment into a temporary file and copy its `BLOB_READ_WRITE_TOKEN` into `.env.local`, preserving your local WorkOS and Neon settings. Never print or commit that token. Do not reuse the production Blob token.

From a checkout linked to the Cuestamp Vercel project, download the development settings to an ignored file:

```sh
npx vercel env pull .env.blob-development.local --environment development
chmod 600 .env.blob-development.local
```

Copy only `BLOB_READ_WRITE_TOKEN` from that file into `.env.local`, then delete the temporary file. Stop and restart `npm run dev:api` to load the credential. Keep the existing local WorkOS, Neon, and `APP_URL` values intact.

Saving a project uploads its attached audio/video before saving the project record in Neon. Working login and database access alone are therefore not enough to save a project with media. If saving reports **“Blob failed to retrieve token”**, check that the development Blob token is present and that the API was restarted, then retry **Save project**. The failed save keeps the local draft. If it still fails, inspect the `/api/media` token request in the browser’s Network panel; an expired login or another API error can also prevent token retrieval.

See [SETUP.md](SETUP.md) for media storage, cleanup, processing limits, and production configuration.

## Verify the local connection

With both processes running:

```sh
curl -s http://127.0.0.1:5190/api/health
curl -s 'http://127.0.0.1:5190/api/auth?action=me'
```

The auth response should be `{"configured":true,"user":null}` before login. `configured: true` means the required settings are present; it is not proof that a full sign-in succeeded. Click Log in or Sign up, complete WorkOS authentication, and confirm you return to the local app with account controls and Log out.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Account buttons disabled or access unavailable | `VITE_API_ENABLED=true`, all required `.env.local` values, and the API process on port 3001. |
| Auth endpoint returns `configured: false` | WorkOS key/client ID, `APP_URL`, `DATABASE_URL`, and a session secret of at least 32 characters must all be present. |
| `/api` requests fail or Vite reports a proxy error | Start `npm run dev:api`; Vite alone cannot serve the API. |
| WorkOS rejects the redirect | Match the callback allowlist to `http://127.0.0.1:5190/api/auth?action=callback` exactly. |
| Return to the app with `authError=1` | Start a fresh login flow; check matching staging credentials, stable session secret, correct cookie host, and database connectivity/migrations. |
| Port already in use | Reuse or stop the existing development process. Do not change the frontend port without also updating `APP_URL` and WorkOS's callback. |
| Login works but saving reports “Blob failed to retrieve token” | Add the development store’s `BLOB_READ_WRITE_TOKEN` to `.env.local`, restart the API, and retry Save project. See the media-storage setup above. If it persists, inspect the `/api/media` response. |

## Checks before submitting code

```sh
npm test
npm run build
```

For changes to media processing or workflow interactions, the existing `scripts/browser-check.cjs` exercises real Wasm analysis and export. Its setup is documented in the script and [SETUP.md](SETUP.md).

Local credentials remain machine-specific. A fresh checkout or another developer's machine needs its own `.env.local`; pulling this repository does not configure services automatically.

### Deployment dependency integrity errors

Vercel runs `npm ci`, then `node scripts/deploy-migrate.mjs && npm test && VITE_API_ENABLED=true npm run build`. Database migrations must remain idempotent and compatible with the currently deployed version; failed migrations block deployment. Previews without `DATABASE_URL` skip migrations and offer guest mode; production requires the database. An `EINTEGRITY` failure happens before the app builds. Compare the affected lockfile entry with `npm view <package>@<version> dist.integrity` and verify a clean install with a fresh cache; do not disable integrity checks.

The failed deployment of `a6498a8` had an incorrect `picomatch@4.0.7` checksum. The corrected lockfile uses npm’s published `sha512-qcJu88Q2IWqJsDD529JKMdwGm/dvInW4HvQnRwiH9JtihJvzGOscDtHE3x1pBKeUOTysQ8kVmLnJ2kJu7yhcGA==`. Preserve the regenerated lockfile when incorporating the upstream credit-profile changes; do not restore that commit’s incorrect checksum during conflict resolution.

### User profiles

Run `npm run db:migrate` after pulling the profile feature (`004_user_profiles.sql`). WorkOS handles login; Neon stores the editable display name and occupation. Signed-in users with incomplete profiles see a setup form, and Profile in the account dropdown reopens it. Vercel applies migrations to its configured database during the build, before publishing the profile-enabled API. Local migration commands only update the configured development database.

### Account credit profiles

`005_credit_profiles.sql` stores reusable credit presets in Neon, keyed by authenticated user and profile ID. The account API lists, saves and deletes only the signed-in user’s presets, with revision checks against stale edits. Existing account-scoped browser presets import once without overwriting newer server versions; guest presets are not imported. Applying a preset copies credits into the current cue sheet, while editing that sheet never updates the account preset.

### Project types and shared audio

Projects supports `cue` and `reel` records in the existing `projects.data` JSON. Old records without a type remain cue projects. Reel drafts contain a title, owned audio asset IDs, and optional track titles. Migration `006_reels.sql` adds cached playback audio and published snapshots; run `npm run db:migrate` after pulling.

The global plus and Create project open a type chooser. The sidebar has separate cue (`#/workspace/library` and the remaining workflow steps), reel (`#/reels/new`), and shared audio (`#/audio`) pages. Cue and reel drafts use separate account-scoped local storage keys.

Audio submitted from the audio library, a cue import, or a reel upload goes into the shared library. Signed-in uploads use the existing private Blob reserve/upload/complete flow and `media_assets` table. `GET /api/media?action=list` returns only the signed-in user's completed audio uploads; video and unfinished uploads are excluded. The development Blob token is required for these uploads, even before a project is saved. Failed uploads stay locally available for retry. Reusing a saved library item attaches the existing asset rather than uploading a second copy.

Guest audio is stored in IndexedDB on this device. It survives reloads but is not copied into an account at login. Clearing site data removes guest audio and drafts. Audio removal from a reel only removes its project reference; it does not delete the library file.

Regression checks: `test/reel-projects.test.js` covers typed project persistence and ownership; `scripts/browser-project-types-check.cjs` and `scripts/browser-account-project-types-check.cjs` cover guest and account workflows. Set `PLAYWRIGHT_MODULE` and optionally `CUESTAMP_URL` as for the other browser checks.

### Reel player and publishing

Start both the API and Vite. **New Reel** supports track titles, ordering, preview, Publish reel, and Share & embed. Account previews and publishing use Vercel Functions to create 192 kbps MP3 playback files and 360-point waveforms. Guest previews use browser decoding (up to 100 MB per file); guests must sign in to publish. Supported reel limits: 50 tracks per publication, 60 minutes per track, and the existing 2 GiB upload limit. Preparation runs one track at a time with a 260-second deadline; Vercel's function limit is 300 seconds. Completed track preparation is reused after a retry.

- `POST /api/reels?action=prepare`: authenticate ownership of a ready audio asset, claim a five-minute processing lease, then prepare/cache private playback audio.
- `POST /api/reels?action=publish`: check ownership, revision and all prepared tracks; save a snapshot with an unguessable share token and MP3 downloads.
- `POST /api/reels?action=revoke`: revoke a published link. Publishing again creates a different token.
- `GET /api/reels?id=PROJECT_ID`: owner-only publication metadata.
- `GET /api/reels?action=preview&id=ASSET_ID`: owner-only redirect to a short-lived playback URL.
- `GET /api/reels?action=public&token=TOKEN`: published player metadata, never private object paths.
- `GET /api/reels?action=stream|download&token=TOKEN&track=ASSET_ID`: check publication and track membership; MP3 downloads are always enabled. Redirects expire after five minutes. Audio already fetched by listeners cannot be recalled.

`/reel.html?token=TOKEN` is a separate Vite entry with no login gate. Add `&embed=1` for an iframe and optionally `&theme=light`. The public player is a reusable `ReelPlayer` class using native HTML audio and a seekable SVG waveform. No Wasm or browser transcoding is needed for published reels. MP3 downloads are always enabled for published reels, including previously published reels. Draft edits do not update a publication until **Update published reel** is pressed.

Postgres stores waveform/manifest metadata. Original uploads and playback MP3s remain in private Blob. Prepared derivatives are reused and retained on unpublish; deleting unneeded Blob objects remains a manual operation. New files use the existing store token; no additional service credentials are needed. Keep `api/reels.js` native binary packaging and duration settings in `vercel.json`.

Signed Blob URLs must encode literal object path segments for transport (`server/blob-url.js`). Stored upload paths already contain encoded filenames; failing to encode those percent signs in the URL causes 403s for filenames containing spaces or punctuation.

Checks: `npm test`, `npm run build`, `scripts/browser-reel-check.cjs`, and `scripts/browser-reel-publish-check.cjs`. The latter mocks account endpoints to exercise editor failures, publish, share, and revoke. With local development credentials and both servers running, `node --env-file=.env.local scripts/reel-live-smoke.mjs` creates synthetic audio, tests the real Neon/Blob/FFmpeg/public-player round trip, then deletes its temporary account and assets. Set `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_EXECUTABLE` as needed for your browser installation. The live check refuses non-local APP_URL values.

### Project browsing and reel editing

Projects exposes the existing immutable `projects.created_at` timestamp and `updated_at`, displayed in the viewer's local date/time. Type filters (All types, Cues, Reels) combine with creation/update ordering in either direction. The API returns the owner's collection, without the old 100-item truncation. Selecting a saved reel opens Edit Reel; Your reels lists all account reels with per-reel Edit and Stop sharing actions, plus Create reel. All published reels offer MP3 downloads, including older publications whose stored permission was disabled. There is no download-permission checkbox.

Reel routes are distinct: `#/reels/new` starts a fresh creation form, and `#/reels/PROJECT_ID/edit` opens an existing reel. First account save replaces the creation URL with the saved reel's edit URL. Reloading an edit URL retains the selected reel; navigation between reels or back to New Reel uses the same unsaved-change guard as leaving a workspace. The New Reel sidebar item is selected only on the creation route.

### Local reel waveform previews

Reel previews can use local audio while the original uploads. Standard PCM WAV
(8/16/24/32-bit integer or 32-bit float) is scanned in small chunks in a Web Worker;
`wasm/waveform.wat` accumulates waveform peaks without decoding the whole file into
memory. This also supports WAV files above the cue analysis 100 MB cutoff. Other
local formats retain browser decoding up to 100 MB, with server processing after
upload when local preview isn't supported. Publishing still prepares the server MP3
and waveform from the original; local previews do not replace the uploaded audio.

The compiled `src/waveform.wasm` is committed. After changing its WAT source, run
`npm run build:waveform` (uses pinned WABT via npx), then `npm test` and `npm run build`.

### Lossless audio uploads

Signed-in audio-library uploads automatically compress eligible integer WAVs
to FLAC in a browser WASM worker before uploading. Originals stay local;
unsupported or unhelpful compression falls back to the original. No extra
service configuration is required. See [upload performance](docs/upload-performance.md)
for supported formats, retry storage, benchmarks and browser regression checks.

### Non-destructive audio editing

Run `npm run db:migrate` after pulling `007_audio_edits.sql`. **Edit audio** is
available on saved Audio Library tracks and in reel track rows. Signed-in users
can set a start/end snippet, fade-in/out durations, and peak normalization to
−1 dB. Times always refer to the original recording; Reset edits restores its
full range. The editor's player auditions the original recording. Listen to the
saved result through Audio Library or Preview reel.

The existing `/api/reels?action=edit-audio` POST handles owned audio only and
renders in Vercel Functions with FFmpeg. Rendered samples are stored in a private
FLAC file. MP3 playback/download derivatives are still prepared on publication.
There is no new service or credential. Processing requires an account and a
completed upload, supports up to 60 minutes / eight channels, and caps output at
512 MB within the existing 260-second processing deadline.

`media_assets.source_id` points to the preserved original; `parent_id` records the
version edited; `edit_recipe` stores the snippet/fades/normalization settings.
Subsequent edits render from the original, avoiding accumulated processing loss.
Save changes replaces the visible library version using `superseded_by`, while
Save as copy retains both entries. Old versions remain readable for existing
projects/publications. Apply to reel creates a library copy and replaces that
reel's track reference; publish again to update a shared reel. Neither operation
deletes the original Blob. Retained originals/versions consume storage.

Checks: `test/audio-edits.test.js` exercises actual FFmpeg output and ownership,
lineage, copy/replacement and stale-save behavior. Run
`scripts/browser-audio-edit-check.cjs` with the documented Playwright variables
for the shared editor and reel integration.

The audio editor also shows an interactive waveform: drag a range or use the
start/end handles (arrow keys adjust by 0.1 s; Shift adjusts by 1 s). Numeric
fields and the fade envelope stay synchronized. Play snippet auditions the
selected original audio. Local WAVs reuse the Wasm waveform worker; remote
files reuse server reel preparation. Waveform preparation does not block editing.
Peak normalization accepts `targetPeakDb` from −60 through 0 dBFS, persisted
in the recipe and applied by FFmpeg. Older recipes retain the −1 dBFS default.
The waveform height represents the original recording, not a post-edit meter.

### Reel profiles, résumé and presentation

Reel drafts now include optional `profile` (name, email, occupation, bio),
`appearance` (accent, dark/light player theme, introduction), `trackColors`, and
`resumeId`/`resumeName`. Use my profile copies account details; subsequent manual
changes belong to this reel. A published snapshot includes these details.

Résumé uploads use the existing private media reserve/upload/complete flow, limited
to PDF files of 10 MB. They are excluded from the audio library. Saving/publishing
checks ownership, readiness and PDF type. Public manifests expose only a résumé
availability flag; `/api/reels?action=resume&token=…` verifies the publication before
redirecting to an expiring private Blob URL. Revoking the reel disables fresh résumé
links too. Existing downloaded files/issued URLs cannot be recalled.

The editor automatically prepares a live preview when tracks are available, reusing
local WAV processing and cached server preparations. Profile/appearance changes do
not regenerate audio. Publish sits below the preview, above Listener analytics, and remains explicit. A failed
preview offers Retry preview. No schema migration or new credentials are required.
Regression coverage includes `scripts/browser-reel-presentation-check.cjs` plus
ownership, publication snapshot and PDF limits in the server tests.

Published reels display their share URL directly beneath the preview, with Copy
link and Open reel controls. Each published item under Your reels also exposes
Share without changing the currently edited reel. Drafts do not expose share URLs.

### Experimental DAW (in development)

`#/experimental` is a separate composer workspace. It currently stores its session
in account-scoped localStorage and original imported files in IndexedDB. Signed-in
users can explicitly Save to account using the existing Neon/Blob services.
Audio/video/MIDI import, arrangement, basic note editing, mixer gain/pan/mute/solo,
undo/redo, local playback and WAV/MIDI export are initial implementations. See
[the full scope ledger](docs/experimental-daw.md) for missing features and evidence;
this is not yet Logic Pro parity. Export project creates a portable `.cuestamp.zip` with original media. JSON-only
export keeps device-local references. Portable archives currently support up to
512 MB of media and a 10 MB document.

Manual actions and agent batches use `src/experimental/session.js`. The command
executor validates the complete result before commit, rejects stale revisions and
supports undo. `/api/daw` uses the same validation before returning a model plan.
No arbitrary code or shell execution is exposed to the model.

The server supports OpenAI Responses and Anthropic Claude Messages through the
same validated DAW tools. Configure one provider in ignored local `.env.local` or
the intended Vercel environment:

| Server variable | OpenAI (default) | Claude |
| --- | --- | --- |
| `DAW_AGENT_PROVIDER` | `openai` (or omit) | `anthropic` |
| API key | `OPENAI_API_KEY` | `ANTHROPIC_API_KEY` |
| `DAW_AGENT_MODEL` | Model ID available to your OpenAI API project | Model ID available to your Anthropic API account |

Choose a model supporting the provider's client function tools and strict tool
schemas. Model IDs are explicit; the app does not choose or upgrade them. Never
use a `VITE_` variable for these settings. Restart the local API after changes.
Configured status means the selected provider's variables are present, not that
real inference has succeeded. Unknown providers fail configuration; there is no
automatic fallback to another provider. Requests require login and same-origin
checks, and send session/selection/conversation metadata to the selected provider,
not source media. Production usage quotas remain pending.

Checks: `npm test`, `npm run build`, and `scripts/browser-experimental-check.cjs`
with the standard Playwright variables. The browser agent check mocks inference;
a real provider test is still required after credentials are configured.

Run the credential-free preflight with:

```sh
npm run check:daw-agent -- --config-only
```

After setting both variables in ignored `.env.local`, run:

```sh
npm run check:daw-agent
```

The full check makes up to two billable requests to the configured model using a
disposable in-memory session. It verifies a -6 dB track edit, then a contextual
follow-up to -3 dB, with no other state changes. It never saves projects/media or
prints credentials/provider payloads. It exits nonzero for missing configuration,
a failed request, an invalid plan or an incorrect result. Configuration-only mode
makes no model request. This direct adapter check does not test WorkOS login,
Vercel environment settings, browser audio rendering or production quotas.


The Experimental mixer includes ordered EQ/compressor/delay/reverb inserts and
volume/pan automation. Playback and offline rendering share the same signal chain.
Bounce stems exports aligned per-track WAVs in a ZIP; muted tracks are excluded,
solo is ignored, and master gain is included. Edits stop playback. Run
`scripts/browser-experimental-effects-check.cjs` for controls, stem packaging and
actual browser PCM regression checks. Bus outputs and selectable send positions are available through + Bus and the mixer routing section.

Run `scripts/browser-experimental-archive-check.cjs` to verify portable project
export, import into cleared storage, restored playback and reload.

The Experimental piano roll has a beat-based note inspector, pitch/time dragging,
right-edge resizing, velocity, duplicate and explicit delete controls. Run
`scripts/browser-experimental-piano-check.cjs` for editing and persistence checks.

Timeline audio/video regions have edge trim handles; audio/MIDI regions have fade
handles and envelope overlays. Hold Shift while dragging for unsnapped movement.
The inspector remains available for exact numeric editing. Run
`scripts/browser-experimental-region-check.cjs` to check trim/fades and restoration.

Record audio in Experimental captures standalone microphone takes as 16-bit PCM
WAV at the browser sample rate (up to stereo, ten minutes). Stop recording places
the take at the starting playhead position. Cancel or leaving the page discards
the active take and releases the microphone. Optional arrangement playback is available; microphone monitoring is not implemented.
`scripts/browser-experimental-recording-check.cjs` uses Chromium's fake microphone;
it does not access physical recording hardware. Microphone access requires HTTPS
or a trusted loopback origin.

Experimental buses support nested outputs, pre/post-fader sends, shared effects and
volume/pan automation. Routing validation rejects feedback cycles. Bus deletion
clears references reversibly. Run `scripts/browser-experimental-routing-check.cjs`
for routing controls and real PCM checks. Per-track stem exports retain bus effects;
shared nonlinear effects can make summed stems differ from the full mix.

The MIDI event editor supports controller, pitch-bend, program and pressure events.
Import/export retains note channels and channel events. Synth audition supports
CC7/11/10/64 and fixed ±2-semitone pitch bend; program/pressure events are export-only.
Run `scripts/browser-experimental-midi-events-check.cjs` for editor and PCM checks.

Experimental video scoring has non-drop timecode, frame-rate selection and frame
stepping. Extract movie audio creates an independently editable track using the
same original asset. Codec support and the 250 MB browser decode limit apply.
`scripts/browser-experimental-video-check.cjs` generates an MP4 fixture using the
installed FFmpeg binary and checks picture sync, offsets and audible extraction.

+ Drum track creates a MIDI track using the synthesized drum kit. Add a MIDI region
to open its bar-based step sequencer; hits remain ordinary MIDI notes editable in
the piano roll. Run `scripts/browser-experimental-drums-check.cjs` for pattern,
velocity, undo, MIDI export and actual audio-render checks.

Cycle playback stores a start/end range and repeats its rendered audio (up to ten
minutes). Use selected region sets the range. Effects restart each cycle; edits
stop playback. Full-session export ignores Cycle. Run
`scripts/browser-experimental-cycle-check.cjs` for wrapping, pause, persistence,
PCM boundaries and cancellation of a pending render.

Experimental account saves use the existing `/api/projects` and private `/api/media`
flows. No new migration or credentials are required. Ensure the development Blob
token, WorkOS and Neon are configured as above. Projects lists these as Experimental
DAW. The existing 1 MB JSON limit applies; media uploads are separate.
`scripts/browser-experimental-cloud-check.cjs` mocks services to test account UI and
retry behavior; `test/experimental-cloud-projects.test.js` verifies ownership and
revision rules in PGlite. Neither replaces a live Neon/Blob smoke test.

### Live Experimental account-storage check

With the local frontend running and development credentials loaded:

```sh
node --env-file=.env.local scripts/daw-live-smoke.mjs
```

Set the standard `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_EXECUTABLE` variables if needed.
The script refuses any APP_URL or Neon branch outside the documented development
setup. It uses a synthetic identity (not a real WorkOS sign-in), real Neon and private
Blob multipart uploads, then clears device data and checks exact source restoration,
playback and revision updates without duplicate uploads. It removes its test data.

If project loading reports `column "folder_id" does not exist`, the existing folder
migration has not been applied. Confirm the development branch and run
`npm run db:migrate` before retrying. This occurred during DAW live verification;
the local-development branch is now migrated through `010_folders.sql`.

Experimental export settings support 44.1/48/96 kHz and 16/24-bit PCM or 32-bit float
WAV for both mixes and per-track stem ZIPs. Run
`scripts/browser-experimental-bounce-check.cjs` to verify downloaded formats and
start timing. The ten-minute limit still applies; stem ZIP generation uses memory.

Experimental piano-roll Timing & feel controls provide strength/swing quantization
and seeded timing/length/velocity humanization. Both use the shared command harness
and support region-wide or selected-note edits. Run
`scripts/browser-experimental-note-tools-check.cjs` for UI, undo/redo, persistence
and MIDI-download checks; `test/experimental-note-transforms.test.js` covers command
bounds, determinism and agent validation. Tool defaults reset on reload; note edits
persist. Humanization is destructive but undoable, so undo before comparing seeds.

Experimental Mixer → Master channel edits the summed mix before master volume.
These effects share track controls and command operations (`effect.add` targets
the session ID). Older projects default to an empty master chain. Run
`scripts/browser-experimental-master-check.cjs` for controls, persistence and PCM
render checks. Stems include master processing individually; nonlinear effects may
make their sum differ from the mix. Live master metering is available as described below.

The Master channel also shares the track automation editor for volume and pan.
Master curves override static master volume/pan; clear the corresponding curve to
return to static controls. `automation.point` and `automation.clear` use the session
ID for master edits. The master browser check includes rendered fades, panning and
seek restoration; unit coverage is in `test/experimental-master-automation.test.js`.

Send Position can be Before volume, After volume, or After pan (the existing default).
All positions are after inserts; mute silences all outgoing sends. These positions
also control whether source volume/pan automation affects the send. Run
`scripts/browser-experimental-send-taps-check.cjs` for controls, persistence and
rendered signal-flow checks. The shared `send.set` command accepts tap values
`preFader`, `postFader`, or `postPan`; existing sends allow independent tap/level updates.

Each send now has an expandable gain automation curve, sharing the track/master
editor. Points override static send gain and initialize correctly on seek.
`send.automation.point` uses source track ID plus busId/time/value; clear uses source
track ID and busId. Existing `automation.delete` accepts send point IDs. The send
position browser check also covers send curves, persistence, mute, seek and stems.
Run `test/experimental-send-automation.test.js` for command validation and undo.

Automation points support drag, numeric updates and keyboard editing across track,
master and send curves. Arrow keys adjust time/value (Shift makes larger changes);
Delete removes a focused point. The shared `automation.set` command updates time
and/or value while preserving ID/parameter and rejecting collisions. Run
`scripts/browser-experimental-automation-edit-check.cjs` for interaction/focus,
undo, collision and persistence checks, and
`test/experimental-automation-edit.test.js` for command invariants.

MIDI file imports now use one atomic `midi.import` command (original SMF base64 plus
optional start seconds). Limits: 8 MB/file, 128 session tracks, 20,000 notes and
20,000 channel events per imported track. Invalid files preserve undo/redo; valid
imports undo as one action. Run `scripts/browser-experimental-midi-import-check.cjs`
for a 10,001-note import, failure recovery, export and reload, and
`test/experimental-midi-import.test.js` for history retention and size limits.

Piano roll Snap supports straight/triplet grids and Off. Hold Shift for temporary
free movement; drag increments preserve existing timing offsets. Quantize remains
a separate operation for aligning starts exactly. Run
`scripts/browser-experimental-piano-grid-check.cjs` for interaction/tempo/persistence
checks and `test/experimental-piano-grid.test.js` for timing and boundary rules.

Experimental MIDI input: click Connect MIDI, choose a device, then Record MIDI.
Stop & save MIDI creates one editable track at the captured playhead. Optional live triangle-synth audition and arrangement playback are available
with the recording controls below. Browser Web MIDI
support and permission are required; the app requests no SysEx access. Disconnect
or the ten-minute limit saves recorded data; cancellation/navigation discards an
unsaved take. Failed storage saves can be retried without duplicate tracks.

Run `scripts/browser-experimental-midi-input-check.cjs` for simulated-device access,
recording, undo, disconnect, save retry and lifecycle tests, and
`test/experimental-midi-capture.test.js` for event decoding/limits. Physical keyboard
input, latency and cross-browser support still require hardware verification.

Experimental Export settings → Stem grouping offers Individual tracks (default)
and Output groups. Output groups combine sources sharing their final primary
output bus; nested buses roll into that outer group. Tracks sent directly to Master
stay separate. Sends do not assign group membership; each group's contributions
still pass through their sends, bus effects and master processing. Solo is ignored,
muted sources are excluded, and file lengths match the full arrangement including
effect tails. The mode is a workspace preference and resets on reload.
Run `scripts/browser-experimental-bounce-check.cjs` for grouped ZIP downloads and
PCM reconstruction, plus `test/experimental-stem-groups.test.js` for membership,
nested routing, send preservation and non-mutation.

MIDI regions support inward edge dragging and Region inspector → Crop MIDI region.
Boundaries use absolute timeline seconds. Cropping clips/rebases notes, carries
controller state into the new start and retains pedal-held notes. This edits MIDI
events; Undo restores removed content, while outward dragging does not. Region
movement and Length in Apply edits remain separate operations. The shared
`region.trim` command supports the same behavior for agent/manual actions.
Run `scripts/browser-experimental-midi-trim-check.cjs` for UI, undo, persistence and
rendered audio boundaries; `test/experimental-midi-trim.test.js` covers channel state,
pedal-held notes and atomic rejection of invalid bounds.

Experimental has a playback metronome with quarter-note beats per bar and its own
click level. It follows BPM, accents the bar start and works with Cycle. Settings
persist in the project and use undoable `session.set` fields `metronomeEnabled`,
`metronomeDb` (-60..0) and existing `meter` (1..16). Applying settings stops playback,
like other edits. Click output bypasses mixer gain/effects and is never included in
WAV or stem exports. Recording click and count-in are configured separately below.
Run `scripts/browser-experimental-metronome-check.cjs` for controls, persisted state,
actual click timing/seek/cycle audio and export exclusion; unit coverage is in
`test/experimental-metronome.test.js`.

Metronome → During recording enables the click for standalone audio and MIDI takes,
independently of playback click. Its persisted/undoable command field is
`metronomeRecordEnabled`. The click uses the take's starting playhead, BPM, meter
and click level. It stops on finish, discard, disconnect or navigation, including
when device/audio initialization resolves after leaving. Microphone capture and
click share a scheduled audio frame; the click is routed only to the output, not
the capture worklet. Use headphones to avoid acoustic bleed into the microphone.
Count-in and arrangement playback are available below; microphone monitoring and calibrated hardware latency remain pending.
The existing microphone and MIDI input browser checks now verify click lifecycle;
the microphone check also records silence with click enabled and verifies the
saved file remains silent. Tests use simulated devices, not physical hardware.

Metronome → Count-in supports Off, 1 bar or 2 bars for both audio and MIDI takes.
It plays pre-roll click even when During recording is off; that checkbox controls
whether click continues into the take. The selected playhead stays the take's
start. Input during pre-roll is excluded, Save is disabled until recording begins,
and Cancel discards the preparation. Settings persist through undoable
`session.set` → `countInBars` (integer 0..2; old projects default to 0).
Run `scripts/browser-experimental-count-in-check.cjs` for audio/MIDI pre-roll,
placement, cleanup, persisted settings and click continuation audio checks.

Piano roll multi-selection: Ctrl/Cmd-click toggles notes; Select all notes and Clear
selection are available above the editor. Dragging moves the selected group with
relative timing/pitch preserved and joint boundary limits. With multiple notes,
Move selected notes accepts relative beats and semitones. Duplicate selection
copies the group after its span; Delete selection removes it. Right-edge resizing
still changes one note. Timing & feel → Selected notes now supports the whole group.
Each bulk edit is one undo step. Selection itself is transient and resets on reload.
The agent receives validated selectedNoteIds, and `notes.move`, `notes.duplicate`,
`notes.delete` accept comma-separated `noteIds` in one command targeting a MIDI
region (omission means all notes). Quantize/humanize accept noteIds as an alternative
to noteId. Run `scripts/browser-experimental-note-selection-check.cjs` and
`test/experimental-note-selection.test.js` for these behaviors.

Piano roll Tool → Select notes enables box selection on empty grid space. Alt-drag
provides the same action while Draw notes is active. Ctrl/Cmd/Shift adds the box's
notes to the selection; Escape cancels the gesture. Drag a selected right edge to
resize all selected notes by the same amount, or use Length change in beats.
The shared `notes.resize` command takes region ID, comma-separated noteIds and
relative seconds; omission of noteIds applies to all notes. Starts/pitches stay
fixed and invalid resulting lengths reject the entire change. Selection/tool state
is temporary. Box selection does not auto-scroll yet.
Run `scripts/browser-experimental-marquee-check.cjs` for gestures, group resize,
undo/redo and Draw mode regression, plus `test/experimental-marquee.test.js`.

Select an audio or MIDI region and use Bounce region to export just that region as
stereo WAV. It starts at the region boundary and includes routed bus/master effect
tails. Source offset, fades, reversal and automation use the existing renderer;
automation initializes at the region's original timeline position. Solo is ignored;
track and bus mute still apply. Movie regions require Extract movie audio first.
The existing sample rate/bit depth settings and ten-minute render limit apply.
Mix, stem and region exports now capture the document/settings before asynchronous
work and decode only media used by the render. Editing during a bounce does not
change that export. Run `scripts/browser-experimental-region-bounce-check.cjs` for
actual WAV isolation, source offset, delay tail, automation, MIDI and snapshot checks,
and `test/experimental-bounce-plan.test.js` for plan/asset/limit coverage.

Play arrangement while recording enables audio/MIDI overdubbing into a new track.
The persisted/undoable field is `recordWithPlayback` (default false). Audible audio
is decoded before recording starts; playback uses a fixed session snapshot with
mixer routing, effects and automation, beginning at the take's post-count-in start.
The recording clock, playhead and movie monitor advance during the take. Cycle is
ignored for recording: playback runs linearly from the selected position. Optional live MIDI audition is available below; microphone monitoring/latency calibration remain pending. Headphones prevent accompaniment bleeding acoustically into the input.
Run `scripts/browser-experimental-overdub-check.cjs` for audio/MIDI take placement,
backing cleanup, scheduled/seek PCM and digital isolation of microphone recordings.

Hear MIDI while recording enables triangle-synth audition during MIDI takes and
count-in. It is opt-in, persisted and undoable through `session.set` field
`midiMonitorEnabled`. Audition bypasses the mixer; it is not an audio recording.
Saved takes retain editable notes/controller events and use the triangle instrument.
CC7/11/10/64 and ±2-semitone pitch bend work live. CC120/123 and reset controllers
release voices appropriately; stop, discard, disconnect and navigation silence them.
Polyphony is limited to 64 voices, stealing the oldest voice when needed. Count-in
notes sound but are excluded from the take. Idle monitoring and physical device
latency calibration remain pending. Run
`scripts/browser-experimental-midi-monitor-check.cjs` for synthetic-device UI and
real Web Audio signal/lifecycle checks. No physical keyboard was tested.

Microphone monitoring: enable Hear microphone while recording and choose a monitor
level (-60..0 dB; default -18), then Apply microphone monitoring. This is off by
default and uses validated, undoable `session.set` fields `audioMonitorEnabled` and
`audioMonitorDb`. Monitoring starts with the microphone, including count-in, on a
separate output branch. It bypasses track/master effects and never changes captured
PCM, saved WAV levels or export settings. Use headphones to prevent feedback.
Mute monitor / Unmute monitor remains available during a take and changes only
that take; the saved preference applies again on the next recording. Finish,
cancel, initialization failure and navigation disconnect the monitor. Hardware
direct monitoring should be disabled if using browser monitoring to avoid hearing
two copies. Browser/device latency is not calibrated or compensated.
Run `scripts/browser-experimental-input-monitor-check.cjs` for fake-microphone
capture, live mute controls, gain/isolation PCM, saved preferences and cleanup.

Experimental Markers lists named timeline locations in chronological order. Add a
name/time, edit either field with Save marker, or Delete marker; all edits support
undo/redo and persist with the session. Clicking a marker's time or ruler diamond
jumps to it; Previous/Next marker searches relative to the current transport time.
Navigation stops playback and centers the destination. Marker times are absolute
seconds (0..86400) and do not rescale with tempo. Markers beyond audio extend the
visible arrangement, with at most 1,000 ruler labels. They do not extend audio exports.
`marker.add` accepts optional id plus name/time; `marker.set` targets an existing ID
with name and/or time; `marker.delete` removes it. IDs remain unique across the
whole session. Run `scripts/browser-experimental-markers-check.cjs` for UI,
navigation, persistence and undo, plus `test/experimental-markers.test.js` for
atomic validation and ordering. MIDI-file marker import/export is supported as described below.

MIDI import/export now carries SMF marker meta-events (FF 06). Exports write them
in chronological order in the conductor track; marker-only files are supported.
Import converts ticks through the source tempo map and adds the selected playhead
offset to both markers and tracks. Both are committed as one undoable operation.
Imported markers receive fresh IDs, so repeated imports preserve both copies.
Limits remain 1,000 markers per session, 200 characters per name (long imported
names are truncated), and 0..86400 seconds after placement. UTF-8 labels round-trip
in Cuestamp; legacy MIDI applications may interpret non-ASCII text differently.
Tempo maps themselves are still flattened on export to the session tempo. Cue-point
meta-events (FF 07) are not treated as markers. The marker browser check downloads
and re-imports the actual MIDI file; `test/experimental-midi-markers.test.js` covers
tempo changes, offset, IDs, bounds and atomic undo.

Bounce range WAV exports the saved Cycle start/end positions without requiring
Cycle playback to be enabled. Apply cycle first to commit typed boundaries, or Use
selected region to set them. Output is stereo WAV using Export settings and is
exactly the selected duration (rounded up to a sample), with no trailing effects
outside the range. Maximum export length is ten minutes; a short range late in a
long session is allowed. Only audio regions intersecting the window are decoded.
Silence is exported for an empty window. Mute/solo, routing, effects, source offsets,
fades and automation use the existing mix renderer, and metronome is excluded.
The seek renderer starts effects at the range boundary: prior delay/reverb history
is not reconstructed. For an exact excerpt of a previously running mix, export the
full mix and trim it externally until DSP pre-roll is implemented. Settings/document
are snapshotted before decoding. Run
`scripts/browser-experimental-range-bounce-check.cjs` for actual WAV sample/length,
automation, unrelated-media exclusion and silence checks.

Select a track (or one of its regions), then open Track actions → Duplicate track.
The copy appears immediately after its source and has independent IDs for regions,
notes, controller events, effects and automation. Original media assets are shared,
so this does not upload or duplicate source files. Instrument, gain/pan, mute/solo,
effects, automation, outgoing bus and sends are retained. New track with same
settings omits regions while keeping these settings. Duplicating a bus copies only
its settings/outgoing routes; existing tracks keep feeding the original bus.
`track.duplicate` uses target=source ID and optional values id, name, includeRegions
(boolean, default true). Limits and full routing/ID validation apply atomically;
each copy is one undo step. Run `test/experimental-duplicate-track.test.js` and
`scripts/browser-experimental-duplicate-track-check.cjs` for independent editing,
media references, bus behavior, history, persistence and real rendered audio checks.

Move regions between tracks by dragging vertically in the arrangement or selecting
Region inspector → Move to track. Destinations must have the same type (audio,
MIDI or video); bus tracks cannot contain regions. Compatible drop lanes highlight
with the accent color, incompatible lanes with a red outline. Vertical-only drags
preserve timeline placement; horizontal movement retains the existing snap/Shift
behavior. Region IDs, source offsets, notes, events and fades are preserved, while
the destination instrument, mixer effects and routing determine playback.
`region.move` targets a region ID with required `trackId` and optional absolute
`start`; it is atomic and undoable. The inspector moves at the existing time.
Run `scripts/browser-experimental-region-move-check.cjs` for drag feedback,
incompatible rejection, inspector/history/persistence and destination gain PCM;
`test/experimental-region-move.test.js` covers audio/MIDI/video transfers and invalid
commands. Multiple-region moves and automatic scrolling during drags remain pending.

Region inspector → Repeat region creates 1–100 additional copies with spacing in
beats. Default spacing equals the region length; shorter spacing deliberately
creates overlaps, longer spacing creates gaps. Copies stay on the same track,
share source media and preserve source offset, fades and MIDI content, but receive
new region/note/event IDs. They are independent edits, not linked loop aliases.
One Undo removes the entire repetition; the 1,000-region track limit still applies.
The agent command `region.repeat` targets a region ID with required `count` and
optional `interval` in seconds (default region duration). Repeat starts must remain
within the 86,400-second timeline bound. Run
`test/experimental-repeat-region.test.js` and
`scripts/browser-experimental-repeat-region-check.cjs` for content/bounds, beat
spacing, independent edits, history/persistence and rendered phrase timing.

Drag a track name onto the upper/lower half of another track header to place it
before/after that track. An accent line shows the insertion edge. Track actions →
Move track up/down provides keyboard-accessible alternatives; boundary buttons are
disabled. Arrangement lanes and mixer order follow the document order. All track,
region and routing IDs stay unchanged, and each move is one undo step.
`track.move` targets a track ID with `index`, the zero-based final position in the
track list. Invalid positions reject atomically. Run
`test/experimental-track-order.test.js` and
`scripts/browser-experimental-track-order-check.cjs` for insertion math, validation,
drag/controls, history, persistence, routing and unchanged rendered audio. Track
multi-selection, folders and automatic scrolling while dragging remain pending.

Mixer level meters show sampled stereo peaks after each track/bus volume and pan,
plus the processed master output. Bars span -60..0 dBFS; the numeric peak holds the
highest sampled level (including values above 0 dBFS) until Reset peak or a playback
restart. Red text indicates a held level at/above 0 dBFS, not destructive clipping
inside the floating-point mixer. Stop clears the displays and disconnects all meter
nodes. No live reading is shown as “—”, rather than implying measured silence.
Meters observe playback only; they do not alter the session or exported audio.
Cycle playback meters its combined pre-rendered master buffer (including click when
enabled); individual track/bus values are unavailable there. Linear playback's
metronome bypasses the mixer meters. Recording accompaniment/input monitors do not
feed these meters. They sample 2,048-frame windows at UI updates and may miss brief
peaks; they are not true-peak, RMS or LUFS meters. Run
`scripts/browser-experimental-meters-check.cjs` for actual stereo/headroom signal,
hold/reset, track/bus/master UI, Cycle, cleanup and signal-isolation checks.

The editing agent request can now include recent sampled playback levels. The
client retains its last observation after Stop for up to two minutes, but excludes
it after a document revision changes, a project is replaced, or meters are reset.
Telemetry includes session ID/revision, timestamp, playback position/mode, sample
rate/window size and per-channel left/right/held peak dBFS. Null means measured
silence; omitted channels are unmeasured. Cycle includes only its combined master.
The server bounds/validates fields, freshness, IDs and held/current consistency
before inference. Readings are client-reported context, never persisted project
state or instructions. Provider guidance requires replay to verify any estimated
level adjustment and prohibits claiming full-file/true-peak/loudness analysis from
sampled observations. Static gain changes may be overridden by automation.
Run `test/experimental-meter-context.test.js` and
`scripts/browser-experimental-meter-context-check.cjs` for validation, real playback
context delivery, post-edit invalidation and persistence exclusion. Provider calls
are mocked in these checks; real inference still requires configured credentials.

Select a region and use Mute region / Unmute region in the inspector. Muted regions
remain visible with a dashed, dimmed appearance and retain editable notes, media
references and all settings. `region.set` accepts `mute` (boolean, defaults false
for older sessions); undo/redo, duplication, repetition and saves preserve it.
Playback, Cycle, recording accompaniment and all WAV bounce modes omit muted source
regions and do not decode their files. Arrangement/export duration still includes
muted regions so timeline alignment stays intact; bouncing a muted region yields
silence. Muted movie regions are excluded from the video monitor.
Export MIDI omits muted tracks and regions (solo does not filter MIDI export).
Standard MIDI files do not retain the mute state or omitted content; export the
Cuestamp project to retain all editable material. The internal writer supports
`includeMuted: true` when an unfiltered MIDI serialization is explicitly needed.
Run `test/experimental-region-mute.test.js` and
`scripts/browser-experimental-region-mute-check.cjs` for default/history handling,
asset exclusion, same-track independence, playback and actual WAV/MIDI downloads.

MIDI input → Record to chooses New instrument track (default) or an existing MIDI
track. Each take appends a new independent region at the captured playhead; existing
regions are preserved and overlapping takes play together. Destination selection is
locked during capture/retry and resets to New instrument track on reload. It is
checked before recording, including the 1,000-region limit. Recording into an
existing track works even when the session already has 128 tracks.
The atomic `midi.import` command accepts optional `trackId` for this behavior. MIDI
tracks in an imported file become separate regions on that destination. Name,
instrument, mixer effects, routing and earlier regions are unchanged; Undo removes
the whole take. Saving failures retain the same destination for retry.
Live audition uses the destination instrument (triangle on new tracks). Sine,
triangle, square, sawtooth and the built-in drum kit are supported. Drum hits are
one-shots and finish naturally after note release; stop/discard releases all voices.
Monitoring still bypasses destination mixer volume/effects/routing, so it is not an
exact preview of the processed track. Run
`test/experimental-midi-destination.test.js` and
`scripts/browser-experimental-midi-destination-check.cjs` for existing-track saves,
limits, preservation/history, instrument choice and real drum/voice output cleanup.
The device is simulated; physical latency, take lanes and MIDI merge/replace/punch
recording modes remain pending.

Audio destination beside Record audio selects New audio track (default) or an
existing audio track. The choice is locked while recording and saving; the take
uses the starting playhead even if other UI positions change during save. An
existing destination gets one additional region without replacing earlier takes,
changing mixer settings or creating another track. Overlapping regions play
together. New/existing destinations are validated before microphone access, with
128-track/1,000-region limits. An existing track remains usable at the track cap.
The shared media-import planner validates ordinary track/region commands before
storing new media; the completed take commits as one undo step. Destination choice
is temporary and defaults to a new track after reload. Failed take saves retain the
existing WAV-download fallback. Run `test/experimental-audio-destination.test.js`
and `scripts/browser-experimental-audio-destination-check.cjs` for limits, track
preservation, placement, history, synthetic PCM and cancellation/navigation cleanup.
These are separate regions, not take lanes or automatic comping/replace recording.

Experimental recording has an Audio input selector and Refresh inputs control.
Selection is transient, separate from the destination track, and locked during a
take. Device names/list availability depend on browser microphone permission;
recording requests that permission and refreshes the list afterward. Explicit
inputs use an exact device constraint: failure is surfaced without retrying the
system default. A disconnected selection remains visibly unavailable until the
user reconnects it or chooses another input. Enumeration never opens a microphone.
Device-change listeners and pending refreshes are cleaned up on navigation.
Multichannel input assignment, output routing and physical latency calibration
remain pending. See `test/experimental-audio-inputs.test.js` and
`scripts/browser-experimental-audio-input-check.cjs`.

Record channels beside Audio input offers Stereo / native, Mono Input 1 (left),
and Mono Input 2 (right). Mono selection extracts one source channel without
summing; both the saved WAV and live monitor use it. Mono monitoring plays centered.
Choices are local, locked during capture, and fixed before preparation. Input 2
requests at least two device channels and rejects reported single-channel streams,
releasing the device on failure. Browser/device channel-count reporting varies;
these are the first two browser-exposed channels, not arbitrary hardware port maps.
Stereo / native retains the prior capture behavior (up to two channels). Multiport
assignment, simultaneous independent armed tracks and latency calibration remain
pending. Run `test/experimental-recording-channels.test.js` and
`scripts/browser-experimental-recording-channels-check.cjs`; the latter measures
separate left/right synthetic signals in saved PCM and monitor output.

Experimental's Recover backup previews the account-scoped local backup created by
New session or opening another account session. It displays title, track count,
revision and missing source-media count before confirmation. Recovery creates a
new local session identity/revision with the arrangement intact and a '(recovered)'
title suffix; account projects are untouched until an explicit save. The displaced
current session becomes the next backup. A failed primary storage write rolls the
backup back; parsing/validation and stale-backup checks happen before mutation.
Undo history and agent trace reset on recovery. Source media still comes from this
account's device cache; the backup JSON is not a media archive. Download backup
exports its raw JSON even if damaged, without replacing it. This is one recovery
slot, not a timestamped version history or cloud autosave system. Run
`test/experimental-recovery.test.js` and
`scripts/browser-experimental-recovery-check.cjs` for restore/swap, corruption,
quota rollback, missing-media warnings, account isolation and reload behavior.

The piano roll includes a velocity lane below the note grid, sharing its horizontal
scroll. Drag vertical controls or use arrow keys. Selected notes change together
by a relative amount, independently clamped to 0–127; an unselected note changes
alone. Simultaneous notes fan out horizontally for access. Each completed change
is one undo step, with keyboard focus retained after repaint. The shared agent
command `notes.velocity` targets a MIDI region with optional comma-separated
`noteIds` and exactly one of `velocity` (absolute 0–1) or `delta` (-1–1). Omitting
noteIds edits all notes in that region. It preserves note timing/pitch/channel.
Run `test/experimental-velocity.test.js` and
`scripts/browser-experimental-velocity-check.cjs`. Continuous CC/pitch-bend drawing
and expression automation lanes remain pending; this lane edits note velocity.

The piano roll also has a graphical MIDI controller lane for expression (CC11),
volume (CC7), pan (CC10), sustain (CC64) and pitch bend, filtered by MIDI channel.
Click to add a point, drag to edit time/value, and use Delete/Backspace to remove.
Arrow keys change time by the piano snap (1/16 when snap is off) or value by one
MIDI step (128 for pitch bend). Home/End choose the value limits; 0 restores the
controller default, including exact pitch-bend center 8192. Shift-drag bypasses
snap. Clicking an existing snapped time updates its point instead of adding one.
The graph shows held/step values, matching event playback rather than implying
smooth interpolation. Edits use shared event.add/set/delete, with one undo per
completed gesture. Existing event forms remain available for precise values and
other event types. This is point editing, not freehand drawing or real-time CC
record automation. Run `test/experimental-controller-lane.test.js` and
`scripts/browser-experimental-controller-lane-check.cjs`.

Create a ramp in the controller lane adds evenly spaced controller points with
linear, ease-in or ease-out values. Start/end and maximum spacing are entered in
beats; the shared `event.ramp` command uses region-relative seconds. Values are
integers (0–127 for CC, 0–16383 for pitch bend); exact endpoints are retained.
Only matching type/controller/channel events within the inclusive range are
replaced. Other channels/controllers and outside events remain. One ramp is one
undoable command, limited to 2,000 new points and 20,000 total region events.
The ramp is sampled MIDI steps, not continuous interpolation. Agent values are
`type`, `channel`, `parameter` (0 for bend), `start`, `end`, `from`, `to`, `step`,
and optional `curve` (`linear`, `easeIn`, `easeOut`). Run
`test/experimental-controller-ramp.test.js` and
`scripts/browser-experimental-controller-ramp-check.cjs`; checks include rendered
expression dynamics and MIDI export/re-import as well as selection and undo.

Insert a chord in the piano roll provides root/octave, chord quality, inversion,
start/length in beats, velocity and channel, with an exact note-name preview.
Supported qualities are major/minor/diminished/augmented triads, sus2/sus4, major7,
minor7, dominant7, halfDiminished7, diminished7 and power fifths. C4 means MIDI 60.
Inversions raise the lowest chord tones one octave. Each insertion appends ordinary
editable notes without replacing existing material and is one undo step. The
shared `notes.chord` command accepts `root` (MIDI pitch), `quality`, `inversion`,
`start`, `duration` (seconds), `velocity` (0–1) and `channel` (0–15). It rejects
out-of-range pitches, invalid inversions, region overflow and the note limit.
The agent is instructed to insert only explicitly requested chords, not invent
progressions. This is deterministic note entry, not generated audio. Run
`test/experimental-chords.test.js` and `scripts/browser-experimental-chords-check.cjs`.

Workspace redraws preserve expanded panels and timeline/piano/controller scroll
positions while staying in the same session and selected region. Background initial
loading also preserves unfinished fields and text focus/selection; audio device
refreshes update only the audio-input controls, leaving editor drafts untouched.
Routine document edits still render committed form values. View state is transient
and is not serialized into project files. Run
`scripts/browser-experimental-view-state-check.cjs` for delayed initialization,
device-change events, drafts, expanded panels, scroll, and undo behavior.

Key & scale in the piano roll previews how many pitches will change, supports all
notes or the current selection, and optionally highlights scale tones. Choose a
root pitch class, scale, nearest/up/down movement, and lower/higher tie resolution.
Existing in-scale pitches stay unchanged. Applying changes pitch only and is one
undo step; notes that converge are kept separately. Highlighting is only a guide
and does not constrain drawing. Options remain local to the workspace, not a
persisted key-signature/tempo map. Shared `notes.scale` values are `root` (C=0 to
B=11), `scale` (major, minor, harmonicMinor, dorian, phrygian, lydian, mixolydian,
locrian, majorPentatonic, minorPentatonic, chromatic), optional `direction`
(nearest/up/down), `tie` (down/up), and `noteId` or comma-separated `noteIds`.
Omitting selection targets all notes in the region. Directional requests with no
valid pitch inside MIDI 0–127 reject atomically. Run
`test/experimental-scales.test.js` and `scripts/browser-experimental-scales-check.cjs`.

MIDI tracks now support a single-sample instrument. The track/region inspector's
Sampler section can upload an audio file or choose an existing device-cached audio
source and set its root MIDI note (C4=60). Assignment selects the sampler without
creating an extra audio track. Notes transpose by playback speed, preserve the
source, follow velocity/CC7/11/10/64 and ±2-semitone pitch bend, and stop at note
release/region end or the end of the sample. Source playback does not loop or time
stretch. Seeking integrates earlier pitch-bend rates to resume at the source offset.
Live MIDI monitoring uses the sample too; physical hardware latency is unverified.

Shared track.add/set accept instrument `sampler`, nullable `sampleAssetId` and
`sampleRoot` (0–127, default 60). Source dependencies include samples for playback,
recording accompaniment, mix/stem/region/range bounces, account saves and portable
archives. Archive/cloud restoration remaps sample IDs together with region IDs;
server project validation requires their media mappings. Missing samples fail
clearly. Sample upload/decode currently has the existing 250 MB browser limit.
Run `test/experimental-sampler.test.js` and
`scripts/browser-experimental-sampler-check.cjs` for schema/history, source
references, archive bytes, server mappings, pitched render, live voice cleanup,
mock cloud save/restore and reload. Multi-sample zones, looping/envelope controls,
velocity layers, slicing and pitch-independent time stretching remain pending.

Sampler tracks now offer Loop while note is held with source-second start/end
points. Blank end uses the source duration. Shared track.add/set fields are
`sampleLoop` (default false), `sampleLoopStart` (default 0), and `sampleLoopEnd`
(nullable, default null). Point order is validated in the document; enabled loops
are validated against decoded source duration and a one-sample minimum span before
assignment/playback. Uploaded replacement samples reset loop settings; selecting
a different cached sample resets the loop form. Loops sustain until note/region
end and work in playback, bounce, accompaniment and live MIDI monitoring. Seek
positions include pitch-bend history and wrap into the loop after its first pass.
These are hard boundaries, without crossfades or zero-crossing assistance. Run
`test/experimental-sampler-loop.test.js` and
`scripts/browser-experimental-sampler-loop-check.cjs` for bounds/history, sustained
rendering, unlooped comparison, seek, note-end silence and live note-off cleanup.

The sampler inspector displays a cached waveform overview after sample decoding.
Load waveform decodes the selected source after reload without committing edits.
Drag across it to choose a loop range, drag handles to adjust boundaries, or focus
a handle and use arrows for one source sample (Shift: 10 ms; Home/End: boundary).
Gestures snap to source frames and keep a minimum one-frame span. Changes update
only the form and enable looping; Use sampler commits them as one undoable edit.
Pointer cancellation restores the previous draft. Numeric loop fields update the
band too. The overview is peak-sampled and normalized for visibility; it is not a
sample-level zoom or zero-crossing editor. Run
`test/experimental-sampler-waveform.test.js` and
`scripts/browser-experimental-sampler-waveform-check.cjs`. The browser script can
save an inspector screenshot when CUESTAMP_SCREENSHOT is set to an output path.
Audio-device enumeration has a five-second timeout. A failed discovery leaves the
current choice intact and enables Refresh inputs to retry; recording remains a
separate permission request. This handles browser APIs that never settle.

### Sampler amplitude envelope

Sampler tracks now expose attack and decay (0–10 seconds), sustain level (0–1),
and release (0–30 seconds). Use sampler commits them as one undoable change.
Shared track.add/set fields are sampleAttack, sampleDecay, sampleSustain and
sampleRelease; defaults are 0.005, 0, 1 and 0.02 respectively. The editing agent
receives these controls through the same validated command schema.

The amplitude rises during attack, falls to sustain during decay, and fades from
its current level after note-off or sustain-pedal release. Early note-off releases
from the current attack/decay value. Arrangement notes are gated at region end;
release can continue beyond it unless a region fade silences it. Looping samples
continue looping during release. An unlooped sample can end before the envelope.
Playback, accompaniment, offline bounces and live MIDI monitoring share envelope
settings. Mix/stem/region exports reserve release tails, and range/seek playback
can resume inside a release; exact range exports still stop at the requested end.
Source audio is never rewritten.

Validation: 240 unit/integration tests and production build pass. The sampler,
loop and new envelope browser checks pass. Real Web Audio renders verify amplitude
at attack/decay/sustain/release points, early note-off, instant decay at the attack
boundary and post-region seeking. The browser also verifies controls/undo/redo
and live monitor voice lifetime. Physical MIDI hardware and live model inference
remain unverified. Multi-sample zones/layers, loop crossfades and filter/modulation
envelopes remain pending.

### Effect parameter automation

The mixer now has an Automate section below each effect, using the same editable
curve interface as volume/pan. Track, bus and master chains support EQ frequency,
Q and gain; compressor threshold/ratio/attack/release/knee; delay time/feedback/mix;
and reverb wet mix. Reverb decay, filter type and bypass remain static. EQ gain and
Q retain the selected filter type's Web Audio semantics (for example, lowpass does
not use gain). Curves use absolute project seconds, interpolate linearly in their
displayed units, hold the first/last value outside their points, and override static
controls. Clear the parameter curve to return to its static value.

Shared commands: effect.automation.point targets an effect ID with parameter,
time, value and optional id; a matching parameter/time updates the existing point.
effect.automation.set targets a point ID with time/value; delete targets a point;
clear targets an effect with parameter. Supported ranges match static controls.
Each effect allows 2,000 points; unsupported parameters, out-of-range values,
duplicate times/IDs and invalid batches are rejected. Undo/redo and local/cloud/
archive documents retain the curves; track duplication gives their points fresh
IDs. The agent prompt documents the new validated operations.

Playback and offline exports schedule native effect AudioParams and chase curve
values when seeking. EQ gain remains in decibels (unlike a channel GainNode).
Wet/dry gains use complementary mix curves. Delay export tails reserve automated
maximum time/feedback/mix within the existing 30-second per-chain cap. Seeking
still does not reconstruct earlier delay/reverb/compressor state. Automation write/
touch/latch recording and alternative interpolation curves remain pending.

244 tests and build pass. New unit checks cover all supported parameter ranges,
transaction rollback, point operations, master/bus handling, duplication, JSON
persistence, seek scheduling and tail estimates. Browser checks cover controls,
millisecond parameter precision, undo/reload, an audible offline filter sweep,
seek continuity and every native effect parameter's final value. Existing track/
send automation drag, keyboard, numeric-edit and persistence checks pass; the
browser test now waits for fonts before measuring drag coordinates. The mixer
screenshot was visually inspected. Live model inference remains unverified.

Implementation reference: native EQ gain uses decibels, and native AudioParam
linear ramps interpolate parameter values:
https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode/gain
https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/linearRampToValueAtTime

### Audio crossfades and fade curves

Select an audio region and use Crossfade in the region inspector to choose an
overlapping region on the same track. Linear and equal-power modes set the earlier
region's fade-out and later region's fade-in across the entire overlap in one
undoable edit. Positions, source offsets and recordings remain unchanged. One
region must start and end earlier than the other; touching, separated, contained
or different-track regions are rejected. Existing outer fades must leave room.
The form shows eligible pairs and explains the overlap requirement when none fit.

Shared command: region.crossfade targets either region with otherRegionId and
optional shape (linear or equalPower, default equalPower). region.set also accepts
fadeInShape/fadeOutShape (default linear) independently of fadeIn/fadeOut duration.
Curves work for audio and MIDI region gain envelopes; paired crossfades are audio
only. The agent prompt documents the operation and constraints. Timeline envelopes
show curved shapes. Shapes persist through saves, duplication and trimming.

Equal-power curves use complementary sine fades, approximated with 64 linear
segments per fade in playback/export. Linear fades preserve the summed amplitude
of identical aligned material; equal-power fades preserve the sum of squared gains
and can boost correlated material. Existing region gains and downstream effects
still apply. Seek starts at the proper envelope value. These are paired edits,
not linked region objects: reapply after moving/trimming a pair. Automatic overlap
creation, persistent crossfade links and adjustable curve tension remain pending.

248 tests and build pass. Unit checks cover paired edits/undo, rejection and atomic
rollback, energy/amplitude relationships, shape persistence and unchanged source
references. The browser verifies the form, fade drawing, independent curve edits,
undo/reload, real stereo linear/equal-power renders, seek and stem rendering. The
crossfade inspector was visually inspected. This is incremental progress on the
full DAW scope; hardware recording and live model execution remain unverified.

Reference workflow: Apple's overlapping-region crossfades:
https://support.apple.com/en-gb/guide/logicpro/lgcp9260fa9c/10.7/mac/11.0

### MIDI legato and overlap correction

The piano roll now includes Legato & note lengths. Connect note lengths adjusts
selected or all notes to the next strictly later onset in the same MIDI channel.
Simultaneous notes are treated as a chord. Shorten overlaps only never extends a
note. A gap in milliseconds leaves space before the next onset; a negative gap
creates overlap. Choose all notes or only the changed selection as the source of
following boundaries, and optionally require the same pitch. Notes with no next
onset keep their length by default, or use the region end. A live preview reports
how many notes will change and disables invalid/no-op submissions.

Shared command notes.legato targets a MIDI region with mode legato/shorten, gap
in seconds (-10..10), following all/selected, match channel/pitch, last keep/
regionEnd, and optional noteId or comma-separated noteIds. Defaults are legato,
0, all, channel and keep. Omit selection fields to edit the region's notes.
Region-end fallback ignores gap; overlaps are capped at the region boundary.
A zero/negative note length or result over the 3,600-second note limit rejects
the entire command. Onsets, pitches, channels, velocities and controller events
stay unchanged. Plans use sorted onset groups and binary search for large regions.
One batch is one undo step, and note lengths persist and export through MIDI.
The editing-agent prompt documents the operation. It edits MIDI gate duration;
sustain pedals, instrument release tails, glide and sample articulations remain
separate behaviors.

253 tests and the production build pass. Unit checks cover chords/channels,
selection versus following-note scope, matching pitches, gaps/overlaps, final-note
policy, shortening, atomic rollback/undo, MIDI roundtrip and 20,000 unsorted notes.
The browser checks preview/validation, selected/all edits, undo/reload, visible
controls and an offline audio render showing the former gap now sounding. The
existing piano inspector, drag/resize, duplicate/delete and persistence checks
also pass. The controls were visually inspected. The full DAW objective and live
model validation remain ongoing.

Reference workflow: Apple's Force Legato and overlap-correction commands:
https://help.apple.com/logicpro/mac/9.1.6/en/logicpro/usermanual/chapter_23_section_3.html

### Agent follow-up context and request isolation

The editing agent now receives recent conversation turns alongside the current
session. Each turn records the instruction, response, outcome, before/after
revisions and up to 20 actual entity deltas (for example, track gain 0 to -6 dB).
This supplies context for follow-ups such as making a previous reduction smaller.
Failed, canceled and discarded requests have no applied deltas. Track/effect order,
region ownership and send settings are included; metadata fields are explanatory,
not new editable command fields. The latest session remains authoritative after
manual edits or undo. Historical text is sent as untrusted data, never as a new
privileged instruction. Server checks reject mismatched session IDs, future
revisions, unsupported fields and oversized history before model invocation.

History is kept in memory while the page is open: at most eight turns and 24,000
serialized characters. Each turn is capped at 12,000 serialized characters;
truncated deltas/text are marked. It is cleared on session replacement/import,
page reload or Clear conversation and is not saved with audio projects. The model
request keeps store:false and includes bounded summaries as current request data,
not provider conversation IDs or replayed reasoning/tool calls.

Cancel request aborts the browser fetch and prevents late application; it does not
guarantee an already-running upstream model request stops billing. Leaving the
workspace or replacing its history aborts pending work. Responses must match the
original SessionHistory object, session ID, revision and active workspace before
any edit or conversational reply is accepted. Failed revision checks are recorded
as discarded. If an edit changes in-memory state but device persistence fails,
the UI and follow-up history say that it applied but could not be saved, rather
than incorrectly claiming no edit occurred.

257 tests and build pass. Server/unit checks cover actual edit deltas, size caps,
identity/revision rejection, send/order/deletion metadata and context forwarding.
A browser test with mocked model replies verifies follow-up context, manual-edit
races, cancellation, clearing, switching sessions and a simulated storage failure.
The agent panel was visually inspected. Live model inference, multi-step tool
loops, persisted conversation history and model-side request cancellation remain
unverified or pending; this does not complete the full DAW objective.

Official OpenAI documentation reference for conversation state:
https://developers.openai.com/api/docs/guides/conversation-state

### Full-mix sample analysis

Analyze mix below the mixer renders the complete stereo arrangement at the sample
rate selected in Export settings (44.1, 48 or 96 kHz). It uses the same offline
engine as bounce, including instrument envelopes, fades, effects, automation,
routing and effect tails. Mute/solo apply; the metronome is excluded. The existing
10-minute offline-render limit applies. Source decoding and the render use browser
memory; a dedicated worker scans copied channel buffers so sample scanning does
not block the main UI. Worker buffers are transferred and the worker terminates
on completion, error, abort or a 60-second scan timeout.

The panel reports per-channel and combined sample peak, RMS mean-square level,
and the number of samples whose absolute value exceeds one. RMS includes silence
and tails over the entire render. Zero-energy channels display Silence. Go to
loudest sample moves the playhead to the first occurrence of the greatest sample
magnitude. These are sample-domain measurements, not true-peak or LUFS; over-range
output is not evidence that an earlier source was clipped.

Analysis is kept only in page memory and becomes stale after any session revision.
The panel marks stale results and disables peak navigation; agent requests omit
stale results. A session replacement clears them. Valid current results are sent
as optional mixAnalysis alongside the existing short-window meter readings. Server
validation checks session/revision, expected rendered frame count, timestamp,
channel consistency and render bounds. Data remains client-reported; the prompt
uses it as measurement context rather than instructions, differentiates final-mix
from individual-track levels, and requires reanalysis after edits. No automatic
normalization or agent-driven render loop is implemented by this change.

261 tests and build pass. Unit checks cover peak/RMS arithmetic, silence, polarity,
over-range counts, invalid samples, scope/revision checks and agent forwarding.
Real browser renders and workers verify normal and over-range audio, silence,
peak navigation, stale-context omission, an edit during rendering, worker error/
cancellation and preservation of the rendered buffer. Model responses are mocked;
live inference remains unverified. Existing agent conversation/race checks also
pass. The analysis panel was visually inspected. Full DAW parity remains ongoing.

### Master sample-peak normalization

After Analyze mix, set Target sample peak (-60 to 0 dBFS) and Apply peak target.
The adjustment offsets the master fader and every master gain automation point
by the same decibel amount, preserving the curve, pan and insert settings. It is
one undoable session edit, followed automatically by a fresh full-mix render.
The measured result is displayed; a failed or interrupted reanalysis does not
undo the level adjustment. Undo is available, and old measurements remain stale.
Targets already within 0.001 dB, silent mixes, stale analysis and adjustments
outside the master/automation range (-96 to +12 dB) cannot be applied. The target
is a transient UI preference, not saved project data. This changes the session's
master level for playback and export; it is not an export-only setting, limiter,
LUFS normalization or true-peak protection. Analysis respects mute/solo.

Shared command master.gain.offset accepts deltaDb (-108..108) and optional current
session ID. It validates all resulting levels before committing; it never silently
clips the automation curve. The agent prompt documents deriving the offset from
current full-mix measurements and a requested target, and requiring new analysis
afterward. The agent itself does not yet initiate an analysis tool loop.

264 unit/server tests and the build pass. Browser verification uses real offline
renders to reach a -12 dBFS target with master automation, pan and an EQ insert,
checks preserved automation/effects and undo, and rejects stale/silent use. The
analysis panel was visually inspected. Provider responses remain mocked in this
test; live model inference and the broader DAW scope remain ongoing.

### Export master-processing options

Export settings now offers Include master processing (the default), Bypass master
inserts, and Bypass entire master. Insert bypass removes only master effects and
their tails; master gain/pan and their automation remain. Entire-master bypass
also sets unity master gain, centered pan and no master automation in the export
snapshot. Track/bus inserts, faders, automation, routing and sends stay included.
The setting applies to mix, individual/grouped stems, selected-region and range
bounces. Range duration stays exact; other exports omit bypassed master tails.
Playback, mix analysis, saved documents and undo history are unchanged. Export
settings remain transient UI state. Analyze mix describes the processed playback
mix, so its measured peak is not a measurement of a bypassed export. Bypassing
master processing does not eliminate nonlinear processing shared across buses.

265 tests and build pass. Unit checks cover every bounce mode, tail durations,
invalid settings and source-document immutability. Real downloaded browser WAVs
verify insert attenuation, retained gain automation/pan, entire-master bypass
against an unprocessed reference and grouped-stem reconstruction. The session
export confirms original master settings remain intact. The older browser script
was updated to respect preserved disclosure state rather than toggling an already
open panel closed. Export settings were visually inspected. Broader DAW scope,
agent-controlled exports and live model validation remain ongoing.

### Reverse MIDI note timing

The piano roll has a Reverse note timing panel with all/selected-note scope and
phrase/entire-region bounds. Phrase bounds use the earliest selected start and
latest selected end. The operation mirrors complete note intervals, preserving
lengths, pitches, velocities, channels and IDs. Repeating it restores the original
phrase (within floating-point precision). Unequal-length notes that originally
start together may start at different times after interval reversal. Controller
events, sustain pedal, instrument envelopes and audio samples are not reversed.
A preview counts moved notes; empty selection and no-op submissions are disabled.

Shared command notes.reverse targets a MIDI region with optional bounds phrase
(default) or region, plus noteId or comma-separated noteIds. Omit selection fields
for all notes. The formula is boundStart + boundEnd - start - duration. Invalid
selection, unsupported fields, non-MIDI targets and out-of-region results reject
the atomic batch. The editing-agent prompt describes the command. One operation
is one undo step and changes persist in the ordinary session document.

267 tests and build pass. Unit checks verify interval positions, preserved note
attributes/controller events, two-pass reversal, undo/redo and invalid-batch
rollback. Browser checks cover phrase/region modes, selection/no-op feedback,
undo/reload and actual offline audio showing the note moved out of its original
time window. The panel was visually inspected. Live model execution and broader
DAW parity remain unverified or ongoing.

Reference: Apple's MIDI Transform documentation describes reversing selected
positions around a pivot. This implementation explicitly mirrors note intervals:
https://support.apple.com/en-sg/guide/logicpro/lgcp21584fd3/10.7/mac/11.0

### Gain and stereo utility insert

The mixer effect selector now includes Gain / Stereo utility for tracks, buses
and the master. Gain spans -96 to +24 dB; width spans 0 to 2 (1 preserves stereo,
0 averages L/R into both outputs, 2 doubles the side component). Independent
left/right polarity switches apply before width; Swap left/right applies after
width. Mono inputs are speaker-upmixed to both channels before this matrix.
The insert adds no tail and follows normal chain order, bypass and export rules.
Source media stays unchanged. Polarity inversion may improve or worsen summed
recordings; it is not a timing correction or frequency-dependent phase rotation.

Shared effect.add/set kind gain supports gainDb, width, invertLeft, invertRight
and swap, in addition to enabled. Defaults are 0 dB, width 1 and false switches.
Gain and width support the existing effect automation commands and graphical
editor. Gain ramps interpolate in dB using exponential amplitude ramps; width
coefficients interpolate linearly. Seeking initializes the interpolated values.
Polarity and swap remain static. The agent prompt documents these settings.

268 tests and build pass. Unit checks cover validation, automated values, tail
behavior and atomic rollback/undo. Browser audio checks verify stereo identity,
mono averaging, widening, each-channel sign behavior, swap, cancellation,
operation order, mono upmix, gain, bypass, automation and seek. UI checks verify
checkbox/numeric editing, undo/redo and persistence; the panel was visually
inspected. Broader DAW parity and live model verification remain ongoing.

Reference: Apple's Gain utility provides gain, polarity, swap and mono controls:
https://support.apple.com/en-ie/guide/logicpro/lgcef2d8c650/mac

### Agent-requested mix analysis

The editing agent can now request analyze_mix when a level question or edit needs
current full-mix sample measurements. The browser renders and measures the same
unchanged session, then makes a fresh planning request with the original user
instruction, document, selection, bounded conversation and validated mixAnalysis.
This is a stateless two-request workflow: no raw provider reasoning or tool-call
history is replayed. The application supplies the measured data as normal context.
The server exposes the empty-argument analysis tool only when allowAnalysis is
true and current measurements are absent. Old clients default to false. Mixed
analysis/edit responses, unknown tools, invalid arguments and multiple calls are
rejected. The second request disables analysis, preventing repeated render loops.

Each user submission permits at most one render and two model requests, with a
five-minute overall browser deadline (each server model request still has its
90-second timeout). The browser checks session identity/revision before analysis,
after rendering and before edits. Analysis uses the original playback master,
not export-bypass settings. Cancellation prevents continuation and cancels sample
scanning; an already running OfflineAudioContext render or source decode may finish
before cancellation unwinds. Upstream model cancellation is not guaranteed.
Missing media/render failures stop the request without edits. A successful edit
remains one undo step. Its previous measurements become stale; automatic post-edit
verification, per-track measurements, LUFS and true-peak are still pending.

269 tests and build pass. Server tests cover tool availability, strict arguments,
current/stale measurement rules and mixed-tool rejection. Browser tests perform
real rendering and worker scanning with mocked model responses, then apply a
measurement-derived edit. They verify cancellation during rendering, an intervening
manual edit, repeated-tool rejection and render failure cleanup. Existing agent
conversation, persistence-failure and session-isolation tests also pass. The agent
panel was visually inspected. Live model inference is not verified by these tests.

Official OpenAI function-calling documentation (application executes tool code and
makes a subsequent model request with results):
https://developers.openai.com/api/docs/guides/function-calling

### Post-edit mix verification

Agent edit plans now accept optional verifyMix=true. After applying the batch,
the browser renders and measures the new full mix and reports its actual sample
peak and over-range sample count in the agent log. master.gain.offset always
triggers this verification. The post-edit render uses normal playback processing,
not export-bypass settings; it adds no undo step and performs no further edits.
The model response before execution cannot claim the measurement already occurred.
Successful fresh results become current mixAnalysis for future requests. This
extends the bounded workflow to at most two renders (one prerequisite and one
verification) and two model requests per submission under the existing five-minute
overall deadline. There is no extra model call for the verification report.

Canceling or failing verification keeps the already applied edit and clearly
reports that verification did not complete; the user can undo it. History captures
the exact post-command snapshot before verification starts, so intervening manual
edits are not attributed to the agent. Old measurement results are rejected if the
session changes during rendering. Model-request timeouts no longer incorrectly
say no edits were applied after an edit has succeeded. The log follows new output
when already at the bottom and preserves a user's scrolled-back reading position.

270 tests and build pass. Browser tests use real audio renders to verify a -12 dBFS
post-edit peak, current analysis display and conversation history, cancellation
after application, manual-edit races during verification, preserved undo and
scroll behavior. Existing conversation, cancellation, persistence-failure and
session-isolation checks pass. The verification report was visually inspected.
Model responses remain mocked; live inference, automatic corrective iterations,
per-track analysis, true-peak/LUFS and the broader DAW scope remain ongoing.

### Unsent agent instruction drafts

The instruction textarea now keeps account- and session-scoped drafts separately
from project documents, so mixer/selection changes, analysis and other redraws do
not erase typing or change the project revision. Drafts are stored on this device
under the account namespace, bounded to ten recently edited sessions and 6,000
characters each. Reload restores the current session's draft. Switching sessions
shows that session's own draft, never the previous project's instruction. Text is
escaped when rendered; drafts are not automatically submitted or sent to the model.
Storage failure retains text in memory and shows that the page must remain open.

A request leaves its instruction available while running. Successful replies or
applied edits clear only the unchanged submitted draft; typing a new instruction
while waiting protects the newer text. Failed/canceled/discarded requests retain
the draft for retry. Already-applied edits count as applied even if verification
fails, avoiding an automatic retry of an edit that already happened. Clear
conversation leaves unsent text alone. Draft storage does not persist model
conversation history or provide cross-device sync. Active textarea focus and
selection survive same-session redraws without overwriting newer draft state.

272 tests and build pass. Unit tests cover account/session isolation, reload,
version-aware clearing, limits and storage failure. Browser checks cover escaped
text, repaint/reload, caret selection, typing during a pending request, success,
failure, cancel, switching projects and memory fallback. The measured-edit and
post-edit verification browser workflow also passes. The draft indicator was
visually inspected. Live model verification and the broader DAW scope remain ongoing.

### MIDI phrase time scaling

Scale note timing in the piano roll changes spacing from either the first chosen
note or the region start. It supports all/selected notes, 6.25% to 1600% scaling,
and Double speed (50%) / Half speed (200%) presets. Scale note lengths is enabled
by default; disabling it changes onsets only. Preview counts changed notes and
shows the resulting phrase end. Notes that exceed the region reject the edit
unless Extend region to fit is enabled. That option grows the region only; it
never shrinks it or moves neighboring regions. Its existing fade-out therefore
moves later. Controllers, pitches, velocities, channels, tempo and other regions
stay unchanged. This edits MIDI timing, not audio time-stretching or tempo maps.

Shared notes.timeScale targets a MIDI region with required factor 0.0625..16,
anchor phrase/region (default phrase), scaleLengths (default true), extendRegion
(default false), and optional noteId or comma-separated noteIds. Onset formula:
anchor + (oldStart - anchor) * factor. Lengths scale only when requested. Results
must respect 3,600-second note and 86,400-second region limits; invalid selections
or values reject the entire batch. Chords retain aligned starts. It is one undo
step, persists normally and exports through MIDI. The agent prompt documents it.

279 tests and build pass. Unit checks cover chords, preserved metadata/events,
selection and anchors, lengths/onsets, region extension, rollback, undo/redo and
MIDI roundtrip. Browser checks exercise presets and custom input, selection,
validation, undo/reload and a real offline render showing the earlier note onset.
The controls were visually inspected. Live model configuration and the broader
DAW parity work remain ongoing.

Reference workflows: Apple's MIDI Double/Half Speed and piano-roll time handles:
https://support.apple.com/en-gb/guide/logicpro/lgcp215831be/mac
https://support.apple.com/en-ie/guide/logicpro/lgcp4a739b4b/10.7/mac/11.0

### Full-mix stereo compatibility measurements

Mix analysis now also reports stereo correlation, mono-average RMS and stereo-
difference RMS. A worker computes normalized cross-product sum(L*R) / sqrt(sum(L²)
* sum(R²)) over every rendered sample, without mean subtraction. Correlation is
null when either channel has zero energy. Mono average is (L+R)/2 and stereo
difference is (L-R)/2; their RMS includes the entire render, silence and tails.
Zero energy displays Silence. +1 means matching shapes, not necessarily equal
levels. Negative correlation indicates possible mono cancellation; complete
cancellation also requires matched amplitudes. These full-render values can hide
brief problems and are not a windowed correlation meter, LUFS or true-peak check.

Optional mixAnalysis.stereo is validated against channel RMS power and forwarded
to the agent with interpretation limits. Validation uses absolute error relative
to total energy to avoid unstable division with an extremely quiet nonzero channel.
Older measurement payloads without stereo data remain accepted; absent data is
never inferred. Revision checks and stale UI handling apply to all measurements.
The render-worker helper now returns {channels,stereo}; it still transfers copies
and terminates on completion, error or cancellation.

282 tests and build pass. Unit cases cover identical, opposite-polarity, unequal-
level, uncorrelated and silent channels, invalid inputs, power consistency,
extreme level imbalance and agent forwarding. Browser renders verify a centered
mono signal and an inverted-right master utility producing -1 correlation with
silent mono fold-down, plus worker errors/cancellation and existing normalization.
Agent-requested analysis and post-edit verification also pass. That browser check
now waits for fonts before asserting scroll geometry. The panel was visually
inspected. Live inference, momentary correlation and broader DAW parity remain open.

Reference: Apple's correlation meter and mono compatibility guidance:
https://support.apple.com/en-ca/guide/logicpro/lgcef24f430f/mac

### Stretch a complete MIDI region

The MIDI region inspector now includes Stretch MIDI region. Enter a new duration
or use Half length / Double length, review the note/controller count and apply.
All note onsets/lengths, every MIDI event timestamp, fades and the region duration
scale together relative to its existing start. Sustain, pitch bend, expression,
program changes and pressure retain their relative timing and original values.
Timeline start, source offset, pitches, channels, velocities, project tempo,
track/master automation and neighboring regions stay unchanged. Expansion can
overlap another region; this is not ripple editing. Instrument envelope times and
effect delays remain in seconds. Undo restores the entire original region.

Shared region.timeScale accepts only factor 0.0625..16 and a MIDI-region target.
It validates region/note/event limits before committing the atomic batch. Fades
are bounded against tiny floating-point rounding at the new region edge. Empty
MIDI regions can also be resized. Audio/video regions reject this operation; the
existing notes.timeScale remains available for notes-only selected-phrase edits.
The agent prompt explains which command includes controller data.

285 tests and build pass. Unit checks cover event types/channels/values, notes,
fades, unchanged neighboring regions and automation, invalid factors/limits,
non-MIDI targets, undo/redo and MIDI roundtrip. Browser checks verify inspector
presets/custom lengths, validation, persistence, and a real synth render proving
that sustain-pedal timing stretches with the notes. The inspector was visually
inspected. Audio stretching, graphical time handles, tempo maps and broader DAW
parity remain ongoing; live model access is still unconfigured locally.

Reference: Apple's MIDI region time-stretch workflow:
https://support.apple.com/en-gb/guide/logicpro/lgcpf7c0ebee/10.7/mac/11.0


### Optional integer WAV dither

Export settings now offer None (default) or Triangular (TPDF) dither for 16- and
24-bit PCM. Mix, stem, cycle-range and selected-region bounces share this setting.
The setting remains local to the current workspace instance; it does not change
the project, playback, mix analysis or recording dither defaults. Selecting
32-bit float disables the control and skips dither, while retaining the integer
preference for switching back. No noise shaping or automatic normalization is
performed. Prefer float for intermediate mixes when preserving headroom matters.

The encoder adds the difference of two independent uniform random values in
integer LSB units before rounding, then clamps to signed PCM limits. Integer
encoding now uses uniform 2^(bits-1) scaling on both sides of zero (previously
positive samples used one less), avoiding a polarity-dependent quantizer step.
This correction also applies to non-dithered recordings; existing recordings
are unchanged. Independent samples/channels receive independent noise, including
silent sections. Repeated dithered exports are intentionally not bit-identical.

Validation: all 287 tests and the production build pass. The export settings
were visually inspected. Unit checks cover sub-LSB signal mean, noise variance, channel
independence, clipping, headers and float bypass. Browser checks inspect actual
16/24-bit downloads and confirm float exports ignore dither; the existing stem
routing, master bypass and mix reconstruction checks remain in the same script.
The browser script spaces its many downloads to avoid rapid-download throttling.

Reference: Apple's PCM bounce controls include dither for integer bit-depth
reduction. This implementation uses plain TPDF, not Apple's proprietary options:
https://support.apple.com/en-ie/guide/logicpro/lgcpb7e35135/10.7/mac/11.0


### Chromatic and scale-step MIDI transposition

The piano roll now has a Transpose notes panel instead of the fixed +1-semitone
button. Choose all notes or the current selection, enter a signed semitone or
scale-step shift, preview the affected count, then apply. Octave presets set
±12 semitones or one complete scale cycle (7 degrees in major/minor, 5 in
pentatonic, 12 in chromatic). They set the shift and do not immediately edit.
The controls validate before applying and disable empty, fractional, no-op,
missing-selection and out-of-range edits. Octave actions stay grouped when the
form wraps. Manual edits persist normally and are one undo step.

The existing notes.transpose command retains {semitones} compatibility and now
accepts optional mode=chromatic plus noteId or comma-separated noteIds. Diatonic
mode instead requires {mode:'diatonic',steps,root,scale}; root is 0..11, scale uses
the existing scale names and steps is an integer -127..127. Each degree advances
to the next allowed pitch, crossing octave boundaries. All selected pitches
must already be in the chosen scale; use the separate Key & scale tool first
when intentional snapping is wanted. Invalid inputs or any result outside MIDI
0..127 reject the entire batch rather than clamp. Audio/video targets reject.
Timing, velocity, channel, note IDs, MIDI controller/pressure events and unrelated
notes remain unchanged. Drum-kit pitches also identify instruments; transposing
them changes the drum sounds. This edits note data, not a live transpose insert
or a non-destructive global transposition track. The agent prompt describes the
same shared command and selection semantics; live model access remains
unconfigured locally.

291 tests and production build pass. Unit coverage includes all supported scales
in all 12 keys, octave crossings, legacy/selected operation, metadata and event
preservation, invalid batch rollback, undo/redo and MIDI export roundtrip.
Browser checks verify visible controls and validation, selected/all scope,
persistence, undo/redo and real offline sine renders (C4 to D4 for one C-major
step). The panel was visually inspected and its octave buttons grouped after
checking the wrapped layout.

Reference workflow: Apple's transposer combines pitch shifting with key/scale
controls; the implementation above operates on selected stored notes:
https://support.apple.com/en-bn/guide/logicpro/lgceee5a5e6f/10.7/mac/11.0


### Join MIDI regions

The MIDI region inspector now has Join MIDI regions. Choose other regions on the
same track individually, or Select all; Clear empties that selection. The
selected region remains the target and retains its ID and name. The preview
shows the combined duration, note/event counts, and flags differing source
region settings and controller state. The resulting span includes gaps and
overlaps. Other chosen regions are removed in the same undoable operation.

Shared region.joinMidi targets the retained region and accepts regionIds as a
comma-separated list of distinct ADDITIONAL IDs (exclude the target). Notes and
events retain IDs, pitch/value/channel, duration and absolute timeline position;
only their region-relative starts change. Source regions sort by timeline start,
stably in existing track order for ties; merged events then sort stably by time.
Thus later-starting source regions win equal-time controller ties. Target gain,
mute and fade settings apply across the combined span; other source region
settings are not baked into note velocities. MIDI source offset is reset to zero.

Joining combines region-local controller streams into one stream per channel.
Sustain, expression, pan or pitch bend can therefore affect notes that used to
belong to another region. This is editable MIDI consolidation, not guaranteed
sound-identical rendering. The UI and agent prompt make both controller and
region-setting behavior explicit. Undo restores every source region and its
settings. Audio/video and cross-track joining remain outside this operation.
Limits (20,000 notes and 20,000 events, 86,400-second region length), missing IDs,
duplicates and wrong tracks reject the entire command batch before committing.

295 tests and production build pass. Unit checks cover target identity, note and
event timing/IDs, overlapping and tied events, metadata, limits/atomic rollback,
undo/redo and MIDI roundtrip. Browser checks cover individual/all/clear selection,
preview warnings, persistence and undo/redo. Real offline audio renders verify
unchanged playback for ordinary note-only joins and the expected expression
change when two formerly separate regions share controller state after joining.
The inspector layout was visually inspected. Live model access remains
unconfigured locally; the validated shared command is available to that harness.

Reference: Apple's region-join workflow:
https://support.apple.com/en-om/guide/logicpro/lgcpaa45acde/mac


### Sustain-aware MIDI splits

Fixed Split at playhead / region.split dropping notes whose MIDI key release was
before the cut while CC64 still held them. MIDI splits now share the trim/crop
helper: the right region contains a new note at its start for each still-held
voice, plus chased controller and pitch-bend state for its own channel. Notes
that already stopped, including a pedal release exactly at the cut, do not carry.
Ordinary crossing notes retain their remaining gate length. Events exactly at
the cut belong on the right; left-side IDs remain and right-side IDs are fresh.
Outer fades are retained within the respective region lengths, internal fades
are zero and MIDI source offsets become zero. Audio/video splitting is unchanged.

Very long carried holds cap their new MIDI gate at 3,600 seconds to respect the
individual-note limit; the retained pedal stream sustains them to the original
release. The same improvement applies to MIDI cropping. Splitting is still
rearticulation at the cut (new oscillator/sample/envelope), not seamless audio
continuity. Undo restores the unsplit performance; this limitation is also
explicit in the agent instructions.

299 tests and build pass. Unit checks cover channel-isolated sustain, release at
the cut, crossing and exact-start notes, chased pitch bend, fresh IDs, fade
boundaries, long holds, invalid batch rollback, undo/redo and MIDI export.
Browser checks exercise the actual Split at playhead button and render real
Web Audio: the held note continues after the cut, ends at the original release,
and seeking inside the right region also restores sustain correctly. Reload
persistence and undo/redo pass. No physical MIDI hardware or live model call was
used for these checks.


### Workspace keyboard controls

Experimental now includes a collapsible Keyboard shortcuts reference and an
Enable workspace shortcuts switch. The switch is account/device scoped in
local storage (guest has a separate key), survives reload and does not change
the project document or revision. If preference storage fails, its in-memory
value still works for the current visit. Native buttons remain keyboard usable
when workspace shortcuts are off.

Space toggles play/pause; Home stops and returns to zero. Cmd/Ctrl Z undoes and
Cmd/Ctrl Shift Z redoes; Ctrl Y is also accepted. With the arrangement or region
inspector active, S splits at the playhead, D duplicates the selected region,
and Delete/Backspace deletes it. Track selection alone does not enable deletion.
In the piano roll, D and Delete apply to selected notes through the existing
selection buttons. The last clicked/focused editor determines this scope even
when a repaint moves browser focus to the body. Clicking another area clears
editing scope. Existing controller/automation/note keyboard handlers retain
priority through defaultPrevented; common browser shortcuts such as Cmd/Ctrl T,
D, S, R and W are not reassigned.

The document listener ignores text/select/range/contenteditable fields (including
shadow event paths), composition, Alt/unsupported modifiers, open dialogs and
unrelated focused controls. Space on buttons or summaries remains native. It
suppresses held-key repeats, pauses during pointer gestures/recording/loading,
and detaches when leaving the workspace. Reopening installs one listener set.
Shortcuts call existing UI buttons so validation, undo, selection and error
handling match mouse actions. This does not add transport tools to the model
or a customizable key-map editor; those remain separate future work.

301 tests and build pass. Browser checks cover actual region/note duplication
and deletion, split, both undo/redo modifier families, live transport changes,
Space button activation, text/IME/modal guards, repeat suppression, disabled
preference persistence, busy and detached-root gating, navigation cleanup and
remount. The shortcut reference was visually inspected. Browser transport used
synthetic session audio, not physical recording devices.

Reference transport workflow:
https://support.apple.com/guide/logicpro/use-transport-key-commands-lgcp2814a670/10.7/mac/11.0


### Agent transport tool

The agent harness now offers control_transport when the browser explicitly sends
allowTransport plus a validated current transport snapshot. Actions are play,
pause, stop and seek. position is required as either absolute seconds 0..86400
or null: seek requires a number, pause/stop require null, and play accepts either.
Play(null) resumes the current position and is idempotent during playback.
Play(number) starts at that position. Pause keeps the playhead; stop returns to
zero; seek pauses at the requested position. Cycle settings remain active, and
the browser reports the actual start if the cycle redirects playback. Linear
playback rejects starting at or beyond the arrangement end.

This strict tool is separate from edit_session and analyze_mix: at most one tool
call is accepted per model response, and the browser rejects mixed edits/actions.
Transport does not change the document, revision or undo stack. The resulting
conversation entry is a reply with the browser-generated transport report and no
edit deltas. Recording, exports, undo and combined edit-plus-play sequences are
not implemented by this tool. Existing analysis/edit verification still works.

The server checks transport session/revision and echoes its epoch; the browser
compares it before execution. Manual play/pause/stop/seek or project replacement
invalidates a delayed transport plan. Natural playback progress alone does not.
Region double-click seeking now also stops/repositions through the transport
invalidation path. Existing recording/busy guards apply. Cancellation races
against decode, AudioContext.resume and cycle rendering, observing late failures
while preventing late results from scheduling playback. A canceled startup may
leave the requested playhead position selected; the report states the actual
current transport. It does not silently undo a later manual transport action.

304 tests and build pass. Unit checks cover opt-in/strict schemas, mismatched
context, invalid/mixed tool calls and cancellation of delayed promises. Browser
checks use real Web Audio and mocked model responses to verify seek/play/pause/
stop, idempotency, actual-result reports, conversation, unchanged document/undo,
stale-response rejection after a manual seek, canceled delayed context startup,
arrangement bounds and cycle redirection. The existing analysis/normalization/
post-edit verification browser regression passes. Config-only preflight confirms
OPENAI_API_KEY and DAW_AGENT_MODEL remain absent locally, so live inference has
not been verified and no provider request was made by that preflight.

Reference: OpenAI function-calling schema/tool execution guidance:
https://developers.openai.com/api/docs/guides/function-calling


### Ordered agent edits followed by transport

edit_session now accepts optional afterEditTransport when the client enables
transport. It uses the same validated operation/position shape as
control_transport. This supports requests such as lowering a track and then
playing from a requested time, without another user turn. The model is instructed
to add follow-up playback only when explicitly requested. Clients without the
capability do not receive that parameter in their tool schema, and a returned
unsupported follow-up is rejected. Multiple separate tool calls in one response
remain invalid; an ordered edit batch plus one transport action is one plan.

The browser validates the follow-up before applying any commands, checks both
document and transport freshness, then applies the edit batch once. Requested
mix verification (and mandatory master gain verification) finishes before the
follow-up. Manual playhead changes during verification suppress follow-up
transport, even though analysis itself is valid for the unchanged document.
Manual document changes similarly prevent starting playback of a stale edit.
Transport executes through the same helper as standalone transport requests.

Applied edits remain undoable if verification or playback fails or is canceled.
The result clearly distinguishes an applied edit from an incomplete follow-up;
conversation records retain the actual post-edit snapshot rather than attributing
later manual changes to the agent. Playback adds no undo entry. Successful
reports append the actual browser transport result. This supersedes the previous
requirement for separate edit and playback turns; arbitrary multi-step tool
loops, recording/export actions and live provider verification remain ongoing.

305 tests and build pass. Unit checks cover capability-gated schema exposure,
follow-up validation and command validation. Browser checks use mocked model
replies with real Web Audio to verify edit/analysis/play ordering, one-step undo,
invalid follow-ups rejected before editing, stale transport plans, verification
failure, manual seek during verification, canceled playback startup preserving
the edit, actual conversation attribution, and edit-then-seek. Existing
standalone transport and analysis regressions also run. Local model credentials
remain unconfigured; these are harness/execution checks, not live inference.

### Agent WAV and stem exports

The browser now advertises an opt-in export_audio tool. Explicit requests can
bounce the full mix, aligned track/output-group stems (ZIP), one audio/MIDI
region, or a time range. It uses the existing manual bounce plan and renderer;
there is no alternate DSP path. Strict settings support 44.1/48/96 kHz,
16/24-bit PCM or 32-bit float, dither, stem grouping and master bypass modes.
Null settings inherit the settings captured when the instruction was submitted;
explicit settings supply all fields without changing the UI preferences. A null
region ID uses the captured selected region. Null range boundaries use the
captured cycle range; explicit boundaries must be supplied together.

The server validates capability, context, target and render limits before
returning an action. The browser validates again, rejects mixed edit/transport/
export responses, and guards document identity/revision before download. A
prerequisite analysis may precede export, but edit-then-export is not implemented.
Export adds no document revision or undo entry. It stops playback to render.
Cancel/navigation stops waiting for decoding/rendering/ZIP generation and
prevents late results from downloading; underlying browser work may finish.
Success reports “Download started” rather than claiming a filesystem save.
The existing ten-minute render limit and shared nonlinear stem-processing
limitations apply. Export does not require a fresh live meter reading.

307 unit tests and build pass. Browser checks use mocked model replies with real
Web Audio/downloads: mix, stems, range and region, WAV rate/depth/range length,
ZIP contents, unchanged session/undo behavior, cancellation during delayed render
and stale-model response rejection. Existing manual bounce checks pass, including
dither, master bypass, grouped stem alignment and mix reconstruction. Live model
inference remains unverified without local provider credentials.

### Ordered agent edits followed by export

edit_session now offers afterEditExport when the browser advertises allowExport.
It uses the standalone export_audio argument shape. The tool schema hides it
for clients without that capability, and unsupported replies are rejected.
Export and transport follow-ups are mutually exclusive. The prompt requires an
explicit export request and forbids claiming completion before browser execution.

Both server and browser validate the export against a simulated edited document
before applying the batch. Missing/deleted region targets, invalid ranges and
render limits reject the whole plan. Actual rendering uses the actual applied
snapshot, not the simulated document (new IDs may be generated during edits).
Inherited settings and selected region ID come from the original request; an
inherited cycle range comes from the edited document. Selected-region context is
irrelevant for a mix, so deleting that selection does not block mix export.

Verification runs before export when requested or required for master gain.
Failed verification prevents download but preserves the undoable edit. Likewise,
cancellation, render failure or changed project state suppresses the follow-up
without reversing applied edits. Conversation reports retain the real applied
snapshot and distinguish an applied edit from an incomplete export. Export adds
no undo entry. This supersedes the earlier separate-request limitation; arbitrary
multi-action loops and live provider validation remain unfinished.

308 tests and build pass. Browser checks use mocked model responses and real
Web Audio/WAV downloads to verify a -6 dB edit in exported PCM, verification before
export, one-step undo, invalid target rejection before edits, verification failure
and canceled delayed render with no late download. Existing ordered transport and
standalone export regressions are also checked. Live inference remains unverified.

### Agent undo and redo

The opt-in navigate_history tool executes undo/redo against the same in-memory
SessionHistory used by the toolbar. Strict arguments are operation (undo/redo)
and steps (integer 1..100). The request supplies session/revision and available
undo/redo counts, without historical documents or source media. The server checks
capability, context and availability; the browser rechecks identity/revision and
both stack depths before execution. Invalid counts reject the whole action.

Each original command batch is one step, including manual edits. Multiple steps
execute synchronously after validation, using the existing revision increments;
no inverse command batch or extra undo entry is created. Playback stops, and
recording/busy guards apply. Redo is available after agent undo; a new manual or
agent edit clears it normally. History is still memory-only and resets on reload.

The prompt allows this tool only for explicit undo/redo requests and warns that
counts do not identify historical operations. It must not infer step counts from
conversation or claim selective undo of an older agent action. History runs alone
without edit/export/transport follow-ups. Actual changes and completion are added
to conversation as applied outcomes. A canceled/stale model reply does not touch
history. Cancellation cannot interrupt the short synchronous history application.
If local persistence fails after application, the applied snapshot remains recorded
as applied, with the persistence failure reported rather than a false rollback.

310 tests and build pass. Unit coverage checks atomic count rejection, revisions,
redo branching, strict schemas and capability/context checks. Browser coverage
uses mocked model replies and real workspace history/playback to check multi-step
undo, redo, toolbar interoperability, actual conversation deltas, insufficient
counts, manual edits during planning, cancellation and stopping playback. The
ordered edit/export browser regression also passes. Live inference is unverified.

### MIDI velocity ramps

notes.velocityRamp targets a MIDI region with from/to normalized velocities 0..1,
optional curve linear/easeIn/easeOut, bounds phrase/region, and noteId or CSV
noteIds. Phrase bounds run from first to last chosen onset; region bounds run
from zero through region duration. Values are based on elapsed time rather than
note index, so unequal spacing and simultaneous notes are handled consistently.
A phrase with only one onset uses from. Zero silences notes. This changes attack
velocity, not expression during a sustained note. Other note fields, MIDI events,
region settings and unselected notes remain unchanged; invalid batches roll back.

The piano roll has a Velocity ramp panel with all/selected scope, 0..127 endpoint
inputs, curve and bounds selectors, Reverse ramp, and a live SVG bar preview.
Controls show affected counts and disable invalid/no-op submissions. Apply runs
the shared command as one undo step. Settings survive workspace repaint; project
velocities persist normally. The model tool prompt documents units, selection,
held-note limitations and the requirement not to invent endpoint levels.

314 tests and build pass. Unit checks cover curves, descending ramps, chords,
region/phrase bounds, selected/single onsets, atomic validation, unchanged fields,
undo/redo and MIDI export velocities/channels/timing. Browser checks cover the
panel, preview, selection, validation, velocity lane synchronization, undo/redo,
reload and actual offline audio peaks. The panel screenshot was visually checked.
Live model inference remains unverified without configured provider credentials.

Reference: Apple Logic Pro MIDI Transform presets (Crescendo):
https://support.apple.com/nl-nl/guide/logicpro/lgcp215831be/mac

### Separate MIDI by pitch or channel

region.separateMidi targets one MIDI region with by=pitch (default) or channel.
It creates independent tracks immediately after the source, ordered by numeric
pitch/channel. The source region remains intact and is muted; other regions on
its track are untouched. Undo restores the entire operation in one step.

Pitch copies contain notes of that pitch, controller/bend/program/channel-pressure
events on those notes' channels, and poly-pressure events matching that pitch.
Channel copies contain all notes/events on that channel, including event-only
channels. Note times, channels, velocities, region start/length/gain/fades and
mute are retained. Empty pitch regions reject. The total 128-track limit is checked
before mutation. Copies use fresh IDs for all editable children, preserve asset
references, instrument/sampler settings, track mute/solo, routing, sends, effects
and automation. Source track effects become independent copied chains, so nonlinear
processing may change the combined sound. This is MIDI organization, not audio
source separation or shared-channel-strip identity with Logic Pro.

The inspector provides pitch/channel choices, a preview of resulting track names,
and a single Separate MIDI button. The agent uses the same command. 318 tests
and build pass. Unit checks cover source preservation, ordering, controller and
pressure filtering, event-only channels, fresh IDs, routing/sample/effect settings,
undo/redo, invalid arguments and track limits. Browser checks cover both modes,
real linear playback equivalence, undo/redo and reload. Visual inspection caught
and fixed inherited inspector grid layout; the final panel was inspected again.
Live provider inference remains unverified.

Reference: Apple Logic Pro demix MIDI regions:
https://support.apple.com/guide/logicpro/demix-midi-regions-lgcpf7c0f28c/mac

### Sampler per-voice filters

Tracks now persist sampleFilterType (off/lowpass/highpass, default off),
sampleFilterCutoff (20..20000 Hz, default20000), sampleFilterResonance (-20..30 dB,
default0), and sampleFilterKeyTrack (0..1, default0). Shared track.add/track.set
commands validate these fields, and the agent prompt documents them. Existing
projects parse with bypass defaults. Copy/separate/archive/project persistence
use the same track schema and preserve settings.

Each sampled note optionally passes through a second-order 12 dB/octave filter
before its amplitude envelope. Low/high-pass resonance uses Web Audio Q's dB
interpretation. Key tracking scales cutoff relative to sampleRoot by
2^((pitch-root)/12 * tracking), clamped to 20 Hz..20 kHz and below Nyquist.
Pitch bend changes sample playback pitch but does not modulate filter cutoff.
Off creates no filter node, retaining the prior signal path. The same filter
factory is used for arrangement/offline exports and live MIDI monitoring; voice
cleanup disconnects the filter. Filters are static per voice, with no modulation
envelope or automation yet. Seeking starts fresh filter state, as other existing
DSP seeks do; it does not reconstruct prior filter history.

The sampler inspector includes filter type, cutoff, resonance and percentage
tracking controls applied with the other sampler settings in one undo step.
320 tests and build pass. Unit checks cover old-project defaults, validation,
undo/copy/bounce settings, tracking intervals and Nyquist limits. Browser checks
use real offline audio with low/high-frequency tones to measure attenuation and
pass-band preservation, check bypass creates no node, compare live monitoring,
verify voice cleanup and UI undo/redo/reload. The panel was visually inspected;
the previous sampler-envelope browser regression also passes. Live inference and
physical MIDI hardware remain unverified.

References:
https://support.apple.com/guide/logicpro/synth-pane-lgcp24400b22/mac
https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode/Q

### Sampler coarse and fine tuning

track.add/track.set now support sampleTune (integer -48..48 semitones) and
sampleFineTune (-100..100 cents), defaulting to zero for existing projects.
The sampler form applies them with the other instrument settings in one undo
step. The agent prompt exposes units and clarifies that tuning changes sample
playback speed, not MIDI pitches, source media, root mapping or ADSR duration.
Filter key tracking continues to use MIDI pitch relative to the original root.

One shared playback-rate calculation combines note/root mapping, semitones and
cents. Arrangement rendering and live MIDI monitoring use that rate; pitch bend
continues multiplying it through detune. Seek offset integration uses the same
rate across prior bend events, then wraps source-time loops. Higher tuning can
exhaust an unlooped sample sooner; this does not perform time stretching.

322 tests and build pass. Unit checks cover tuning composition, bend-integrated
seek offsets, loop wrapping, defaults, validation, undo and copies. Browser
checks use real sampled audio to measure octave, cents, combined tuning, pitch
bend and live monitoring frequencies, plus UI undo/redo/reload. Whole-frame
looped seeks match uninterrupted rendering exactly in the test. Fractional-frame
seeks differ within one source-frame phase bound: the observed difference matches
rounding the requested source offset in Chromium, so no sub-sample seek precision
is claimed. Sampler-filter browser regression passes. The form was visually
inspected. Live model inference and physical MIDI hardware remain unverified.

### Multi-region arrangement selection and movement

Ctrl/Cmd-click toggles region selection across audio, MIDI and video tracks.
Selected regions have shared visual/aria-pressed state. Clicking without modifiers
selects one, keyboard activation selects a region, and track selection or session
replacement clears the group. Selection is transient, filtered after edits and
limited to 1,000 regions; it is not saved with the document.

Dragging the body of a selected group moves all its regions horizontally on their
existing tracks, with spacing preserved. Delta snapping uses the existing quarter-
beat subdivision; Shift bypasses snapping. Timeline boundaries clamp the common
delta, never individual members. Canceling a pointer gesture restores preview
positions without editing. Single-region drag across compatible tracks, trim and
fade handles remain available. Trim/fade gestures select and edit only that
region. The inspector labels its individual controls Primary region when a group
is selected, and provides a separate group move-by-seconds form and clear button.
Other individual actions still operate on the primary region; group delete/copy
and marquee selection are not implemented yet.

regions.move is the shared atomic command: values regionIds (CSV, 1..1000 distinct
existing IDs) and seconds (-86400..86400). All resulting start times must remain
0..86400 or the complete batch rejects. It keeps tracks, source offsets, region
content/settings and spacing intact. Track automation and markers stay fixed;
there is no ripple and overlaps are allowed. The agent receives validated
selectedRegionIds separately from piano-roll selectedNoteIds and may use the same
command. Old clients without arrangement selection continue to work.

325 tests and build pass. Unit checks cover mixed-kind moves, metadata preservation,
atomic rejection, clamping, undo and agent selection validation. Browser checks
cover modifier toggles, group form/drag, boundary clamping, unsnapped Shift moves,
gesture cancellation, undo, agent request context, keyboard selection and reload.
Existing single-region cross-track move and trim/fade/playback regressions pass.
The group inspector was visually checked. Model responses remain mocked.

### Group duplicate/delete and arrangement shortcuts

regions.duplicate and regions.delete accept regionIds (CSV, 1..1000 distinct
existing IDs). Duplicate accepts optional seconds (-86400..86400); the default is
latest selected end minus earliest selected start, placing the copies after the
complete group. Spacing, tracks, source media references, region settings and
notes/events are preserved; region/note/event IDs are renewed. Overlapping copies
are allowed. Starts must remain 0..86400 and each track must stay within 1,000
regions. All targets and capacities are validated before adding copies. Delete
removes only the selected regions, keeping tracks, media and automation. Both
commands are atomic, undoable and documented in the agent prompt.

The group inspector offers duplicate/delete buttons. Manual duplication selects
the new copies; deleting clears the selection. D and Delete/Backspace use these
buttons when the arrangement has multiple selected regions. Piano-roll shortcuts
still take priority for selected notes, and form inputs remain excluded. Other
primary-region controls remain individual. This supersedes the prior group-copy/
delete limitation; marquee selection and clipboard workflows are still unfinished.

328 tests and build pass. Unit checks cover group span/explicit offset, mixed
tracks, preserved content/media, fresh IDs, delete semantics, undo and atomic
failures for missing targets, timeline bounds and track capacity. Browser checks
cover buttons and shortcuts, copied selection, repeated duplication, undo/redo,
text-field/piano-roll isolation and reload. Existing group drag/clamp/cancellation
regression also passes. The updated inspector was visually inspected. Live model
inference remains unverified.

### Arrangement marquee selection

Dragging empty track-lane space creates a box selecting intersecting rendered
region rectangles across all track kinds. Reverse-direction drags work. Shift,
Ctrl or Cmd adds to the captured selection; normal drags replace it. Empty clicks
clear unless additive. Escape, pointer cancellation and lost capture restore the
previous selection. Ruler controls and region/handle gestures are excluded, as
are busy/recording states. Touch is excluded to preserve scrolling; mouse and pen
are supported. Selection changes no document revision or undo history.

Hit testing uses timeline-local coordinates derived from actual DOM rectangles,
including horizontal scroll and the rendered minimum region width. The box gives
live class/aria-pressed feedback and a polite live selection count. Hint height is
held during the gesture to prevent moving the timeline beneath the pointer.
A requestAnimationFrame loop scrolls horizontally near viewport edges and updates
hits. Release/cancel/removal cleans up capture, handlers and animation. More than
1,000 hits rejects the selection without truncating or replacing the previous
one. The selected IDs feed existing group actions and agent context.

330 tests and build pass. Pure checks cover intersection directions, boundaries,
additive deduplication, replacement and selection limits. Browser checks cover
normal/additive/reverse boxes, Escape and pointer cancellation, empty clicks,
horizontal auto-scroll to distant regions, scrolled hit testing, unchanged saved
document and one-step group duplication undo. Existing group drag/cancel and
duplicate/delete shortcut regressions pass. A live marquee screenshot was visually
inspected. This supersedes the earlier missing-box-selection note; clipboard and
broader arrangement workflows remain unfinished.

### Arrangement region clipboard

Copy/Cut/Paste at playhead controls now sit above the arrangement. Ctrl/Cmd C/X/V
operate on arrangement regions, while text fields, selected page text, and the
piano-roll editing context retain their native behavior. The clipboard is an
immutable in-memory snapshot of 1..1000 selected regions, limited to 10 MiB UTF-8.
It is isolated to the active session/history and clears on replacement or reload;
it neither reads nor writes the OS clipboard. Copy changes no document state.
Cut snapshots first, then uses the atomic regions.delete command.

regions.paste accepts original clipboard JSON data and absolute position seconds.
The payload contains version1, source sessionId and entries with original trackId,
kind and full region snapshots. Shared region schemas validate content. Paste
requires the same session and still-existing compatible destination tracks. It
aligns the earliest copied start to the playhead while preserving relative spacing,
source offsets, media references and region content/settings. Editable IDs are
renewed. All track capacities and timeline starts are validated before insertion.
Track settings remain current rather than being copied. Missing source tracks
reject the entire paste; undoing their deletion makes paste possible again.

Manual paste captures the current transport position, stops playback via execute,
and selects the new regions. Cut and paste each use one undo step; the clipboard
survives ordinary edits/undo and subsequent pastes. The agent command description
allows regions.paste only with explicitly supplied original clipboard data; a
browser clipboard tool/context is now available as described below.

333 tests and build pass. Unit checks cover immutable snapshots, independent IDs,
media/timing preservation, cut/paste undo, malformed/cross-session/missing-track
payload rejection and shortcut mappings. Browser checks cover buttons and keyboard
copy/cut/paste, playhead alignment, new selection, undo, field/piano isolation,
retained saved content and transient clipboard reload. Marquee and group-action
regressions pass. The toolbar was visually inspected. Live inference is unverified.


### Agent session clipboard

The capability-gated region_clipboard tool accepts one copy/cut/paste action.
Strict schemas validate operation, nullable regionIds and nullable position.
Copy/cut resolve captured selection when IDs are null; paste uses the captured
playhead when position is null. Requests include matching session/revision,
clipboard epoch/count, and transport position/epoch, never the clipboard payload.
The browser checks clipboard freshness for every action and transport freshness
for paste, including explicit-position paste. Document freshness and cancellation
checks still apply. Mixed edit/follow-up responses are rejected.

Manual and agent operations share performRegionClipboard: copy changes no document,
cut and paste each create one undo step; actual operation results and document
changes populate conversation history. Missing original tracks reject paste atomically.
Clipboard replacement increments its epoch even when document revision is unchanged.
The clipboard clears on session replacement, remains transient, and never uses the OS
clipboard. These actions currently require separate agent requests.

335 unit tests and production build pass. Browser checks cover agent copy/cut/paste,
captured and explicit positions, shared undo/redo, actual conversation outcomes,
clipboard/playhead race rejection, cancellation, mixed response rejection and missing
track rejection. Manual clipboard browser regression also passes. Responses are mocked;
live model inference remains unverified. The existing build chunk-size warning remains.

### Committed MIDI arpeggiation

Apple reference: https://support.apple.com/en-qa/guide/logicpro/lgce129c3fbe/mac
Logic's arpeggiator provides note order, rate and octave controls; its Up/Down
order repeats both endpoints. Cuestamp now implements an editable-note transform,
not the live MIDI insert, latch, remote controls, inversions or pattern sequencer.

notes.arpeggiate targets a MIDI region. Values: rate in quarter-note beats
(.125..4, default .25), gate as fraction of a step (.01..1, default .8), order
up/down/upDown/asPlayed, octaves 1..4 upward, optional noteId or CSV noteIds.
Omission selects the whole region. Exact same-onset, same-channel notes form a
chord. The pattern restarts at each selected chord, ending at the earliest of
its longest source note end, the next selected chord in that channel, and region
end. Shorter notes in a chord remain members of that chord's pattern. As played
uses document order for simultaneous notes, independent of selection click order.
Staggered starts are separate chords. Output inherits source velocity/channel.

The pure plan prevalidates pitch and 20,000-note capacity limits. The shared
atomic command replaces only chosen notes and gives generated notes fresh IDs;
controller events, unselected notes, region settings and tempo remain unchanged.
Rate is resolved using current project tempo; later tempo changes do not retime
committed notes. Sustain/controller processing can extend their audible length.
Undo restores source chords. The piano-roll form shows a note preview (first
1,000 generated notes at most) and counts before applying, and shares validation
with the server agent's command simulation.

340 tests and build pass, with the existing chunk-size warning. Unit checks cover
rate/tempo, gate, order, octave bounds, chord changes, channels, partial selection,
region bounds, capacity/invalid-input rejection, preserved controllers, fresh IDs,
undo/redo, MIDI export timing and mocked agent planning. Browser checks cover UI,
preview, validation, selected chords, order/range/gate, persistent output, undo/redo
and real offline PCM with eight gated notes. The form was visually inspected.
Live model inference and physical MIDI hardware remain unverified.

### Region bounce in place

Reference: https://support.apple.com/en-kw/guide/logicpro/lgcp8ae5826e/mac
The audio/MIDI region inspector now has Render to audio → Bounce in place.
It renders the selected region into a new audio track directly below its source,
keeps and mutes the original region, and commits both changes in one undo step.
It uses stereo 32-bit float WAV at the chosen export sample rate, without dither
or normalization. Rendering and saving media happen locally; Save to account and
project archives include the generated file through existing asset references.

regionBouncePlan isolates the region and source instrument/insert effects,
including region gain/fades/reverse, effect automation and estimated effect tails.
It renders at the original region start with fresh DSP, omitting all other regions.
Track gain, pan, their automation, sends and output routing are excluded from the
render and copied to the destination with renewed editable IDs. Destination
inserts are cleared and region gain/fades/offset/reverse reset to avoid applying
processing twice. Bus and master processing stay live. Overlapping regions through
nonlinear source inserts can sound different when rendered independently; prior
DSP history is not reconstructed. A muted source region is rejected; track mute
and solo are retained on the new track. The current action always keeps/mutes the
source and uses a new track rather than offering destructive source deletion.

region.commitBounce is the internal shared atomic command after media exists.
It validates region eligibility, 128-track capacity and expected rendered duration
(with one-frame tolerance) before insertion. Agent edit_session rejects this
command: the model must use the capability-gated bounce_region_in_place tool.
Its strict nullable regionId/sampleRate arguments default to the captured selected
region and export rate. The browser and server validate the same plan. This tool
is a standalone action, not a download or an edit-plus-export follow-up.

Document/history identity and revision are rechecked after async work. Agent
cancellation prevents late commits. IDB media is written before document changes;
a local document-save failure restores the history stacks and document and removes
the new asset. Stale/cancelled operations clean up their own new asset (best effort
if IndexedDB itself fails). Undo keeps the asset for redo. Generated files are
limited to 250 MB so they can decode after reload, in addition to the 10-minute
render limit; 96 kHz long regions may need a lower rate.

345 unit tests and build pass, retaining the existing chunk-size warning. Checks
cover plan isolation, routing/settings/ID preservation, atomic undo, eligibility,
size/duration validation and mocked agent tool validation. Browser verification
covers stereo PCM equivalence for linear inserts/routing, local media/reload,
undo/redo, failed document-save rollback and asset cleanup, cancellation during
render, and manual edits during a pending render without falsely attributing them
to the agent. Inspector control was visually inspected. Live model inference and
physical hardware remain unverified.

### Stereo tremolo insert

Reference: https://support.apple.com/en-ie/guide/logicpro/lgcef266d9be/mac
Tremolo is now available on track, bus and master insert chains through the mixer
and shared effect.add/effect.set commands. Schema defaults: kind=tremolo,
rate=4 Hz (.05..20), depth=.5 (0..1), phase=90 degrees (-180..180),
stereoPhase=0 (-180..180), sync=false, beats=1 (.125..16 quarter-note beats/cycle).
Depth 0 preserves amplitude; depth 1 modulates to silence. Opposite stereo phase
alternates channel levels. It changes amplitude, not pitch, and adds no tail.

Rate and depth share the existing effect-automation lane and command schemas.
Free-rate automation is linear in Hz; its integral from project zero initializes
the LFO phase when seeking. Oscillator frequency scheduling then continues that
curve, while depth drives both the gain offset and modulation amount. Explicit
stereo upmix preserves mono input in both channels. Both LFOs are registered with
the audio engine's stop/disconnect cleanup. The waveform is sine-only for now;
Logic-style smoothing/symmetry controls and surround distribution remain absent.

Tempo sync uses tempo/60/beats Hz and keeps the same project-time phase anchor.
Free-rate values and rate automation remain saved but are ignored while synced;
depth automation remains active. Sync/beat division and both phase settings are
static. The engine passes project tempo through track/bus/master effects, so live
arrangement playback, cycle rendering, exports and bounce in place share this path.
Cycle boundaries still use the existing rendered-loop behavior, including possible
discontinuities for cycle lengths that do not contain whole modulation periods.
Direct live MIDI monitoring still uses its existing monitor path without inserts.

350 tests and build pass, with the existing chunk-size warning. Unit checks cover
schema and automation bounds, phase integration, synced-rate conversion, preserved
free-rate settings, track/bus/master edits, atomic undo/redo and mocked agent use.
Browser checks compare real stereo PCM with the expected modulation, verify unity
for zero depth and bypass, tempo conversion on every insert placement, rate/depth
seek continuity (maximum observed error about 2.3e-5), UI, undo/redo and reload.
The mixer form was visually inspected. Live model inference remains unverified.


### OpenAI / Claude provider adapter

server/daw-model.js maps the shared prompt and tools to OpenAI Responses or Claude
Messages. OpenAI retains store:false and parallel_tool_calls:false. Claude uses a
system prompt, user message, input_schema tools and auto tool choice with parallel
tools disabled. Supported strict tools retain strict:true; the general edit tool
continues to use post-response Zod validation. Requests retain the 90-second timeout
and 6,000-output-token bound. Authentication and origin checks are unchanged.

Claude tool_use blocks normalize to the same function-call representation before
capability checks, one-action enforcement and session/command simulation. Text-only
responses remain replies. Thinking blocks are not surfaced. Incomplete/max-token,
unsupported continuation, malformed and unexpected tool responses fail without an
edit. Network/HTTP/JSON errors expose a generic message, never raw provider bodies,
credentials or model traces. Provider selection is server-only, with no client
provider override or silent provider fallback. Claude has no store:false field;
provider retention policies are not made equivalent by this adapter.

The live-check CLI uses the selected provider/key and the same disposable two-edit
session verification. --config-only never calls a provider. Current local preflight
still fails because OPENAI_API_KEY and DAW_AGENT_MODEL are absent; neither provider
has been tested live. 356 unit tests and build pass (existing chunk-size warning).
New checks cover configuration/key isolation, Claude request format, parity for all
seven action types, malformed/truncated/parallel/unoffered actions, text replies,
error redaction, no fallback and Claude CLI configuration forwarding.

References:
- https://developers.openai.com/api/docs/guides/function-calling
- https://platform.claude.com/docs/en/api/messages/create
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use

### Graphical EQ response editor

Reference: https://support.apple.com/en-mide/guide/logicpro/lgcef1edc1d7/mac
Each existing EQ insert now has a logarithmic 20 Hz–20 kHz response plot with a
±24 dB display. This is one graph per existing biquad insert, not a combined
multiband Channel EQ or spectrum analyzer. BiquadFilterNode.getFrequencyResponse
uses the same filter type/frequency/Q/gain as the renderer. The graph uses the
current AudioContext sample rate when available, otherwise a labeled 48 kHz
preview. Frequencies above Nyquist are omitted; the actual engine frequency clamp
is respected. Off-scale gain is clipped geometrically, not flattened as a fake
response. Bypassed inserts show unity. No source audio is analyzed.

Form input updates the static preview without committing. Dragging applies the
shown EQ settings through one effect.set command; peaking/shelves change frequency
and gain, pass filters only frequency. Left/right arrows move by a semitone, or a
quarter-semitone with Shift; up/down move .5 dB, or .1 dB with Shift, for gain-bearing
filters. Numeric Q controls remain available. Automation stays unchanged and an
explicit caption explains that curves override this static preview in playback.
The graph does not pretend to show live automated response or audition draft edits.

Pointer capture supports mouse/pen/touch. Escape, pointer cancellation, capture
loss, window blur or DOM removal restore draft fields without a commit. One drag
is one undo step. A DOM-replacing edit cannot apply a late drag; commits also carry
the captured document revision. Busy/recording states block graph edits. Number
fields remain keyboard alternatives, and the SVG exposes keyboard instructions.
Graph contexts are reused per sample rate and do not start audio playback.

359 unit tests and production build pass with the existing chunk-size warning.
New units cover coordinate mapping, boundaries, filter-specific fields and keyboard
increments. Browser checks cover previews, drag/keys, one-step undo/redo, Escape,
pointer cancellation, undo during a drag, invalid drafts, reload, and numerical
response vs actual rendered sine audio at three frequencies for all five filter
types (within .02 dB). Low sample-rate/Nyquist and bypass responses are also checked.
The graph was visually inspected. Existing agent EQ commands need no new tool.

### Experimental DAW: copy channel settings

Select the destination channel in Mixer, expand **Copy channel settings**, and choose a source and categories. The operation replaces selected categories in one undo step; it preserves destination regions, name, kind, mute and solo. Effects include their automation. Volume/pan automation and static volume/pan are separate choices. Output routing includes sends and their curves. Instrument/sampler copying requires two MIDI tracks. Curves keep absolute project times; copied editable points/effects receive new IDs, while sample assets and routing targets remain shared references. Feedback loops are rejected atomically. Master/video channels and cross-session presets are not supported by this action.

The agent uses the same `track.copySettings` command: destination `target`, `values.sourceId`, and explicit boolean `effects`, `mix`, `automation`, `routing`, `instrument` choices (at least one true). GUI defaults to effects only; omitted command choices are false. Regression coverage: `test/experimental-channel-settings.test.js` and `scripts/browser-experimental-channel-settings-check.cjs` (mocked auth, real UI/command engine).

### Experimental DAW: melodic pitch inversion

Piano roll → **Invert note pitches** reflects all or selected MIDI notes around a pivot. The shared agent/manual command is `notes.invert`, targeting a MIDI region with `pivot` (0–127, increments of 0.5) and optional `noteId` or comma-separated `noteIds`. Result = `2 * pivot - oldPitch`; results outside MIDI 0–127 reject the entire command. Half-step pivots still produce integer MIDI notes. **Use pitch-range center** sets the midpoint of the chosen notes’ minimum/maximum pitches, keeping their resulting range unchanged. Preview reports affected count and resulting pitch range. One operation is one undo; timing, note IDs, velocity, channels and controllers remain intact. Drum pitches select different drums. This is melodic reflection, not chord-voicing inversion or a live MIDI insert.

Reference: [Apple MIDI Transform presets](https://support.apple.com/en-sg/guide/logicpro/lgcp215831be/mac), Reverse Pitch. Verification: `test/experimental-note-invert.test.js` covers reflection, double inversion, half-step pivots, selected subsets, atomic bounds failures and undo. `scripts/browser-experimental-note-invert-check.cjs` covers the real piano-roll form, preview, midpoint shortcut, empty selection, undo and reload with mocked account APIs.

### Experimental agent: bounded editing continuation

The browser supports at most **three edit batches per instruction**, with one undo step per batch. `edit_session.continueEditing: true` requests another model plan using the actual post-edit document, bounded recent change records, and revision-matched mix analysis. Set it only when a later edit needs the prior result; normal independent edits remain one atomic batch. `remainingEditSteps` (0–2; default 0 for older clients) gates the tool field and rejects additional continuation at zero. Continuation cannot accompany an export or transport follow-up. Subsequent requests set `editingContinuation: true`, offer only edit/analysis tools, and reject standalone clipboard/history/bounce/export/transport actions. A final edit can still use its validated requested export or transport follow-up.

Each stage retains the original selection (filtering deleted IDs), refreshes history/transport/export context, and checks history identity, revision, mounted workspace, cancellation and recording/busy state. One optional pre-edit analysis per stage means at most six model calls; the existing overall 300-second request timeout remains. Cancel, failures or concurrent manual edits stop subsequent work and retain already-applied batches. Conversation attributes only the last actual agent-applied snapshot, excluding later manual changes. No automatic retry of failed edits or model requests.

Tests: `test/experimental-agent-continuation.test.js`; `scripts/browser-experimental-agent-continuation-check.cjs` covers three real edit batches, actual audio verification fed into the next request, separate undo, hard cap, concurrent edit rejection, cancellation and conversation attribution. Model responses are mocked; this does not establish live provider behavior. Existing edit/play and edit/export browser regressions also pass.

### Experimental DAW: MIDI note mute

Piano roll supports **Mute selected**, **Unmute selected**, and **Select muted notes**. Muted notes remain editable and use gray dashed outlines; velocity bars dim and fully muted drum steps show dashed outlines. Shared command `notes.mute` targets a MIDI region with required boolean `mute` and optional `noteId` or comma-separated `noteIds`; omit selection to affect all notes. `note.add`/`note.set` also accept `mute`. Older documents default to false. Changes are undoable without altering timing, pitch, velocity, channels or controller events. Duplication and arpeggiation retain mute state.

Synth, sampler and drum scheduling skip muted notes for playback, analysis and audio exports. Muted-only sampler regions do not require decoding the sample, but project media references still retain it for unmuting. Normal MIDI export omits muted notes; the explicit `writeMidi(...,{includeMuted:true})` preservation path includes their original notes (standard MIDI does not store this application's mute flag). Project/session JSON preserves the flag. Shared MIDI controllers remain active for other notes.

Reference: [Apple Piano Roll note muting](https://support.apple.com/en-asia/guide/logicpro/lgcpa8fd7ce5/10.7/mac/11.0). Tests: `test/experimental-note-mute.test.js` covers selection, undo, copies/arpeggiation, old-document defaults and MIDI round trips. `scripts/browser-experimental-note-mute-check.cjs` checks controls, visual state, reload and real PCM silence versus audible output for all three instrument paths.

### Experimental DAW: remove duplicate MIDI notes

Piano roll → **Remove duplicate notes** previews cleanup for the whole region or selected notes only. `notes.removeDuplicates` targets a MIDI region. Optional values: `match: onset|identical` (default onset), `keep: first|longest|loudest` (default first), and `noteId` or comma-separated `noteIds`. Onset matching requires exactly equal stored start, pitch and MIDI channel; nearby starts and different channels are distinct. Identical matching also requires equal duration, velocity and mute state. Longest/highest velocity policies retain that note intact; ties use first document order, independent of selection click order. Muted notes participate and a muted survivor stays muted. Selected-only cleanup compares selected notes with each other; it never deletes an unselected note. Controllers are unchanged. One undo restores all removed notes.

[Apple's doubled-event cleanup](https://support.apple.com/en-ie/guide/logicpro/lgcpa9100075/mac) is the reference. This implementation uses stored starts (quantize here commits note timing); it does not use a hidden playback-quantization grid or a near-time tolerance. Unit coverage includes all keeper policies, exact performance matching, channel isolation, selected-only comparison, atomic invalid selection, undo and 20,000-note grouping. Browser coverage in `scripts/browser-experimental-note-cleanup-check.cjs` verifies preview, form choices, survivor identity, undo/redo, disabled empty/no-op submissions and reload.

### Experimental DAW: transfer MIDI phrases between regions

Piano roll → **Copy or move notes to another region** transfers the selected notes or all source notes into a different existing MIDI region, on the same or a different instrument track. Destination choices show track and region names. The form uses beats into the destination; the shared `notes.transfer` command uses seconds in `position`. Required `destinationId` identifies the destination region; `mode` is copy (default) or move, `extend` defaults false, and `noteId`/comma-separated `noteIds` optionally restrict the source selection. The earliest selected onset maps to `position` (default zero). Spacing, durations, pitch, velocity, channel and mute state are preserved. Copy creates new IDs; Move retains IDs and removes source notes only after the full operation validates. Existing destination notes remain. One undo restores both regions and any explicit length extension.

The preview reports note count and resulting destination length; an out-of-bounds phrase is rejected unless **Extend destination to fit** is checked. The 20,000-note destination limit and maximum region length are enforced atomically. Source controller events remain in place and are not transferred; destination controllers/instrument/effects apply. This is note transfer within the current session, not cross-session clipboard or controller transfer. Reference: [Logic's MIDI copying workflow](https://support.apple.com/guide/logicpro/copy-notes-lgcpa917aaef/10.7/mac/11.0).

Verification: `test/experimental-note-transfer.test.js` covers copy independence, selected move identity, timing conversion, extension, preserved controllers, capacity/selection rejection and undo. `scripts/browser-experimental-note-transfer-check.cjs` verifies actual form preview, beat placement, both modes, one-step undo/redo and reload.

### Experimental DAW: stereo chorus

Mixer → **Stereo chorus** adds one sine-modulated delay voice per stereo channel. It is available on track, bus and master chains through the existing effect commands. `kind: chorus` parameters: `rate` .05–10 Hz (default .8), `depthMs` 0–20 ms (default 3), `mix` 0–1 (default .35), and static `stereoPhase` −180–180 degrees (default 90). Rate, depth and mix have effect automation lanes and shared agent commands. The delay is centered at 25 ms, remaining between 5 and 45 ms at maximum depth. Dry/wet mixing is linear; mix zero is dry, depth zero retains a fixed 25 ms wet delay. Mono input is upmixed before independent left/right modulation. Strong modulation can create pronounced pitch changes.

LFO phase integrates the automated rate from project zero, including seeks. Delay history starts empty on seek, as with existing delays; uninterrupted audio history is not reconstructed. The export tail estimate includes the maximum delay depth whenever wet mix can be nonzero. Nodes are registered with the transport cleanup path. This is an original chorus implementation; vintage D-mode, feedback, multi-voice ensemble and tempo sync are not included. Reference: [Apple Chorus effect](https://support.apple.com/en-lamr/guide/logicpro/lgcef266d395/mac).

Verification: `test/experimental-chorus.test.js` covers parameter/automation bounds, bypass and tail behavior, all channel types and undo. `scripts/browser-experimental-chorus-check.cjs` verifies actual mixer editing/reload and rendered PCM: dry/bypass error below 1e-6, fixed-delay error below 1e-5, analytical stereo modulation error below .005 and automated seek-versus-continuous error below .005 after delay warmup. Observed errors were about .000021 and .000117 respectively. Tests use real Web Audio; no live model inference is implied.

### Experimental DAW: audio punch range recording

**Audio punch recording** defines microphone punch-in/out in timeline seconds, with **Use cycle range** to copy current cycle locators. `session.set` supports `audioPunchEnabled` (default false), `audioPunchStart` (default 0) and `audioPunchEnd` (default 4). Ranges must be ordered, within 0–86400 seconds and at most 600 seconds long. The agent can configure these settings but cannot grant microphone access or start capture; the user clicks Record audio.

Capture starts at punch-in and stops at punch-out at AudioWorklet sample boundaries (rounded to the nearest sample). If the playhead is earlier, it becomes the pre-roll start; if later, playback starts at punch-in. Count-in precedes this playback start. **Play arrangement while recording** controls whether the backing arrangement is audible during pre-roll/capture. Stop recording can finish a take early after punch-in; Cancel take discards capture, including during pre-roll. Punch-out automatically flushes and saves a new region at punch-in in the chosen audio destination, with one undo for the imported take. Existing regions and their audio remain unchanged. Ordinary recording now also stops exactly at its existing ten-minute capture limit.

This is an audio range-capture workflow, not Logic's full destructive replacement, quick punch-in, cycle takes, take folders or comping. Existing overlapping regions can still play alongside the new take. MIDI recording is unaffected, and microphone hardware latency compensation is not implemented. Reference: [Logic audio punch recording](https://support.apple.com/guide/logicpro/punch-in-and-out-of-audio-recordings-lgcpb19bfd0d/10.7/mac/11.0).

Verification: `test/experimental-audio-punch.test.js` checks settings/undo and exact stereo block slicing at start/end frames with one limit notification. `scripts/browser-experimental-audio-punch-check.cjs` exercises real AudioWorklet capture with a synthetic browser microphone, automatic save, exact 0.75-second duration and placement, undo/redo, pre-roll cancellation, device-track cleanup and reload. Existing ordinary recording/click-isolation browser regression passes. No physical microphone/interface timing has been verified.

### Experimental DAW: MIDI punch range recording

**MIDI punch recording** has independent punch-in/out locators and **Use cycle range**. `session.set` accepts `midiPunchEnabled` (default false), `midiPunchStart` (default 0), and `midiPunchEnd` (default 4); ranges are 0.1–600 seconds within the 24-hour timeline. The agent can configure these settings; MIDI access and Record MIDI remain manual. MIDI and audio punch settings do not affect each other's capture.

Earlier playhead positions provide pre-roll, optionally with arrangement playback; count-in precedes playback. If the playhead is later than punch-in, recording starts at punch-in. Physically held keys and latest per-channel controller/bend/program/pressure state observed during pre-roll are carried into the take at relative time zero. Notes already released before punch-in are excluded, including notes ringing only because of sustain. New events at or beyond punch-out are excluded; held notes close at the exact logical endpoint. The UI timer checks completion every 250 ms, so save/monitor shutdown can occur slightly after that endpoint while recorded data is clipped to it.

A new region is saved on the selected instrument destination, preserving existing regions. MIDI recording's existing SMF conversion quantizes data to 480 ticks per quarter note; imported region length is at least the captured duration so trailing silence remains. `midi.import` now accepts optional nonnegative `minimumDuration` in seconds, retaining its existing 0.1-second minimum and never cropping imported content. One undo removes the take. Cancel during pre-roll discards it; ordinary MIDI recording retains its prior behavior of ignoring count-in notes.

This does not implement quick punch-in, loop takes, replacement/comping, or physical keyboard latency compensation. Tests: `test/experimental-midi-punch.test.js` covers chase, range clipping, opt-in behavior, bounded pre-roll, floating-point range endpoints and silent tails. `scripts/browser-experimental-midi-punch-check.cjs` uses a synthetic Web MIDI port to verify the real recording UI, automatic save, held-note/controller carry-in, pre-released exclusion, undo/redo, cleanup and reload. Existing MIDI input browser regression also passes; no physical MIDI hardware was tested.

### Experimental DAW: assemble an audio comp

Select an audio track/region and expand **Build a comp from takes** below the arrangement. Choose timeline sections from audio regions on that track, name the comp, choose an edge fade (0–100 ms, default 5 ms), and create the comp. The section list is an in-memory draft until saved as an alternative or used to create a comp track; unsaved choices are not restored after reload. The result is a normal editable audio track inserted after the source with copied gain/pan/effects/automation/output/sends and independent editable IDs. Source media references, offsets, gain and reverse playback are preserved. Selected sections play unmuted. **Mute original track** defaults on and silences that entire track, including areas outside the comp; original regions remain intact. Turn it off to retain simultaneous source playback. One undo removes the comp and restores source mute state.

Shared agent command: `track.comp` targets the source audio track, with `segments` as a JSON string containing 1–64 `{regionId,start,end}` objects in absolute timeline seconds. Optional values: `name`, `muteSource` boolean (default true), `edgeFade` seconds 0–0.1 (default .005). Sections must fit their source regions and not overlap; timeline gaps remain gaps. Each section gets linear edge fades capped at half its duration, replacing original region fades. Optional automatic crossfades are described below; without them, these are short edge fades. Missing source regions/media references, invalid boundaries and the 128-track capacity reject atomically.

Reference: [Logic comp assembly](https://support.apple.com/guide/logicpro/create-and-save-comps-lgcpb193382e/10.7/mac/11.0). Current implementation is section-based assembly on one source audio track, not take folders, automatic recording take lanes, cross-track comping or automatic recording take folders. Resulting regions can use the existing trim/fade/move tools. Tests: `test/experimental-audio-comp.test.js` covers reverse offsets, copied settings, source preservation, mute choice, undo, bounds/overlap/capacity rejection and short-section fades. `scripts/browser-experimental-audio-comp-check.cjs` verifies section entry, naming, undo/redo, reload, and real PCM take switching with silence in gaps and faded edges.

### Experimental DAW: graphical comp selection

The comp editor displays source-region waveforms in separate lanes. Drag over a
lane to select that interval; new selections replace previous choices only in the
same interval, keeping portions on either side. Adjacent selections from the same
take merge. The top Comp strip shows covered time. Enter/Space chooses a focused
take in full; numeric start/end controls remain available for precise selection.
Escape, pointer cancellation, window blur or removal of the editor cancels a drag.
The first 32 takes appear graphically to bound rendering work; the dropdown includes
all source regions. Choices remain an in-memory draft until Create comp track.
Numeric additions use the same replacement behavior. The shared `track.comp`
command still requires a final non-overlapping list, so manual and agent output
use the same validated comp assembly, copied mixer settings and undo operation.

Verification: `test/experimental-comp-lanes.test.js` covers replacement, preserved
remnants, merging and bounded rendering. `scripts/browser-experimental-comp-lanes-check.cjs`
uploads real WAV fixtures and verifies waveforms, keyboard selection, drag
replacement, cancellation, creation and undo. The existing audio-comp browser
check covers numeric entry and rendered PCM take switching, silence and fades.

### Experimental DAW: audition a comp draft

**Audition in mix** in the comp editor plays a disposable copy of the session with
its proposed comp added using the same `createAudioComp` path as the final command.
It starts at the first selected section and stops after the last section and its
routed effect tails. The existing mix, source-mute checkbox, solos, routing,
automation and master processing apply. Cycle is disabled only for this audition.
No document, revision, account save or undo entry changes. Stop audition or the
normal transport stops playback; changing comp choices/settings also stops it,
including pending startup. Press Audition again to hear the updated draft.

Audition uses the existing playback engine and its seek behavior: effect history
before the start position is not pre-rendered. The UI checks the endpoint every
40 ms. This is draft playback, not live switching between takes during playback.
Draft meter readings are not stored as observations of the saved session for the
agent. Agents can already create a comp with `track.comp` and request playback;
the temporary manual draft is not exposed as an agent-editable session object.

Reference: [Apple's take-preview workflow](https://support.apple.com/en-ca/guide/logicpro/lgcp317d76de/mac).
Verification: the audio-comp unit test checks snapshot isolation, routing, bounds
and source-mute choices. The two comp browser checks verify real uploaded media,
start/stop, automatic end, stopping on draft edits, unchanged session storage and
PCM equivalence between audition and committed comp (including reverse playback,
EQ, bus routing and both source-mute options). The agent transport browser check
covers ordinary transport, cancellation, stale requests and cycle regression.

### Experimental DAW: named comp alternatives

The comp editor now has **Save new alternative**, **Update alternative**, and a
saved-comp selector with explicit Load/Delete actions. Save keeps selections,
name, edge fade and the mute-original choice in the source audio track without
creating a track or changing source mute. Load replaces the temporary draft;
audition and Create comp track then use that draft. Saving/updating/deleting is
undoable and persists with the session in device storage, account saves and
portable archives. Saving alternatives locally does not automatically save the
session to the account. Unsaved draft changes still disappear after reload.

Agent commands share the same validation:
- `comp.save`, target source track: required `name` and `segments` JSON string of
  `{regionId,start,end}` in timeline seconds; optional `id` (existing ID updates,
  omitted generates a new ID), `edgeFade` 0–0.1 seconds and `muteSource` boolean.
- `comp.delete`, target source track, `{compId}` removes a saved alternative.
- `comp.createTrack`, target source track, `{compId}` creates its editable comp.

Each audio track supports 32 alternatives, each with 1–64 non-overlapping sections.
Saved alternatives refer to current source regions and use current mixer settings;
they do not freeze or duplicate audio. Moving/trimming/deleting referenced takes
can invalidate selections. Invalid choices remain saved for reference/deletion,
but loading or creating them rejects missing/out-of-range sections. Undoing the
source edit restores usability. Track duplication remaps comp IDs and region
references; settings-only copies and newly created comp tracks omit alternatives.
Saved alternatives are included in agent context and bounded change summaries.

Reference: [Logic's saved comp alternatives](https://support.apple.com/guide/logicpro/create-and-save-comps-lgcpb193382e/10.7/mac/11.0).
Tests: `test/experimental-comp-alternatives.test.js` covers commands, undo/redo,
limits, stale references, duplication, portable media remapping and the mocked
model command path. `scripts/browser-experimental-comp-lanes-check.cjs` covers
save/load/update/delete, reload and audition with real uploaded WAVs. Existing comp
PCM/browser checks also pass. Live model inference is not verified by these mocks.

### Experimental DAW: automatic comp crossfades

Comp settings now include **Crossfade · ms** (0–1000, default 0/off) and
**Crossfade curve** (Linear or Equal power). Adjacent selected sections extend
symmetrically around their shared boundary, using available audio in both source
regions. The overlap cannot exceed available source-region bounds or the length
of either selected section. This also prevents neighboring fades from overlapping
inside a very short middle section. Boundaries with no room retain edge fades;
gaps remain silent. Outer edges retain the Edge fade setting. Reverse source
offsets are recalculated from the original take. The input selections and original
takes remain unchanged; output regions contain ordinary editable overlapping fades.

Linear suits correlated material. Equal power uses the existing sine fade curves
and can raise the peak when the two takes are correlated. The requested duration
may be shortened; it is not a guarantee that every transition has that width.
The lane highlights show selected sections, not their extended crossfade areas.

`track.comp` and `comp.save` accept optional `crossfade` in seconds (0–1) and
`crossfadeShape` (`linear` or `equalPower`). Alternatives retain these fields;
older alternatives default to 0/linear. Audition and `comp.createTrack` use the
same plan as manual creation. There is no rendering or new source file required.

Reference: [Logic automatic crossfades](https://support.apple.com/en-gb/guide/logicpro/lgcp9260fa9c/10.7/mac/11.0).
`test/experimental-comp-crossfades.test.js` verifies timing, reverse offsets,
short sections, gaps, source bounds, disabled mode, alternatives and undo.
The audio-comp browser check measures real rendered PCM before, within and after
both linear and equal-power transitions. The comp-lanes browser check verifies
settings, save/load/reload, audition and creation of overlapping output regions.

### Experimental DAW: bounce an entire track in place

Select an audio or instrument track (or one of its regions) and use **Bounce track
in place** in the inspector. This renders all unmuted regions from their earliest
start through their latest end and instrument/insert tails into one stereo 32-bit
float WAV. Gaps and overlaps are rendered together. Muted regions are excluded,
and track/bus solo settings are ignored for the render. Muted source tracks must
be unmuted explicitly first. There is no normalization. The Export settings sample
rate applies (44.1, 48 or 96 kHz); the rendered range is limited to ten minutes and
the float WAV must fit the existing 250 MB playback limit. Initial timeline silence
before the first included region is not rendered, so late-starting short tracks
are supported. Like existing seeking, this does not pre-render earlier DSP history.

A new audio track appears immediately after the original. Instruments, region
processing and insert effects are baked in. Channel volume/pan/automation, sends
and output routing are copied with independent editable IDs, and remain live;
master and downstream bus processing are not baked. The original track is muted,
with its regions, instrument, alternatives and settings retained. The new track
has no insert chain or saved comp alternatives. One undo restores source mute and
removes the new track; redo reuses the rendered asset. This is a new rendered track,
not a reversible Freeze toggle or a destructive replacement.

The agent's `bounce_track_in_place` tool requires `trackId` and nullable
`sampleRate` (null uses the captured export rate). It uses the same browser render,
revision checks, media storage and atomic commit as manual use. The internal
`track.commitBounce` command validates rendered duration; the model cannot call it
to invent media. Cancellation or edits during rendering prevent a stale commit.
Document-storage failure rolls back the history and source mute and removes only
the newly stored asset. Completed output uses the existing local media store and
is included in account saves/portable archives through normal media references.

Reference: [Logic track bounce in place](https://support.apple.com/en-ie/guide/logicpro/lgcp8aa3b784/10.7/mac/11.0).
`test/experimental-track-bounce.test.js` verifies isolation, gaps, late timeline
placement, tails, bounds, undo and capability-gated agent requests.
`scripts/browser-experimental-track-bounce-check.cjs` renders MIDI and audio,
compares routed stereo PCM before/after, checks muted-region exclusion, local
reload/playback, undo/redo, storage failure cleanup, agent cancellation and stale
renders. Model responses are mocked. The existing region-bounce regression passes.

### Experimental DAW: bounce multiple tracks in one operation

**Track actions → Bounce all tracks in place** renders every unmuted audio or
instrument track with at least one unmuted region. Bus/video/empty/muted tracks
are skipped, and solo does not restrict which tracks are rendered. Every output
uses the existing whole-track processing rules: instrument/region/inserts printed,
channel mix and routing copied, original source retained and muted. New tracks are
inserted after their sources. All outputs commit as one undo/redo operation.

The agent can use `bounce_tracks_in_place` with `trackIds` set to a unique array of
source track IDs or null for all eligible tracks, and `sampleRate` set to 44100,
48000, 96000 or null for the captured export rate. Explicit invalid, empty or muted
sources reject the batch. Track capacity is checked for the full batch before any
rendering. Per-track ten-minute and 250 MB limits still apply; additionally, a batch
is limited to 250 MB total rendered float audio to bound browser memory. Choose a
smaller subset through the agent or use individual bounces if that limit is reached.

Rendering is sequential, with a track counter and **Cancel bounce** button. The
same cancel control is also available for single-track and region bounces. Outputs
are stored provisionally, and the document changes only once all renders and
stores have succeeded and the original session revision is still current. On
failure/cancellation, provisional assets are deleted; a document-save failure also
restores the original history stacks. Asset cleanup is best effort if IndexedDB
itself becomes unavailable. Cancel does not undo a batch already committed. The
browser may finish an already-started offline render internally after cancellation,
but its result is discarded and no subsequent tracks start.

Reference: [Logic bounce all tracks](https://support.apple.com/en-ae/guide/logicpro/lgcpd51ba7d3/10.7/mac/11.0).
`test/experimental-bounce-batch.test.js` checks eligibility, explicit subsets,
limits, atomic undo and the mocked model tool path.
`scripts/browser-experimental-bounce-batch-check.cjs` checks stereo PCM equivalence,
one-step undo/redo, failure/cancellation on the second render after the first file
was stored, cleanup after a failed document commit, agent execution and reload
playback. Both existing single-track and region-bounce browser regressions pass.

### Experimental DAW: convert sustain pedal to note lengths

The piano roll's **Sustain pedal to note lengths** tool extends notes whose
note-off occurs while their MIDI channel's CC64 value is at least 64. The new end
is the next pedal-off message or the region end if none follows. Pitch, onset,
velocity, channel and mute state are preserved, as are existing same-pitch
retrigger overlaps. This uses the same binary pedal semantics as current playback;
it does not model continuous half-pedaling.

Choose all notes or selected notes. **Remove converted channels’ pedal events**
defaults on and deletes CC64 only on channels represented by the chosen notes.
Other controllers and events on other channels remain. If an unselected note on
those channels still depends on sustain, removal rejects rather than changing its
playback: include those notes or explicitly keep pedal events. Keeping the events
allows them to continue affecting playback. The preview shows note/event counts;
conversion is one undoable edit. MIDI export carries the new note lengths.

Shared command: `notes.applySustain`, target MIDI region, optional `noteId` or
comma-separated `noteIds` (omit for all), `removePedal` boolean default true.
Events are indexed by channel and time so conversion does not repeatedly sort all
controller data for every note. Conversions exceeding the existing one-hour note
length limit reject atomically. An empty selection or non-MIDI source also rejects.

Reference: [Logic sustain-pedal conversion](https://support.apple.com/en-in/guide/logicpro/lgcpa90a4474/mac).
`test/experimental-sustain-lengths.test.js` covers channels, boundary/same-time
messages, thresholds, missing pedal-up, partial selections, preserved values,
20,000-note/event input, undo and MIDI export. It also verifies the mocked agent
command path. `scripts/browser-experimental-sustain-lengths-check.cjs` checks the
UI, selected-only protection, keeping events, real PCM equality, undo/redo and
reload. No external MIDI instrument was used for playback verification.

### Experimental DAW: split and divide MIDI notes

The piano roll now offers **Split notes** in its Tool menu. Click inside a note to
cut it at the grid-snapped time; Shift bypasses snap. If the clicked note is in the
current selection, all selected notes crossing that time split together. Otherwise
only the clicked note is split. Clicking an endpoint or empty space does not add
notes in this mode. Draw and Select retain their previous behavior.

The **Split & divide notes** panel also provides keyboard-accessible numeric cuts,
a **Use playhead** shortcut (converted from session time to beats relative to the
region), and division into 2–128 equal time slots. **Note length · % of each part**
sets the sounding portion from 1–100%; shorter values leave gaps. These are new
note attacks, not time stretching. Pitch, velocity, channel and mute are preserved;
controller events stay unchanged, so sustain can bridge the gaps. First pieces
retain their original note IDs, while later pieces receive new IDs. One undo
restores the original notes. The region length is unchanged.

Shared commands:
- `notes.split`, target MIDI region, `time` in seconds relative to region start.
- `notes.divide`, target MIDI region, `parts` integer 2–128, optional `gate` .01–1
  (default 1).
- Both accept optional `noteId` or comma-separated `noteIds`; omission means all
  notes. Splitting affects only notes strictly crossing the chosen time.

The complete operation rejects if it would exceed 20,000 notes or produce an
unrepresentable positive duration; it does not silently truncate output. The
preview reports affected, added and total note counts before applying.
Reference: [Logic's scissors tool](https://support.apple.com/guide/logicpro/common-tools-lgcp8b7459e4/10.7/mac/11.0).
`test/experimental-note-split.test.js` covers identity/value preservation, bounds,
capacity, subdivision, gaps, undo and MIDI export plus the mocked agent path.
`scripts/browser-experimental-note-split-check.cjs` covers graphical grouped cuts,
playhead conversion, the form, actual rendered note attacks/gaps, undo/redo and
reload. Existing piano-grid and note-selection browser checks cover regressions.

### MIDI note joining

The piano roll's **Join note fragments** panel and agent command `notes.join` share the same validated operation. Target a MIDI region; omit selection for all notes or provide `noteId` / comma-separated `noteIds`. Only chosen notes with matching pitch, channel and mute state join. Touching/overlapping chains join by default; `gap` (0–10 seconds) explicitly fills intervening silences. `velocity` accepts `first` (default, earliest note), `highest`, or `average` (arithmetic mean of fragment velocities). The earliest note ID remains; ties use region order. Controllers and unselected notes stay unchanged. Joined notes cannot exceed 3,600 seconds. Joining removes repeated attacks; this is a sustained note, not a legato articulation switch.

Verification: `test/experimental-note-join.test.js` covers selection, identity, velocity, bounds, 20,000-note handling, undo, MIDI export and mocked agent commands. `scripts/browser-experimental-note-join-check.cjs` checks panel controls, actual offline audio sustaining across a former gap, undo/redo and local reload. Live model inference and physical MIDI hardware are not covered by these checks.

### Conditional MIDI selection and edits

**Select notes by condition** in the piano roll combines pitch/velocity ranges, channel, onset range, duration range and mute state with AND. Blank fields are unrestricted. UI timing uses beats relative to this region, channels 1–16, pitch and rounded velocity 0–127. Range bounds are inclusive except the onset ending beat, which is exclusive. Replace/add/subtract/intersect and invert affect only transient selection, not session history; subsequent edits use normal undo and persistence.

For `notes.mute`, `notes.move`, `notes.resize`, `notes.delete`, `notes.duplicate`, `notes.quantize`, `notes.transpose`, and `notes.join`, agents or the command harness can provide `values.filter` as a JSON object string instead of explicit note IDs. Fields: `pitchMin`, `pitchMax`, `velocityMin`, `velocityMax` (integers 0–127), `channel` (0–15), `mute` (boolean), `start` inclusive / `end` exclusive (onset seconds relative to region), `durationMin`, `durationMax` (inclusive seconds). Example: `{"op":"notes.mute","target":"region-id","values":{"filter":"{\"pitchMax\":48}","mute":true}}`. Filters resolve against the current region at each batch step. Conflicting IDs, unknown fields, inverted ranges, unsupported operations or no matching notes reject the entire batch without changing the document. Empty `{}` deliberately matches all notes.

Tests: `test/experimental-note-filter.test.js` covers matching, bounds, selection modes, supported operations, batch atomicity, undo and mocked agent use. `scripts/browser-experimental-note-filter-check.cjs` verifies rendered selection, beat/channel conversion, subtraction/inversion, subsequent editing and reload. Research reference: [Apple's piano-roll selection guide](https://support.apple.com/en-za/guide/logicpro/lgcpa906bc30/10.7/mac/11.0). This implementation currently filters one region, not multiple tracks.

### Automation curve shapes

Track, bus, master, send and effect automation points accept optional `shape`: `linear` (default for legacy points), `hold`, `smooth`, `easeIn`, or `easeOut`. The shape belongs to the **starting** point and controls the segment to the next point of that parameter. Hold keeps the previous value until the next point's exact timestamp; the first and last values extend outside the point range. The graph and each point's editor expose the shape, and the add-point form applies its selected shape to graph clicks too.

Supported commands: `automation.point/set`, `send.automation.point`, and `effect.automation.point/set`. Existing point IDs and shapes survive value-only upserts. `automation.set` also edits send points by ID. Invalid shapes reject the command batch atomically. Duplication, archive/session persistence and undo retain shapes through the existing document model.

`automation-curves.js` supplies the common evaluator/scheduler. Smooth uses smoothstep, ease-in/out use quadratic curves, approximated by 64 fixed linear segments per point interval. The graph, seek evaluator and tremolo/chorus rate phase integration use those same segments. Gain in dB schedules exponential amplitude ramps; effect parameters interpolate in their displayed units. This is a bounded preset-shape implementation, not arbitrary Bezier handles or live touch/latch/write automation recording.

Verification: `test/experimental-automation-curves.test.js`; `scripts/browser-experimental-automation-curves-check.cjs` renders real Web Audio PCM for all five shapes on dB gain and effect parameters, compares mid-curve seeking, checks the graph and tests undo/reload. Existing automation-edit, effect-automation, tremolo and chorus browser checks cover regressions. Agent testing uses mocked model responses, not live provider inference. Research: [Apple automation editing guide](https://support.apple.com/guide/logicpro/select-copy-and-move-automation-lgcpb1a5aad6/10.7/mac/11.0).

### Automation range editing

Every mixer automation editor now has **Copy, move or delete points**. Choose the current parameter, an inclusive source time range, and (for copy/move) a destination lane and time. Destinations expose the same parameter on track/bus/master, send and effect lanes. Destination value limits still apply; values are not scaled between different ranges. Copy creates fresh IDs; move preserves IDs. The entire edit is one undo step.

Shared command: `automation.range`, target = source track/session/effect ID. Values: `mode` (`copy`, `move`, `delete`), `parameter`, `start`, `end`, optional source `busId`. Copy/move additionally require `position` (destination for the source range start), optional `destination` owner ID and `destinationBusId`, and optional `replace` boolean (default false). Omitting both destination fields keeps the same lane. Explicit destination with no destinationBusId selects that owner's main lane. Delete accepts no destination/position or replacement. Both source boundaries are included, even a single timestamp. Empty selections, invalid destination values/times, capacity above 2,000 points per automation array and unapproved exact-time collisions reject atomically. Replacement removes only matching timestamps of the same parameter. Overlapping moves remove their source points before checking collisions.

This edits control points, not a sampled slice of a curve: no boundary points are invented. Shapes travel with points, so neighboring interpolation may change. Source media, static controls and other automation parameters are untouched. Tests: `test/experimental-automation-range.test.js` and `scripts/browser-experimental-automation-range-check.cjs` cover cross-lane copy/move/delete, overlap/collision behavior, capacity, undo/reload, mocked agent commands, and real PCM equivalence of a copied smooth fade. Live model inference remains unverified.

### Summing groups

Use **Mixer → Create summing group** to name a bus and select audio, instrument or bus tracks. The new bus starts at 0 dB, centered pan, unmuted/unsoloed with no effects. Selected main outputs route through it. The bus is placed before the selected tracks, which become contiguous in original order; unselected tracks retain their relative order. The bus inspector lists its direct main-output inputs with buttons to select them. Existing Routing controls add/remove membership by changing a track's main output.

Shared agent/harness command: `track.createGroup`, values `name`, comma-separated `trackIds`, optional new `id`, optional `output` bus ID or null for Master. Omitted output preserves the tracks' shared destination. If destinations differ, output must be explicitly chosen. Parent buses and their descendants cannot both be selected. Invalid IDs, video tracks, cycles and the 128-track limit reject the batch atomically. Track media, instruments, gain/pan, effects, automation and sends remain intact. Sends are independent paths and may remain audible when the summing bus is muted. Group creation is one undo step and uses ordinary persisted bus routing, so existing stem export grouping understands it.

This implements audio subgroup creation, not collapsible/folder track stacks, VCA groups, or MIDI layered through a main instrument track. Tests: `test/experimental-summing-group.test.js` covers routing, ordering, preserved settings, nesting, failure atomicity, undo and mocked agent use. `scripts/browser-experimental-summing-group-check.cjs` verifies the UI, direct-member navigation, exact before/after PCM for a neutral group, group gain/mute, grouped stem audio and reload. Live model inference remains unverified. Research: [Apple summing-stack overview](https://support.apple.com/en-au/guide/logicpro/lgcp9bc4b63d/mac).

### Collapsible summing groups

The arrangement and mixer share a hierarchy derived from primary bus outputs. Bus rows have keyboard-accessible disclosure buttons; their routed descendants appear indented and depth-first in document sibling order. Sends never establish membership. `track.set` accepts `collapsed` (boolean, true only on buses), persisted with the session and supported by undo. Nested fold states remain independent. A folded bus shows a non-editable overview of descendant region positions (at most 512 rectangles, with total counts); expand it to edit regions. Existing media, routing, audio rendering and exports include hidden tracks.

Folding/unfolding through the UI does not stop active playback. It remains unavailable during recording or a pending busy operation. Opening a hidden member from the mixer expands collapsed ancestors. Header dragging and the Move track up/down controls reorder siblings within the same primary-output group; use Routing → Output to change group membership. `track.move` retains its document-index command semantics, and the hierarchy displays sibling order from that document.

Verification: `test/experimental-track-hierarchy.test.js` covers nesting, visibility, sends, export/source preservation, saved state, undo and sibling ordering. `scripts/browser-experimental-track-hierarchy-check.cjs` verifies synchronized header/lane/mixer visibility, live playback continuing during folds, region overview, keyboard expansion, member reveal, unchanged offline PCM, reload and undo/redo. The track-order and summing-group browser checks cover their updated interactions. Folder/VCA groups, dragging tracks between groups and layered MIDI playback from a parent remain unfinished.

### Automation Read / Off

Each channel, master, effect and send automation editor has a Read/Off selector. Read is the default when the saved mode is absent. Off uses static controls while retaining all automation points and shapes for editing or later re-enabling. Disabled curves appear muted/dashed. This is not effect bypass: an effect still processes audio at its static settings.

Commands: `track.set {automationMode:"read"|"off"}`, `session.set {masterAutomationMode:"read"|"off"}`, `effect.set {automationMode:...}`, and `send.set {busId,automationMode:...}`. Channel Off suppresses its volume/pan, effect and send automation; master Off suppresses master volume/pan and master effect automation. Local effect/send switches remain independent stored choices, but parent Off wins during rendering. Bus mode does not change child tracks' own modes, and MIDI controller events are unaffected. Modes are saved, copied with the corresponding settings, and undoable. Changing a mode stops current playback through the normal edit path; restart to audition it.

The shared audio scheduler uses a temporary effective view without modifying the document. Playback, offline mix/stem/region exports, analysis and effect tails honor modes. LFO phase ignores disabled rate curves. Master gain offset/normalization changes only the static master fader when master automation is Off, preserving inactive curves. Read-mode behavior remains unchanged.

Verification: `test/experimental-automation-mode.test.js` covers inheritance, persistence, undo, invalid modes, tails/bounce lengths, LFO phase, master gain offsets and mocked agent commands. `scripts/browser-experimental-automation-mode-check.cjs` exercises all four UI scopes, inherited Off appearance, preserved points, real PCM equality against manually cleared/static reference settings and reload. Existing automation-curve, effect-automation, tremolo and chorus browser checks cover regressions. Touch/Latch/Write recording and per-parameter curve muting remain unfinished; live provider inference is not verified.

### Per-parameter automation playback

The automation editor's **Selected curve** switch independently enables/disables the currently displayed parameter. Disabled points remain visible (muted/dashed), editable and saved. For example, pan can remain automated while volume uses its static setting. The channel/master Read/Off hierarchy still takes precedence; enabling a curve under an Off parent does not turn that parent on. A channel volume-curve switch does not affect insert gain automation.

Shared command: `automation.parameter`, target = track/session/effect ID, values `{parameter, enabled}`; add `busId` for a send on the target track. Parameters are validated against that owner, so a pan curve cannot be enabled on a send or a delay effect. Flags are stored in optional `automationMuted` arrays (master: `masterAutomationMuted`), survive save/undo and settings copies, and are honored by playback, effect tails, seeking, analysis and export through the shared scheduler. Clear/remove/copy point operations do not change the switch. Master gain offsets preserve a muted master volume curve, as they do in channel Off mode.

Verification: `test/experimental-automation-parameter.test.js` covers independent filtering, parent precedence, schema validation, persistence/undo, master gain offsets and mocked agent commands. `scripts/browser-experimental-automation-parameter-check.cjs` covers all four owner scopes, graph state, saved point values, stereo PCM equivalence to a manually filtered reference, undo and reload. Existing Read/Off and curve-render checks cover regressions. Touch/Latch/Write automation recording remains unfinished; live model inference remains unverified.

### Automation range transforms

The range editor includes **Transform in place** plus time/value scaling for Copy and Move. `automation.range` accepts `mode:"transform"` for the current lane (omit position/destination fields). Copy/move/transform accept `timeScale` .01–100 (default 1), `valueScale` −100–100 (default 1), `valueAnchor` and `valueOffset` ±1,000,000 (default 0). UI scaling uses percentages: 100% = factor 1.

Times become `position + (time - start) * timeScale`, with position = source start for Transform. Values become `valueAnchor + (value - valueAnchor) * valueScale + valueOffset`, in the displayed parameter's units (dB, pan, Hz, seconds, etc.). A negative valueScale inverts around the pivot; zero flattens to pivot plus offset. Shapes and point IDs survive Move/Transform; Copy generates fresh IDs. No boundary points are inserted. Static values, playback switches and unselected parameters stay unchanged. Out-of-range values/times, collisions without explicit replacement, and floating-point time collapse reject atomically. Delete rejects nondefault transforms. Reset scaling restores factor 1 and zero pivot/offset.

`test/experimental-automation-transform.test.js` verifies scaling/inversion/flattening, exact identity, IDs, interpolation, collision and precision failures, undo and mocked agent commands. `scripts/browser-experimental-automation-transform-check.cjs` checks controls, disabled invalid edits, range preview, reset, persistence and real PCM equivalence for a smooth fade stretched 2× and shifted −6 dB. This is offline point editing, not live Trim/Relative automation recording.

### Insert time across the project

The arrangement's **Insert time** panel accepts an absolute position and duration in seconds. Shared command `session.insertTime` uses values `{position,duration}` and makes one atomic, undoable edit through the same engine used by the agent. Regions beginning at or after the position move right; crossing audio, MIDI and video regions split, including reversed audio with correct source offsets. Source files remain unchanged. Saved comp segments follow the split region IDs and inserted gap. Markers, all track/send/insert/master automation, and cycle/audio/MIDI punch ranges follow the insertion. A range ending exactly at the insertion point stays on the left; one beginning there moves right.

Automation holds its left-hand value through the gap, then resumes the original curve. A smooth/eased segment crossing the cut is expanded into the scheduler's existing linear approximation so the rendered values on either side remain unchanged. Existing point IDs survive; boundary/intermediate points get new IDs. Limits (including 2,000 automation points, 1,000 regions per track, and 64 comp segments) still apply and failures leave the document untouched. MIDI uses the existing split/chase behavior, including pedal-held notes, and retriggers carried notes on the right. Outer region fades use existing split-style clamping; splitting within a fade can change its envelope. Effect and instrument release tails can continue into the gap, and this edit does not freeze DSP state or LFO phase. It is an arrangement insertion, not guaranteed digital silence under every effect chain. Delete-time and tempo/meter maps remain unfinished.

Verification: `test/experimental-insert-time.test.js` covers reverse audio, MIDI/controller chase, video offsets, all automation scopes, curves/boundaries, comp references, cycle/punch ranges, limits, atomic undo/redo and mocked agent commands. `scripts/browser-experimental-insert-time-check.cjs` checks the UI, real reversed-audio PCM with smooth automation before/after insertion, zero samples in the dry gap, undo/redo and reload. Live model inference remains unverified. Behavior reference: [Apple's guide to adding/removing arrangement gaps](https://support.apple.com/en-au/guide/logicpro/lgcp21e2cb21/10.7/mac/11.0).

### Split selected regions and reversed audio

Select multiple regions in the arrangement and choose **Split selected at playhead** in the inspector, or press the existing Split shortcut (`S`). Only selected regions strictly crossing the playhead are split; selected regions outside it remain unchanged. Both halves remain selected after a group split. The ordinary single-region Split button also supports reversed audio. Source media, playback direction, mix settings and routing are retained.

Shared command `regions.split` accepts `{regionIds,time}`: a comma-separated list of 1–1,000 distinct region IDs and an absolute project time in seconds. Unknown/duplicate IDs, no crossing regions, or capacity failures reject the whole batch. `region.split` retains its single-target API. Both operations and `session.insertTime` use `region-split.js`, which handles reversed source offsets, normal audio/video offsets, MIDI note/controller chase, IDs and fade clamping consistently. Saved comp selections referencing a split region are partitioned/reassigned to the right-hand region so they remain usable. The 64-segment comp limit still applies atomically.

Outer fades remain on their respective pieces; cuts inside a fade retain the existing clamp behavior and can change that envelope. MIDI notes carried over a split are retriggered, including pedal-held notes. This does not add a choice of MIDI truncate/keep/split policies or an arrangement scissors pointer tool yet. [Apple's arranging guide](https://support.apple.com/guide/logicpro/arranging-regions-lgcp4d686a1a/10.7/mac/11.0) documents the selected-regions-at-playhead workflow used as the reference.

Verification: `test/experimental-region-split.test.js` covers mixed audio/MIDI/video selections, reversed offsets, preserved performance fields, comp reuse, boundaries, capacity failures, undo and mocked agent commands. `scripts/browser-experimental-region-split-check.cjs` verifies group button/shortcut and single reverse split, retained selection, stereo PCM equality with outer fades, undo and reload. Existing MIDI sustain, Insert time and multi-region selection checks cover regression paths. Live model inference remains unverified.

### Arrangement Scissors tool

The arrangement toolbar's **Tool** selector switches between Pointer and Scissors. In Scissors mode, hover over a region to preview the absolute cut time and number of crossing regions. Click to cut, or hold and drag to adjust before releasing. Cuts snap to the project sixteenth-note grid; Shift bypasses snapping. If the clicked region belongs to a selection, the crossing regions in that selection split together. Clicking outside the selection scopes the cut to that one region. Ctrl/Cmd-click toggles selection without cutting, and empty-lane marquee selection remains available. Escape, pointer cancellation and lost capture cancel an active cut. Trimming/fade handles are hidden while Scissors is active. Keyboard users can select regions and use the existing `S` shortcut or Split button.

Scissors uses the existing atomic `regions.split` command with a captured revision, so manual pointer cuts and agent cuts share validation, reverse-audio offsets, MIDI chase, comp-reference updates, limits and undo. Preview movement does not change the document. After a cut both pieces are selected and the playhead moves to the cut. Pointer mode restores normal region movement and trim/fade handles. Tool choice is local UI state and resets to Pointer on reload; cuts themselves persist. This does not yet add scrub audition, equal-division Option-click cuts, or configurable arrangement snap subdivisions. [Apple's region-arranging guide](https://support.apple.com/guide/logicpro/arranging-regions-lgcp4d686a1a/10.7/mac/11.0) describes the scissors click/drag/release workflow.

Verification: `test/experimental-scissors.test.js` covers snapped/free timing, selected versus unselected scope, boundaries and invalid selections. `scripts/browser-experimental-scissors-check.cjs` covers visible time/count preview, click/drag commit, group scope, modifier selection, free cuts, Escape and pointer cancellation, Pointer restoration, undo and reload. Existing multi-region selection and split browser checks verify regression behavior and actual split audio. No source media is rendered or modified by this tool.

### Arrangement snap grids and alignment

The arrangement toolbar includes **Snap** (Off, Bar, Beat, 1/8, 1/16, 1/32, eighth/sixteenth triplets, Frame, Second and 0.1 second) and **Alignment**. Relative preserves a region's offset by snapping the drag distance; Absolute snaps the dragged region/trim/fade edge to a project-grid position. Group moves apply the primary dragged region's snapped delta to every selected region, preserving their spacing. Source and timeline bounds can still clamp an edit. Shift bypasses snapping and Off permits free movement/cuts. Scissors always uses an absolute cut grid and shows Alignment as disabled Absolute, retaining the Pointer alignment choice for when you switch back.

Musical grids follow the current global tempo and quarter-note meter count. Frame uses the project's frame rate, including exact 24000/1001, 30000/1001 and 60000/1001 timing for 23.976, 29.97 and 59.94. The timeline grid follows snap and zoom; when divisions are too close, only every second/fourth/etc. line is shown (at least 8 pixels apart) without changing the actual snap interval. Off hides grid lines. Preferences are UI state, defaulting to relative sixteenth-note snapping after reload. Commands continue taking exact seconds; snap does not silently quantize agent edits or numeric forms. Piano-roll and automation editors retain their own snap behavior. Tempo/meter maps, Smart snap, sample snapping and drop-frame timecode remain unfinished.

Verification: `test/experimental-arrangement-snap.test.js` checks musical/time/frame calculations, relative versus absolute anchors, overrides, scissors integration and displayed spacing. `scripts/browser-experimental-arrangement-snap-check.cjs` checks controls, group moves, trim boundaries, Shift/Off, fractional-frame cuts, undo and reload. Existing Scissors and multi-region selection browser checks cover defaults. Reference: [Apple's snap-grid guide](https://support.apple.com/en-hk/guide/logicpro/lgcpf7c0f66a/mac).

### Musical and timecode timeline rulers

The arrangement **Ruler** selector displays Seconds, Bars / beats, or Timecode (non-drop). Ruler clicks seek to the displayed positions. Musical labels follow the current global tempo and quarter-note meter, showing individual beats when zoom permits and skipping whole bars on wider views. Timecode labels use the project's exact frame rate; 29.97 uses 30000/1001, for example. The ruler is bounded to 1,000 labels for long sessions. The transport clock and recording position display use the selected format as well; changing display mode during playback does not stop or restart audio.

**Go to position** accepts seconds, HH:MM:SS:FF non-drop timecode, or `bar:beat:tick` in musical mode. Bars and beats start at 1; ticks run 0–959 per quarter-note beat. `2:1` is shorthand for `2:1:000`. At 120 BPM and three beats per bar, `3:2:480` is 3.75 seconds. Invalid fields and positions outside 24 hours reject without moving the playhead. Jumps pause playback and center the arrangement around the destination. Ruler mode is UI state, resets to Seconds after reload, and does not modify project data/history. The agent prompt documents the same musical-position conversion; its existing transport API still takes seconds. Tempo/meter maps and drop-frame timecode remain unfinished.

Verification: `test/experimental-timeline-ruler.test.js` covers conversion, boundaries, malformed inputs, fractional frame rates, zoom, tick density and long-session limits. `scripts/browser-experimental-timeline-ruler-check.cjs` checks ruler labels/seeks, musical and timecode jumps, unchanged project data, live clock updates and display switching without interrupting playback, invalid positions, and reload. Run its playback check before taking screenshots: on this host, headless Chromium's native AudioContext constructor stalled when first invoked after the screenshot/jump sequence. The test uses the normal audio context; physical audio hardware and live model inference remain unverified.

### Graphical cycle range

A cycle strip sits above the arrangement ruler. Drag empty strip space in either direction to create an enabled range. Drag its center to move it or either edge to resize; the current arrangement snap grid/alignment applies, and Shift bypasses snapping. New ranges use absolute grid boundaries. Moving preserves duration and enabled/off state; resizing keeps the opposite end fixed. Bounds are 0–86,400 seconds and graphical edits keep a positive range of at least 1 ms. Near the visible edge, dragging scrolls the timeline. The arrangement width includes the saved cycle end so remote ranges remain reachable.

The Cycle button beside the ruler, a simple click on the range body, or Enter/Space on its button toggles the saved range. Disabled ranges remain dimmed for range export and can be edited without enabling playback. Focus the body or either end and use Left/Right to move by one snap step (0.01 seconds with Snap Off); Shift uses 0.01 seconds. Escape, pointer cancellation, lost capture, or a replaced view cancels a drag. Preview movement does not edit the document; releasing commits one `session.set` operation with a revision check and one undo. The numeric cycle form, graphical strip, agent commands and range export all read the same saved loopStart/loopEnd/loopEnabled fields. Range labels follow Seconds, Bars/beats or non-drop Timecode. Cycle edits stop current playback through the normal editing path; restart to hear the new range.

Existing playback limits remain: cycle audio is prerendered for ranges up to 10 minutes and restarts at the boundary, without continuous effect history or loop recording. Skip-cycle and seamless live range changes are unfinished. Very narrow ranges can be adjusted using the numeric cycle form or more zoom. Reference: [Apple's cycle-area guide](https://support.apple.com/nl-nl/guide/logicpro/lgcp59e41e86/10.7/mac/11.0).

Verification: `test/experimental-cycle-strip.test.js` covers bidirectional drawing, relative/absolute/free/frame snapping, bounds, positive resizing, disabled-state preservation and atomic undo. `scripts/browser-experimental-cycle-strip-check.cjs` covers preview without mutation, draw/move/resize/toggle, keyboard controls, cancellation, header alignment, musical labels, persistence, actual OfflineAudioContext cycle PCM and transport wrap arithmetic. Set `CHECK_REALTIME_AUDIO=1` to additionally check live wraparound on a host with a functioning audio clock. Live playback could not be reverified here: both Cuestamp and a standalone oscillator test showed an AudioContext clock stuck at zero, including a context reporting `running`. This is documented separately from passing offline audio and UI checks; physical output remains unverified.

### Track content protection

The lock button next to each arrangement track's M/S controls protects its contents. `track.set {protected:true}` uses the same persisted flag for manual controls, JSON commands and agent edits. Protected tracks cannot be deleted or have regions, notes, MIDI events or saved comp selections modified. Group edits, transfers and project-wide insert-time/tempo changes reject the entire batch if they would change protected content. Each command is checked separately: explicitly unlock before editing, not afterward. Undo/redo can restore earlier states, including protection.

Audio import/recording and MIDI recording reject protected destinations before beginning capture. Mix settings, instruments, effects, automation, routing, names, order and playback remain editable/usable. Protection on a bus does not propagate to its child tracks. Copies made with Duplicate track are unprotected. Whole-track bounce can create a new track and mute the protected source (a mixer change); region bounce rejects when it would mute a protected source region. Protection is an editing safeguard, not an authorization boundary or source-media freeze. The agent is instructed to request explicit unlocking rather than silently unlocking to perform an edit.

Verification: `test/experimental-track-protection.test.js` covers content operations, transfers, global edits, per-command atomic validation, undo/redo, duplicates, comp selections, import preflight and mocked agent validation. `scripts/browser-experimental-track-protection-check.cjs` checks the lock UI, rejected edits, mixing, reload, unlock/undo and sample-identical OfflineAudioContext output before/after protection. Live model inference and physical recording remain unverified. Reference: [Apple's track protection guide](https://support.apple.com/en-ae/guide/logicpro/lgcpc20c80f9/10.7/mac/11.0).

### Delete time across the arrangement

**Delete time** removes a half-open `[start,end)` interval in seconds from the entire project and closes the gap. Enter boundaries or use **Use cycle range** to copy the saved graphical cycle bounds. The agent uses `session.deleteTime {start,end}` through the same validated engine. Original media remains intact and the whole operation is one undo step. Unlike a clipboard cut, this command does not copy the removed section.

Fully contained regions are removed; crossing audio, reversed audio, MIDI and video regions are cropped/split and later material shifts left. MIDI notes/controllers are chased at the right boundary, so held notes can retrigger there. Outer fades follow existing split/clamp behavior; cutting inside a fade can change its envelope. Markers inside the interval disappear, later markers shift, and saved comp selections are clipped/remapped to surviving regions. Empty comp alternatives disappear. Cycle and punch boundaries move with the edit; fully removed ranges are disabled and reset to up to one second at the seam. Protected content rejects the complete operation atomically.

All automation scopes follow deletion: tracks, buses, master, inserts and sends, including inactive stored curves. Curves crossing a boundary use the renderer's existing 64-segment approximation. Two distinct points encode a discontinuous join: at most the final microsecond before the seam is held, then the later value resumes exactly at the seam. This avoids duplicate-time point ambiguity. Capacity limits can reject complex edits rather than discard automation. Effect state/tails are recomputed by playback; the operation does not splice a rendered master recording and can create audible hard joins. Automatic crossfades and project-section clipboard insertion remain unfinished.

Verification: `test/experimental-delete-time.test.js` covers reverse offsets, MIDI sustain/controller chase, video, markers, every automation scope/shape, saved comp references, cycle/punch ranges, full deletion, protection, capacity rejection, undo and mocked agent execution. `scripts/browser-experimental-delete-time-check.cjs` checks the form, cycle bounds, closed-gap reverse-audio PCM with curved automation, undo/redo and reload. Live model inference remains unverified. Reference: [Apple's guide to adding and removing gaps](https://support.apple.com/guide/logicpro/add-or-remove-gaps-lgcp21e2cb21/10.7/mac/11.0).

### Repeat an arrangement section

**Repeat section** copies a half-open `[start,end)` project interval immediately after itself, inserting space and moving later material right. Choose explicit seconds or **Use cycle range**, plus 1–16 additional copies. `session.repeatSection {start,end,count?}` exposes the same operation to the agent (count defaults to 1). All copies and shifts form one undo step, respect content protection and persist with the session. The region clipboard is unchanged.

Every audio, reversed-audio, MIDI and video region intersecting the interval contributes its cropped portion. Source media is shared without rendering or duplication; region, note, event, marker and copied automation IDs are fresh. MIDI controllers and held notes are chased at the copied start. Original material crossing the insertion point splits and its right side shifts. Markers within the interval repeat, excluding markers exactly at its end. Saved comp selections repeat with references to the copied regions; their existing later sections shift. Fractional-time comp endpoints are clamped only when arithmetic puts them at most 1 ns outside their source region. This rounding correction also applies to Insert time and Delete time; genuinely stale comp selections are not repaired silently.

Automation repeats across tracks, buses, master, effects and sends, including stored inactive curves. Boundary-crossing curves use the renderer's fixed linear approximation; two distinct seam points preserve jumps using at most a 1 µs hold before each join. Existing later curves shift rather than stretch through the copies. Cycle/punch ranges follow Insert time rules: a cycle ending at the source section end remains on the original; later ranges shift and crossing ranges expand. Limits on regions, automation, comps, markers and 24-hour time can reject the entire operation. Fades follow existing crop/split behavior, MIDI can retrigger at joins, and effect state is recomputed rather than copied from a rendered mix. Automatic crossfades and a movable project-section clipboard remain unfinished.

Verification: `test/experimental-repeat-section.test.js` covers cropped reverse/MIDI/video regions, multiple copies, fresh IDs, all automation scopes/shapes and boundaries, MIDI sustain, comp mapping (including 150 fractional-time repeat/insert/delete cases), range movement, protection, capacity rejection, undo and mocked agent execution. `scripts/browser-experimental-repeat-section-check.cjs` verifies controls/cycle bounds, actual reversed-audio PCM with curved automation, multiple-copy undo, redo and reload. Live model inference remains unverified. Reference: [Apple's section repeat workflow](https://support.apple.com/guide/logicpro/add-or-remove-gaps-lgcp21e2cb21/10.7/mac/11.0).

### Copy or move a project section

**Copy or move section** transfers a half-open `[start,end)` interval to another position across the entire arrangement. Source bounds can come from **Use cycle range**; the destination defaults to the playhead. `session.transferSection {mode:"copy"|"move",start,end,position}` exposes the same validated action to the agent. **Position always refers to the timeline before editing.** For example, moving 2–4 seconds to the original 6-second mark closes the two-second source gap and places the moved section at 4–6 seconds. A move destination inside or at either source boundary is rejected; copying into or before the source is supported using an unchanged source snapshot.

Copy inserts room at the destination. Move closes the source gap first, then inserts the captured section. Audio, reverse audio, MIDI and video are cropped at the section bounds and share the original source assets. Notes and MIDI controllers are chased into copied starts. Copied regions/notes/events/automation receive fresh IDs. Copied markers get new IDs; moved markers keep theirs. Saved comp sections follow the inserted regions, including restoration of alternatives fully removed from the source. Comp boundary rounding follows the existing 1 ns clamp. Cycle/punch ranges wholly contained in a moved section follow it and retain their enabled state; other ranges follow deletion/insertion rules.

Track, bus, master, effect and send automation curves travel with the section. Boundary-crossing curves use the renderer's 64-segment approximation, with at most a 1 µs hold before a seam to encode jumps without duplicate-time points. Effect history is recomputed; fades follow existing crop/split rules and held MIDI notes may retrigger. Automatic crossfades are not applied. Protection, region/automation/comp/marker limits and the 24-hour timeline reject the complete operation rather than leave partial edits. A successful operation is one undo step and persists. This direct transfer does not modify the region clipboard; a reusable project-section clipboard remains unfinished.

Verification: `test/experimental-section-transfer.test.js` covers forward/backward moves, copy destinations before/within the source, original coordinate semantics, reversed audio/MIDI/video, all automation scopes and shapes, sustain/controller chase, marker IDs, comp references and fractional bounds, cycle/punch movement, protection, capacity/overflow rejection, undo and mocked agent execution. `scripts/browser-experimental-section-transfer-check.cjs` checks the form, cycle bounds, retained inputs, actual reversed-audio PCM with curved automation, invalid move feedback, undo/redo and reload. Live model inference remains unverified. Reference: [Apple's project-section copy and insertion workflow](https://support.apple.com/guide/logicpro/add-or-remove-gaps-lgcp21e2cb21/10.7/mac/11.0).

### Named arrangement sections

The timeline has an **Arrangement sections** row above the cycle strip. Use **Sections** to open its editor, name a positive range (Intro, Verse, Chorus, scene names, etc.), or copy the current cycle bounds. Sections are persisted in `session.sections` as `{id,name,start,end}`, with up to 256 nonoverlapping ranges in absolute seconds. Older sessions default to an empty list. Section IDs share the document's global uniqueness rules. Clicking a timeline label selects it in the editor; the dropdown can select offscreen sections. **Go to section start** seeks, and **Cycle this section** sets/enables the cycle range.

**Save label and bounds** and **Remove label** change metadata only. The separate content action form can repeat, copy, move, or delete the selected section and close the gap. These actions apply across the whole arrangement, using the existing project-time engine, protection checks, validation and one-step undo. Move destinations refer to the original timeline. Section selection is local UI state, while labels and all content edits survive reload. The editor stays open when the section count changes.

Named ranges follow raw project-time commands as well: insertion splits a crossing label to leave room, deletion clips/shrinks or removes ranges, repeat/copy inserts clipped source labels with fresh IDs, and a wholly moved section retains its ID. Partially transferred labels receive new IDs for the copied portion. Overlap checks tolerate only 1 ns of timestamp arithmetic noise. Labels use absolute seconds; tempo-map/bar-anchored sections and contiguous multiselection remain unfinished. Dragging and section exchange are documented below.

Agent commands: `section.add {id?,name,start,end}`, `section.set` targeting an ID with changed name/bounds, and `section.delete` (label only). `section.editContent` targets an ID with `{action:"repeat",count?}`, `{action:"copy"|"move",position}`, or `{action:"remove"}`. The model sees the named ranges in the document and can target “the chorus” by its ID. Live model inference remains unverified.

Verification: `test/experimental-arrangement-sections.test.js` covers legacy defaults, bounds/overlap/ID validation, labels versus content, all project-time transformations, copy/move identities, protection, capacity, undo and mocked agent targeting. `scripts/browser-experimental-arrangement-sections-check.cjs` checks creation, selection, rename, sample-identical audio after labeling, move/cycle/repeat, label-only deletion, undo, timeline alignment and reload. The cycle-strip browser regression also passes with the extra row. References: [Apple's arrangement-marker overview](https://support.apple.com/guide/logicpro/add-arrangement-markers-lgcpf7c0c09c/10.7/mac/11.0) and [editing arrangement markers](https://support.apple.com/en-gb/guide/logicpro/lgcpf7c0a3d7/10.7/mac/11.0).

### Drag and resize arrangement sections

Drag a named section's body to move its contents. Hold **Option / Alt** to copy instead, including to a position inside the source. The drag uses the arrangement snap grid/alignment; **Shift** bypasses it. The insertion line marks the destination on the original timeline, while the ghost and hint show where the moved section will actually start after closing its source gap. Releasing commits one `section.editContent` command with a captured revision and one undo. A move to its own start/end is unchanged; other destinations inside itself reject. Numeric copy/move forms remain available.

Drag either small boundary handle to resize the **label only**. A shared boundary adjusts both adjacent section labels in one batch; a boundary beside a gap stops at the next section without moving it. Graphical resizing preserves at least 1 ms on affected sections and stays within 0–86,400 seconds. Arrow keys on a focused handle resize by one snap step (0.01 seconds with Snap Off); Shift uses 0.01 seconds. Content stays in place, so protected tracks do not prevent label resizing. The existing numeric bounds support finer adjustments.

Preview movement does not modify session data. Escape, pointer cancellation/lost capture or a replaced view discards the preview. Near the viewport edge, dragging scrolls the timeline. Changing Option/Alt or Shift while holding the pointer updates the preview. Additional pointers cannot take over an active drag. A click or Enter/Space on the body still selects the section. Recording/loading/agent operations block drag edits; final command validation enforces protection and capacity limits. Drag-to-swap/replace, contiguous multi-section selection and content-linked edge stretching remain unfinished.

Verification: `test/experimental-section-gestures.test.js` covers original versus resulting move coordinates, copy/no-op/invalid targets, adjacent-label resizing, clamping, relative/absolute/free/frame snapping, protection, revisions and undo. `scripts/browser-experimental-section-gestures-check.cjs` checks visible previews without mutation, moves/copies, shared resizing, keyboard/Shift controls, cancellation, invalid targets, modifier changes, edge scrolling, native selection, undo and reload. The existing arrangement-section browser regression also verifies unchanged audio for label edits and timeline alignment. Reference: [Apple's arrangement marker editing workflow](https://support.apple.com/en-ca/guide/logicpro/lgcpf7c0a3d7/mac).


### Swap and replace named sections

The section content action menu includes **Swap with another section** and **Replace with a copy of another section**. Choose the other named section from the dropdown; these actions are disabled when no other section exists. Swapping exchanges both sections, even with unequal lengths, while retaining the order of intervening material and the total arrangement length. Both section IDs survive. Adjacent sections swap without an unnecessary second move. Replacement removes the currently selected section and inserts a copy of the other at its former start. The source remains, the replacement adopts its name with a fresh ID, and later timing shifts by the length difference. The editor selects the replacement afterward.

Both operations move audio, MIDI, video, automation, markers and saved comp selections through the shared time-editing engine, preserve original assets, respect track protection and commit as one undo step. A cycle/punch range exactly matching a replaced section follows the full replacement and retains its enabled state; other ranges follow normal deletion/insertion rules. Swapped ranges follow the moved section. Existing crop/fade, MIDI retrigger, automation seam, effect-history and capacity limits still apply. The exact right edge of deleted time now maps directly to the cut start, avoiding zero-length labels and tiny enabled locator ranges caused by floating-point subtraction.

Agent commands use `section.editContent` targeting the selected section with `{action:"swap",otherId}` or `{action:"replace",otherId}`. The two IDs must exist and be different. Replacement direction matters: the target disappears; otherId supplies the copied contents. Drag-to-swap/replace and multi-section exchange remain unfinished.

Verification: `test/experimental-section-exchange.test.js` covers unequal and adjacent swaps, both replacement directions, locator behavior, marker IDs, automation curves, saved comps, 40 fractional-boundary cases, atomic undo/protection and mocked agent execution. The deletion suite also checks exact-boundary remnant removal. `scripts/browser-experimental-section-exchange-check.cjs` verifies controls, replacement selection, real reversed-audio PCM with automation, undo/redo, reload and the single-section guard. Live model inference remains unverified. Reference: [Apple's arrangement marker swap and replacement workflow](https://support.apple.com/en-ca/guide/logicpro/lgcpf7c0a3d7/mac).

### Experimental DAW: tempo-map foundation

`src/experimental/tempo-map.js` provides shared, piecewise-constant beat/time
conversion. Tempo points use zero-based quarter-note beats and BPM; the base
BPM remains `tempo`. Compiled maps validate 20–300 BPM, at most 256 changes,
unique positive beat positions, and the 24-hour timeline. MIDI retiming preserves
musical endpoints for regions, notes, controller events and fades; audio/video
retain absolute time. Existing global BPM commands now use this shared retimer
and reject MIDI that would move beyond the timeline atomically.

Musical ruler and snapping helpers accept maps. Standard MIDI file helpers
preserve conductor tempo points and use them to convert note, controller and
marker timing. MIDI tempo precision is integer microseconds per quarter note;
export timing uses 480 PPQ. The reader rejects zero tempo and the writer rejects
delta times that exceed the SMF limit instead of wrapping them.

**This is internal groundwork, not an enabled project tempo editor.** The session
schema and command harness still expose only a single BPM. MIDI imports continue
to preserve performance timing in seconds without adopting their tempo map into
the project. Before enabling saved maps, integrate the piano/drum/controller
editors, metronome and count-in, recording, tempo-synced effects, project-time
operations, grid drawing, and agent descriptions. Do not add UI controls that
would leave these consumers using contradictory clocks.

Regression coverage: `test/experimental-tempo-map.test.js` and
`test/experimental-midi-tempo-map.test.js`, plus existing ruler, snapping, MIDI,
protection and undo tests. The browser arrangement snap check covers existing
constant-tempo editing behavior.

### Experimental DAW: mapped metronome and count-in

The metronome now accepts the internal tempo map. Two shared padded buffers
(normal pulse and downbeat correction) serve all segments, with at most two
loop sources per tempo segment plus seek tails. Loop periods compensate for
sample-frame rounding; tempo changes between beats preserve bar phase. Sources
stop after their last pulse, retaining a click tail across a tempo boundary.
Seeking into a click restores its remaining sound. Constant-tempo sessions keep
the existing bar-buffer path. Metronome sound remains excluded from exports and
captured audio.

`recordingTiming(session, now, sampleRate, position)` walks backward by the chosen
number of count-in beats from the recording playback position. Both microphone
and MIDI recording callers supply that position; capture still rounds up to an
audio frame. This also supports count-in before time zero using the initial BPM.

`test/experimental-mapped-metronome.test.js` verifies resource bounds, segment
scheduling, seek tails, cleanup and count-in across tempo changes.
`scripts/browser-experimental-mapped-metronome-check.cjs` renders actual browser
OfflineAudioContext PCM to check beat spacing, bar accents, silence, seek tails,
and a tempo change during a sounding click. This does not verify hardware
real-time playback. Saved tempo-map commands/UI remain pending the other timing
consumers listed above.

### Experimental DAW: region-local musical entry

`regionBeatTiming(region, sessionOrTempo)` converts beat offsets relative to a
region, including regions starting between global beats. Note durations are
measured at the note's own starting beat. The constant-tempo path preserves
existing arithmetic and legacy callers that pass a numeric BPM.

Chord entry, the step sequencer, MIDI event entry/editing, and the split-note
form now receive session timing. Drum steps remain sixteenth notes across tempo
changes; their saved durations and enabled steps follow actual region bounds.
Split at playhead and MIDI event labels convert back to the same local beat
coordinates used by their inputs. Commands still receive seconds and continue
through the existing validation/history engine.

Coverage: `test/experimental-region-beats.test.js` checks conversions, off-beat
origins and rendered labels. `scripts/browser-experimental-region-beats-check.cjs`
uses actual DOM forms with an internal mapped fixture to check emitted chord,
event, drum and split commands. Full project tempo-map controls are still not
exposed: piano-roll gestures, multi-note transformations, controller ramps,
filters, tempo-synced effects and arrangement-time operations need integration.

### Experimental DAW: musical note conditions and transfer fields

The note-selection form compares timing conditions in region-local beats via
`matchingMidiNotesInBeats`. Each note's duration is converted at its own onset,
so equally long musical notes can match across different BPMs even when their
lengths in seconds differ. Position ranges remain half-open; other conditions
still combine with AND. Returned notes are original references and selection
does not mutate the document. Musical limits support up to 432,000 quarter-note
beats. Command JSON filters continue using seconds and their existing limits.

Transfer destination position and length feedback now use the destination
region's beat/time conversion. The existing transfer operation preserves phrase
spacing and lengths in seconds; its explanatory text states that explicitly.
The musical transfer mode described below additionally remaps individual note
endpoints; destination offset conversion alone does not preserve rhythm.

Coverage includes `test/experimental-musical-note-filter.test.js` and expanded
actual-DOM checks in `scripts/browser-experimental-region-beats-check.cjs`.
Tempo maps remain internal until all required consumers are integrated.


### Experimental DAW: preserve beats when transferring phrases

`notes.transfer` accepts `timing: "seconds" | "beats"`, defaulting to seconds for
existing commands. The transfer form exposes both modes. Beat mode measures each
note onset and end relative to the earliest selected onset in source musical
time, then converts those distances at the destination. It handles notes spanning
tempo changes and off-beat destination offsets. The command's `position` remains
seconds relative to the destination region in both modes; UI fields use beats.

Pitch, velocity, channel and mute remain intact. Copies get fresh IDs; moves
retain IDs. Source controller events stay in place, and destination controllers
apply. Extension remains explicit, invalid plans do not remove source notes,
and the shared command engine retains protection, revision and undo validation.
Constant-tempo sessions retain the existing arithmetic. The agent prompt documents
both modes; no extra provider tool or bypass of command validation is introduced.

Tests: `experimental-musical-transfer.test.js`, the expanded command/history tests
in `experimental-note-transfer.test.js`, and both timing options through actual
DOM forms in `browser-experimental-region-beats-check.cjs`. Saved project tempo
maps remain pending the remaining timing integrations.

### Experimental DAW: musical MIDI controller lane

Controller lane beat labels, point snapping and horizontal keyboard movement now
use region-local musical timing. Shift bypasses pointer snapping. The plot still
uses seconds horizontally to align with the piano-roll note display.

`event.ramp` accepts `timing: "seconds" | "beats"` (default seconds). Start, end
and maximum spacing all use the chosen unit. In beat mode, curve progression and
spacing are measured in beats, then each generated point is converted separately
to region-local seconds. The lane form emits beat-mode commands. Existing
seconds-based commands remain compatible. The shared command engine supplies
session timing and retains validation, protection and undo. Ramps retain exact
endpoints, preserve unrelated events and reject excessive point counts or
collapsed point times. The agent prompt documents both timing modes.

Verification: `experimental-musical-controller.test.js` covers tempo crossings,
curve progression, validation and command undo. The browser script
`browser-experimental-musical-controller-check.cjs` checks actual DOM labels,
keyboard movement, snapped/free point entry and ramp submission. Tempo maps
remain internal pending the remaining piano-roll, transformation, effects and
arrangement-time integrations.

### Experimental DAW: mapped arpeggiation

`arpeggioPlan` accepts either numeric BPM (legacy callers) or session timing. The
shared `notes.arpeggiate` command and UI preview now pass the session. For mapped
timing, each chord's onset/end are measured in local beats, and each generated
note onset and gated end are independently converted back to seconds. This keeps
triplets, rate and gate musical across tempo changes. Chords still restart at
their onset, stop at the next chosen chord/longest note/region end, and run
independently per MIDI channel. The flat-tempo path retains its existing exact
arithmetic. Generated patterns remain bounded by the 20,000-note region limit;
collapsed or non-finite timing rejects the edit before applying it.

Verification: `experimental-musical-arpeggio.test.js` covers tempo crossings,
off-beat triplets, gate, chord restarts, channels, legacy compatibility and
capacity. The region-beats browser check verifies actual form preview counts,
chart notes and command submission. Existing arpeggio command, MIDI roundtrip,
agent and undo tests remain applicable. Project tempo-map controls remain
pending the remaining integrations.

### Experimental DAW: musical quantization

`notes.quantize` accepts `timing: "seconds" | "beats"` (default seconds). Grid
spacing uses that unit. In beat mode, nearest swung grid points and strength
interpolation are calculated in region-local beats, then converted to seconds
through the session map. The UI emits beat mode directly. Existing command
callers using seconds remain compatible, and the agent prompt documents both.

Quantization continues to change onsets only: durations remain in seconds and
notes are clamped inside their region. Humanization remains explicitly measured
in milliseconds/seconds. Selection filters and IDs, protection, atomic batches
and undo continue through the shared command engine.

`experimental-musical-quantize.test.js` covers tempo crossings, swing, partial
strength across a boundary, zero strength, selection, limits and command undo.
The existing note-tools browser check exercises form submission, generated note
positions and history. Saved project tempo maps are still pending remaining
piano-roll, effects and arrangement-time integration.

### Experimental DAW: piano-roll musical fields and entry

Single-note start/length fields, piano note labels and velocity accessibility
labels now use region-local beat timing. Editing a note measures its duration
at the entered starting beat, including across a tempo boundary. Drawing a note
uses local beat snapping and a musical grid-step length; with snap bypassed it
uses a sixteenth-note default at the clicked position. Notes are clipped at the
region end. The split tool snaps in local beats. Constant-tempo note drawing
retains the existing path.

Tests: `experimental-musical-piano.test.js` checks placement, clipping and labels;
`browser-experimental-musical-piano-check.cjs` uses the actual piano view/bindings
to edit a note, draw one and split through a mapped fixture. This is not yet a
fully map-enabled piano roll: group drag/resize, group timing forms, duplication
and grid-line rendering still need musical integration before enabling saved
project tempo maps.

### Experimental DAW: tempo-aware piano grid rendering

Mapped piano grids render their line positions from region-local musical beats,
so spacing expands/contracts at tempo changes while the horizontal axis remains
seconds. Off-beat region origins are supported. Snap Off removes lines; returning
to constant-tempo sessions clears the mapped CSS overrides. The existing uniform
grid path remains for constant tempo.

Visual density is bounded to 1,000 lines with a minimum four-pixel interval at
the fastest mapped tempo. Dense grids are thinned by powers of two without
changing note editing's actual snap interval. Shared CSS custom properties apply
one bounded gradient to pitch rows, without adding DOM elements per note row or
allocating a large bitmap.

Unit coverage extends `experimental-musical-piano.test.js`; the browser check
verifies mapped line positions and snap switching and captures
`/tmp/cuestamp-musical-piano-grid.png`. Group gestures and group timing forms
still require integration before project tempo maps can be enabled.

### Experimental DAW: musical group moves, resizes and copies

`notes.move`, `notes.resize` and `notes.duplicate` accept `beats` as an alternative
to `seconds`; supplying both is rejected. Beat moves/copies convert each onset
and end separately, preserving musical spacing and duration through tempo
changes. Beat resize shifts the end only. Negative shifts are allowed when all
resulting notes remain valid inside the region. The existing seconds paths are
unchanged. Numeric group timing forms now emit beats directly, and the agent
prompt documents this option.

`musicalNoteShift` plans all note results without mutating input. The command
engine applies the plan atomically, preserving protection, undo, selection and
schema validation. Copies receive new IDs. Out-of-range or collapsed notes
reject the edit. Constant-tempo calculations retain original note durations on
moves/copies.

Tests: `experimental-musical-note-shift.test.js` covers tempo-boundary movement,
round trips, resize, rejected edits, command undo, copies and protection. The
musical piano browser check now submits both group timing forms. Pointer group
drag/resize still uses seconds and is the next piano-roll integration needed
before saved project tempo maps can be enabled.

### Experimental DAW: musical piano group gestures

Mapped sessions now use `musicalNoteDrag` for pointer move/resize previews. The
pointer's time displacement is converted at the grabbed onset (move) or end
(resize), snapped as a relative beat shift, and constrained for the entire group.
Pitch changes clamp as a group too. Shift bypasses snap while retaining musical
spacing and note lengths. Resize moves each end by the same beat amount and
keeps starts fixed. The committed beat command uses the same shift planner as
the preview, including each note's changed width after moving across tempo.
Constant-tempo pointer editing retains its existing path.

Unrepresentable previews retain the last valid position. Command validation,
protection and undo still apply on release. Musical shift planning rejects note
lengths over the schema's one-hour limit before preview/commit.

`experimental-musical-note-drag.test.js` covers preview/command agreement,
resize anchoring, snap bypass and group bounds. The real-mouse browser script
`browser-experimental-musical-drag-check.cjs` drags and resizes two notes through
a tempo change, checks their preview geometry and emitted commands, then applies
the shared planner to its isolated fixture. Saved project maps still require
remaining recording, effects and arrangement-time integration.

### Experimental DAW: MIDI take tempo excerpts

`tempoWindow(session, position, duration)` rebases a tempo map to an excerpt's
beat/time zero. Its initial tempo is the tempo at the excerpt start; subsequent
points inside the take are offset by that start's musical beat. It supports
recording starts between beats and exactly on tempo changes, omits unrelated
points, and validates the 24-hour range.

MIDI recording placement now captures a detached tempo snapshot. Saving the take
uses its actual duration and recording start to encode a MIDI conductor map,
instead of encoding everything at the session's initial BPM. Recorded event and
note times remain take-relative seconds before encoding, and the existing MIDI
import path reconstructs those times for placement. Count-in is not part of the
saved take. New empty MIDI regions measure their four-bar duration at the
playhead through the shared beat conversion.

Tests: `experimental-tempo-window.test.js` checks rebasing, boundaries, snapshot
isolation and note/controller MIDI roundtrips. The browser MIDI-input check
covers the existing mocked device recording workflow; it does not verify a
physical MIDI device or real-time hardware audio. Project tempo-map controls
remain pending the effects and arrangement-time integrations.

The MIDI-input browser check defaults to an OfflineAudioContext-backed graph
with a stubbed resume, because this host's real-time AudioContext startup can
stall. It still exercises real browser audio-node creation and cleanup plus the
mocked MIDI capture/save workflow, but not audible output. Set
`CHECK_REALTIME_AUDIO=1` to exercise native AudioContext on a working audio host.

### Experimental DAW: tempo-synced tremolo maps

Track, bus and master effect chains now receive tempo points from the session.
Synced tremolo schedules rate changes as steps at tempo boundaries and derives
seek phase from integrated musical beats divided by beats per cycle. This avoids
restarting phase or extrapolating the initial BPM across the whole song. Tempo
sync applies independently of effect automation Read/Off; retained free-rate
points remain ignored in sync mode. Depth automation, stereo phase and the
existing constant-tempo/free-rate paths remain unchanged.

`experimental-mapped-tremolo.test.js` checks rates, phase continuity, seeks and
retained automation. `browser-experimental-mapped-tremolo-check.cjs` renders actual
OfflineAudioContext audio through complete track/master effect chains, compares
samples with expected modulation, and compares a seek render with the matching
full-render segment. This verifies offline PCM, not hardware real-time output.
Saved project tempo-map controls are still pending arrangement-time integration.

### Experimental DAW: mapped arrangement grids and keyboard steps

Arrangement musical grid lines now convert absolute beat positions through the
tempo map. Frame/seconds grids and constant-tempo rendering retain the existing
uniform path. Mapped lines are bounded to 1,000 and thinned by powers of two when
needed for eight-pixel visual spacing; edit snapping retains its actual selected
interval. The timeline shares a bounded CSS gradient rather than adding DOM
nodes per track.

Cycle and section-edge keyboard gestures now calculate signed musical movement
at the edited position. Left steps integrate backward, right steps forward;
they can differ in seconds at a tempo boundary. Shift continues to use 0.01-second
free movement, and Off retains its fine-step fallback. Pointer snapping already
uses the mapped conversion helpers.

`experimental-mapped-arrangement-grid.test.js` checks variable spacing, bounds,
fixed-time grid compatibility and directional steps. The browser script
`browser-experimental-mapped-arrangement-check.cjs` verifies actual cycle/section
keyboard handlers and generated grid positions. Project-time insertion/deletion
and section content transfers still need tempo-map handling before enabling
saved project maps.

### Experimental DAW: tempo maps during project time edits

Insert/delete time now plan their tempo-map changes before mutating project
content. Insertion shifts points at or after the insertion in absolute seconds;
the preceding tempo holds through the gap (the initial tempo holds for insertion
at zero). Deletion removes points in the cut and restores the tempo at the old
right edge at the new seam. Deleting from zero updates the initial tempo.
Surviving point IDs are retained; newly required boundary points get fresh IDs.

`tempoFromSeconds` rebuilds musical beat positions by integrating the edited
segments, removes redundant adjacent tempos and validates the normal map limits.
There is no second MIDI retime: region/note content already follows the existing
project-time edit. Constant-tempo legacy documents do not acquire a new map field.

`experimental-tempo-time-edit.test.js` covers exact boundaries, cuts from zero,
insert/delete reversal, MIDI material shifting once, preserved tempo context and
pre-mutation rejection of map overflow. Section copy/move/repeat still needs to
carry the source tempo segments before saved project maps are enabled.

### Experimental DAW: tempo segments in section transfers

Section copy/move/repeat now insert the source tempo segment into the destination
and restore the destination's tempo immediately afterward. Source tempo is read
from the pre-edit snapshot, including when copying inside the source section.
Moves close the source gap first and preserve IDs of surviving moved tempo points;
copies and newly required boundaries receive fresh IDs. Insertion at zero sets
the source's starting tempo as the new base tempo. Repetition restarts source
tempo for each copy. Swap/replace inherit the behavior through their existing
composition of project-time and transfer operations.

`insertTempoSection` rebuilds beat anchors from edited absolute-time segments;
it does not retime copied MIDI again. Redundant adjacent tempo points are removed
and map limits are validated. Legacy flat sessions remain without a map field.

`experimental-tempo-section.test.js` covers internal points, destination tempo
restoration, insertion at zero, identity uniqueness, moves, multiple repeats,
copying inside the source, and section swap/replace. Saved project map schema,
commands and editor controls still need to be enabled and verified end to end.

### Experimental DAW: musical region repetition

`region.repeat` accepts positive `beats` spacing instead of `interval` seconds;
supplying both is rejected. Every copy's onset is independently converted through
the session tempo map. MIDI copies also remap region/note endpoints, controller
events and fade endpoints to preserve musical timing. Audio/video retain source
offsets, duration and playback speed. Copies keep independent region/note/event
IDs, and normal command validation, track protection and undo remain in force.

The region-repeat form displays its default spacing in local beats and emits the
beat command. Legacy seconds commands remain unchanged. Musical copies must end
within the timeline, and invalid spacing/capacity rejects the edit.

Tests: `experimental-musical-region-repeat.test.js` covers mapped copy placement,
MIDI internal timing/fades, unchanged media speed, IDs and command undo/validation.
The existing repeat-region browser check exercises the form and history workflow.
Saved tempo maps and their editor controls remain pending end-to-end integration.

### Experimental DAW tempo maps

The Tempo map panel adds, updates and removes step tempo changes. Its beat fields are one-based quarter notes (beat 9 means eight quarter notes from the start); command/API beat values are zero-based. The toolbar BPM controls the initial tempo. Sessions persist up to 256 unique tempo points as `tempoChanges: [{id, beat, bpm}]`; older sessions default to no changes.

Manual controls and agent commands share `tempo.add`, `tempo.set`, and `tempo.delete`. Changes preserve MIDI region, note and controller beat positions, including MIDI fades. Audio/video, automation, markers and locators retain absolute seconds. Protected MIDI tracks reject timing changes. Tempo maps support undo, local/account saves and MIDI export; this is step tempo, not tempo ramps or changing time signatures.

Verification: `node --test test/experimental-tempo-commands.test.js test/experimental-cloud-projects.test.js`; `scripts/browser-experimental-tempo-map-check.cjs` covers actual controls, reload and rendered MIDI audio timing. The agent test mocks provider responses; it does not establish live model quality.

### MIDI import tempo choices

The MIDI import timing panel controls file imports only; captured MIDI takes keep their recorded timing. Preserve performance (default) imports seconds exactly. Follow session tempo converts file beat positions into the destination map at the insertion time, including note ends, channel events and markers. Use file tempo replaces the session map from the insertion time onward with the file map, preserves earlier tempo points, and retimes existing MIDI to keep its beats. Audio/video and existing markers/automation retain seconds. The final imported tempo continues until another change is added. Each file and its tempo edit form one undo step; protected MIDI retiming rejects the whole import.

The shared `midi.import` command accepts `tempoMode: "performance" | "follow" | "adopt"`. MIDI tempo adoption/following uses the session limits (20–300 BPM, 256 changes, 24 hours). Use Preserve performance for a file outside those tempo limits. Verify with `test/experimental-midi-import-timing.test.js` and `scripts/browser-experimental-midi-import-tempo-check.cjs`.

### Repeating MIDI motifs

The piano roll’s Repeat selected notes panel adds 1–100 copies at a beat interval and can explicitly extend its region. Both Duplicate selection and the single-note Duplicate button preserve musical duration across tempo changes. Controllers are not copied by note repetition; use whole-region repetition when controller data must repeat too.

The agent/shared command is `notes.repeat`, targeting a MIDI region, with `count`, optional `noteId`/`noteIds`/`filter`, optional positive `beats` or `seconds` (never both), and `extend` (default false). Omitted spacing uses the selected phrase’s musical length. Originals retain IDs and each copy gets fresh IDs. Capacity, region boundaries, protected tracks and undo are enforced by the command engine. Verify with `test/experimental-note-repeat.test.js` and `scripts/browser-experimental-note-repeat-check.cjs`.

### Musical note reversal

Reverse note timing now offers Musical beats (editor default) and Elapsed seconds. Musical mode mirrors full note intervals within phrase/region beat bounds and preserves beat lengths across tempo changes; seconds lengths can change. The `notes.reverse` command accepts `timing: "beats" | "seconds"`, defaulting to seconds for existing commands. Both modes preserve IDs, pitch, velocity, channel and mute; controller events remain unchanged. Preview counts start or duration changes, and invalid lengths/bounds reject atomically. Tests: `test/experimental-note-reverse.test.js`, `scripts/browser-experimental-musical-reverse-check.cjs`.

### Musical phrase time scaling

Scale note timing offers Musical beats (editor default) and Elapsed seconds. Beat mode scales spacing and optional lengths through the tempo map; disabling length scaling preserves each note’s beat length at its new position. `notes.timeScale` accepts `timing: "beats" | "seconds"`; existing commands still default to seconds. The factor, phrase/region anchor, selection, explicit region extension, preview and undo work in either mode. Controllers and tempo maps remain unchanged. Absolute note ends cannot exceed the 24-hour timeline. Verify with `test/experimental-note-time-scale.test.js` and `scripts/browser-experimental-musical-time-scale-check.cjs`.

### Musical legato gaps

Legato & note lengths offers gap units in milliseconds (existing default) or musical beats. `notes.legato` accepts `timing: "seconds" | "beats"`; command gap values use that unit, with bounds −10..10. Positive beat gaps are measured backward from the next eligible onset, negative gaps forward for overlap, through the session tempo map. Last-note region-end behavior still ignores the gap. Chord grouping, channel/pitch matching, selection, shorten-only mode, protection and undo remain in effect. The UI remembers separate values for each unit. Verify with `test/experimental-legato.test.js` and `scripts/browser-experimental-musical-legato-check.cjs`.

### Musical note division

Split & divide notes offers equal division in Musical beats (editor default) or Elapsed seconds. Beat division places each part through the tempo map and applies the note-length percentage in beats, so retriggers and gaps follow the musical grid across tempo changes. `notes.divide` accepts `timing: "beats" | "seconds"`, defaulting to seconds for existing commands. Splitting at an explicit time is unchanged. The original note ID stays on the first part; other parts get new IDs. Test with `test/experimental-note-split.test.js` and `scripts/browser-experimental-musical-divide-check.cjs`, which renders and checks sound and silence for the gated parts.

### Musical MIDI region stretching

Stretch MIDI region offers elapsed seconds (default) or musical beats. In beat mode, the length input and half/double presets use the region’s beat span, and the chosen unit survives editor repaint and undo. `region.timeScale` accepts `timing: "seconds" | "beats"`; it scales region-local note endpoints, controller positions, fade endpoints and total length while keeping the timeline start fixed. Other regions, track automation and the tempo map stay unchanged. Both modes reject an absolute end past 24 hours. Verify with `test/experimental-midi-region-scale.test.js`, `scripts/browser-experimental-musical-region-scale-check.cjs`, and the existing MIDI region scale browser test for rendered sustain-pedal timing.

Tempo-only standard MIDI files are supported with **Use file tempo** (`midi.import tempoMode: "adopt"`). They update timing without adding instrument tracks and share normal undo/protection behavior. Other import modes explain that the file requires tempo adoption; truly empty files never reset tempo. MIDI decoding compiles cumulative tempo segments once and uses binary lookup for event timestamps, including repeated tempo events at the same tick. Dense-map correctness is covered by `test/experimental-midi-dense-tempo.test.js`.

### MIDI time-signature metadata

MIDI export now writes the current quarter-note meter into the conductor track (for example, session meter 7 exports 7/4), with 24 MIDI clocks per click and 8 notated 32nd notes per quarter. The decoder returns `timeSignatures` with numerator, denominator, click/notational fields, beat and seconds; same-tick events resolve to the last one. Malformed signatures reject. Imported signatures are decoded but are not yet applied to the session: variable signatures and non-quarter denominators still require ruler/metronome/session integration. Verify the real download with `scripts/browser-experimental-midi-meter-export-check.cjs` and format cases with `test/experimental-midi-signature.test.js`.

Format reference: [Standard MIDI File specification](https://www.cs.cmu.edu/~music/cmsip/readings/Standard-MIDI-file-format-updated.pdf), time-signature meta-event FF 58.

### Changing-signature groundwork

`meter-map.js` compiles time signatures independently of tempo. It accepts a base `meter` numerator and `meterDenominator` (default 4), plus up to 256 `meterChanges: [{id?, bar, numerator, denominator}]` anchored to one-based whole bars from 2. Supported numerators are 1–32; denominators are 1, 2, 4, 8, 16, 32 or 64. Points expose quarter-note beat positions. Bar/beat conversion uses notated beats; position text uses 960 ticks per notated beat.

This is groundwork, not enabled session editing: session persistence, ruler tick placement, snapping, click/count-in scheduling, project-time operations and MIDI signature adoption must be integrated before exposing changing signatures. Musical position parsing/formatting now uses the shared model and retains existing constant-quarter-meter behavior. Tests in `test/experimental-meter-map.test.js` cover changing signatures, compound denominators, tempo interactions, round trips and invalid maps.

Changing-signature ruler ticks now use the meter map: close zoom shows notated beats (eighth notes in 6/8), while distant zoom chooses whole-bar strides. Candidate generation and output are bounded to avoid allocating every bar in long sessions. Seek timestamps and position labels agree across tempo/signature transitions. `test/experimental-meter-ruler.test.js` covers 4/4 → 6/8 → 7/4, compound denominators and long-session label limits. Signature persistence/editing and snapping/metronome integration remain unfinished.

Changing-signature bar/beat snapping now shares `meter-grid.js` coordinates with keyboard movement and arrangement grid lines. Integers mark bar starts or notated beats. Relative movement preserves fractional phase in the chosen unit (halfway through one bar moves to halfway through the next), while absolute snapping chooses the nearest integer coordinate. Signed keyboard moves handle different lengths on either side of a signature boundary. Eighth/sixteenth/triplet grids remain fixed musical note values; seconds/frames remain absolute. Grid rendering thins in powers of two and caps output at 1,000 lines. Tests: `test/experimental-meter-snap.test.js`. Session exposure and metronome/count-in integration remain pending.

Changing-signature metronome scheduling now merges tempo and signature boundaries, clicks on notated beats, and accents each bar start. Count-in walks backward in the shared bar coordinate, including before time zero. Compound meters click each notated beat; custom accent grouping is not implemented. Two pulse buffers are reused across segments; extreme long periods use 8 kHz buffers to bound memory, and very dense beats shorten the click envelope to avoid truncating an overlapping pulse. Signature fields still are not exposed/persisted. Tests: `test/experimental-mapped-metronome.test.js` and `scripts/browser-experimental-meter-metronome-check.cjs` (actual offline-rendered beat/accent/seek audio). Physical realtime playback is not established by these checks.

Changing-signature MIDI export now writes every meter-map point at its quarter-note tick position, including denominator metadata and combined tempo changes. `midi-meter-map.js` converts decoded signature events back to bar-anchored maps with fresh IDs; it defaults missing metadata to 4/4, collapses redundant signatures, and rejects mid-bar changes or nonstandard notation scaling instead of rounding them. This converter is groundwork for explicit import adoption; the session still does not expose signature editing. Tests in `test/experimental-midi-signature.test.js` cover variable-meter export/conversion, duplicate metadata, unsupported imports and the 24-hour limit.

### Editable base time signatures

The metronome form now edits the saved base numerator (1–16) and beat denominator (1, 2, 4, 8, 16, 32, 64). `session.set {meter, meterDenominator}` shares the same validation; older sessions default to denominator 4. Changing the signature does not retime content. Ruler, bar/beat snapping, metronome/count-in and MIDI exports use the denominator. New MIDI regions span four bars. Drum patterns use sixteenth-note steps, or the notated beat for denominators 32/64; large bar counts use a numeric selector instead of allocating thousands of options. Tempo-point and piano-roll beat fields remain quarter-note based. Changing signatures within one session are still not exposed or persisted. Tests: `test/experimental-base-signature.test.js` and `scripts/browser-experimental-base-signature-check.cjs`.

### Pattern bars across signature changes

`pattern-bars.js` calculates drum pattern windows using the active signature and tempo maps. For a mapped session the bar selector counts project bars overlapping the region, labels the selected project bar/signature, and clips first/last cells to the region boundaries. It materializes only the selected bar, even for long regions. Sessions without signature changes keep their existing region-relative pattern grid. New MIDI regions use four continuous musical bars, retaining fractional bar position when created off a bar line.

Variable `meterChanges` remain helper-only: session persistence and signature-map editing are not enabled yet. Project time edits and meter-map preservation must be resolved first. Verification: `experimental-pattern-bars.test.js` covers changing meters/tempos, partial bars, exact endpoints and long regions; the base-signature browser check verifies the existing 6/8 UI, notes, reload and MIDI export. Full suite: 652 passing; production build passes with the existing chunk-size warning.

### Signature maps during project time edits (foundation)

`meter-time-edit.js` provides pure insertion, deletion and section-transfer calculations. It relocates signature events in seconds, then rebuilds their bar anchors using the resulting tempo map. Deletion restores the active signature at the seam; copied sections restore the destination signature afterward and assign independent IDs. Moved events can retain IDs. Redundant signature events collapse. These helpers do not retime media or mutate the source document.

The bar-anchored model cannot represent a seam falling inside a bar. Such edits currently reject explicitly instead of rounding signatures. This remains an implementation limitation to resolve for arbitrary time edits; the helpers are not yet connected to project edit commands, and variable signatures remain unexposed/unpersisted. Before wiring section commands, avoid validating their temporary empty-gap insertion map: validate the final combined tempo/signature map instead. `experimental-meter-time-edit.test.js` checks shifts, deletion seams, mixed tempo, ID preservation, copied signatures and rejection of unsupported seams.

### Signature-map integration into timeline helpers

Project insert/delete and section repeat/copy/move now apply the signature-map calculations alongside their tempo edits. Section insertion skips validation of its temporary empty-gap signature map and validates the final copied map instead. Existing sessions without variable signatures retain their behavior. Named section operations inherit these changes through the same helpers; complex exchanges can still reject an unrepresentable intermediate mid-bar seam.

`experimental-meter-project-edit.test.js` exercises the actual project editing helpers with mapped fixtures, checking marker/signature alignment, round-trip insertion/deletion, repeated compound-meter sections, copy restoration, move identity and rejection before insertion mutation. Variable maps still require session-schema persistence, editing controls, agent commands and further exchange/import coverage before exposure. The full feature is not yet enabled.

### Saved signature maps and editing controls

Variable signatures are now enabled, superseding the earlier helper-only notes above. Documents persist `meterChanges` (default empty), with up to 256 unique whole-bar changes `{id,bar,numerator,denominator}` within the 24-hour timeline. The Time signatures panel adds, edits and removes them. Shared commands `meter.add`, `meter.set`, `meter.delete` expose the same operations to the agent; base signature remains in the Metronome controls. Changes update the grid without retiming notes or media. IDs participate in global command validation; invalid batches are atomic and edits support undo/reload.

Known limits: mid-bar signatures are unsupported, time edits that create such seams reject, complex section exchanges can reject intermediate seams, and MIDI import does not yet adopt source signatures. No custom compound-meter accent groups. Live agent inference remains unverified. `experimental-meter-commands.test.js` covers persistence, CRUD, undo and invalid/atomic edits; `browser-experimental-meter-map-check.cjs` verifies the actual forms, mapped four-bar regions, 6/8 drum hits, reload and undo. Full suite: 663 passing; build passes with the existing chunk warning.

### MIDI signature adoption

MIDI signature import now offers Keep session signatures (default) and Use file signatures, independently of the tempo import mode. Shared `midi.import` accepts `meterMode: 'preserve' | 'adopt'`. Adoption keeps preceding signatures and replaces the map from the insertion onward; the last imported signature continues. Insertion must be at a project bar boundary. Follow session tempo maps source quarter-note positions onto the destination tempo; Use file tempo adopts tempo first; Preserve performance uses source elapsed times and can reject incompatible bar boundaries. No-signature files cannot adopt signatures. Signature-only files can import without creating empty tracks. Recorded takes continue to preserve session signatures by default.

Source mid-bar signatures and unusual MIDI notation scaling remain unsupported. `experimental-midi-import-meter.test.js` checks combined modes, nonzero insertion, conductor-only files, undo/persistence and atomic failure. The browser import check uploads real MIDI bytes through the file input and verifies the controls and reload. Live model inference remains unverified.

### Key-signature MIDI foundation

The MIDI codec reads/writes FF 59 key-signature metadata: signed accidentals -7..7 and major/minor mode. Decoded `keySignatures` include quarter-note beat and integrated time, with the last physical event winning at a duplicate tick. Invalid lengths, accidentals and modes reject. Optional export `keySignature` and `keyChanges` use `compileKeyMap`, which validates unique positive change beats and a 256-change limit; export checks the 24-hour boundary. Absent key metadata remains unknown. This is metadata only and never transposes notes.

These key fields are not yet in the persisted session schema or UI; MIDI import commands do not adopt them yet. This is groundwork for project keys and notation, not completed notation or key detection. `experimental-midi-key-signature.test.js` verifies all 30 encodings, signed flats, mapped timing, missing metadata and invalid files. Reference: [MIDI Association key-signature explanation](https://midi.org/community/midi-software/key-signature-message).

### Project key controls

A single project key is now persisted as nullable `keySignature: {sharps,mode}`; old documents default to unknown. The Project key panel selects all 30 standard major/minor signatures or Not set. Shared agent/manual commands are `key.set` with flat values `sharps` (-7..7) and `mode` (major/minor), and `key.clear` with empty values. These label exported MIDI without transposing any material. Undo/redo and saved documents preserve the choice.

Changing keys over time and MIDI key adoption remain unfinished. The key-map codec supports those events as groundwork, but the session still stores only one project key. `experimental-project-key.test.js` checks media invariance, persistence, exported bytes and atomic rejection. `browser-experimental-project-key-check.cjs` verifies actual controls, MIDI encoding, reload, clearing and undo. Live agent inference is not verified.

### Project key in piano-roll tools

Key & scale offers Use project key, which selects the project tonic and major/natural-minor scale and turns on highlighting. Insert a chord offers Use project tonic, which selects a root-position major/minor tonic chord. Neither button modifies notes until Apply scale or Insert chord is pressed. An unknown project key disables these actions. Enharmonic signatures resolve to MIDI pitch classes; the project key label retains its original spelling.

The shared `notes.scale` command accepts `useProjectKey: true` instead of explicit root/scale. It resolves the saved key at execution, preserves existing direction/tie/selection behavior, rejects unknown keys or conflicting explicit scales, and supports undo. This does not add harmonic-minor inference or automatic transposition. Tests cover tonic conversion, selection, unchanged timing and failure cases; the project-key browser check now verifies the highlighted guide, prepared controls, actual C-minor chord insertion and undo.

### Diatonic / scale-step transposition

The piano-roll Key & scale tool now previews and applies integer scale-step moves. In a seven-note scale +1 is the next degree, +2 a third, +7 an octave; negative values move down. It uses the chosen scale and existing region/selected-note scope. The accidentals choice either keeps each note's semitone offset above the lower scale note or rejects off-scale notes. Because MIDI pitches have no spelling, this is a defined pitch-class rule, not inferred sharp/flat notation. Out-of-range pitches reject the entire batch rather than clipping.

Shared command `notes.diatonicTranspose` accepts `steps` -70..70, explicit root/scale or `useProjectKey:true`, optional noteId/noteIds, and accidentals preserve/reject. Timing, velocity, channels and unselected notes are preserved. Existing track protection and undo apply. Tests cover major/minor/chromatic intervals, octave boundaries, selection and invalid commands. The project-key browser check verifies actual chord transposition and undo. Full suite: 676 passing; build passes. This is a committed MIDI edit; realtime transposer plugins and a global transposition lane remain unfinished. Reference for those separate Logic capabilities: [Apple Transposer](https://support.apple.com/en-lamr/guide/logicpro/lgceee5a5e6f/mac).

### Agent memory for musical edits

Recent-edit deltas now include tempo points, signature points, arrangement sections and project key additions/updates/removals. Previously the full session carried this data, but the conversation's before/after summaries omitted nested key objects and these arrays. Project keys use a separate `project key` entity, avoiding a misleading null-to-null scalar delta. Existing history count/byte bounds still apply.

`experimental-agent-musical-context.test.js` checks score deltas, request context, a validated project-key scale-step edit, undo, rejected invalid score commands and protected-track edits. It uses a mocked provider response: this proves request construction and command validation, not natural-language inference quality or a live provider connection.

### Custom piano-roll scales

Key & scale now includes Custom, with twelve note toggles relative to the chosen root. The same definition drives highlighting, pitch correction and the scale-step transpose action. UI choices survive workspace repaint for the current visit; custom presets are not yet stored as project data. At least one allowed note is required. Scales may omit the root: off-scale transposition anchors to the preceding allowed note, including across an octave boundary.

`notes.scale` and `notes.diatonicTranspose` accept `scale:'custom'` and `custom:'0,2,4,6,8,10'` (distinct semitone offsets from root). Invalid/empty definitions reject. Preset scales reject a stray custom definition, and project-key resolution cannot combine with custom notes. Tests cover whole-tone correction, sparse scales, missing tonic, octave movement and invalid inputs. The browser project-key check creates a custom scale, applies it to actual notes and undoes the edit. Full suite: 681 passing; build passes. The older Transpose notes panel still offers its preset-scale strict mode; custom scales are available in Key & scale. These tools commit reversible note edits rather than processing live MIDI through a plugin.

### Saved custom scale presets

Projects now persist up to 64 named `scalePresets` with id/name/root/custom offsets. Key & scale can save the current preset or custom scale as a new named scale, load it, update the selected entry, or delete it. Loading only prepares controls and highlighting; applying to notes remains explicit. Presets travel with session JSON/account saves; a new session starts with none. This supersedes the earlier note that custom scales could not be saved across visits.

Shared commands: `scalePreset.add` (optional id, name, root, custom), `scalePreset.set` (target ID, name/root/custom), `scalePreset.delete` (target ID, empty values). Names are trimmed, offsets validated/sorted, IDs join global command validation, and undo/redo restore changes. Agent conversation includes preset deltas. The preset tests cover validation, persistence, edit/delete/undo and escaped names. The browser project-key check saves a custom scale, reloads the page, loads it, deletes it and undoes deletion. Full suite: 683 passing; production build passes with the existing chunk warning.

### Unified transposition workflow

Transpose notes is now the single piano-roll panel for semitone and scale-step transposition. It can load the project key or the current Key & scale choices (including a loaded saved custom preset), choose off-scale rejection/offset preservation, preview and apply. Key & scale retains definition/highlighting/correction/presets; the duplicate scale-step controls were removed.

`notes.transpose` in diatonic mode now delegates to the shared diatonic engine and accepts custom/useProjectKey/accidentals. Its default remains reject for compatibility. `notes.diatonicTranspose` remains supported with preserve as its default; both allow -127..127 steps and reject pitch overflow. Existing chromatic behavior is unchanged. Tests cover all preset keys, custom/project-key modes, original selection/undo contracts, and the browser exercises both project-key and saved custom-scale transposition. Full suite (683 at run time), the added unified-command test and production build pass. Live inference remains unverified.

### Selected MIDI chord identification

Selecting two or more piano-roll notes shows exact supported chord matches, bass/inversion labels and alternate interpretations. Octave duplicates collapse for identification. Muted selected notes are included and flagged. When no common time interval exists, the UI explicitly says the notes do not all overlap. No match is an honest fallback; the analysis does not infer omitted tones, key or harmonic intent. Names use flat spellings for flat project keys and sharp spellings otherwise, not full notation-aware enharmonic spelling.

The server computes `selectedChord` from validated selected note IDs and absolute region positions and passes it to the agent. It contains pitches/classes, candidate roots/qualities/inversions, simultaneous and mutedCount, so the model need not guess the basic pitch-set calculation. Unit tests cover inversion, doubling, ambiguity, spelling, unsupported sets and cross-region timing. A mocked provider check verifies the actual request context; live inference remains unverified. The browser check selects a C-minor chord and verifies its label. Full suite (687 at run time), the added request-context test, production build and browser checks pass.

### Extended chord construction and identification

Chord insertion now includes major/minor sixths, minor-major seventh, add-nine/minor-add-nine, major/minor/dominant ninths, minor/dominant elevenths and major/minor/dominant thirteenths. These are full spelled-out interval stacks; optional omitted fifths/elevenths and jazz voicing conventions are not inferred. The inversion selector offers every tone, and the pitch builder raises preceding tones enough to make the requested extension the actual bass, even above an octave. MIDI range/capacity/time limits still reject atomically.

Exact chord analysis uses pitch classes for extension inversion matching and returns alternate matches such as C6/Am7. Existing notes.chord commands expose the new quality IDs to the agent. Tests check every supported quality in every inversion across twelve roots, bass identity, pitch-class preservation, recognition and overflow. The browser check verifies seventh-size inversion menus, actual ninth-chord MIDI notes, label and undo. Full suite: 690 passing; build passes with the existing chunk warning.

### MIDI input channel filtering

The MIDI recording strip now selects All channels (default) or one channel 1–16. The controller captures that choice when opening the input and filters channel-voice messages before both monitoring and take capture. Notes, sustain, pitch bend and other controllers from unrelated channels cannot leak into the take; accepted messages retain their source channel. The selector is disabled while opening, recording or awaiting save retry, and controller handlers also ignore changes during that state. All channels can be restored between takes. This is a device preference for the current workspace visit, not a MIDI-file import filter or a persisted project setting.

The controller unit check verifies filtering, monitoring, retained channels, note-off handling, blocked mid-take changes and returning to All channels. The browser simulated-Web-MIDI test sends unrelated notes/controllers alongside channel 3 and verifies only channel 3 is saved, then runs capture/undo/cancel/disconnect/retry/cleanup regressions. Physical hardware and real-time audio were not exercised; the browser uses its existing offline AudioContext substitute. Full suite: 691 passing; production build passes.

### MIDI input transposition

The recording strip adds Input transpose (-48..48 semitones). A per-take transform combines channel filtering with pitch changes before recording and monitoring. It transforms note-on (including velocity-zero releases), note-off and polyphonic pressure pitches, preserves other channel messages, and drops out-of-range pitches instead of wrapping them. Original Web MIDI bytes are not mutated. Settings remain locked while opening/capturing/retrying a take, keeping release messages consistent with held notes. This changes newly recorded notes only and is a per-visit device preference, not a project playback transposer.

Tests exhaust all 128 MIDI pitches for several shifts and message types, malformed input, controller preservation and controller-level mid-take locking. The browser sends channel-filtered input with +12 transposition and verifies saved pitches, then runs recording cleanup regressions. Full suite: 693 passing; build passes. Tests use simulated MIDI and the offline AudioContext substitute; physical hardware/realtime playback remain unverified.

### MIDI input velocity adjustment

Input velocity now offers From keyboard (unchanged), Add offset (-126..126), and Fixed velocity (1..127), captured with the channel/transpose settings for the duration of a take. Offset attacks clamp to 1..127. Note-on velocity zero remains a release; note-off velocity, poly pressure and controller data are unaffected. Both monitoring and capture receive the transformed messages; imported files and existing regions are unaffected. Preferences are per visit.

Tests exhaust attack velocities for several offsets/fixed values, release preservation, combined transposition and mid-take locking. Browser recording verifies fixed velocity survives capture and MIDI import, then resets the mode and exercises existing cleanup paths. Full suite: 694 passing; controller test rerun after extending locking assertions; build passes. Hardware/realtime audio remain unverified; browser MIDI is simulated.

### Live automation capture foundation

`automation-capture.js` records a single forward-moving gesture using transport timeline seconds. It validates parameter bounds, replaces same-time samples, preserves corners/extrema and removes only collinear middle points within floating-point roundoff relative to parameter range. It never silently drops new data at capacity: overflow rejects while keeping the previous gesture recoverable. Seek/loop discontinuities reject, finish requires positive duration, and copies prevent callers mutating internal samples.

This is not yet connected to mixer faders or committed into session lanes. Touch/Latch/Write automation remains unfinished. Next steps are preserving surrounding lane curves when committing a gesture, shared undoable commands, mixer/transport integration and actual audio verification. Unit tests cover long ramps, extrema, repeated timestamps, errors/capacity, cancel and finish. Full suite: 697 passing; build passes with the existing chunk warning.

### Automation gesture commit command

Shared `automation.record` targets an audio/instrument/bus track or the Master session ID. Values: parameter gainDb/pan, samples as JSON string of 2–2000 strictly increasing timeline-second `{time,value}` pairs, returnSeconds 0–10 (default .1). It replaces that parameter's touched interval, then ramps back to the previous curve. Empty lanes use the static fader value outside the gesture. Other parameters and existing Read/Off states remain unchanged. The whole command is undoable and rejects invalid/range/capacity inputs atomically.

Boundary-crossing smooth/ease curves are materialized using the renderer's existing segments, including cuts at an existing endpoint. A <=1 microsecond incoming guard represents the touch jump without duplicate-time points. A zero return duration uses a one-microsecond ramp. The surrounding rendered curve is preserved outside those seams; original point representation may change near cuts. This is not yet wired to live faders, sends/effects, Latch or Write. Unit tests check surrounding values across all curve shapes, exact endpoints, empty Master lanes, other-parameter identity, undo and invalid inputs. Full suite: 701 passing; build passes. Actual live gesture/audio verification remains pending.

### Live automation playback overrides

`scheduleSession` now exposes `automation.set(target, parameter, value)`, `release(target, parameter, returnSeconds=.1)` and `cancel(target, parameter)` for track/bus/Master gainDb and pan. This is playback-only: recording remains a separate `automation.record` command. Overrides cancel future parameter events; release ramps back to the saved effective curve and reinstates later events. Gain ramps in dB (exponential linear-gain AudioParam ramps), pan linearly. Cancel immediately restores the original curve. The controller respects Read/Off and parameter mutes through the scheduler's effective session; muted channels are excluded so overrides cannot unmute them. Stop invalidates stale callbacks. Timeline positions use the scheduler's base and seek offset, clamping events before scheduled playback begins.

Six tests cover schedule takeover/return for every curve, hold transitions, cancel, validation, seek/base offsets, master/channel integration, Off/mute and disposal using an AudioParam scheduling double. Full suite before the final integration test: 706 passing; all six targeted tests and production build pass. No actual rendered audio or hardware playback was verified for these overrides. Mixer Touch capture/commit wiring and Latch/Write/Trim remain unfinished.

### Mixer Touch recording

Mixer Fader mode now offers Static (default) and Touch recording for track/bus/Master volume and pan. During normal playback, input changes override the scheduled parameter and capture timeline samples. Release/change or blur commits one revision-checked `automation.record` command, updates the running scheduler's source curve and returns to that curve over 100 ms while playback continues. Stop, pause and seek finalize the active gesture before stopping playback. Escape and pointer cancellation discard the gesture and restore the original curve. Repainting an unfinished control cancels it so detached inputs cannot leave a stuck override. Stopped controls retain static editing. The mode is a per-visit preference.

Touch requires Cycle off and does not record during comp audition, audio/MIDI recording or pending processing. Muted/protected channels and Off/muted automation lanes reject recording; enable Read first. Empty-duration gestures cancel. Session revision, transport epoch and playback identity guard stale captures. Local commands resolve their default revision after stopping has finalized a gesture; explicit agent revisions remain checked. Latch/Write/Trim, send/effect Touch, cycle recording and moving fader readback remain unfinished.

`experimental-automation-touch.test.js` covers capture/commit/undo, cancellation, stale transport/revisions, target protection and consecutive/master gestures. `browser-experimental-touch-check.cjs` verifies actual UI record/release, continuing playback, Escape, stop and undo with a controllable clock; it separately renders real OfflineAudioContext audio to verify a -20 dB override and restoration. Physical/realtime audio remains unverified. Full suite: 712 passing; production build passes with the existing chunk warning.

### Mixer Latch recording

Fader mode now includes Latch. A moved volume/pan lane stays overridden after release until Stop/pause/seek or a mode change finalizes the pass. Multiple track/bus/Master lanes can latch together. Their `automation.record` commands commit as one validated batch and one undo; if any command fails, no lane is partially committed. The shared 100-command batch limit caps an active pass at 100 lanes. Per-owner 2,000-point limits still apply. The recorded interval returns to the previous curve over 100 ms after its endpoint.

Released lanes survive channel selection/repaint and display their held values. A new movement after a hold inserts a <=1 microsecond transition instead of interpolating across the whole untouched interval. Stop adds the final held sample. The UI shows active lane count and Discard automation pass; discard restores every live override without editing the document. Escape on a mixer input also discards the active pass. Mode is per visit, not a saved track mode. Cycle, send/effect automation, Write/Trim and general moving-fader Read feedback remain unfinished. Touch retains release-to-curve behavior; its commit callback now uses command arrays shared with Latch.

Reference: [Apple automation modes](https://support.apple.com/guide/logicpro/lgcpb1a6ab26/mac). `experimental-automation-latch.test.js` verifies hold/re-touch timing, simultaneous lanes, atomic failure, stale playback, discard and one-step undo. The browser Touch script now covers Latch held readback, multi-lane recording through Stop, undo and discard, alongside the existing actual OfflineAudioContext override/return render. Full suite: 717 passing; production build passes with the existing chunk warning. Realtime/physical audio remains unverified.

### Moving mixer automation readback

Track/bus/Master volume and pan controls now follow the effective automation curve on each transport tick and after repaint/seek. `mixer-readback.js` compiles the same fixed-segment curves as audio rendering once per session object/revision; Off and muted parameters use static values. Active Touch/Latch values take precedence. Readback only changes DOM values/labels and never dispatches an edit or changes the document. Volume sliders now cover the full -96..12 dB model range.

Pointer/input ownership prevents timer updates from overwriting a held fader; focused numeric Master inputs are left alone until blur. Labels and accessible value text describe the current level or pan. Range thumbs retain their existing step resolution; the accompanying output reflects the actual curve value. Playback/seek and paused repaint use project timeline seconds.

Three readback unit tests cover all curve shapes, Off/muted lanes/Master, live overrides, editing protection and cache invalidation after undo. The browser Touch/Latch check now also verifies automated movement, a held pointer surviving a confirmed transport tick, resumed readback after release and marker seeking. Full suite: 720 passing; build passes with the existing chunk warning. The browser audio regression renders offline; realtime/physical playback remains unverified. Write/Trim, cycle recording and live send/effect capture remain unfinished.

### Selected-channel Write recording

Mixer Fader mode now offers Write selected channel. Choosing it stops playback so the recording start is explicit. On the next Play, the selected mixer track/bus or Master starts writing both volume and pan at their effective values at the playhead, even if neither control is moved. The first audio channel is the fallback when no mixer selection exists. The selected target is fixed for that pass; another channel cannot silently join it. Released controls keep their values through Stop. The passed interval replaces previous automation and uses the same 100 ms boundary return as the recording engine. Both lanes commit in one undoable command batch.

Stop/pause/seek switches Write back to Touch. Discard/Escape restores the original live curves and switches to Touch while playback can continue. Preparing a pass with a missing, muted, protected or disabled lane cancels any already-started override and stops playback. Cycle and comp audition are rejected. The current implementation covers selected-channel gain/pan only, not arbitrary write-armed tracks, sends or effects. Trim and cycle recording remain unfinished. Reference: [Apple automation modes](https://support.apple.com/guide/logicpro/lgcpb1a6ab26/mac).

Four Write tests verify untouched control recording, hold/re-touch timing, scope, partial-start rollback, discard/zero-duration behavior, Master and undo. The browser automation check verifies automatic two-lane startup, stop-to-Touch, undo and discard, plus Touch/Latch/readback and offline audio regressions. Full suite: 724 passing; production build passes with the existing chunk warning. Physical/realtime audio remains unverified.

### Range-based automation trim

Every automation editor now offers Trim curve over a time range for its displayed parameter. Enter start/end seconds and a constant offset in the parameter's units (dB for volume/sends, -1..1 units for pan). The edit offsets the underlying curve even when no original points lie in the selected passage, retaining the surrounding curve and other parameters. Empty lanes use their static value. Out-of-range results and point-capacity overflow reject atomically instead of clipping. Zero offset leaves point data unchanged. This is an offline range edit; realtime Trim Touch/Latch recording is still unfinished.

Shared `automation.trim` values: parameter, start, end (strictly greater than start), amount, optional busId. Target track/bus, Master session ID, or effect ID. Supports all exposed automation parameters through the shared lane catalog. The range is start-inclusive/end-exclusive; guard seams of up to one microsecond represent discontinuities. Only boundary-crossing nonlinear segments are materialized using the renderer's fixed approximation; intact interior segments retain their shapes. Legacy missing-shape points mean linear. Track content protection continues to protect regions/takes rather than mixer automation, consistent with existing range edits. Existing Read/Off states remain unchanged.

The agent prompt and operation schema expose this command. Six tests cover all shapes and cut positions, default linear points, empty Master/send/effect lanes, invalid ranges/limits/capacity, undo and a mocked provider command. The browser automation script verifies actual Trim form submission, surrounding values and Undo alongside previous recording/audio checks. Full suite: 730 passing; production build passes with the existing chunk warning. Live agent inference and physical/realtime audio remain unverified.

### Changing trim-offset command

`automation.trimRecord` now composes a changing offset with existing track/bus/Master gainDb or pan automation. Values: parameter, samples JSON string (2..2000 strictly increasing `{time,value}` samples; values are offsets), returnSeconds 0..10 default .1. It includes the original rendered curve's breakpoints so eased/ramped/held base motion continues underneath the offset. During return, the offset ramps to zero while the underlying curve continues. The stored result is flattened absolute automation and is one undoable edit, not a persisted secondary lane. Existing Read/Off and other parameters stay unchanged.

Gain offsets are within ±108 dB and pan offsets within ±2; actual resulting values must still fit gain -96..12 or pan -1..1. Capacity/time/value violations reject atomically, with no clipping. Base-curve discontinuities use <=1 microsecond seams. Zero return uses one microsecond, and the shared splice adds a one-microsecond final boundary. Expanded curves and gesture samples must fit the 2,000-point owner limit. This is the command foundation for live Trim, not yet connected to a live Trim fader mode. Sends/effects and independent relative lanes are not covered by this command.

Five tests verify curve composition/return for all shapes, Master/static fallback, undo, invalid batches, Off preservation, expansion limits and a mocked agent request. The browser automation script now renders original and trimmed audio through OfflineAudioContext, checking amplitude ratios before/during/after offsets and return, alongside existing UI regressions. Full suite: 735 passing; build passes with the existing chunk warning. Live model inference and physical/realtime audio remain unverified.

### Live trim playback scheduling

The playback automation controller now exposes `trim(target, parameter, offset)`, which schedules the remaining gainDb/pan curve with a constant offset rather than freezing it to an absolute value. Rendered nonlinear segments are only expanded once; holds stay holds. Repeated trim updates always use the original lane, so offsets do not accumulate. Current and future values are checked before changing the AudioParam schedule. This currently rejects offsets that exceed a limit anywhere in the remaining curve, even if a later release might avoid that point; bounded range trim can be used instead.

After committing `automation.trimRecord`, call `replace` with the committed points and `resume` to schedule that exact curve, including its already-composed return. Ordinary absolute `release` rejects an active trim to prevent mixing offset and absolute units. `cancel` restores the original curve; stop invalidates callbacks. Mixer live Trim UI remains unwired.

Three scheduler tests cover future motion, repeated offsets, limits before mutation, single curve expansion and committed resume. The browser script now suspends an actual OfflineAudioContext render, starts a +6 dB trim while the base volume ramps, commits the captured interval and resumes the stored return. Measured amplitude ratios match the expected base-plus-offset before/during/after return. Full suite: 738 passing; browser checks and production build pass. Physical/realtime audio remains unverified.

### Live Trim Touch / Trim Latch controls

Mixer Fader mode now includes Trim Touch and Trim Latch. Controls show offsets centered at zero rather than absolute channel values (volume ±12 dB, pan ±1 in the UI). During playback, the recorder calls the live trim scheduler while capturing offset samples. Trim Touch commits `automation.trimRecord` on release, resumes the committed curve with its 100 ms return, and resets the offset display to zero. Trim Latch holds offsets across release/repaint, supports multiple channels/parameters and saves one undoable batch on Stop. Stop resets the offset display but keeps the chosen trim mode. Discard/Escape cancel active offsets; stopped trim inputs show guidance and cannot accidentally write absolute gain/pan settings.

Track/bus/Master volume and pan are supported. Existing Cycle/comp/recording/protection/Read guards apply. The scheduler still requires the offset to fit the entire remaining source curve; some offsets that would fit a shorter gesture are rejected, and bounded range trim remains available. Sends/effects, cycle automation recording and independent relative lanes remain unfinished.

Three recording tests cover composed capture/return, multiple held offsets with one-step undo, cancellation and failed live scheduling. The browser script exercises stopped-edit protection, centered controls, live Trim Touch capture/reset/undo and Trim Latch hold/stop/undo, alongside the actual offline audio trim render and previous automation workflows. Full suite: 741 passing; browser checks and production build pass with the existing chunk warning. Realtime/physical audio and live agent inference remain unverified.

### Send automation recording commands and playback

`automation.record` and `automation.trimRecord` accept optional `busId` for an existing send. Target remains the source track/bus ID; busId identifies its destination bus. Sends accept gainDb only. The shared recording-lane resolver finds the actual send points/static value, preventing edits to another source feeding the same destination or to the destination's channel fader. Missing sends, Master sends, pan and invalid samples reject; other routing/settings and Read/Off modes remain unchanged. The agent prompt documents this addressing. Live send UI is still pending.

The audio scheduler exposes live send gain parameters through an internal `sendAutomationTarget(sourceId,busId)` identity, usable with the same override/trim/resume controller as channel faders. It uses the effective automation session and excludes sends on muted sources. Internal identities cannot collide with validated project entity IDs and are not persisted or supplied to model commands.

Five tests cover source/destination isolation, absolute and trim gestures, fallback/modes, undo, invalid identities/parameters/capacity, scheduler isolation/mute and a mocked agent request. The browser automation check renders a send-only signal offline, changes the live send gain and cancels it, verifying the expected amplitude ratios. Full suite: 746 passing; browser checks and production build pass with the existing chunk warning. Physical/realtime audio and live agent inference remain unverified.

### Live send controls

Send levels now use sliders with dB readback and share the mixer's Static, Touch, Latch, Trim Touch and Trim Latch binding. The recorder carries the source track plus optional busId through capture, playback targeting, release/cancel, saved commands and resume. Multiple sends can latch independently; captured commands retain source/bus scope and one-pass undo. Trim send sliders show offsets centered at zero, with the same ±12 dB UI range and remaining-curve limit as channel trim. Write remains selected-channel volume/pan only and rejects send input during its pass.

Readback compiles effective send automation and respects both send and parent channel Off. The parent's muted gainDb automation parameter does not disable its send curve. Source mute/protection and the send's own parameter mute still block live recording. Static send edits retain existing send.set behavior. Send tap/output routing is unchanged by recording.

Controller tests cover all four recording modes, source/bus playback identity, held values, undo, and parent/send mode distinctions. The browser script exercises actual send Touch capture and Trim Latch hold/stop/undo, checking that source automation remains unchanged, alongside offline routed-send audio checks and all existing automation regressions. Full suite: 748 passing; browser checks and production build pass with the existing chunk warning. Cycle and effect-parameter recording remain unfinished; physical/realtime audio and live model inference remain unverified.

### Recorded effect parameter commands

`automation.record` and `automation.trimRecord` now accept an effect ID and any automatable parameter defined for its kind. The shared lane resolver supplies effect-specific points, fallback and limits, including EQ gain -24..24 dB and gain utility -96..24 dB rather than channel -96..12 dB. Trim offset bounds use the parameter's span; resulting absolute values must still fit its limits. Units remain the displayed units (Hz, seconds, dB, mix fraction, etc.). Static controls and busId on effect targets reject. Channel/Master/send behavior remains unchanged.

Recorded curves preserve effect bypass, Read/Off, static settings, routing and other lanes. The result is flattened absolute automation with undo. This enables agent/direct command editing; live effect knob recording and parameter bindings remain unfinished. The existing audio renderer consumes the resulting curves.

Five tests exercise every exposed effect parameter, Master effect trim, effect-specific ranges, static/unknown fields, send-scope rejection, bypass/mode preservation, undo and a mocked agent plan. The browser audio regression renders a recorded +18 dB gain-effect gesture and verifies its gain and return, proving the effect range is not incorrectly capped at the channel limit. Full suite: 753 passing; browser checks and production build pass with the existing chunk warning. Physical/realtime audio and live agent inference remain unverified.

### Live effect parameter bindings

Effect construction now registers each exposed parameter's AudioParam bindings, displayed-unit transform, interpolation type and limits with the playback controller. Multiple bindings move together: dry/wet mix, stereo width coefficients, chorus depth/mix and tremolo depth. EQ gain is already a dB parameter; the gain utility converts dB to amplitude with exponential ramps. Chorus depth converts ms to seconds; EQ frequency keeps its existing Nyquist cap. Already-rendered trim segments are not expanded twice.

The generic controller resolves registered lanes rather than assuming gainDb/pan, uses per-lane limits and schedules each binding through its original transform. Master and unmuted-track enabled effects are registered. Bypassed effects, muted-source effects, static fields and synced tremolo free-rate controls are absent. Existing set/release/cancel/trim/replace/resume operations apply. Effect UI recording remains unwired.

Five tests exercise all registered parameter types, linked binding counts/transforms, EQ vs utility gain, dry/wet, ms depth, width, bypass/sync exclusions and effect trim/return limits. The browser offline effect render now overrides a recorded gain curve, checks the live level, cancels, and checks restoration to the saved +18 dB curve and its later return. Full suite: 758 passing; browser checks and build pass with the existing chunk warning. Realtime/physical playback and live agent inference remain unverified.

### Live effect sliders

Each effect now has a separate Live controls panel with sliders for its automatable parameters. These use the mixer's Static, Touch, Latch, Trim Touch and Trim Latch modes, sharing capture, return, cancellation and undo with channel/send faders. Static mode edits only the moved parameter through effect.set. Recording does not submit the static settings form. Readback follows effective effect automation; trim sliders display offsets centered at zero with ranges based on each parameter's span. Captures use effect-specific units/limits, including Master effects.

Bypassed effects, tempo-synced tremolo free rate and selected-channel Write mode disable the relevant live sliders. Recorder guards also enforce effect/parent Read state, parameter mute and parent track mute/protection. Static controls such as bypass, filter type, decay and sync remain in the settings form. All effect panels keep their open state after recording. Cycle automation recording remains unfinished, and live trim still rejects offsets exceeding remaining-curve limits.

Controller tests exercise all four recording modes for Master effect frequency and reject bypass/Master Off/synced rate. Browser checks record an EQ sweep in Hz, verify unchanged static frequency, retain the live panel, undo, then record/hold/stop/undo EQ gain Trim Latch. Existing offline live-effect audio and channel/send regressions pass. Full suite: 760 passing; build passes with the existing chunk warning. Physical/realtime audio and live agent inference remain unverified.

### Mixer numeric input safety

Master numeric faders ignore blank, incomplete, non-finite, and out-of-range input while typing. Such values never write a static setting or automation sample. Committing or leaving an invalid field restores the last accepted value and ends any active Touch gesture; an explicit `0` remains valid. Regression coverage: `test/experimental-mixer-input.test.js`. Live model verification still requires server-only `OPENAI_API_KEY` (or the configured Anthropic key) and `DAW_AGENT_MODEL`; use `npm run check:daw-agent -- --config-only` before the billable inference check.

### MIDI opening-key import

The MIDI signature import controls include **Keep project key** (default) and **Use file opening key**. The latter sets the global project key from an explicit MIDI key-signature event at beat zero, without transposing imported or existing notes. It does not import later modulations and rejects files without an opening signature rather than assuming C major. The same operation is available to the agent/command harness as `midi.import` with `keyMode: "opening"`; `"preserve"` is the default. Key-only files can be adopted without creating tracks. The complete import remains one undoable transaction. Tests: `test/experimental-midi-import-key.test.js`.

### Key-change timeline

Project key controls now include a key-change list. `keyChange.add` takes optional `id`, positive `beat` in quarter notes from project start, `sharps` -7..7, and `mode` major/minor. `keyChange.set` targets an existing ID and updates any of beat/sharps/mode; `keyChange.delete` removes it. Up to 256 changes persist in `session.keyChanges`, with unique IDs, distinct positions and a 24-hour timeline limit. MIDI export writes the opening key and all later changes; conversation summaries include key edits. Key changes label harmony without changing pitches. `key.clear` clears only the opening signature. Project-key scale tools follow note-onset keys, MIDI import can adopt the complete key map, and arrangement edits carry key changes with the music; scale snapping and diatonic transposition can follow those changes. Tests: `test/experimental-key-changes.test.js`. Reference: https://support.apple.com/en-ca/guide/logicpro/lgcp6409cfb7/mac

### Importing a full MIDI key map

Choose **Use file key changes** in MIDI signature import, or `midi.import` with `keyMode: "adopt"`. All explicit signatures use the same timing mapping as notes: performance retains source seconds, follow maps source beats into the destination tempo, and adopt uses the newly adopted tempo. Destination keys before the first imported signature remain; that signature and all later file signatures replace the later destination key map. A signature at project beat zero replaces the opening key. Without a source opening signature, the earlier destination key (including unknown) remains until the first imported signature. Notes are never transposed. Missing signatures, capacity overflow, and timeline overflow reject the entire import, including tempo changes. Opening-only and preserve modes retain their previous behavior. Regression coverage is in `test/experimental-midi-import-key.test.js`.

Browser regression: `scripts/browser-experimental-keys-check.cjs` imports a MIDI file through the actual file input, selects full key-map adoption, edits/adds/removes signatures through the UI, checks undo, and reloads to verify persistence. It uses mocked account/API responses and does not verify live model inference.

### Key changes during arrangement edits

Timeline insertion/deletion and section copy/move/repeat/swap/replace now rebuild key-change beat anchors from the edited tempo timeline. Retained passages preserve their original key, inserted sections carry their starting key and internal modulations, and destination harmony resumes after the insertion. Cutting the project opening adopts the key at the surviving start. Redundant adjacent signatures are coalesced. Undo restores all affected content together. Unknown opening keys remain unknown; a transfer requiring an unknown key *after* a known key currently rejects with guidance to set an explicit opening key, because the current key model cannot represent that reset. Tests compare the resulting key at dense timeline positions, including tempo changes and unequal section swaps: `test/experimental-key-time-edit.test.js`.

### Scale editing across key changes

**Follow project key changes** in Key & scale and Transpose notes resolves each selected note's key at its project onset (region start + note start, mapped through the tempo timeline). Sustained notes retain their onset key. The same behavior applies to `useProjectKey: true` in `notes.scale`, `notes.diatonicTranspose` and diatonic `notes.transpose`. Unknown keys reject only affected selections, with no partial edit. Explicit scale choices remain available; **Load opening key** copies the initial signature into those choices. Row-wide scale highlighting is disabled while following changing keys because a single highlighted keyboard cannot represent multiple passage keys. Key/pitch metadata is not an automatic realtime pitch-following system.

### Instrument pitch-bend range

MIDI channels in the mixer expose **Pitch-bend range · ± semitones**. `track.add`/`track.set` accept `pitchBendRange` from 0 to 96 (fractional allowed), default 2. The range is persisted and copied with instrument settings. Synth/sampler playback, offline audio bounce, sampler seek integration, and live MIDI monitoring use it consistently; drums ignore bend. Zero disables pitch displacement while retaining raw MIDI events. Imported RPN pitch-bend sensitivity messages override that default, and MIDI export inserts sensitivity setup when custom ranges or RPN data are present. The receiving instrument must support RPN 0. Unit coverage: `test/experimental-pitch-bend-range.test.js`. Browser verification: `scripts/browser-experimental-bend-check.cjs` measures actual OfflineAudioContext output frequencies for synth, sampler playback after seeking, and simulated MIDI monitoring at multiple ranges. Physical MIDI/audio hardware remains unverified.

### RPN pitch-bend sensitivity

Playback, sampler seek integration and live monitoring interpret RPN 0 per channel: CC101/100 select the parameter, CC6 supplies semitones and CC38 cents. RPN null and NRPN selection prevent unrelated Data Entry messages changing sensitivity. Sensitivity updates affect held bends immediately. CC121 centers pitch bend and clears the parameter selection while retaining its sensitivity. Region splits/trims preserve the ordered RPN/bend/reset history needed to reconstruct that state. Track defaults remain 0–96 semitones; RPN data supports its full semitone-plus-cent byte range. CC96/97 increment/decrement and other RPN parameters remain unsupported. MIDI export preserves the original controller messages and initializes the track default when custom ranges or RPN data are present. Tests: `experimental-pitch-bend-rpn.test.js`; browser audio frequency regression includes RPN overrides. Reference: https://midi.org/about-midi-part-3midi-messages

### Exported pitch-bend setup

For sessions with custom instrument bend ranges or RPN data, MIDI export initializes sensitivity at each exported non-drum region start for every used MIDI channel: select RPN 0, write semitones/cents, deselect RPN, and center bend. Original region events follow at the same tick, so explicit source sensitivity and bend messages win. Later regions reset to their track defaults, matching region-local playback. Defaults are rounded to the nearest whole cent for MIDI 1.0; source events retain their values. Muted content follows the existing include-muted export setting. Original channel assignments remain unchanged: overlapping regions/tracks sharing one MIDI channel cannot maintain independent bend/controller state on an external multitimbral instrument. Tests: `test/experimental-midi-bend-export.test.js`.

### Reassign MIDI channels

The MIDI region inspector offers **Reassign MIDI channel**, with region or whole-track scope, source/destination channels, a count preview, and an explicit merge option for occupied destinations. `midi.remapChannel` exposes the same operation to the agent, targeting a MIDI region or track with zero-based `from`/`to` (0–15) and optional `merge` (default false). It moves notes and all channel events together without changing IDs, timing, pitches, values or event order. Track protection and undo apply. Other tracks are unchanged; this is explicit channel reassignment, not an automatic 16-channel allocator. Tests: `test/experimental-midi-channel-remap.test.js`.

### Automatic MIDI channel allocation

The mixer’s **Organize MIDI channels for export** section previews reassignment and applies it with `midi.allocateChannels` (empty values, optional current-session target). Each original channel on each non-drum MIDI track receives an independent destination; notes and controllers move simultaneously to avoid remapping chains. Unique existing assignments are preserved before collisions are assigned remaining channels. Drum tracks and their actual channels stay fixed; channel 10 is reserved as well. Protected instrument assignments stay fixed, and conflicting protected assignments reject. Muted content and controller-only parts are included. Insufficient capacity rejects the complete edit. This saves project channel assignments with one undo step; it does not split overlapping same-channel regions within one track or support additional MIDI ports. Tests: `test/experimental-midi-channel-allocation.test.js`.

### MIDI controller thinning

Each controller lane has **Thin controller data** with a preview of removed event count and maximum raw-value difference. `event.thin` targets a MIDI region and accepts `type` (controlChange/pitchBend), zero-based `channel`, `parameter`, integer `tolerance` (default0), and optional region-local second bounds `start`/`end`. Allowed continuous CCs are 1,2,4,7,10,11,71,74; sustain64 supports exact duplicates only. The thinning comparison uses held values, matching MIDI playback rather than assuming interpolation. First/last selected points, coincident lane points, resets, extrema endpoints (except redundant sustain duplicates) and centered bends remain. Other lanes, RPN/mode messages, notes, IDs and retained event order remain unchanged. Tolerance is raw MIDI units, not acoustic loudness or cents. Undo restores the edit. Tests: `test/experimental-controller-thin.test.js`. General reference for scoped MIDI transforms: https://support.apple.com/en-lamr/guide/logicpro/lgcp2158341a/10.7/mac/11.0

### Tempo curves

The Tempo map panel includes **Create tempo curve**, with a step-curve preview, one-based UI start/end beats, start/end BPM, linear/ease-in/ease-out/S-curve shape, beat spacing and a continue/restore choice. `tempo.ramp` uses zero-based `startBeat`/`endBeat`, `fromBpm`/`toBpm`, positive `step` (default .25), `curve` (linear/easeIn/easeOut/easeInOut), and `continueAfter` (default true). It generates explicit held tempo points, matching the existing playback and MIDI-export model. The maximum spacing is subdivided evenly across the range. Earlier/later points remain; points inside the range are replaced. Continue false restores the original tempo at the end, while true holds the new ending tempo until a later existing change. MIDI beats are preserved, audio/video/automation retain seconds, and one undo restores the whole change. The project cap remains 256 tempo changes. This is density-based tempo-curve generation, not an analytic continuous tempo function. Tests: `test/experimental-tempo-ramp.test.js`. Reference: https://support.apple.com/en-asia/guide/logicpro/lgcpf7cb8542/mac

### Proportional tempo scaling

**Scale existing tempo** in the Tempo map panel accepts a percentage and whole-project or beat-range scope. A range preview reports its original and new duration. `tempo.scale` exposes `factor` (>0 through 16; 1.1 = 110%) with optional paired zero-based `startBeat`/`endBeat`. Existing tempos are multiplied while beat anchors and IDs remain; missing range boundaries are inserted and the original tempo resumes at the end. Earlier/later tempo values are unchanged. MIDI is retimed to preserve musical beats, while audio/video/automation remain fixed in seconds. Factor 1 does not modify tempo data. BPM outside 20–300 or more than 256 points rejects atomically. Tests: `test/experimental-tempo-scale.test.js`; browser preview/apply/undo coverage is in `scripts/browser-experimental-keys-check.cjs`.

### Constant tempo with a fixed endpoint

Experimental → Tempo map → Make tempo constant simplifies the selected passage to one BPM while keeping its duration and endpoint time. The UI uses one-based quarter-note beats; the shared `tempo.constant` command uses zero-based `startBeat` and `endBeat`. The BPM is total beats divided by elapsed minutes, not an arithmetic average of tempo values. Original tempo resumes at the end boundary. MIDI inside the passage moves to retain musical beat positions; later music retains its timing. Audio, video, and automation retain absolute seconds. One undo restores the tempo map and MIDI timing. Already constant ranges leave tempo data unchanged.

Verification: `node --test test/experimental-tempo-constant.test.js` covers boundary preservation, downstream timing, MIDI retiming, fixed video, invalid ranges and undo. `scripts/browser-experimental-keys-check.cjs` exercises the preview, apply and undo controls in Chromium.

### Relative MIDI bend sensitivity

Playback, sampler seeking, and MIDI monitoring support RPN 0 Data Increment (CC96) and Data Decrement (CC97). Each message changes sensitivity by one cent, ignoring its value byte; 100 cents carries to the next semitone. Null/NRPN selections and Reset All Controllers disable further data changes until RPN 0 is selected again. Limits saturate rather than wrap. Ordered relative messages survive region trims and MIDI export/import, including repeated identical messages. Agent event commands can create these messages; other RPN/NRPN relative parameters remain unsynthesized.

Source: MIDI Association [RP-018](https://midi.org/response-to-data-increment-decrement-controllers), downloaded recommendation. Tests: `test/experimental-pitch-bend-rpn.test.js`; native OfflineAudioContext renders in `scripts/browser-experimental-bend-check.cjs` cover synth, sampler seek, simulated live MIDI and MIDI export/import. Physical MIDI hardware is not verified by this check.

### Editing bend-range changes within a region

Select a MIDI region and open **Pitch-bend range change** in the inspector. Choose a region-local time in seconds, channel (1–16 in the UI), and range (0–96 semitones). The preview displays current and requested sensitivity; Add range change inserts all six required MIDI messages as one undoable edit. The agent uses `midi.bendRange` with `start`, `range`, and zero-based `channel`. Values round to the nearest cent.

Existing notes, wheel values and other channels remain untouched. The previous RPN/NRPN selection is restored after writing sensitivity, so subsequent raw data-entry events retain their destination. Later sensitivity events still apply. Protected regions and invalid times reject atomically. Drums ignore pitch bends. Individual generated events remain visible in MIDI events. Tests cover held bends, selector restoration, same-time ordering, channel isolation, validation, protection and undo; the browser check exercises preview/apply/undo.

### MIDI channel fine and coarse tuning

The synth, sampler, offline audio render and live MIDI monitor honor RPN 1 (14-bit fine tuning, center 8192, 100/8192 cents per unit) and RPN 2 (coarse tuning, center 64, 100 cents per unit). Both add to pitch bend and remain in effect after CC121; drums ignore them. CC96/97 adjusts fine tuning by one unit or coarse tuning by one semitone, saturating at the valid bounds. Null and NRPN selections block these writes.

Use the MIDI events editor or agent `event.add` commands: select CC101=0, CC100=1 for fine or 2 for coarse, then CC6 and (fine only) CC38. Trims retain ordered parameter history, and seeking integrates tuned sampler playback. When RPN initialization is needed, MIDI export resets fine/coarse tuning at each region start before source events, matching the per-region playback model. Overlapping regions sharing an external MIDI channel cannot maintain independent tuning; use separate channels for independent parts.

Source: [MIDI Association controller table](https://midi.org/midi-1-0-control-change-messages), plus RP-018 for relative adjustments. Tests: `test/experimental-midi-tuning.test.js` and `scripts/browser-experimental-tuning-check.cjs` (native browser synth/sampler render, seek, MIDI roundtrip and simulated live held note). Physical MIDI hardware remains unverified.

### Channel tuning editor and agent command

Select a MIDI region → **Channel tuning change**. Enter the position (region-local seconds), MIDI channel (1–16), coarse semitones (−64 to +63), and fine cents (−100 to +100). Preview reports the actual rounded value; MIDI fine resolution is 100/8192 cents, so +100 maps to +99.98779296875. Add tuning change inserts eight events as one undoable action. Set coarse and fine to zero to restore equal temperament.

The agent command is `midi.tuning`, with required `start`, `semitones`, `cents`, and optional zero-based `channel` (default 0). It preserves notes and wheel values and restores the previous RPN/NRPN selection. Existing later tuning events remain active. Track protection, bounds and final event limits apply atomically. The tuning and bend-range editors share parameter-state reconstruction. Tests cover quantization, zero reset, selector restoration, channel scope, protected contents and invalid input; browser checks cover preview/apply/undo and native rendered audio through the command.

### Fit music to a picture timestamp

Experimental → Tempo map → **Fit music to a timestamp** accepts a start/end quarter-note beat and an absolute endpoint in project seconds, or a project marker. UI beats count from 1. It proportionally scales the existing tempo changes in the passage, preserving the start time and relative tempo variations. The original BPM resumes at the end beat. Preview reports the endpoint, multiplier and shift of later MIDI.

The shared agent command `tempo.fit` takes zero-based `startBeat`, `endBeat`, and `targetTime` in absolute project seconds. MIDI notes and regions preserve beat positions, including later material shifting by the duration difference. Audio/video, markers and automation remain at absolute times. Impossible BPM (outside 20–300), invalid ranges, excessive tempo point counts and timeline bounds reject atomically. One undo restores the entire change. An already matching endpoint leaves tempo data unchanged.

Reference workflow: [Apple Tempo Operations](https://support.apple.com/en-gb/guide/logicpro/lgcp0f61a684/mac). Tests cover nonzero starts, varying tempo, exact endpoints within floating-point tolerance, downstream shifts, fixed video/markers, invalid ranges and undo; browser checks cover choosing a marker, preview, apply and undo. This operation does not time-stretch audio or lock later MIDI to picture.

### MIDI regions with fixed timing

In a selected MIDI region’s inspector, disable **Follow tempo changes** and Apply edits to keep the region’s start, duration, notes, controllers and fades in seconds during tempo edits. The timeline labels it **Fixed timing**. Defaults and older sessions continue to follow tempo. This applies to tempo add/set/delete, initial BPM, curves, scaling, constant tempo, timestamp fitting and adopted MIDI tempo maps.

Agent `region.add` and `region.set` accept `tempoFollow:false` (MIDI only); `true` reenables following from the region’s current musical position. Toggling never moves content. Copies and splits retain the setting; joining different modes rejects until they agree. This is a tempo response setting, not a general edit lock: explicit moves, trims and arrangement edits still apply. MIDI file export preserves performance timing but cannot round-trip this app editing preference.

Reference: [Apple absolute-time workflow](https://support.apple.com/en-gb/guide/logicpro/lgcpfffcaf81/10.7/mac/11.0). Verification: `test/experimental-midi-fixed-timing.test.js` covers tempo operations, adoption, undo, serialization, duplication, mixed joins, protection and MIDI export; the browser check exercises the inspector, indicator and tempo change.

### Selected MIDI timing modes

Select multiple regions with Command/Ctrl-click or the arrangement marquee. The group inspector shows how many selected MIDI regions keep fixed timing, with **Keep MIDI timing fixed** and **Make MIDI follow tempo** actions. Audio/video in mixed selections stay unchanged. Buttons disable when all selected MIDI already match. One undo restores the group.

The shared `regions.tempoFollow` command accepts comma-separated `regionIds` and boolean `tempoFollow`. It validates every ID, requires at least one MIDI region, rejects protected changes atomically and avoids adding explicit defaults to already-matching protected regions. Regression checks verify fixed mode survives split, clipboard paste and repeat. Browser checks exercise both group buttons and undo.

### MIDI Reset All Controllers consistency

CC121 now restores expression to 127 and sustain to zero during scheduled playback, seeking and controller chasing; a reset releases pedal-held notes. Trimming and Sustain pedal to note lengths use the same release boundary. Reset messages remain when pedal data is removed because they also affect other controllers. Volume and pan remain unchanged, as do bend sensitivity and channel tuning. Live monitoring retains tuning when centering the pitch wheel. Parameter selection is cleared for both RPN and NRPN.

Source: MIDI Association RP-015, linked from [MIDI 1.0 Addenda](https://midi.org/midi-1-0-addenda). Supported synthesis does not yet implement every controller listed in RP-015. Tests cover reset/renewed controller state after chasing, note release/trim/conversion, channel gain scheduling and native audio rendering; the tuning render check includes a reset on a held live note.

### Reset-aware controller curves

Expression, sustain and pitch-bend lanes display CC121-derived resets as outlined squares, and their step curves follow actual reset order, including messages sharing a timestamp. Volume and pan do not show a reset because CC121 leaves those values intact. Reset markers are annotations rather than editable lane points: use MIDI events to modify or delete the underlying CC121 message. Clicking a reset marker does not create another event. This preserves the reset’s effects on other controllers. Tests compare reset-derived curve values with playback state and browser-check marker behavior.

### Dense MIDI playback scheduling

The audio engine groups region events by MIDI channel once and compiles gain/pan, sustain-release and pitch/tuning timelines once per active channel. All voices reuse this interpretation. Sustain and seek positions use binary lookup; pitch scheduling visits only points inside the note's audible interval. Sampler seek integration reuses the compiled pitch timeline. The cache is local to each scheduling call, so edits cannot leave stale controller state behind.

Tests compare compiled behavior against direct evaluation for unsorted and same-time events, verify 20,000 events/notes, and render tuning, sampler seeks and controller resets in Chromium. A local Node microbenchmark with 2,000 controller events measured approximately 69 ms for the former repeated gain scans versus 1 ms for compilation. This is a preparation benchmark, not a promise about end-to-end playback startup or physical hardware latency. Node creation, decoding, effects and the number of audible voices still contribute to startup cost.

### Indexed sampler pitch integration

Sampler seek offsets use a per-channel range-sum index over pitch/tuning playback rates. Construction is linear in controller points; each note’s interval query is logarithmic instead of scanning earlier bends. The index sums only spans inside the requested interval, avoiding cancellation from subtracting large prefix totals when very short low-pitch passages follow extreme earlier tuning. It is rebuilt with each playback schedule, and sampler root/coarse/fine tuning still applies independently.

Tests compare indexed offsets against piecewise integration, verify boundaries and numerical precision, and render synth/sampler tuning and bends in Chromium. A local benchmark of 2,000 seek calculations over 20,000 pitch events measured about 126 ms for scanning versus 1.25 ms for indexed queries, excluding compilation; the aggregate offset difference was below 1e-10 seconds. This does not measure full playback startup, decoding or device latency.

### Audio time-stretch processing foundation

`audio-stretch.js` uses pinned `@soundtouchjs/core` 2.1.1 (MPL-2.0) and its WSOLA Stretch processor for pitch-preserving duration changes. The client runs it in a dedicated module worker, copies source PCM before transferring it, reports progress and terminates on AbortSignal cancellation. Validation supports mono/stereo, 8–192 kHz, 50 ms–10 minute source clips, duration ratios 0.5–2, and a 250 MB combined source/output PCM budget (additional worker/internal memory is needed). Output is cropped to the requested sample count after bounded silence drains the overlap windows. Ratio 1 returns an exact independent copy.

The audio-region inspector now exposes Time and pitch (50–200% duration). It creates a 32-bit float WAV in local media storage, adds a track below the source, and mutes only the original region. Source offset and reverse are rendered; region gain and scaled fades remain editable, as do copied track effects/routing/automation. Automation keeps its original timeline times. Undo restores the original and redo reuses the rendered asset. Progress and Cancel render are available; navigation aborts the worker. Session changes invalidate pending output, and failed commits remove the new asset. The agent uses the dedicated `stretch_audio_region` tool with regionId (null for captured selection) and ratio (0.5–2). The browser advertises this capability and performs the actual render through the same manual path. Both server and client validate the captured session/revision and source; raw rendered-asset commits from the model are rejected. Requests cannot mix stretching with other edits or follow-up actions. Cancel request terminates the shared worker operation; a project change invalidates pending output. Agent history records a successful edit only after the audio asset and session commit succeed. WSOLA is not lossless and can introduce transient/texture artifacts; it is not Logic Flex parity. Automated verification covers sine pitch, exact frame count, stereo phase/isolation, source preservation, validation and worker cancellation. Listen to real music before judging production quality. Third-party attribution is in `public/licenses/soundtouchjs.txt`. Browser editor verification (`scripts/browser-experimental-stretch-editor-check.cjs`) imports a real WAV, stretches it, checks undo/redo and reload, and decodes the persisted output. Session tests cover atomic invalid commits, protection, frame matching and stale revisions. Agent tests verify strict tool arguments, capability gating, captured selection, continuation rejection and fabricated-asset rejection. Browser tests use mocked model responses with real worker rendering and verify undo and delayed-response rejection; live model inference remains unverified.

### Fit stretched audio to musical length

The audio-region Time and pitch panel can use either a duration percentage or a length in quarter-note beats. Musical length is measured from the region’s existing start through the complete tempo map, including any tempo changes; it does not snap the region start. The target duration is converted to the existing 50–200% stretch ratio and rendered through the same worker, asset storage and undo transaction. This is a uniform stretch that fits the endpoint, not transient-by-transient warping or automatic tempo following after subsequent tempo edits. Fades scale, while copied track automation remains at its original absolute times.

The agent’s capability-gated `fit_audio_region_beats` tool takes `regionId` (null for captured selection) and `beats`. The server resolves the ratio against the captured document rather than having the model approximate it from the initial BPM. The client applies existing revision and rendered-output checks. Unit tests cross a tempo boundary from a nonzero region start and reject unsupported ratios; the browser test selects Musical length, renders a six-beat clip, verifies persistence and undo, then exercises agent rendering and stale response rejection.

### Audio pitch transposition

Select an audio region and open **Time and pitch → Pitch only**. A signed semitone value from −12 to +12 (fractional values supported) creates a new 32-bit float audio file at the original duration and timeline start. The original region is retained and muted; undo/redo use the same asset transaction as time stretching. Source trim/reverse are rendered, while gain, fades, effects and routing stay editable. The worker uses the pinned SoundTouch core pitch pipeline with Lanczos resampling and WSOLA duration compensation. Zero shift returns an exact independent copy; nonzero shifts can introduce artifacts and do not preserve vocal formants. This is whole-region transposition, not note detection, pitch correction, or Logic Flex Pitch parity.

The `transpose_audio_region` agent tool accepts a nullable captured `regionId` and finite `semitones`, gated by the browser's existing audio-render capability. Both sides validate source and session context. Raw `region.commitPitch` output fabrication is rejected. Cancellation, stale-session rejection, storage rollback and one-step undo reuse the manual render path. Unit tests measure upward/downward/fractional shifts, fixed sample count, stereo phase and isolation, finite output, and atomic commits. Browser tests decode a persisted octave-up WAV and measure its frequency, exercise manual/agent rendering and undo, and retain the stretch regression checks. Live model inference and perceptual evaluation on real music remain unverified.

### Strip Silence preview and editable regions

An audio region's inspector has **Strip silence** with threshold (dBFS), minimum quiet gap, pre-roll and post-roll. Preview scans cropped/reversed raw source PCM in a cancelable worker; either stereo channel exceeding threshold keeps the interval. Short interior gaps remain inside a retained region; padding clips to region bounds and merges overlapping ranges. The preview shows retained timeline spans, requires an explicit Apply, and is invalidated by settings or session changes. Entirely quiet audio and an unchanged whole-region result leave the source untouched.

Applying creates a new track of regions referencing the existing source file and mutes the original region. Absolute timeline positions, source offsets (including reversed clips), gain, effects, automation and routing are retained. No audio file is rewritten or uploaded. Original fades are retained only on segments touching the corresponding original edge; internal cuts have no added fades, so use pre/post padding or edit fades to avoid clicks. This is source-level detection before region gain/fades and channel processing. One undo restores the original. Analysis supports mono/stereo, up to 10 minutes and 250 MB of PCM, and at most 1,000 retained regions.

The dedicated `strip_audio_silence` agent tool accepts preview/apply, a nullable captured region ID, and validated detection settings. The browser advertises `allowSilence`, analyzes real PCM locally, and shares the manual commit transaction. Raw `region.commitSilence` commands from the model are blocked so it cannot invent detected ranges. Preview opens the result panel without changing project history; apply leaves all-silent or unchanged results intact. Cancellation and stale-session checks cover analysis and commit. Persistence failure rolls back history, and the agent records success only after a committed edit. Unit tests verify stereo activity, exact ranges, silence, gap merging, padding, invalid data, reversed offsets and atomic undo. `scripts/browser-experimental-silence-check.cjs` imports a WAV and verifies actual worker analysis, preview invalidation, apply, undo/redo, reload, agent preview/apply, and all-silent preservation. Model responses are mocked; live inference is unverified. Reference: [Logic Remove Silence controls](https://support.apple.com/en-ie/guide/logicpro/lgcp86ee7672/10.7/mac/11.0). This implementation does not yet offer zero-crossing adjustment or claim exact Logic detection parity.

### Measured audio-region normalization

**Normalize region gain** measures the selected, trimmed source in the existing analysis worker. Measurement excludes region gain/fades and downstream effects, routing and mixing; reverse does not change the measured sample distribution. Mono is duplicated only for the stereo analysis worker, preserving its RMS level. The source file is never modified. Choose sample-peak or RMS normalization, inspect the predicted gain/peak/RMS, then apply a single undoable region-gain edit. RMS mode limits gain to its sample-peak ceiling and reports when that prevents reaching the requested average. Peak mode targets the requested peak directly. Targets span −60 to 0 dBFS and resulting region gain must fit −96 to +12 dB. Silence cannot be normalized.

RMS is average sample power, not LUFS; sample peaks are not true peaks. This does not guarantee a final mix ceiling after effects or overlapping regions. This panel covers one selected audio region; multi-selection normalization is documented below. Reference: [Logic's nondestructive Normalize Region Gain](https://support.apple.com/en-ae/guide/logicpro/lgcp663fdd13/10.7/mac/11.0).

The capability-gated `normalize_audio_region` agent tool takes measure/apply, a nullable captured region ID, and mode/targetDb/ceilingDb. Apply always measures actual source audio before calculating gain. Server and browser validate settings and captured context; worker cancellation, revision checks, persistence rollback and undo protect the edit. Repeating an already matching target does not create another undo entry. Unit tests verify source preservation, existing-gain replacement, RMS power aggregation and peak limiting, invalid/stale/protected data and tool gating. The browser suite imports a known-amplitude WAV, checks measured manual and mocked-agent gains, and undoes both. Live model inference remains unverified.

### Batch region normalization

Select multiple regions and open **Normalize selected audio**. Measure first, then choose individual targets, shared gain per track, or shared gain across the selection. Shared modes include existing region gain and add the same dB change within each group, preserving its current balance. RMS averages clip power weighted by duration, including silent clips; overlapping regions are treated as separate excerpts, not rendered as a simultaneous mix. The ceiling is the largest individual clip sample peak in a group, not a summed-mix or true-peak ceiling. Individual silent regions and wholly silent groups remain unchanged.

Up to 100 selected regions can be requested. Mixed selections leave MIDI/video unchanged and require at least one audio region. Every selected audio source is validated and measured before any gain change. Unknown/duplicate IDs, protected tracks, stale measurements, missing audio or an out-of-range gain reject the batch. Each clip uses the existing ten-minute/250 MB PCM analysis bound. Successful changes commit in one transaction and one undo step; storage failure restores history. Preview becomes stale after document or selection changes. The original audio files remain untouched.

The agent `normalize_audio_regions` action supports measure/apply, explicit regionIds or null for captured selectedRegionIds, and grouping/mode/targetDb/ceilingDb settings. It uses the same capability gate as single-region normalization and never accepts model-provided measurements. Tests cover balance preservation, duration-weighted RMS, peak limiting, independent track targets, silence, protection, stale inputs and tool gating. Browser checks compare manual and mocked-agent shared-gain results and undo the complete batch. Live model inference remains unverified.

### Detailed audio waveform editor

The audio-region inspector's **Audio waveform editor** loads an exact min/max source index in a cancelable worker, preserving even single-sample transients. The cached index is keyed to the decoded buffer object so importing a different file with the same asset ID cannot reuse stale peaks. Mono/stereo sources within 250 MB decoded PCM are supported. The view respects the region's trim, source offset and reverse flag; it displays source amplitude before gain/fades/effects, with separate stereo lanes.

Zoom in/out, Fit region and pan controls support magnification down to a 16-sample window. Click to place a sample-aligned timeline cursor. Arrow keys move one sample, Shift+Arrow moves 10 ms, and Home/End go to the region boundaries; the view follows the cursor when it leaves the visible window. **Split at cursor** uses the existing validated `region.split` command, source preservation, comp-reference handling and undo. Transport and split commands remain available to the agent through its existing tools; the new waveform view is a manual navigation aid, not model audio perception.

Unit tests compare min/max queries against exact PCM, including isolated impulses, bucket edges, trim/reverse and stereo separation. Browser checks load the worker index, click the waveform, move one sample with the keyboard, zoom, split and undo. The waveform is visual editing support; range selection is documented below; transient detection and Flex warping remain unfinished.

### Waveform range selection and splitting

Drag across the detailed waveform to select a sample-aligned passage; the shaded range follows the visible zoom and supports reverse-direction dragging. A click still positions the cursor. Numeric start/end fields provide a keyboard-accessible alternative, with times relative to the region. **Split selected range** isolates that passage while retaining before/after audio, reusing the source file. One undo restores all pieces. Ranges touching an original edge create only two pieces; selecting the whole region needs no split. Document edits invalidate the transient selection, and pointer cancellation does not commit it.

The shared `region.splitRange` command takes absolute timeline `start`/`end` seconds. It validates audio type, bounds, track capacity and protection, preserves reversed source offsets and outside fades, and updates comp references at both cuts. Internal edges have no added fade. The agent receives optional validated `audioRange` context with the captured region and absolute bounds, allowing “split this selection” without guessing times. Changed revisions omit that range from subsequent planning steps.

Tests verify forward/reversed source coverage, boundary cases, atomic invalid/protected edits, comp reconstruction, captured agent context and undo. Browser tests drag a range, split/undo manually, enter numeric bounds, and execute/undo the same operation through mocked agent responses. Live model inference remains unverified. This is range splitting; range playback, transient detection and Flex warping remain separate work.

### Selected audio-range playback

The detailed waveform editor has **Play selected range** after selecting a passage by dragging or entering its start/end. It plays that region through its existing fades, gain, track/bus effects and master chain, then returns the cursor to the selection start. Click **Stop range playback** to stop early. This is a listening operation: it does not trim clips, save new media, change the document revision, or add an undo entry.

The audition snapshot retains the complete source region so seeks preserve reverse offsets and original fade positions. Other source regions are excluded; bus routing remains. Track/region/bus mutes apply, solos are ignored, and cycle and metronome are disabled. Preview playback does not start Write automation. A scheduled output gain gate silences the output at the selection end independently of the UI timer. Delay/reverb history before the selection is not reconstructed, and tails are cut at the end.

The agent can request `audition_audio_range` with a captured selection or explicit absolute start/end seconds. The server validates region bounds and capability; the client revalidates session revision and transport epoch before starting playback. The tool is unavailable during an editing continuation. Model-provider execution still requires configured credentials; the browser regression uses a mocked response with real playback.

Verification: `test/experimental-audio-range-audition.test.js` covers isolation, validation and tool guards. `scripts/browser-experimental-range-audition-check.cjs` uses native offline audio rendering to verify identical samples before the boundary and exact silence after it, including reverse source, fades and bus gain. The existing silence browser regression now also checks manual/agent range playback, automatic stop, early stop, cursor return and unchanged saved session.

### Zero-crossing selection

The detailed waveform editor offers **Cursor to zero crossing** and **Range to zero crossings**. Each searches up to 5 ms on either side for the nearest integer sample boundary where every channel crosses or touches zero. Channels remain aligned; opposite-polarity stereo is inspected separately rather than summed. Equidistant candidates prefer the lower maximum adjacent amplitude. Trim offsets and reversed regions use source-boundary mapping. Whole-region range edges are retained.

If no shared crossing exists, or snapping both ends would collapse the selection, the operation fails without changing the cursor/range. This selects a cut point only: it does not change audio samples, region geometry, project revision or undo history. Crossing a steep waveform can still click; use fades as needed. This is an explicit control, not automatic snapping on every drag or split.

The agent tool `snap_audio_range_to_zero_crossings` accepts the captured waveform range or explicit absolute boundaries. Server validation checks the requested audio region and bounds; browser-side analysis uses the actual decoded samples. Session revision, cancellation and transport epoch are checked after decoding, before updating the selection. The tool cannot be combined with document edits or run as an editing continuation. The resulting selection can subsequently be auditioned or split through the shared controls/commands. Live provider inference remains separate from the mocked tool-response browser regression.

Tests: `test/experimental-zero-crossing.test.js` checks bounded searches, stereo polarity, channel mismatch, offset/reversal mapping, invalid samples, collapsed ranges and agent capability/context guards. `scripts/browser-experimental-silence-check.cjs` checks manual and agent selection controls against imported WAV samples and unchanged saved project state.

Reference: [Apple Logic Pro zero-crossing editing](https://support.apple.com/guide/logicpro/snap-edits-to-zero-crossings-lgcp76a73399/10.7/mac/11.0).

### Audio attack detection and navigation

In **Audio waveform editor**, **Detect attacks** analyzes the selected region in a cancelable worker and overlays detected attacks. **Previous attack** / **Next attack** move the cursor through those positions; the existing waveform split and range controls then provide editing. Detection settings are attack rise (3–24 dB), noise floor (-96 to -12 dBFS) and minimum gap (0.01–1 second). Defaults are 9 dB, -45 dBFS and 50 ms. Smaller rise thresholds can detect weaker attacks but also more false positives.

This is an approximate short-time energy-rise detector: 2 ms blocks, a preceding 20 ms baseline, maximum channel power, and a minimum separation. It does not infer beats, perform spectral onset analysis, or implement Flex warping. Transitions below the floor are ignored; channel powers are not summed as waveforms, so opposite polarity cannot cancel the detector. Markers are region-local, with source offset and reverse applied before analysis. No audio file or document is modified. Results are temporary and invalidated by a document revision; they are not yet manually editable or persisted marker sets.

Detection accepts up to 10 minutes of mono/stereo region PCM within 250 MB and at most 10,000 attacks. Worker inputs are copies; cancellation terminates analysis. After decoding/analysis, session revision and cancellation are checked before publishing results. Missing detailed waveform data is loaded so agent-generated results are visible in the same editor.

The agent tool `detect_audio_attacks` accepts a region ID (null for captured selection) and the same settings. It analyzes real PCM in the browser and reports the first 32 measured absolute timeline positions in the action summary. It is a standalone analysis action and unavailable during editing continuation. Live provider inference is not covered by the mocked-response browser check.

Verification: `test/experimental-transients.test.js` covers separated attacks, sustained tone, silence, subfloor audio, stereo polarity, gap settings, invalid data, navigation and agent guards. `scripts/browser-experimental-transients-check.cjs` verifies actual worker execution, trim/reverse timing, cancellation and unchanged buffers. The editor browser regression imports WAV, detects two attacks, navigates both directions, requests agent analysis and checks unchanged saved state.

Reference: [Apple Logic Pro transient marker editing](https://support.apple.com/en-ca/guide/logicpro/lgcp21586c87/mac). Manual marker editing and Flex warping remain unfinished.
