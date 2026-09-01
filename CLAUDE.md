# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

肢別問題集（"limb-by-limb question bank"） — a Japanese exam-prep web app where each choice ("肢"/limb) of a multiple-choice question is judged individually as ○ (correct) or × (incorrect), with immediate feedback and an explanation. Built for exams like 行政書士 (administrative scrivener) and 土地家屋調査士 (land/building surveyor).

**No build step.** This is a static site: `index.html` + `app.js` + `style.css` + `auth-module.js`, loaded directly by the browser via plain `<script>` tags (no bundler, no modules, no TypeScript, no framework). All of `app.js` and `auth-module.js` share one global scope — functions defined in either file are callable from the other and from inline `onclick=` handlers in the HTML.

## Commands

Install dependencies (only needed for the Playwright/Node test suite — the app itself needs nothing):
```
npm install
```

Run all tests (unit + Playwright):
```
npm test
```

Run just the unit tests (`node:test`, no browser required):
```
npm run test:unit
# or target a single test/describe block:
node --test tests/unit/pure-functions.test.js
```

Run Playwright suites (spins up `http-server` on :8080 automatically via `webServer` in `playwright.config.js`):
```
npm run test:playwright        # everything
npm run test:ui                # tests/ui/
npm run test:e2e               # tests/e2e/
npm run test:a11y              # tests/accessibility/
npm run test:responsive        # tests/responsive/
npm run test:performance       # tests/performance/
npm run test:security          # tests/security/
npm run test:regression        # tests/e2e/regression.test.js only
```

Run a single Playwright test file/case directly:
```
npx playwright test tests/e2e/regression.test.js
npx playwright test tests/e2e/regression.test.js -g "あいまいボタン"
```

Playwright is configured with three projects (`chromium`, `mobile-chrome`, `tablet`) in `playwright.config.js`. In this sandboxed environment the Chromium binary path is hardcoded to `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` — if a `browserType.launch` error says the executable doesn't exist, check that path against `ls /opt/pw-browsers` and update `CHROMIUM_EXEC` in `playwright.config.js`.

Playwright tests mock all external network calls (Firebase SDK, Google Fonts/Identity, Firestore REST) via the shared fixture in `tests/fixtures.js` — import `{ test, expect }` from `../fixtures` (not `@playwright/test` directly) in any new Playwright test file, or requests will hang waiting on real Firebase/Google endpoints.

Run the app locally without npm (Python, no Node needed):
```
python -m http.server 8000
```
or just open `index.html` directly in a browser — everything still works via `localStorage`, only cloud sync is unavailable.

There is no lint or build script configured.

## Architecture

### File layout (all top-level, no `src/`)
- `index.html` — all markup for every "page" (see below), all modals, forms, and the login overlay. Loads Firebase SDK (compat build) and Google Identity Services from CDN, then `auth-module.js`, then `app.js`.
- `auth-module.js` — Firebase Authentication: email/password + Google sign-in/redirect flow, admin login overlay, nav-button visibility gating based on auth state.
- `app.js` (~4400 lines) — everything else: state, storage, sync, session/study logic, rendering, question CRUD, stats. This is the file you'll touch for almost any feature change.
- `firebase-config.js` — Firebase project config + `window.APP_CONFIG` (admin emails, Google client ID). Committed intentionally (client-side Firebase API keys are not secrets; access is enforced by `firestore.rules`).
- `style.css` — single stylesheet, CSS custom properties in `:root`, BEM-ish class names.
- `tests/` — see Testing section below.
- `sample_questions.json` — reference shape for the question JSON import format (see Data model below).
- `firestore.rules` / `firestore.indexes.json` / `firebase.json` / `.firebaserc` — Firebase project config, deployed independently of the static site (`firebase deploy --only firestore:rules`, not part of any npm script).
- `scraper.ps1`, `extract_r3_4_questions.ps1`, `review_compare.ps1`, `output/` — one-off PowerShell scripts for scraping/converting past exam questions into the JSON import format. Not part of the runtime app.

### "Pages" are one HTML document, JS-driven visibility
There are four `<main class="page" id="page-*">` elements (`study`, `admin`, `manage`, `stats`) all present in the DOM at once; `showPage(name)` in `app.js` toggles `.active` on the target page and its nav button. `manage` and `admin` are gated by `isAdminUser()` (checks the signed-in user's email against `window.APP_CONFIG.adminEmails`). Modals (`#modal-question`, `#modal-result`, `#admin-login-overlay`) are separate `.modal-overlay` elements toggled via `.hidden`, with focus remembered/restored around open/close (`rememberFocusBeforeModal`/`restoreFocusAfterModal`).

### Data model
A **question** has `id`, `subject`, `category`, `source`, optional `questionText`, and an array of **limbs**. Each **limb** (`id`, `text`, `correct`, `explanation`) is graded independently — this per-limb granularity is the core mechanic of the app (see `sample_questions.json` for the full shape). Limbs also support:
- **Choice questions**: `options` + `correctText` (pick one of several answers instead of ○/×).
- **Text-answer questions**: `acceptedAnswers` (free-text match via `normalizeTextAnswer`).
- **Inline ○× questions**: a limb whose `text` embeds multiple parenthesized sub-judgments (e.g. `（①…）〇×`), parsed by `parseInlineOxItems`/`extractInlineOxKey`. Each sub-item is answered and scored independently but rolls up into the parent limb's stats via `getEffectiveRecord(limb)`, which aggregates sub-record ids of the form `` `${limbId}::${key}` `` (see `makeInlineRecordId`). `addRecord` is only ever called on sub-record ids, so the parent record's `review` stays at its initial value — `getEffectiveRecord` therefore aggregates `review` too (min `streak`/`intervalDays`/`ease`/`dueAtMs`, max `lastAnsweredAtMs`), meaning "one blank still unmastered ⇒ the whole limb is unmastered". Without that aggregation `review.streak` reads 0 forever and any inline-OX limb answered wrong once never leaves 「間違えたもの」. Most stats/filtering code has to special-case this aggregation — when touching mastery/scoring logic, check whether it reads `getRecord(limb.id)` directly (wrong for inline-OX) or `getEffectiveRecord(limb)` (correct).

  On re-encounter, `getInlineOxSettledKeys` drops blanks whose last answer was correct (`review.streak >= 1`) so the user only re-answers the ones they missed; `renderInlineOxText(text, settledMap)` renders those as locked, answer-revealed spans (kept visible so the sentence still reads in context) and the "すべて解き直す" button (`inlineOxForceFullRedoId`) restores the full set. Filtering is skipped entirely when all blanks are unanswered or all are settled. **Because the rendered group list is then a subset, the click handler must map back to the original item index via `group.dataset.index` — never the position within the filtered array**, or answers get graded against the wrong blank. The end-of-limb modal reports partial credit (`opts.partial` in `showResult`) instead of all-or-nothing 正解/不正解.

A **record** (per-limb learning stats, keyed by limb id in the `records` object) tracks `correct`, `wrong`, `wrongDateKeys`, a spaced-repetition `review` state (`intervalDays`/`streak`/`ease`/`dueAtMs`, SM-2-like — see `nextReviewState`), `mastery` (`'perfect' | 'ambiguous' | ''`), `note`, and `bookmarked`. Always construct a fresh empty record via `makeEmptyRecord()` rather than a literal — several functions (`getRecord`, `setLimbMastery`, `ensureRecord`, `addRecord`) rely on it for a consistent shape.

`getLimbsMatchingFilters()` is the single entry point for "which limbs match the current subject/category/year filters" — both `startSession` (the study queue) and `updateMasteryCounts` (the 完璧/あいまい/まちがえたもの count bar) go through it, so the displayed counts always equal what a session would actually serve. **Never count over `Object.values(records)` for these** — the record map also holds orphan records for deleted/re-imported questions and one entry per inline-OX blank (`limbId::key`), which is what made the bar disagree with the session. (`renderStats`'s top cards deliberately do read `records` directly — they report cumulative answer volume, not limb counts.)

Study-mode filters (`filter-mode` select) each have a dedicated scoring/filter function in `app.js`: `weakScore` (苦手優先), `reviewPriorityScore`/`isDueForReview` (復習優先, uses `getRecord` — does **not** aggregate inline-OX sub-records, a known limitation), `priorityReviewScore` (優先復習, uses `getEffectiveRecord` and correctly aggregates), `isPerfectLimb`/`isAmbiguousLimb` (完璧/あいまい), `computeFewAnswersInfo` (回答数が少ないもの). The last one deliberately uses a **relative** cutoff — `max(1, round(average × FEW_ANSWERS_RATIO))` over the currently-filtered limbs — rather than a fixed count, because a fixed threshold matches nearly every limb early on and nothing at all once the user is deep into a bank. Consequences worth keeping: the category empties out on its own when practice volume is even (nothing is relatively behind), the `max(1, …)` floor keeps unanswered limbs selectable when the average is still ~0, and the count-bar button prints the live cutoff (`回答数が少ない: 20（4回未満）`) since the number shifts as study progresses. `priorityReviewScore` additionally adds a smoothly-decaying `4 / (total + 1)` bonus so limbs answered only a few times get surfaced ahead of heavily-drilled ones, without overriding the stronger unanswered (`total === 0`) bonus.

### Storage: local-first, then synced to Firestore
Everything reads/writes `localStorage` first (via `storageGetItem`/`storageSetItem`, prefixed `chisatsu_`) so the app is fully usable offline / without an account. When signed in, data additionally syncs to Firestore:
- **Questions**: shared across all users under a single `chisatsu_question_sets/shared` doc (only admins can write it — see `firestore.rules`'s `isAdminEmail()`). `applySharedQuestionBank` decides whether to accept a remote pull, guarding against a "suspicious downsync" (remote has far fewer questions than local) that would otherwise silently blow away a large local question set.
- **Records** (per-user answer history): `chisatsu_records/{uid}`. Two sync paths exist: a full-snapshot push/pull (`pushRecordsToCloud`/`pullRecordsFromCloudIfNeeded`) and an incremental delta queue (`addPendingRecordDelta`/`flushRecordDeltasToCloudIfNeeded`) for lower-latency answer syncing. Conflicts are resolved by `mergeRecordsNoLoss`, which is deliberately **monotonic**: counters only ever increase, `wrongDateKeys` are unioned, and the more-recently-answered/mastery-updated side wins per field — never a blind overwrite, to avoid losing history when two devices are used.
- **Study time/streak/calendar/session**: `chisatsu_study_stats/{uid}` and `chisatsu_study_sessions/{uid}`, with realtime `onSnapshot` listeners started in `startCloudRealtimeSubscriptions()` and torn down in `stopCloudRealtimeSubscriptions()` on sign-out.
- Firestore collections exist in both a legacy unprefixed form (`records/`, `study_stats/`, …) and the current `chisatsu_`-prefixed form — `firestore.rules` grants matching permissions to both for migration compatibility; new code should use the prefixed collections (the `FS_*` constants at the top of `app.js`).
- All Firestore-touching code should treat connectivity errors as expected/silent, not app-breaking (see `isFirestoreConnectivityError`/`warnCloudError`) — offline usage is a first-class supported mode, not an edge case.

There's also an optional **File System Access API** persistence layer (`FS_SUPPORTED`, `fileHandle`, the `IDB` IndexedDB wrapper for remembering the file handle across reloads) letting a user save their whole local dataset to a JSON file on disk as a backup independent of the cloud — see the "データファイル設定" section in `index.html`/`updateFileStatus()`.

### Auth & admin model
`auth-module.js` owns Firebase Auth (email/password + Google). Google sign-in has **two separate code paths** that are easy to conflate:
- `initGoogleSignIn()` renders the official Google Identity Services (GIS) button (`google.accounts.id.initialize`/`renderButton`) when `APP_CONFIG.googleClientId` is set. No `use_fedcm_for_button` override is set, so this button follows GIS's own default (FedCM in browsers that support it) — there's no explicit FedCM opt-in/opt-out in this codebase.
- `handleGoogleSignIn()` (used as a fallback via `renderGooglePopupFallbackButton()` when no client ID is configured, and as the retry path on `auth/popup-blocked`) goes through plain Firebase `GoogleAuthProvider` + `signInWithPopup`/`signInWithRedirect` — ordinary OAuth popup/redirect, unrelated to FedCM. `shouldUseRedirectForGoogleSignIn()` decides redirect-vs-popup (Safari needs redirect since it blocks third-party popups more aggressively).

Admin status is **not** a Firestore role — it's a client-side email allowlist (`window.APP_CONFIG.adminEmails` in `firebase-config.js`) checked by `isAdminUser()`, mirrored server-side in `firestore.rules`'s `isAdminEmail()` for write protection on the shared question bank. Anonymous/guest use is fully supported (no `records`/`questions` require sign-in locally); signing in only adds cross-device sync and, for admins, question management.

## Testing

`tests/unit/pure-functions.test.js` re-implements (does not import) a handful of pure functions from `app.js` inline for fast `node:test` unit coverage (mastery normalization, review scheduling, weak-score, XSS escaping, etc.). **If you change the corresponding logic in `app.js`, update the copy in this test file too** — they are not wired together via import.

Playwright tests are organized by concern under `tests/`: `unit/`, `ui/`, `e2e/` (includes `regression.test.js`, which pins down previously-fixed bugs — e.g. the ambiguous-button CSS class, `priorityReviewScore` double-counting bookmarks — so check it before "fixing" something that looks like a duplicate), `accessibility/`, `responsive/`, `performance/`, `security/`. All Playwright specs import the shared `test`/`expect` from `tests/fixtures.js`, which mocks Firebase/Google/Fonts network calls so tests run fully offline.
