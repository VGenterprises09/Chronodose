# ChronoDose — Complete Deployment Guide for Beginners

**Authors: Vinaya Gaduputi MD FACG & Vahin Gaduputi**

This guide takes you from "code in a zip file" to "ChronoDose running as an app icon on any iPhone or Android phone," assuming you have never deployed anything before. Every click is spelled out.

---

## What you're actually deploying (read this first)

ChronoDose is two pieces:

1. **The web app** (the `web/` folder) — what patients see and tap. This gets hosted on **Vercel** and installs on phones as a PWA (Progressive Web App): it gets its own home-screen icon, opens full-screen without a browser bar, and looks and feels like a normal app on both iOS and Android. **This is the fastest legitimate way to get on both platforms** — no App Store review, no $99 Apple fee, and updates go live instantly.

2. **The API server** (the `src/` folder) — where data lives so it survives across devices and powers caregiver access. This gets hosted on **Render**.

You can do Part A alone (app on phones today, data stays on the device per session) and add Part B whenever you're ready. The true App Store / Play Store route is covered at the end — do it only after the pilot works.

**Total cost to complete this guide: $0.** (Optional upgrades noted where relevant.)

---

## Part 0 — One-time setup (15 minutes)

### Step 0.1 — Unzip the project
Unzip `chronodose-backend.zip` somewhere easy to find, like your Desktop. You should see folders named `src`, `web`, `client`, `test`, and files like `package.json` and `README.md`.

### Step 0.2 — Create a GitHub account
GitHub is where your code lives online; Render and Vercel both deploy directly from it.
1. Go to **github.com** → **Sign up**. Use an email you check. Free plan is fine.
2. Verify your email when the confirmation arrives.

### Step 0.3 — Put the code on GitHub (no software needed)
1. On github.com, click the **+** in the top-right → **New repository**.
2. Repository name: `chronodose`. Leave it **Public** (simplest; switch to Private later if you prefer — everything in this guide works either way).
3. Check **"Add a README file"**, then click **Create repository**.
4. On your new repository page, click **Add file → Upload files**.
5. Open your unzipped `chronodose-backend` folder on your computer, select **everything inside it** (the `src` folder, `web` folder, `client`, `test`, `package.json`, `README.md`, `DEPLOYMENT-GUIDE.md`), and drag it all into the GitHub upload box. **Do not upload the `node_modules` or `web/node_modules` or `web/dist` folders if you see them** — delete those locally first; the servers rebuild them automatically.
6. Wait for the upload bar to finish (the web folder has many small files; give it a minute), type "initial upload" in the commit box, click **Commit changes**.

Your code is now online. Confirm you can see `src/index.js` and `web/index.html` by clicking through the folders on GitHub.

---

## Part A — Get the app onto iPhones and Androids (30 minutes)

### Step A.1 — Create a Vercel account
1. Go to **vercel.com** → **Sign up** → **Continue with GitHub**. This links the two accounts so Vercel can see your code.
2. Authorize when GitHub asks. Choose the free "Hobby" plan.

### Step A.2 — Deploy the web app
1. On your Vercel dashboard, click **Add New… → Project**.
2. Find `chronodose` in the repository list and click **Import**.
3. **This is the one screen where a wrong setting breaks things — set these exactly:**
   - **Root Directory:** click **Edit** and select the **`web`** folder. (You're telling Vercel the app lives in the `web` subfolder, not the top level.)
   - **Framework Preset:** should auto-detect **Vite**. If not, choose Vite from the dropdown.
   - Leave Build Command (`vite build` / `npm run build`) and Output Directory (`dist`) at their defaults.
4. Click **Deploy** and wait about a minute. Confetti means it worked.
5. Click the preview image or **Visit**. You'll get a URL like `https://chronodose.vercel.app`. Open it — you should see the ChronoDose welcome screen. Walk through onboarding once to confirm everything works.

If the build fails: click the deployment → **Building** log. 95% of failures here are Root Directory not set to `web`. Fix it under **Settings → General → Root Directory** and redeploy.

### Step A.3 — Install on an iPhone
1. On the iPhone, open **Safari** (must be Safari — Chrome on iOS can't do this step) and go to your `https://chronodose.vercel.app` URL.
2. Tap the **Share button** (the square with an arrow pointing up, bottom center).
3. Scroll down the share sheet and tap **"Add to Home Screen."**
4. It will show the ChronoDose name and blue "C" icon. Tap **Add**.
5. There's now a ChronoDose icon on the home screen. Tap it — the app opens full-screen with no browser bar, exactly like a native app.

### Step A.4 — Install on an Android phone
1. Open **Chrome** and go to the same URL.
2. Either Chrome shows an **"Install app"** banner automatically — tap it — or tap the **⋮ menu** (top right) → **"Add to Home screen"** / **"Install app"** → **Install**.
3. The icon appears on the home screen and in the app drawer. Opens full-screen like any Android app.

**That's it — ChronoDose is live on both platforms.** Share the URL with anyone; installation takes them 20 seconds. Every time you upload changed code to GitHub, Vercel redeploys automatically within a minute and every installed copy gets the update on next open.

> **Current behavior to know:** the prototype app stores data in memory for the session. For a demo and design pilot that's fine. Persistent, cross-device data is what Part B's server enables (final wiring of app→server is a development step, covered in B.5).

---

## Part B — Deploy the API server on Render (30 minutes)

### Step B.1 — Create a Render account
Go to **render.com** → **Get Started** → **Sign in with GitHub** → authorize. Free plan.

### Step B.2 — Create the web service
1. Dashboard → **New + → Web Service**.
2. Select your `chronodose` repository → **Connect**.
3. Fill in:
   - **Name:** `chronodose-api` (this becomes your URL)
   - **Region:** closest to you (e.g., Ohio/US East)
   - **Root Directory:** leave **blank** (the server lives at the top level — opposite of the Vercel setup)
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** **Free**
4. Click **Create Web Service**. Watch the log; in 1–2 minutes you'll see `ChronoDose API listening on...` and a green "Live" badge.

### Step B.3 — Test it
Your API URL is at the top, like `https://chronodose-api.onrender.com`. Open `https://chronodose-api.onrender.com/health` in any browser. You should see:
```json
{"ok":true,"service":"chronodose-api"}
```
If you do, your server is live on the internet.

### Step B.4 — Two free-tier facts you must know
1. **Sleep:** free services nap after 15 minutes of no traffic; the next request takes ~50 seconds to wake it. Normal, not broken. Paid Starter ($7/mo) removes this.
2. **Data resets:** the free tier's disk is wiped on every restart/redeploy, so the JSON database resets. **Fine for demos; not fine for a real pilot.** For persistent data: upgrade to Starter, then in Render go to **Disks → Add Disk** (1 GB, ~$0.25/mo), set Mount Path to `/data`, and add an environment variable (**Environment** tab): key `CHRONODOSE_DB`, value `/data/db.json`. Save — it redeploys, and data now survives everything.

### Step B.5 — Connecting the app to the server (the one development step)
The server and the app are both live, and the app ships with a ready client (`client/api.js`) that has one function for every screen — `logFood()`, `checkMed()`, `getVaccines()`, `exportSummary()`, etc. Wiring the app's screens to call those functions instead of its in-memory state is the remaining development task (roughly a day of work for a React developer, or a good structured project to do with Claude screen-by-screen). Two settings when you do:
- In Vercel: **Settings → Environment Variables** → `VITE_API_URL` = your Render URL.
- In Render: environment variable `CORS_ORIGIN` = your Vercel URL (locks the API to only accept your app).

---

## Alternatives to Render (same job, pick one)

**Railway (railway.app):** Sign in with GitHub → New Project → Deploy from GitHub repo → it auto-detects Node and deploys. Add a **Volume** mounted at `/data` for persistence and set `CHRONODOSE_DB=/data/db.json`. Usage-based pricing (~$5/mo credit on the hobby plan); no sleep behavior. Slightly nicer than Render if you're willing to enter a card.

**Fly.io:** More powerful, but requires installing a command-line tool (`flyctl`) and using a terminal (`fly launch`, `fly volumes create`, `fly deploy`). Skip it as a novice; come back if you outgrow Render/Railway.

For a first deployment, **Render is the recommendation** — it's the only one that's genuinely zero-terminal, zero-card.

---

## Part C — The real App Store / Play Store (later, when it's earned)

The PWA above is on phones today. Store listings add credibility and push notifications but cost real time and money:

- **What changes:** the app gets rebuilt in **Expo (React Native)** — the screens and logic port over, but `div`s become `View`s, etc. This is a rewrite of the UI layer, not a tweak. Expo's cloud build service (EAS) means you don't need a Mac even for the iOS build.
- **Apple App Store:** Apple Developer Program is **$99/year**; review takes days and health apps get extra scrutiny (they'll want your medical disclaimer prominent, which the app already has).
- **Google Play:** **$25 one-time**; new personal accounts must run a 12+ tester closed test for 2 weeks before public release.
- **Try-it-today shortcut:** the **Expo Go** app (free on both stores) lets you run a development build on your own phone instantly — good for testing the native port before paying anyone.

Honest recommendation: run the PWA pilot first, put the results in the hospital pitch, and only fund store deployment when a clinical partner is committed.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Vercel build fails immediately | Root Directory not set to `web` | Settings → General → Root Directory → `web`, redeploy |
| Blank white page on the app URL | `node_modules`/`dist` got uploaded to GitHub | Delete those folders from the repo, redeploy |
| "Add to Home Screen" missing on iPhone | Using Chrome/Firefox on iOS | Must use Safari for this step |
| No Install option on Android | Site not fully loaded, or already installed | Refresh; check app drawer |
| `/health` shows "Not Found" on Render | Root Directory was set to something | Clear it (server lives at repo top level) |
| API takes ~1 min to respond after idle | Free-tier sleep | Normal; Starter plan removes it |
| Data vanished after a redeploy | Free-tier ephemeral disk | Add a persistent disk + `CHRONODOSE_DB=/data/db.json` |
| App can't reach API after wiring | CORS or wrong URL | Set `CORS_ORIGIN` on Render and `VITE_API_URL` on Vercel; both must be the full `https://` URLs |

## Final checklist

- [ ] Code visible on GitHub (`src/index.js` and `web/index.html` both browsable)
- [ ] Vercel deploy green; app URL opens and onboarding works
- [ ] Installed on at least one iPhone (Safari → Share → Add to Home Screen)
- [ ] Installed on at least one Android (Chrome → Install app)
- [ ] Render deploy green; `/health` returns `{"ok":true}`
- [ ] (Pilot) Persistent disk attached and `CHRONODOSE_DB` set
- [ ] (Pilot) `CORS_ORIGIN` locked to the Vercel URL

**A note on real patients:** everything here is appropriate for demos, design feedback, and pitching. Before any real patient data is entered, the production checklist in the README (HIPAA-grade hosting, real authentication, clinical validation of alert thresholds) applies — free-tier hosting is explicitly not for protected health information.
