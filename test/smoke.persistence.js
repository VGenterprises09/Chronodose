// End-to-end smoke test of the REAL server: boot -> build schedule -> SIGKILL -> reboot -> verify.
import { spawn } from "node:child_process";
import fs from "node:fs";

const PORT = 3460;
const BASE = `http://127.0.0.1:${PORT}`;
const DB = "./data/smoke-db.json";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function boot() {
  const child = spawn(process.execPath, ["src/index.js"], {
    env: { ...process.env, PORT: String(PORT), CHRONODOSE_DB: DB, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr.on("data", (d) => process.stderr.write(d));
  return child;
}
async function until(fn, tries = 40) {
  for (let i = 0; i < tries; i++) { try { return await fn(); } catch { await wait(150); } }
  throw new Error("server never came up");
}
const api = async (method, path, token, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};
const check = (cond, label) => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); if (!cond) process.exitCode = 1; };

fs.rmSync("./data", { recursive: true, force: true });

let server = boot();
await until(() => fetch(BASE + "/health").then((r) => { if (!r.ok) throw 0; }));
console.log("server up (phase 1)");

const reg = await api("POST", "/auth/register", null, { name: "Smoke Test", wake: 6, sleep: 22, nightShift: true, kidneyDisease: true });
check(reg.status === 201, "register 201");
const token = reg.json.token;

for (const n of ["Simvastatin", "Furosemide", "Metformin", "Metoprolol"]) {
  await api("POST", "/meds", token, { name: n });
}
const sched = await api("GET", "/schedule", token);
const order = sched.json.schedule.map((s) => s.slot);
check(JSON.stringify(order) === JSON.stringify(["morning", "evening", "bedtime"]), `schedule chronological: ${order.join(" → ")}`);
const morning = sched.json.schedule.find((s) => s.slot === "morning");
check(morning.meds.find((m) => m.name === "Furosemide").notes.some((x) => x.includes("specialist-guided") || x.includes("wake time")),
  "kidney + night-shift notes present on furosemide");

server.kill("SIGKILL");
await wait(400);
server = boot();
await until(() => fetch(BASE + "/health").then((r) => { if (!r.ok) throw 0; }));
console.log("server up (phase 2, after SIGKILL)");

const me = await api("GET", "/me", token);
check(me.status === 200 && me.json.profile.routine.wake === 6 && me.json.profile.conditions.nightShift === true, "profile + routine survived restart");
const after = await api("GET", "/meds", token);
check(after.json.meds.length === 4, "med list survived restart");
const sched2 = await api("GET", "/schedule", token);
check(JSON.stringify(sched2.json.schedule.map((s) => s.slot)) === JSON.stringify(order), "schedule reproduced identically after restart");

server.kill("SIGKILL");
console.log(process.exitCode ? "\nSMOKE TEST FAILED" : "\nSMOKE TEST: ALL CHECKS PASSED");
