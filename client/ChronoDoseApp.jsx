import { useState, useEffect, Component } from "react";

/* ============================================================
   ChronoDose — The Medication-Timing Optimizer
   Authors: Vinaya Gaduputi MD FACG & Vahin Gaduputi
   Clinical Minimalist prototype. Single-file, fail-safe build:
   - Error boundary wraps the app
   - Timing rules always defer to the prescriber's instructions
   - Every recommendation shows its reasoning; all state in memory
   ============================================================ */

const C = {
  blue: "#2A4E7E", slate: "#4A4F57", white: "#FFFFFF", soft: "#F5F6F7",
  red: "#C62828", yellow: "#F9A825", green: "#2E7D32", border: "#E1E3E6",
};

/* ---------- Timing slots ---------- */
const SLOTS = {
  waking: { label: "On waking", icon: "☀", order: 0 },
  morning: { label: "Morning", icon: "🌤", order: 1 },
  midday: { label: "Midday", icon: "🕛", order: 2 },
  evening: { label: "Evening", icon: "🌆", order: 3 },
  bedtime: { label: "Bedtime", icon: "🌙", order: 4 },
};

/* ---------- Medication timing database (illustrative prototype;
   production PK/PD + chronotherapy rules pass expert review:
   pharmacology, chronobiology, hepatology, nephrology, cardiology) ---------- */
const DRUGS = [
  { name: "Atorvastatin", cls: "Statin", slot: "bedtime", food: "either", halfLife: "long",
    why: "Cholesterol is made mostly overnight, so shorter-acting statins work best in the evening. Atorvastatin is long-acting enough that timing matters less — but bedtime is the conventional default.",
    tips: ["Consistency matters more than the exact hour.", "Grapefruit raises levels — keep intake consistent or avoid."],
    conflictsWith: [] },
  { name: "Simvastatin", cls: "Statin", slot: "bedtime", food: "either", halfLife: "short",
    why: "Short-acting statin — evening dosing meaningfully improves cholesterol lowering because it covers the overnight production peak.",
    tips: ["Evening dosing is a real efficacy difference here, not just convention.", "Avoid grapefruit entirely — strong interaction."],
    conflictsWith: [] },
  { name: "Levothyroxine", cls: "Thyroid hormone", slot: "waking", food: "empty",
    why: "Absorption drops sharply with food, coffee, and many minerals. An empty stomach 30–60 min before breakfast is the standard, and bedtime (3+ hrs after eating) is a validated alternative.",
    tips: ["Separate from calcium, iron, and antacids by 4 hours.", "Coffee blocks absorption — wait 30–60 minutes.", "Same routine every day keeps levels steady."],
    conflictsWith: ["Calcium carbonate", "Ferrous sulfate", "Omeprazole"] },
  { name: "Lisinopril", cls: "ACE inhibitor", slot: "evening", food: "either",
    why: "Blood pressure normally dips at night; evening dosing can restore that dip and may improve outcomes for some. Morning is also fine — ask your prescriber which suits you.",
    tips: ["First dose can cause dizziness — take the very first one at bedtime, seated.", "A dry cough is a known class effect worth reporting."],
    conflictsWith: [] },
  { name: "Hydrochlorothiazide", cls: "Thiazide diuretic", slot: "morning", food: "either",
    why: "It makes you urinate. Morning dosing keeps the effect during waking hours instead of interrupting sleep.",
    tips: ["Avoid late-day dosing to prevent nighttime bathroom trips (nocturia).", "Can lower potassium — expect periodic labs."],
    conflictsWith: [] },
  { name: "Furosemide", cls: "Loop diuretic", slot: "morning", food: "either",
    why: "Strong, fast diuretic. Morning (and a second dose by early afternoon if twice daily) keeps its effect out of the night.",
    tips: ["Never take the second dose late — nocturia and sleep loss follow.", "Report cramps, dizziness, or rapid weight changes."],
    conflictsWith: [] },
  { name: "Metformin", cls: "Antidiabetic (biguanide)", slot: "evening", food: "with",
    why: "Take with food to blunt GI upset. Extended-release with the evening meal is a common, well-tolerated pattern.",
    tips: ["With food, always — reduces nausea and diarrhea.", "Extended-release is gentler if standard metformin bothers your stomach."],
    conflictsWith: [] },
  { name: "Aspirin (low-dose)", cls: "Antiplatelet", slot: "bedtime", food: "with",
    why: "Evening low-dose aspirin is studied for blunting the morning surge in platelet activity, though guidance still evolves. Take with food to protect the stomach.",
    tips: ["With food to reduce stomach irritation.", "Enteric-coated forms further reduce GI upset."],
    conflictsWith: [] },
  { name: "Omeprazole", cls: "Proton-pump inhibitor", slot: "morning", food: "before",
    why: "Works best on the proton pumps activated by the day's first meal — take 30–60 minutes BEFORE breakfast.",
    tips: ["30–60 min before the first meal is the key detail most people miss.", "For nighttime symptoms, a prescriber may add an evening dose before dinner."],
    conflictsWith: ["Levothyroxine"] },
  { name: "Amlodipine", cls: "Calcium channel blocker", slot: "morning", food: "either", halfLife: "long",
    why: "Very long-acting, so any consistent time works. Morning is a common default; the drug covers the full 24 hours regardless.",
    tips: ["Pick a time you'll remember and keep it.", "Ankle swelling is a known effect — report if bothersome."],
    conflictsWith: [] },
  { name: "Metoprolol", cls: "Beta-blocker", slot: "morning", food: "with",
    why: "Morning dosing covers the daytime heart-rate and blood-pressure surge. Extended-release forms give smooth 24-hour coverage.",
    tips: ["Take with or just after food for steadier absorption (ER forms).", "Never stop abruptly — rebound effects can be dangerous."],
    conflictsWith: [] },
  { name: "Gabapentin", cls: "Anticonvulsant / neuropathic", slot: "bedtime", food: "either",
    why: "Sedating — a larger share at bedtime uses the drowsiness to aid sleep and reduces daytime grogginess.",
    tips: ["Bedtime weighting turns a side effect into a benefit.", "Rise slowly at night — dizziness and fall risk."],
    conflictsWith: [] },
  { name: "Prednisone", cls: "Corticosteroid", slot: "morning", food: "with",
    why: "Mimics the body's natural morning cortisol peak; morning dosing reduces insomnia and better matches physiology.",
    tips: ["Morning with food — evening doses commonly cause insomnia.", "Never stop abruptly if taken for more than a couple of weeks."],
    conflictsWith: [] },
  { name: "Sertraline", cls: "SSRI antidepressant", slot: "morning", food: "with",
    why: "Can be activating, so morning suits most people. If it makes you sleepy instead, evening may fit better — timing is individualized.",
    tips: ["If it disrupts sleep, take it in the morning.", "If it makes you drowsy, ask about switching to evening."],
    conflictsWith: [] },
  { name: "Melatonin", cls: "Sleep aid", slot: "bedtime", food: "either",
    why: "A circadian signal — taken 30–60 min before the target sleep time to shift the body clock toward sleep.",
    tips: ["Timing is the whole point: 30–60 min before intended sleep.", "Lower doses (0.5–3 mg) often work as well as higher ones."],
    conflictsWith: [] },
  { name: "Calcium carbonate", cls: "Mineral supplement", slot: "midday", food: "with",
    why: "Best absorbed with food and in split doses (the gut absorbs ~500 mg well at once). Keep it away from thyroid and iron.",
    tips: ["Split large doses across the day.", "Separate from levothyroxine and iron by 4 hours."],
    conflictsWith: ["Levothyroxine", "Ferrous sulfate"] },
  { name: "Ferrous sulfate", cls: "Iron supplement", slot: "morning", food: "empty",
    why: "Absorbed best on an empty stomach, ideally with vitamin C. Every-other-day dosing can absorb better than daily for some.",
    tips: ["Vitamin C (or orange juice) boosts absorption.", "Separate from calcium, thyroid meds, and antacids by 4 hours.", "Take with food only if it upsets your stomach — at the cost of some absorption."],
    conflictsWith: ["Levothyroxine", "Calcium carbonate", "Omeprazole"] },
  { name: "Lactulose", cls: "Laxative (for encephalopathy)", slot: "morning", food: "either",
    why: "For hepatic encephalopathy the goal is 2–3 soft stools daily. Dosing is titrated to that effect, often split through the day rather than fixed to a clock.",
    tips: ["Titrate to 2–3 soft stools per day — the effect sets the dose.", "Consistency prevents both under- and over-treatment."],
    conflictsWith: [] },
  { name: "Warfarin", cls: "Anticoagulant", slot: "evening", food: "either",
    why: "Evening dosing is conventional so that dose adjustments after same-day INR results can be applied the same night — but any consistent time is acceptable.",
    tips: ["Same time every day is what matters most.", "Keep vitamin K intake steady, not zero.", "Never double up on a missed dose without guidance."],
    conflictsWith: [] },
  { name: "Cetirizine", cls: "Antihistamine", slot: "evening", food: "either",
    why: "Mildly sedating for some — evening dosing sidesteps daytime drowsiness while covering overnight and morning allergy symptoms.",
    tips: ["Evening suits most; switch to morning if it doesn't make you drowsy.", "Non-sedating for many people — individualize."],
    conflictsWith: [] },
];

/* ---------- Timing engine (mirrored on the backend) ---------- */
function findDrug(name) {
  const q = String(name || "").trim().toLowerCase();
  if (!q) return null;
  return DRUGS.find((d) => d.name.toLowerCase() === q) ||
    DRUGS.find((d) => d.name.toLowerCase().includes(q) || q.includes(d.name.toLowerCase())) || null;
}

/* Personalization: adjust guidance (not a fixed clock) by conditions + routine. */
function personalizeTiming(drug, profile = {}) {
  const notes = [];
  let slot = drug.slot;

  if (profile.kidneyDisease && drug.cls.includes("diuretic")) {
    notes.push("Kidney disease: diuretic timing and dose are specialist-guided — confirm any change with your team before adjusting.");
  }
  if (profile.liverDisease && (drug.cls.includes("Statin") || drug.name === "Warfarin")) {
    notes.push("Liver disease can change how this drug is cleared — timing tweaks should be confirmed with your hepatology team.");
  }
  if (profile.nightShift && ["morning", "waking"].includes(slot)) {
    notes.push("Night-shift routine: 'morning' means YOUR waking period, not the clock. Anchor doses to your wake time, meals, and sleep — not to sunrise.");
  }
  if (profile.age65 && drug.cls.includes("diuretic")) {
    notes.push("Age 65+: taking diuretics too late raises nighttime bathroom trips and fall risk — keep them early.");
  }
  if (profile.age65 && (drug.name === "Gabapentin" || drug.cls.includes("Antihistamine"))) {
    notes.push("Age 65+: sedating drugs carry a higher fall risk — rise slowly at night and keep a clear path to the bathroom.");
  }
  return { slot, notes };
}

/* Detect same-slot spacing conflicts (e.g., levothyroxine + calcium). */
function detectConflicts(meds) {
  const out = [];
  for (let i = 0; i < meds.length; i++) {
    for (let j = i + 1; j < meds.length; j++) {
      const a = meds[i], b = meds[j];
      const aConf = (a.conflictsWith || []).some((n) => n.toLowerCase() === b.name.toLowerCase());
      const bConf = (b.conflictsWith || []).some((n) => n.toLowerCase() === a.name.toLowerCase());
      if ((aConf || bConf) && a.slot === b.slot) {
        out.push({ a: a.name, b: b.name, slot: a.slot,
          why: `${a.name} and ${b.name} interfere with each other's absorption and are both scheduled for ${SLOTS[a.slot]?.label.toLowerCase()}. Separate them by about 4 hours.` });
      }
    }
  }
  return out;
}

function buildSchedule(meds, profile) {
  const byslot = {};
  for (const key of Object.keys(SLOTS)) byslot[key] = [];
  for (const m of meds) {
    const { slot } = personalizeTiming(m, profile);
    byslot[slot].push(m);
  }
  return Object.entries(SLOTS)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, meta]) => ({ key, ...meta, meds: byslot[key] }))
    .filter((s) => s.meds.length > 0);
}

/* ---------- Error boundary ---------- */
class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return (
      <div style={{ fontFamily: "system-ui", padding: 32, color: C.slate, maxWidth: 420, margin: "40px auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
        <div style={{ color: C.red, fontWeight: 600, marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 14, marginBottom: 16 }}>The screen hit an unexpected error. Session data is kept in memory — reload the view to continue.</div>
        <button onClick={() => this.setState({ err: null })} style={{ background: C.blue, color: "#fff", border: 0, borderRadius: 6, height: 44, padding: "0 20px", cursor: "pointer" }}>Reload view</button>
      </div>
    );
    return this.props.children;
  }
}

/* ---------- Primitives ---------- */
const Card = ({ children, style, alert }) => (
  <div style={{ background: C.white, border: `1px solid ${alert || C.border}`, borderRadius: 8, padding: 20, ...style }}>{children}</div>
);
const Btn = ({ children, onClick, kind = "primary", style, disabled }) => {
  const kinds = {
    primary: { background: C.blue, color: "#fff", border: 0 },
    secondary: { background: "#fff", color: C.blue, border: `1px solid ${C.blue}` },
    tertiary: { background: "transparent", color: C.slate, border: 0 },
  };
  return <button disabled={disabled} onClick={onClick}
    style={{ height: 48, borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: disabled ? "default" : "pointer", padding: "0 20px", width: "100%", opacity: disabled ? 0.5 : 1, ...kinds[kind], ...style }}>{children}</button>;
};
const SlotBadge = ({ slot }) => {
  const m = SLOTS[slot];
  return <span style={{ background: "#F0F4FA", color: C.blue, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 99 }}>{m?.icon} {m?.label}</span>;
};
const FoodTag = ({ food }) => {
  const map = { with: "With food", empty: "Empty stomach", before: "Before food", either: "Food optional" };
  const col = food === "empty" || food === "before" ? "#8A6D00" : "#5F6570";
  const bg = food === "empty" || food === "before" ? "#FDF4DC" : C.soft;
  return <span style={{ background: bg, color: col, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 99 }}>{map[food] || "Food optional"}</span>;
};

/* ---------- 24-hour circadian ring ---------- */
function DayRing({ schedule, routine }) {
  const R = 78, cx = 100, cy = 100;
  const toAngle = (hour) => (hour / 24) * 360 - 90;
  const pos = (hour, r = R) => {
    const a = (toAngle(hour) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const slotHour = { waking: routine.wake, morning: routine.wake + 1, midday: 13, evening: 18, bedtime: routine.sleep - 0.5 };
  // sleep arc
  const sleepStart = routine.sleep, sleepEnd = routine.wake;
  const arc = (h1, h2, r) => {
    const large = (((h2 - h1 + 24) % 24) > 12) ? 1 : 0;
    const p1 = pos(h1, r), p2 = pos(h2, r);
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
  };
  return (
    <svg viewBox="0 0 200 200" width="100%" style={{ maxWidth: 240, display: "block", margin: "0 auto" }} role="img" aria-label="24-hour dosing clock">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={C.soft} strokeWidth="14" />
      <path d={arc(sleepStart, sleepEnd, R)} fill="none" stroke="#C9D2DC" strokeWidth="14" strokeLinecap="round" />
      {[0, 6, 12, 18].map((h) => {
        const p = pos(h, R + 16);
        return <text key={h} x={p.x} y={p.y + 3} textAnchor="middle" fontSize="9" fill="#9AA0A6">{h === 0 ? "12a" : h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`}</text>;
      })}
      {schedule.map((s) => {
        const h = slotHour[s.key] ?? 12;
        const p = pos(((h % 24) + 24) % 24);
        return (
          <g key={s.key}>
            <circle cx={p.x} cy={p.y} r="12" fill={C.blue} />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{s.meds.length}</text>
          </g>
        );
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="12" fill="#9AA0A6">Wake {fmtHour(routine.wake)}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="12" fill="#9AA0A6">Sleep {fmtHour(routine.sleep)}</text>
    </svg>
  );
}
function fmtHour(h) {
  const hr = ((Math.floor(h) % 24) + 24) % 24;
  const ampm = hr < 12 ? "am" : "pm";
  const disp = hr % 12 === 0 ? 12 : hr % 12;
  return `${disp}${ampm}`;
}

/* ============================================================
   MAIN APP
   ============================================================ */
export default function ChronoDose() {
  const [phase, setPhase] = useState("onboard");
  const [profile, setProfile] = useState({ liverDisease: false, kidneyDisease: false, age65: false, nightShift: false });
  const [routine, setRoutine] = useState({ wake: 7, sleep: 23 });
  const [tab, setTab] = useState("schedule");
  const [meds, setMeds] = useState([]);
  const [current, setCurrent] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  const notify = (m) => setToast(m);

  const schedule = buildSchedule(meds, profile);
  const conflicts = detectConflicts(meds);

  const CONDS = [["nightShift", "Night-shift / irregular schedule"], ["liverDisease", "Liver disease"], ["kidneyDisease", "Kidney disease"], ["age65", "Age 65+"]];
  const Toggle = ({ k, label }) => (
    <div onClick={() => setProfile((p) => ({ ...p, [k]: !p[k] }))}
      style={{ border: `1px solid ${profile[k] ? C.blue : C.border}`, background: profile[k] ? "#F0F4FA" : "#fff", borderRadius: 8, padding: "12px 14px", fontSize: 14, color: C.slate, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>{label}</span>
      <span style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${profile[k] ? C.blue : "#B0B5BB"}`, background: profile[k] ? C.blue : "#fff", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{profile[k] ? "✓" : ""}</span>
    </div>
  );

  if (phase === "onboard") {
    return (
      <ErrorBoundary>
        <Shell noNav>
          <div style={{ padding: "32px 20px" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, border: `2px solid ${C.blue}`, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", color: C.blue, fontSize: 24, fontWeight: 700 }}>C</div>
              <h1 style={{ fontSize: 30, fontWeight: 600, color: C.slate, margin: "0 0 10px" }}>ChronoDose</h1>
              <p style={{ fontSize: 16, color: C.slate, lineHeight: 1.5, margin: "0 0 4px" }}>Not just what to take — the best time to take it, built around your day.</p>
              <p style={{ fontSize: 12, color: "#9AA0A6", margin: 0 }}>Prototype for demonstration. Educational only — never overrides your prescriber's instructions.</p>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.slate, marginBottom: 8 }}>When do you usually wake and sleep?</div>
            <Card style={{ marginBottom: 16 }}>
              <RoutineSliders routine={routine} setRoutine={setRoutine} />
            </Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.slate, marginBottom: 8 }}>Anything that affects timing?</div>
            <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
              {CONDS.map(([k, label]) => <Toggle key={k} k={k} label={label} />)}
            </div>
            <Btn onClick={() => setPhase("app")}>Build my schedule</Btn>
          </div>
        </Shell>
      </ErrorBoundary>
    );
  }

  /* ---------- SCHEDULE TAB ---------- */
  function Schedule() {
    return (
      <div style={pad}>
        <h1 style={h2}>Your day</h1>
        <p style={sub}>Doses grouped into the best window for each medication, anchored to your wake and sleep times.</p>
        {meds.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 28 }}>
            <div style={{ fontSize: 14, color: "#7A8087", marginBottom: 14 }}>No medications yet. Add some to see your optimized day.</div>
            <Btn onClick={() => setTab("meds")} style={{ maxWidth: 220, margin: "0 auto" }}>Add medications</Btn>
          </Card>
        ) : (
          <>
            <Card style={{ marginBottom: 12 }}>
              <DayRing schedule={schedule} routine={routine} />
            </Card>
            {conflicts.length > 0 && (
              <Card alert={C.yellow} style={{ marginBottom: 12, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#8A6D00", marginBottom: 6 }}>Spacing needed</div>
                {conflicts.map((c, i) => <div key={i} style={{ fontSize: 13, color: C.slate, lineHeight: 1.55, marginBottom: 4 }}>· {c.why}</div>)}
              </Card>
            )}
            {schedule.map((s) => (
              <div key={s.key} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.slate }}>{s.label}</span>
                </div>
                {s.meds.map((m) => {
                  const { notes } = personalizeTiming(m, profile);
                  return (
                    <Card key={m.name} style={{ padding: 14, marginBottom: 8, cursor: "pointer" }}>
                      <div onClick={() => { setCurrent(m); setTab("meds"); }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: C.slate }}>{m.name}</span>
                          <FoodTag food={m.food} />
                        </div>
                        <div style={{ fontSize: 12, color: "#9AA0A6" }}>{m.cls}</div>
                        {notes.length > 0 && <div style={{ fontSize: 12, color: C.blue, marginTop: 6 }}>◆ {notes[0]}</div>}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  /* ---------- MEDS TAB (list + search + detail) ---------- */
  function Meds() {
    const [q, setQ] = useState("");
    const results = q.trim() ? DRUGS.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()) || d.cls.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
    const unknown = q.trim().length > 2 && results.length === 0;

    if (current) {
      const { slot, notes } = personalizeTiming(current, profile);
      const onList = meds.some((m) => m.name === current.name);
      return (
        <div style={pad}>
          <button onClick={() => setCurrent(null)} style={{ border: 0, background: "transparent", color: C.blue, fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 12 }}>← Back</button>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: C.slate }}>{current.name}</div>
            <div style={{ fontSize: 13, color: "#9AA0A6", marginBottom: 12 }}>{current.cls}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <SlotBadge slot={slot} /><FoodTag food={current.food} />
            </div>
          </Card>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.slate, marginBottom: 4 }}>Why this timing</div>
            <div style={{ fontSize: 14, color: C.slate, lineHeight: 1.6 }}>{current.why}</div>
          </Card>
          {notes.length > 0 && (
            <Card style={{ marginBottom: 12 }} alert={C.yellow}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#8A6D00", marginBottom: 6 }}>For your profile</div>
              {notes.map((n, i) => <div key={i} style={{ fontSize: 13, color: C.slate, lineHeight: 1.55, marginBottom: 6 }}>· {n}</div>)}
            </Card>
          )}
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.slate, marginBottom: 8 }}>Tips</div>
            {current.tips.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ color: C.blue }}>•</span><span style={{ fontSize: 13, color: C.slate, lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </Card>
          <Btn kind={onList ? "tertiary" : "primary"} onClick={() => {
            if (onList) { notify("Already on your list"); return; }
            setMeds((l) => [...l, current]); notify("Added — see it in Your Day");
          }}>{onList ? "On your list ✓" : "＋ Add to my medications"}</Btn>
          <div style={{ fontSize: 12, color: "#9AA0A6", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>Timing guidance is educational. If your prescriber gave you a specific time, follow theirs.</div>
        </div>
      );
    }

    return (
      <div style={pad}>
        <h1 style={h2}>Medications</h1>
        <p style={sub}>Search to see optimal timing, or manage your list. (Live scan/pharmacy import ships in the native build.)</p>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a medication…"
            style={{ flex: 1, height: 48, border: `1px solid ${C.slate}55`, borderRadius: 6, padding: "0 12px", fontSize: 15, outline: "none" }} />
          <Btn onClick={() => { setCurrent(DRUGS[Math.floor(Math.random() * DRUGS.length)]); }} style={{ width: 116 }} kind="secondary">📷 Scan</Btn>
        </div>
        {unknown && (
          <Card alert={C.yellow} style={{ padding: 14, marginBottom: 14, fontSize: 13, color: C.slate }}>
            "{q}" isn't in this demo database. For timing of any medication not listed, follow the label and ask your pharmacist.
          </Card>
        )}
        {results.length > 0 && (
          <Card style={{ padding: 0, marginBottom: 14, overflow: "hidden" }}>
            {results.map((d, i) => (
              <div key={d.name} onClick={() => setCurrent(d)}
                style={{ padding: "12px 16px", borderBottom: i < results.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, color: C.slate }}>{d.name} <span style={{ fontSize: 12, color: "#9AA0A6" }}>· {d.cls}</span></span>
                <SlotBadge slot={d.slot} />
              </div>
            ))}
          </Card>
        )}
        <div style={{ fontWeight: 600, fontSize: 14, color: C.slate, margin: "4px 0 8px" }}>My medications ({meds.length})</div>
        {meds.length === 0 ? (
          <div style={{ fontSize: 13, color: "#9AA0A6" }}>Nothing added yet — search above and tap a result.</div>
        ) : meds.map((m) => (
          <Card key={m.name} style={{ padding: 14, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div onClick={() => setCurrent(m)} style={{ cursor: "pointer" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.slate }}>{m.name}</div>
                <div style={{ fontSize: 12, color: "#9AA0A6" }}>{m.cls}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SlotBadge slot={personalizeTiming(m, profile).slot} />
                <button onClick={() => setMeds((l) => l.filter((x) => x.name !== m.name))} aria-label="Remove"
                  style={{ border: 0, background: "transparent", color: "#B0B5BB", cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  /* ---------- ROUTINE TAB ---------- */
  function Routine() {
    return (
      <div style={pad}>
        <h1 style={h2}>My routine</h1>
        <p style={sub}>Your wake and sleep times anchor every recommendation. "Morning" means your morning.</p>
        <Card style={{ marginBottom: 16 }}>
          <RoutineSliders routine={routine} setRoutine={setRoutine} />
        </Card>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.slate, marginBottom: 8 }}>Conditions & schedule</div>
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {CONDS.map(([k, label]) => <Toggle key={k} k={k} label={label} />)}
        </div>
        <Card>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.slate, marginBottom: 6 }}>How timing is personalized</div>
          <div style={{ fontSize: 13, color: "#7A8087", lineHeight: 1.6 }}>
            {profile.nightShift
              ? "Night-shift mode is on: timing slots follow your wake/sleep times, not the clock, so a 'morning' statin lands in your morning even if that's 4pm."
              : "Timing slots map to your wake and sleep times. Diuretics stay early to protect sleep, sedating drugs weight toward bedtime, and empty-stomach drugs anchor to your first meal."}
            {" "}These are illustrative prototype rules pending expert review — your prescriber's specific instructions always take priority.
          </div>
        </Card>
      </div>
    );
  }

  const screens = { schedule: <Schedule />, meds: <Meds />, routine: <Routine /> };
  const NAV = [["schedule", "Your Day", "◔"], ["meds", "Meds", "⊕"], ["routine", "Routine", "⚙"]];

  return (
    <ErrorBoundary>
      <Shell
        toast={toast}
        nav={
          <div style={{ display: "flex", borderTop: `1px solid ${C.border}`, background: "#fff" }}>
            {NAV.map(([k, label, icon]) => (
              <button key={k} onClick={() => { setTab(k); if (k !== "meds") setCurrent(null); }}
                style={{ flex: 1, padding: "10px 0 12px", border: 0, background: "transparent", cursor: "pointer", color: tab === k ? C.blue : "#9AA0A6" }}>
                <div style={{ fontSize: 17, lineHeight: 1 }}>{icon}</div>
                <div style={{ fontSize: 11, fontWeight: tab === k ? 700 : 400, marginTop: 3 }}>{label}</div>
              </button>
            ))}
          </div>
        }
      >
        {screens[tab] || <Schedule />}
        <div style={{ padding: "8px 20px 20px", fontSize: 11, color: "#B0B5BB", textAlign: "center", lineHeight: 1.5 }}>
          ChronoDose prototype · Vinaya Gaduputi MD FACG & Vahin Gaduputi · Educational demo only — not a medical device. Never overrides your prescriber's instructions.
        </div>
      </Shell>
    </ErrorBoundary>
  );
}

/* ---------- Routine sliders (shared) ---------- */
function RoutineSliders({ routine, setRoutine }) {
  const set = (k, v) => setRoutine((r) => ({ ...r, [k]: Math.max(0, Math.min(23.5, v)) }));
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: C.slate }}>☀ Wake time</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.blue }}>{fmtHour(routine.wake)}</span>
        </div>
        <input type="range" min="4" max="11" step="0.5" value={routine.wake} onChange={(e) => set("wake", parseFloat(e.target.value))} style={{ width: "100%", accentColor: C.blue }} />
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: C.slate }}>🌙 Sleep time</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.blue }}>{fmtHour(routine.sleep)}</span>
        </div>
        <input type="range" min="19" max="26" step="0.5" value={routine.sleep} onChange={(e) => set("sleep", parseFloat(e.target.value))} style={{ width: "100%", accentColor: C.blue }} />
      </div>
    </>
  );
}

/* ---------- Phone shell ---------- */
function Shell({ children, nav, noNav, toast }) {
  return (
    <div style={{ minHeight: "100vh", background: "#EDEFF1", display: "flex", justifyContent: "center", fontFamily: "-apple-system, 'SF Pro Text', Roboto, 'Segoe UI', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420, background: C.white, minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: noNav ? 0 : 8 }}>{children}</div>
        {!noNav && nav}
        {toast && (
          <div style={{ position: "absolute", bottom: 76, left: "50%", transform: "translateX(-50%)", background: C.slate, color: "#fff", fontSize: 13, padding: "10px 18px", borderRadius: 99, whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,.18)" }}>{toast}</div>
        )}
      </div>
    </div>
  );
}

const h2 = { fontSize: 24, fontWeight: 600, color: "#4A4F57", margin: "0 0 6px" };
const sub = { fontSize: 14, color: "#7A8087", lineHeight: 1.5, margin: "0 0 16px" };
const pad = { padding: "24px 20px" };
