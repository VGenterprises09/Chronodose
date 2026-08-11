# ChronoDose API — prototype backend

**Authors:** Vinaya Gaduputi MD FACG & Vahin Gaduputi

The server side of ChronoDose, the medication-timing optimizer: it builds a personalized daily dosing schedule from chronotherapy and PK/food rules, anchored to each patient's wake/sleep routine, and flags absorption conflicts between co-scheduled drugs. Node.js + Express, zero native dependencies. Prototype for demonstration — not a medical device; timing guidance never overrides the prescriber's instructions.

## Quick start

```bash
npm install
npm start                          # API on http://localhost:3001
npm test                           # 13-test suite (engine + scheduling + API + failures)
node test/smoke.persistence.js     # boots the real server, SIGKILLs it, verifies data survives
```

## Architecture

```
src/
  index.js            entry point + process crash guards
  app.js              Express routes, auth, validation, CORS
  util.js             strict parsing/validation helpers
  store.js            persistence: atomic JSON snapshots + .bak recovery
  data/reference.js   20-drug timing database + timing engine (findDrug,
                      personalizeTiming, detectConflicts, buildSchedule) —
                      extracted from the frontend so app and API never disagree
client/
  api.js              drop-in fetch client (one method per app screen)
  ChronoDoseApp.jsx   the frontend prototype
web/                  phone-installable PWA wrapper (Vite + manifest + icons)
test/
  api.test.js         13 tests
  smoke.persistence.js  kill-and-restart persistence verification
```

## Timing engine

Each drug carries a default **slot** (on waking / morning / midday / evening / bedtime), a **food rule** (with / empty / before / either), the reasoning, and practical tips. The engine has four parts:

- **`personalizeTiming(drug, conditions)`** — returns the slot plus condition-specific notes. Notes are *guidance*, not a rewritten clock: kidney disease flags diuretic timing as specialist-guided, liver disease flags altered clearance for statins/warfarin, night-shift reframes "morning" as *your* wake period, and age 65+ adds fall-risk cautions for sedating drugs and nocturia cautions for diuretics.
- **`detectConflicts(meds)`** — finds pairs that interfere with each other's absorption (e.g., levothyroxine + calcium/iron) *and land in the same slot*, recommending ~4-hour separation. Different-slot pairs are intentionally not flagged, since the schedule already separates them.
- **`buildSchedule(meds, conditions)`** — groups meds into chronological slots, dropping empty ones.

The chronotherapy defaults reflect real conventions (evening statins for overnight cholesterol synthesis, morning diuretics to protect sleep, before-breakfast PPIs, bedtime melatonin), all verified by test.

## Endpoints

| Area | Endpoints |
|---|---|
| Auth/profile/routine | `POST /auth/register` (name + wake/sleep + conditions) · `GET /me` · `PATCH /me` |
| Drug timing | `GET /drugs/timing?name=` (personalized) · `GET /drugs` (catalog) |
| My meds | `POST /meds` · `GET /meds` · `DELETE /meds/:name` |
| The schedule | `GET /schedule` (chronological slots + conflicts + routine) |
| Clinician | `GET /export/summary` |
| Misc | `GET /health` |

## Fail-safe design decisions

- **Never overrides the prescriber.** Every timing view carries that language; unknown drugs return a "follow the label, ask your pharmacist" message and can't be added.
- Routine hours validated (wake 0–23.5, sleep 0–26.5 to allow past-midnight); condition flags strictly boolean; unknown drugs 422; duplicates 409.
- Malformed JSON → 400; unknown routes → JSON 404; final handler keeps the process alive.
- Atomic JSON writes with `.bak` recovery — verified by the SIGKILL smoke test (schedule reproduces identically after a hard crash).

## Path to production

Real use requires: a real PK/PD knowledge base keyed to RxNorm (half-life, Tmax, food effects, CYP interactions) replacing the 20-drug seed, expert review of every timing rule (pharmacology, chronobiology, hepatology, nephrology, cardiology — Phase 1 of the validation protocol), pharmacy-import and wearable-sleep integration for real routines, adaptive reminder delivery, and clinical sign-off on the chronotherapy claims. Timing *optimization* is lower-risk than dosing itself, but the safety audit (no dose changes, defer to prescriber, disclaimers intact) still applies before any clinic pilot.
