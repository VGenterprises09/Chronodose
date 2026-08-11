import express from "express";
import { store } from "./store.js";
import { uid, newToken, hash, now, num, cleanStr } from "./util.js";
import { DRUGS, SLOTS, findDrug, personalizeTiming, detectConflicts, buildSchedule } from "./data/reference.js";

const CONDITION_KEYS = ["liverDisease", "kidneyDisease", "age65", "nightShift"];

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  app.use((req, res, next) => {
    res.set({
      "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
      "Access-Control-Allow-Headers": "content-type, authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    });
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.use((err, _req, res, next) => {
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
    next(err);
  });

  const bad = (res, msg) => res.status(400).json({ error: msg });

  function auth(req, res, next) {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const entry = token && store.state.tokens[hash(token)];
    if (!entry) return res.status(401).json({ error: "Missing or invalid token" });
    const p = store.state.patients[entry.patientId];
    if (!p) return res.status(401).json({ error: "Account no longer exists" });
    req.patient = p;
    next();
  }

  // Resolve a patient's stored med names to full drug objects.
  const resolveMeds = (p) => p.meds.map((name) => findDrug(name)).filter(Boolean);

  app.get("/health", (_req, res) => res.json({ ok: true, service: "chronodose-api" }));

  /* ---------------- auth & profile ---------------- */
  app.post("/auth/register", (req, res) => {
    const name = cleanStr(req.body?.name, 80);
    if (!name) return bad(res, "name is required (1–80 chars)");
    const conditions = {};
    for (const k of CONDITION_KEYS) conditions[k] = !!req.body?.[k];
    const wake = req.body?.wake === undefined ? 7 : num(req.body.wake);
    const sleep = req.body?.sleep === undefined ? 23 : num(req.body.sleep);
    if (wake === null || wake < 0 || wake >= 24) return bad(res, "wake must be an hour 0–23.5");
    if (sleep === null || sleep < 0 || sleep >= 27) return bad(res, "sleep must be an hour 0–26.5");
    const id = uid();
    store.state.patients[id] = {
      id,
      profile: { name, conditions, routine: { wake, sleep } },
      createdAt: now(),
      meds: [], // array of drug names
    };
    const token = newToken();
    store.state.tokens[hash(token)] = { patientId: id, role: "patient" };
    store.save();
    res.status(201).json({ patientId: id, token, profile: store.state.patients[id].profile });
  });

  app.get("/me", auth, (req, res) => res.json({ id: req.patient.id, profile: req.patient.profile }));

  app.patch("/me", auth, (req, res) => {
    for (const k of CONDITION_KEYS) {
      if (req.body?.[k] !== undefined) {
        if (typeof req.body[k] !== "boolean") return bad(res, `${k} must be a boolean`);
        req.patient.profile.conditions[k] = req.body[k];
      }
    }
    if (req.body?.wake !== undefined) {
      const w = num(req.body.wake);
      if (w === null || w < 0 || w >= 24) return bad(res, "wake must be an hour 0–23.5");
      req.patient.profile.routine.wake = w;
    }
    if (req.body?.sleep !== undefined) {
      const s = num(req.body.sleep);
      if (s === null || s < 0 || s >= 27) return bad(res, "sleep must be an hour 0–26.5");
      req.patient.profile.routine.sleep = s;
    }
    if (req.body?.name !== undefined) {
      const n = cleanStr(req.body.name, 80);
      if (!n) return bad(res, "name must be 1–80 chars");
      req.patient.profile.name = n;
    }
    store.save();
    res.json({ profile: req.patient.profile });
  });

  /* ---------------- drug timing lookup ---------------- */
  app.get("/drugs/timing", auth, (req, res) => {
    const name = cleanStr(req.query?.name, 120);
    if (!name) return bad(res, "name query parameter is required");
    const drug = findDrug(name);
    if (!drug) {
      return res.json({
        found: false, name,
        message: "Not in the timing database. For any medication not listed, follow the label and ask your pharmacist about timing.",
      });
    }
    const { slot, notes } = personalizeTiming(drug, req.patient.profile.conditions);
    res.json({
      found: true,
      drug: { name: drug.name, cls: drug.cls, food: drug.food, why: drug.why, tips: drug.tips },
      slot, slotLabel: SLOTS[slot]?.label, defaultSlot: drug.slot,
      personalizedNotes: notes,
    });
  });

  app.get("/drugs", (_req, res) =>
    res.json({ drugs: DRUGS.map(({ name, cls, slot, food }) => ({ name, cls, slot, slotLabel: SLOTS[slot]?.label, food })) }));

  /* ---------------- my medications ---------------- */
  app.post("/meds", auth, (req, res) => {
    const name = cleanStr(req.body?.name, 120);
    if (!name) return bad(res, "name is required");
    const drug = findDrug(name);
    if (!drug) return res.status(422).json({ error: "Unknown medication — not in the timing database. Follow the label and ask your pharmacist." });
    if (req.patient.meds.some((n) => n.toLowerCase() === drug.name.toLowerCase()))
      return res.status(409).json({ error: "Medication already on the list" });
    req.patient.meds.push(drug.name);
    store.save();
    res.status(201).json({ added: drug.name, count: req.patient.meds.length });
  });

  app.get("/meds", auth, (req, res) => {
    const meds = resolveMeds(req.patient).map((d) => {
      const { slot, notes } = personalizeTiming(d, req.patient.profile.conditions);
      return { name: d.name, cls: d.cls, food: d.food, slot, slotLabel: SLOTS[slot]?.label, notes };
    });
    res.json({ meds });
  });

  app.delete("/meds/:name", auth, (req, res) => {
    const target = decodeURIComponent(req.params.name).toLowerCase();
    const before = req.patient.meds.length;
    req.patient.meds = req.patient.meds.filter((n) => n.toLowerCase() !== target);
    if (req.patient.meds.length === before) return res.status(404).json({ error: "Medication not found on the list" });
    store.save();
    res.json({ deleted: true });
  });

  /* ---------------- the schedule (core output) ---------------- */
  app.get("/schedule", auth, (req, res) => {
    const meds = resolveMeds(req.patient);
    const schedule = buildSchedule(meds, req.patient.profile.conditions).map((s) => ({
      slot: s.key, label: s.label, icon: s.icon,
      meds: s.meds.map((m) => {
        const { notes } = personalizeTiming(m, req.patient.profile.conditions);
        return { name: m.name, cls: m.cls, food: m.food, notes };
      }),
    }));
    res.json({
      routine: req.patient.profile.routine,
      schedule,
      conflicts: detectConflicts(meds),
    });
  });

  /* ---------------- export ---------------- */
  app.get("/export/summary", auth, (req, res) => {
    const p = req.patient;
    const meds = resolveMeds(p);
    const schedule = buildSchedule(meds, p.profile.conditions).map((s) => ({
      slot: s.label,
      meds: s.meds.map((m) => ({ name: m.name, food: m.food, notes: personalizeTiming(m, p.profile.conditions).notes })),
    }));
    res.json({
      generatedAt: now(),
      patient: p.profile,
      schedule,
      conflicts: detectConflicts(meds),
      disclaimer: "ChronoDose prototype export. Educational demo — not a medical device; timing guidance never overrides the prescriber's instructions. Authors: Vinaya Gaduputi MD FACG & Vahin Gaduputi.",
    });
  });

  /* ---------------- fallthroughs ---------------- */
  app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error("[api] unhandled error:", err);
    res.status(500).json({ error: "Internal error — the request was not applied" });
  });

  return app;
}
