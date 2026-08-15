import { useState, useEffect, Component } from "react";

/* ============================================================
   ChronoDose — The Medication-Timing Optimizer
   Authors: Vinaya Gaduputi MD FACG & Vahin Gaduputi
   Clinical Minimalist prototype. Single-file, fail-safe build:
   - Error boundary wraps the app
   - Timing rules always defer to the prescriber's instructions
   - Every recommendation shows its reasoning; all state in memory
   ============================================================ */

/* Dark-surface palette. blue is the fixed brand navy (solid fills, e.g. primary
   buttons); accent is the same hue lightened until it actually reads against
   near-black — #2A4E7E alone fails contrast as text/lines on a dark surface. */
const C = {
  bg: "#0A0E13", surface: "#141B22", surfaceRaised: "#1E2730",
  line: "#333E4A", lineSubtle: "#232B34",
  text: "#F4F6F8", textMuted: "#9AA0A6", textFaint: "#8C9299",
  blue: "#2A4E7E", accent: "#6FA0DE",
  red: "#F2555B", redSolid: "#C23B40", yellow: "#F9A825", green: "#3FB964",
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

/* ---------- Expanded condition library ----------
   Each condition maps to the drug classes it genuinely affects, mirroring the
   pattern of the four original profile flags (kidneyDisease, liverDisease,
   nightShift, age65) but data-driven so ~50 conditions don't become fifty
   inline `if` statements. `verified: true` = an established, textbook timing
   principle. `verified: false` = a reasonable, clinically-plausible extension
   pending review by a prescriber — flagged, not asserted with false confidence. */
const CONDITION_CATEGORIES = [
  { key: "cardiac", label: "Cardiac" },
  { key: "renal", label: "Renal" },
  { key: "hepatic", label: "Hepatic" },
  { key: "respiratory", label: "Respiratory" },
  { key: "endocrine", label: "Endocrine & metabolic" },
  { key: "gi", label: "Gastrointestinal" },
  { key: "neuro", label: "Neurological" },
  { key: "psych", label: "Psychiatric" },
  { key: "msk", label: "Musculoskeletal" },
  { key: "other", label: "Other" },
];

const CONDITION_RULES = [
  // ---- Cardiac ----
  { key: "heartFailure", category: "cardiac", label: "Heart failure", rules: [
    { match: (d) => d.cls.includes("diuretic"), verified: true,
      note: "Heart failure: diuretics should be taken early to avoid nighttime fluid buildup disrupting sleep." },
    { match: (d) => d.cls.includes("Beta-blocker"), verified: true,
      note: "Heart failure: keep beta-blocker timing consistent day to day — steady levels matter more than the exact hour for rate and symptom control." },
  ]},
  { key: "afib", category: "cardiac", label: "Atrial fibrillation", rules: [
    { match: (d) => d.cls.includes("Anticoagulant"), verified: true,
      note: "Atrial fibrillation: same-time daily anticoagulant dosing keeps stroke-prevention coverage steady — this matters more here than with most drugs." },
    { match: (d) => d.cls.includes("Beta-blocker"), verified: true,
      note: "Atrial fibrillation: consistent beta-blocker timing helps keep heart-rate control steady through the day." },
  ]},
  { key: "cad", category: "cardiac", label: "Coronary artery disease / prior heart attack", rules: [
    { match: (d) => d.cls.includes("Antiplatelet"), verified: true,
      note: "Coronary artery disease: cardiovascular events cluster in the morning hours, so reliable daily antiplatelet coverage — same time, no skipped doses — is worth prioritizing." },
    { match: (d) => d.cls.includes("Statin"), verified: true,
      note: "Coronary artery disease: statin adherence matters more than the exact hour — pick a time you won't miss." },
  ]},
  { key: "orthostaticHypotension", category: "cardiac", label: "Low blood pressure on standing (orthostatic hypotension)", rules: [
    { match: (d) => d.cls.includes("ACE inhibitor") || d.cls.includes("channel blocker") || d.cls.includes("Beta-blocker"), verified: false,
      note: "Orthostatic hypotension: taking blood-pressure-lowering drugs earlier in the day, rather than right before getting up at night, may reduce dizziness on standing — ask your prescriber if this applies to you." },
  ]},
  { key: "edema", category: "cardiac", label: "Peripheral edema / venous insufficiency", rules: [
    { match: (d) => d.cls.includes("channel blocker"), verified: false,
      note: "Peripheral edema: calcium channel blockers are a common cause of ankle swelling — morning dosing makes it easier to notice swelling during the day rather than waking up with it." },
  ]},
  { key: "valvularHeartDisease", category: "cardiac", label: "Valvular heart disease (on anticoagulation)", rules: [
    { match: (d) => d.cls.includes("Anticoagulant"), verified: true,
      note: "Valvular heart disease: if you're anticoagulated because of a heart valve, same-time daily dosing is especially important — talk to your cardiology team before changing your routine." },
  ]},

  // ---- Renal ----
  { key: "dialysis", category: "renal", label: "Dialysis-dependent kidney disease", rules: [
    { match: (d) => d.cls.includes("diuretic") || d.cls.includes("ACE inhibitor") || d.cls.includes("biguanide"), verified: true,
      note: "Dialysis: several medications are timed around dialysis sessions — some doses given after treatment, others held on treatment days. Confirm exact timing with your renal/dialysis team rather than a fixed daily clock." },
  ]},
  { key: "nephroticSyndrome", category: "renal", label: "Nephrotic syndrome", rules: [
    { match: (d) => d.cls.includes("diuretic") || d.cls.includes("ACE inhibitor"), verified: false,
      note: "Nephrotic syndrome: diuretic timing is often adjusted around daily weight checks and swelling patterns — morning dosing makes those easier to track." },
  ]},
  { key: "kidneyStones", category: "renal", label: "Recurrent kidney stones", rules: [
    { match: (d) => d.name === "Calcium carbonate", verified: false,
      note: "Recurrent kidney stones: how and when calcium is taken affects how much ends up in urine — taking it with meals rather than alone is generally preferred. Ask your urology team if supplementation is still needed." },
  ]},
  { key: "kidneyTransplant", category: "renal", label: "Kidney transplant", rules: [
    { match: (d) => d.cls.includes("ACE inhibitor") || d.cls.includes("diuretic") || d.cls.includes("biguanide"), verified: true,
      note: "Kidney transplant: your transplant team may want very consistent, predictable medication timing to help interpret lab trends — avoid changing your routine without checking with them first." },
  ]},

  // ---- Hepatic ----
  { key: "cirrhosisAscites", category: "hepatic", label: "Cirrhosis with fluid buildup (ascites)", rules: [
    { match: (d) => d.cls.includes("diuretic"), verified: true,
      note: "Cirrhosis with ascites: diuretics are often dosed in the morning so daily weight can be checked before the day's fluid shifts begin — a common way hepatology teams track whether the dose is working." },
  ]},
  { key: "hepaticEncephalopathy", category: "hepatic", label: "Hepatic encephalopathy", rules: [
    { match: (d) => d.cls.includes("Laxative"), verified: true,
      note: "Hepatic encephalopathy: dose timing should avoid clustering bowel movements right at bedtime — many people split doses to keep the 2–3 stools/day target without disrupting sleep." },
  ]},
  { key: "chronicHepatitis", category: "hepatic", label: "Chronic hepatitis (viral or autoimmune)", rules: [
    { match: (d) => d.cls.includes("Statin"), verified: false,
      note: "Chronic hepatitis: statins are still often appropriate, but consistent timing makes it easier to correlate any new symptoms with a specific dose — flag anything new to your hepatology team rather than adjusting timing on your own." },
  ]},
  { key: "varicealBleedHistory", category: "hepatic", label: "History of variceal bleeding", rules: [
    { match: (d) => d.cls.includes("Anticoagulant") || d.cls.includes("Antiplatelet"), verified: false,
      note: "History of variceal bleeding: any bleeding-risk medication's timing and necessity should be reviewed directly with your GI or hepatology team — this is one to get individualized guidance on rather than follow general defaults." },
  ]},

  // ---- Respiratory ----
  { key: "asthma", category: "respiratory", label: "Asthma", rules: [
    { match: (d) => d.cls.includes("Beta-blocker"), verified: true,
      note: "Asthma: non-selective beta-blockers can worsen bronchospasm — if you notice increased wheezing after starting one, timing won't fix it; flag it to your prescriber." },
    { match: (d) => d.cls.includes("Corticosteroid"), verified: true,
      note: "Asthma: morning dosing mirrors your body's natural cortisol rhythm and reduces steroid-related insomnia — helpful since asthma symptoms can already disrupt sleep." },
  ]},
  { key: "copd", category: "respiratory", label: "COPD", rules: [
    { match: (d) => d.cls.includes("Corticosteroid"), verified: false,
      note: "COPD: morning steroid dosing reduces insomnia risk, which matters more when sleep is already fragmented by COPD symptoms." },
  ]},
  { key: "sleepApnea", category: "respiratory", label: "Obstructive sleep apnea", rules: [
    { match: (d) => d.name === "Melatonin" || d.name === "Gabapentin" || d.cls.includes("Antihistamine"), verified: true,
      note: "Obstructive sleep apnea: sedating medications taken at bedtime can relax airway muscles further and worsen apnea events — worth discussing whether bedtime is really the best slot with your sleep specialist." },
  ]},
  { key: "chronicCough", category: "respiratory", label: "Chronic dry cough", rules: [
    { match: (d) => d.cls.includes("ACE inhibitor"), verified: true,
      note: "Chronic dry cough: this class is a well-known cause of persistent dry cough — if it started after this medication, no timing adjustment will resolve it; it's worth flagging to your prescriber." },
  ]},
  { key: "seasonalAllergies", category: "respiratory", label: "Seasonal or environmental allergies", rules: [
    { match: (d) => d.cls.includes("Antihistamine"), verified: true,
      note: "Seasonal allergies: if you're taking other sedating medications, stacking them at the same time compounds drowsiness — spread sedating doses out where your prescriber allows." },
  ]},

  // ---- Endocrine & metabolic ----
  { key: "type2Diabetes", category: "endocrine", label: "Type 2 diabetes", rules: [
    { match: (d) => d.cls.includes("biguanide"), verified: true,
      note: "Type 2 diabetes: taking Metformin consistently with meals, at the same times each day, keeps blood-sugar coverage steady across the day." },
    { match: (d) => d.cls.includes("Corticosteroid"), verified: true,
      note: "Type 2 diabetes: steroids raise blood sugar, often most noticeably several hours after the dose — morning dosing means the sugar-raising effect is more likely to show up while you're awake and able to respond." },
    { match: (d) => d.cls.includes("Beta-blocker"), verified: true,
      note: "Type 2 diabetes: beta-blockers can mask early warning signs of low blood sugar, like a racing heart — know your other hypoglycemia symptoms and check sugars if unsure." },
  ]},
  { key: "hypothyroidism", category: "endocrine", label: "Hypothyroidism", rules: [
    { match: (d) => d.cls.includes("Thyroid"), verified: true,
      note: "Hypothyroidism: this reinforces what's already true for Levothyroxine — empty stomach, consistent timing, and a 4-hour gap from calcium, iron, and antacids matter even more when thyroid function is already low." },
  ]},
  { key: "hyperthyroidism", category: "endocrine", label: "Hyperthyroidism", rules: [
    { match: (d) => d.cls.includes("Beta-blocker"), verified: false,
      note: "Hyperthyroidism: beta-blockers are often used to control the racing heart and tremor of an overactive thyroid — consistent timing helps you and your prescriber track whether symptom control is steady through the day." },
  ]},
  { key: "adrenalInsufficiency", category: "endocrine", label: "Adrenal insufficiency (on steroid replacement)", rules: [
    { match: (d) => d.cls.includes("Corticosteroid"), verified: true,
      note: "Adrenal insufficiency: replacement steroid timing matters even more than usual — it's meant to mimic your body's natural cortisol rhythm, so the morning dose is typically the largest, and doses should never be stopped abruptly or skipped, even briefly." },
  ]},
  { key: "osteoporosis", category: "endocrine", label: "Osteoporosis / low bone density", rules: [
    { match: (d) => d.name === "Calcium carbonate", verified: true,
      note: "Osteoporosis: splitting calcium into smaller doses through the day improves how much your body actually absorbs, and it still needs to stay 4 hours from thyroid hormone and iron." },
  ]},
  { key: "vitaminDDeficiency", category: "endocrine", label: "Vitamin D deficiency", rules: [
    { match: (d) => d.name === "Calcium carbonate", verified: false,
      note: "Vitamin D deficiency: vitamin D is fat-soluble, so taking it with a meal that has some fat improves absorption — it's commonly taken alongside calcium." },
  ]},

  // ---- Gastrointestinal ----
  { key: "gerd", category: "gi", label: "GERD / acid reflux", rules: [
    { match: (d) => d.cls.includes("Proton-pump"), verified: true,
      note: "GERD: this reinforces Omeprazole's own timing — 30–60 minutes before your first meal is when it works best, since it needs an empty stomach to reach the acid pumps before food activates them." },
  ]},
  { key: "pud", category: "gi", label: "Peptic ulcer disease", rules: [
    { match: (d) => d.cls.includes("Proton-pump"), verified: true,
      note: "Peptic ulcer disease: consistent pre-meal PPI timing supports healing — missed or late doses reduce the acid suppression your ulcer needs to recover." },
  ]},
  { key: "chronicConstipation", category: "gi", label: "Chronic constipation", rules: [
    { match: (d) => d.cls.includes("Laxative"), verified: true,
      note: "Chronic constipation: like this drug's encephalopathy dosing, laxative timing is often titrated to effect — aiming for regular, comfortable stools — rather than fixed to a specific clock time. Work with your prescriber on the right dose and timing for you." },
  ]},
  { key: "ibd", category: "gi", label: "Inflammatory bowel disease (Crohn's or ulcerative colitis)", rules: [
    { match: (d) => d.cls.includes("Corticosteroid"), verified: true,
      note: "Inflammatory bowel disease: if steroids are prescribed for a flare, morning dosing still applies — it mimics natural cortisol rhythm and helps limit insomnia during an already difficult flare." },
  ]},
  { key: "gastroparesis", category: "gi", label: "Gastroparesis (delayed stomach emptying)", rules: [
    { match: (d) => d.cls.includes("Proton-pump") || d.cls.includes("biguanide") || d.cls.includes("Iron"), verified: false,
      note: "Gastroparesis: delayed stomach emptying can change how food-dependent medications are absorbed — timing relative to meals may need individual adjustment with your GI team, especially for anything meant to be taken with or before food." },
  ]},

  // ---- Neurological ----
  { key: "epilepsy", category: "neuro", label: "Epilepsy / seizure disorder", rules: [
    { match: (d) => d.cls.includes("Anticonvulsant"), verified: true,
      note: "Epilepsy: for any anticonvulsant, taking doses at the same time every day is one of the most important things you can do — even small timing drift can lower blood levels enough to raise seizure risk." },
  ]},
  { key: "migraine", category: "neuro", label: "Migraine", rules: [
    { match: (d) => d.cls.includes("Beta-blocker"), verified: true,
      note: "Migraine: if a beta-blocker was prescribed for prevention (not just heart rate or blood pressure), it needs weeks of consistent daily dosing before you can judge whether it's working — timing consistency matters more than the specific hour." },
  ]},
  { key: "stroke", category: "neuro", label: "History of stroke or TIA", rules: [
    { match: (d) => d.cls.includes("Antiplatelet") || d.cls.includes("Anticoagulant") || d.cls.includes("Statin"), verified: true,
      note: "History of stroke: reliable daily timing for antiplatelet/anticoagulant and statin therapy is part of secondary stroke prevention — missed doses meaningfully raise recurrence risk, more so than with many other drug classes." },
  ]},
  { key: "peripheralNeuropathy", category: "neuro", label: "Peripheral neuropathy (non-diabetic)", rules: [
    { match: (d) => d.name === "Gabapentin", verified: true,
      note: "Peripheral neuropathy: Gabapentin's sedating effect is often most helpful if weighted toward evening/bedtime — ask your prescriber whether an uneven split, more at night and less in the day, fits your symptom pattern." },
  ]},
  { key: "essentialTremor", category: "neuro", label: "Essential tremor", rules: [
    { match: (d) => d.cls.includes("Beta-blocker"), verified: false,
      note: "Essential tremor: if a beta-blocker was prescribed for tremor rather than heart rate or blood pressure, timing it before activities where tremor is most disruptive — rather than a fixed clock time — is a reasonable approach. Ask your prescriber." },
  ]},
  { key: "restlessLegs", category: "neuro", label: "Restless legs syndrome", rules: [
    { match: (d) => d.name === "Ferrous sulfate", verified: true,
      note: "Restless legs syndrome: iron deficiency is a known contributor — if iron supplementation was recommended, taking it on an empty stomach with vitamin C, as already noted, maximizes the chance it actually helps your symptoms." },
    { match: (d) => d.name === "Gabapentin", verified: true,
      note: "Restless legs syndrome: if Gabapentin was prescribed for RLS rather than nerve pain, evening dosing — 2–3 hours before symptoms typically start — is the usual approach, rather than a fixed daytime slot." },
  ]},

  // ---- Psychiatric ----
  { key: "depression", category: "psych", label: "Depression", rules: [
    { match: (d) => d.cls.includes("SSRI"), verified: true,
      note: "Depression: this reinforces Sertraline's own guidance — most people do better with morning dosing since SSRIs can be activating, but if it makes you drowsy instead, evening may fit better. Give any timing change a few weeks before judging effect." },
  ]},
  { key: "anxiety", category: "psych", label: "Anxiety disorder", rules: [
    { match: (d) => d.cls.includes("SSRI"), verified: true,
      note: "Anxiety: SSRIs typically take several weeks to reach full effect regardless of time of day — consistent daily timing matters more than the specific hour for judging whether it's working." },
  ]},
  { key: "insomnia", category: "psych", label: "Insomnia", rules: [
    { match: (d) => d.name === "Melatonin", verified: true,
      note: "Insomnia: this reinforces Melatonin's own timing — 30–60 minutes before your intended sleep time is what makes it a circadian signal rather than just a sedative; taking it too early or late blunts the effect." },
    { match: (d) => d.cls.includes("Antihistamine") || d.cls.includes("Anticonvulsant"), verified: true,
      note: "Insomnia: if you're also taking other sedating medications, spacing them relative to your actual bedtime — not just \"evening\" — helps avoid next-day grogginess." },
  ]},
  { key: "ptsd", category: "psych", label: "PTSD", rules: [
    { match: (d) => d.cls.includes("SSRI"), verified: false,
      note: "PTSD: if nightmares or sleep disruption are prominent symptoms, discuss with your prescriber whether evening SSRI dosing, rather than the typical morning default, fits better for you." },
  ]},

  // ---- Musculoskeletal ----
  { key: "rheumatoidArthritis", category: "msk", label: "Rheumatoid arthritis", rules: [
    { match: (d) => d.cls.includes("Corticosteroid"), verified: true,
      note: "Rheumatoid arthritis: steroid dosing for flares still follows the morning-preferred pattern to match natural cortisol rhythm and limit insomnia." },
    { match: (d) => d.name === "Calcium carbonate", verified: true,
      note: "Rheumatoid arthritis: long-term steroid use raises fracture risk, so if calcium/vitamin D was added to protect bone density, the same absorption-timing rules apply — split doses, away from thyroid hormone and iron." },
  ]},
  { key: "gout", category: "msk", label: "Gout", rules: [
    { match: (d) => d.cls.includes("Thiazide"), verified: true,
      note: "Gout: thiazide diuretics can raise uric acid levels and trigger flares. This isn't a timing fix, but if gout flares started or worsened after beginning this medication, it's worth flagging to your prescriber regardless of when you take it." },
  ]},
  { key: "chronicBackPain", category: "msk", label: "Chronic back pain", rules: [
    { match: (d) => d.name === "Gabapentin", verified: false,
      note: "Chronic pain: if Gabapentin is being used for pain rather than nerve-specific symptoms, evening-weighted dosing — the same pattern as its neuropathy use — is still common, to reduce daytime grogginess." },
  ]},
  { key: "fibromyalgia", category: "msk", label: "Fibromyalgia", rules: [
    { match: (d) => d.cls.includes("SSRI") || d.name === "Gabapentin", verified: false,
      note: "Fibromyalgia: both SSRIs and gabapentin-family medications are commonly used here — whichever you're on, the consistent daily timing already recommended for each matters more for fibromyalgia's fluctuating symptoms than chasing a \"perfect\" hour." },
  ]},

  // ---- Other ----
  { key: "pregnancy", category: "other", label: "Pregnant or breastfeeding", rules: [
    { match: (d) => d.cls.includes("Statin") || d.cls.includes("ACE inhibitor") || d.cls.includes("Anticoagulant"), verified: true,
      note: "Pregnancy/breastfeeding: this medication class needs direct review with your OB and prescriber — some aren't recommended in pregnancy or while breastfeeding regardless of timing. Don't wait for a routine visit if you're unsure." },
  ]},
  { key: "glaucoma", category: "other", label: "Glaucoma", rules: [
    { match: (d) => d.cls.includes("Corticosteroid"), verified: true,
      note: "Glaucoma: corticosteroids can raise eye pressure. This isn't primarily a timing issue, but it's worth mentioning to your ophthalmologist if you start one, regardless of when you take it." },
  ]},
  { key: "upcomingSurgery", category: "other", label: "Upcoming surgery or procedure", rules: [
    { match: (d) => d.cls.includes("Anticoagulant") || d.cls.includes("Antiplatelet"), verified: true,
      note: "Upcoming surgery: anticoagulants and antiplatelets are often paused before procedures on a specific schedule set by your surgical team — don't stop or adjust timing on your own ahead of a procedure." },
  ]},
  { key: "swallowingDifficulty", category: "other", label: "Difficulty swallowing pills (dysphagia)", rules: [
    { match: (d) => d.cls.includes("biguanide") || d.cls.includes("channel blocker"), verified: true,
      note: "Difficulty swallowing pills: never crush or split extended-release formulations without checking first — it can dump the full dose at once instead of releasing it slowly, which changes both effect and timing." },
  ]},
  { key: "frequentTraveler", category: "other", label: "Frequent time-zone travel", rules: [
    { match: (d) => d.cls.includes("Thyroid") || d.cls.includes("Anticonvulsant") || d.name === "Melatonin", verified: false,
      note: "Frequent time-zone travel: for medications where consistent timing matters most, like this one, anchor doses to elapsed hours since your last dose during travel days rather than the new local clock, then transition to local time over a day or two." },
  ]},
];

/* ---------- Timing engine (mirrored on the backend) ---------- */
function findDrug(name) {
  const q = String(name || "").trim().toLowerCase();
  if (!q) return null;
  return DRUGS.find((d) => d.name.toLowerCase() === q) ||
    DRUGS.find((d) => d.name.toLowerCase().includes(q) || q.includes(d.name.toLowerCase())) || null;
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

/* Normalizes both the modern Promise-based Notification.requestPermission()
   and the legacy callback-based signature some browsers still use. Must only
   ever be called from a real user gesture (a click handler) — browsers block
   or auto-deny permission requests that aren't. */
function requestNotificationPermission() {
  return new Promise((resolve) => {
    try {
      const maybePromise = Notification.requestPermission((legacyResult) => resolve(legacyResult));
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(resolve).catch(() => resolve("denied"));
      }
    } catch {
      resolve("denied");
    }
  });
}

/* RxNorm (NIH RxNav, rxnav.nlm.nih.gov — free, public, no key) name-recognition
   lookup for medications outside our curated timing database. This only ever
   confirms a drug NAME exists — it never returns or infers timing/food guidance,
   which is the whole reason the caller must show the "not yet available" message
   rather than treating a match like a curated drug. */
async function checkRxNorm(term, signal) {
  const url = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=5`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`RxNorm approximateTerm failed: ${res.status}`);
  const data = await res.json();
  const candidates = data?.approximateGroup?.candidate || [];
  if (candidates.length === 0) return { recognized: false };

  // Candidates from the approximate-match search don't all carry a display
  // name — prefer the authoritative RXNORM-sourced one, then any named one.
  const named = candidates.find((c) => c.source === "RXNORM" && c.name) || candidates.find((c) => c.name);
  if (named) return { recognized: true, name: named.name };

  // No candidate had a name at all (happens for some ingredient CUIs) — resolve
  // the top-ranked rxcui directly rather than surfacing a nameless "match."
  const nameRes = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui/${candidates[0].rxcui}.json`, { signal });
  if (nameRes.ok) {
    const nameData = await nameRes.json();
    if (nameData?.idGroup?.name) return { recognized: true, name: nameData.idGroup.name };
  }
  return { recognized: true, name: null };
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

  for (const cond of CONDITION_RULES) {
    if (!profile[cond.key]) continue;
    for (const rule of cond.rules) {
      if (rule.match(drug)) notes.push(rule.note);
    }
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
      <div style={{ fontFamily: "system-ui", padding: 32, color: C.text, background: C.bg, maxWidth: 420, margin: "40px auto", border: `1px solid ${C.lineSubtle}`, borderRadius: 8 }}>
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
  <div style={{ background: C.surface, border: `1px solid ${alert || C.lineSubtle}`, borderRadius: 8, padding: 20, ...style }}>{children}</div>
);
const Btn = ({ children, onClick, kind = "primary", style, disabled }) => {
  const kinds = {
    primary: { background: C.blue, color: "#fff", border: 0 },
    secondary: { background: "transparent", color: C.accent, border: `1px solid ${C.accent}` },
    tertiary: { background: "transparent", color: C.textMuted, border: 0 },
  };
  return <button disabled={disabled} onClick={onClick}
    style={{ height: 48, borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: disabled ? "default" : "pointer", padding: "0 20px", width: "100%", opacity: disabled ? 0.5 : 1, ...kinds[kind], ...style }}>{children}</button>;
};
const SlotBadge = ({ slot }) => {
  const m = SLOTS[slot];
  return <span style={{ background: `${C.accent}22`, color: C.accent, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 99 }}>{m?.icon} {m?.label}</span>;
};
const FoodTag = ({ food }) => {
  const map = { with: "With food", empty: "Empty stomach", before: "Before food", either: "Food optional" };
  const caution = food === "empty" || food === "before";
  const col = caution ? C.yellow : C.textMuted;
  const bg = caution ? `${C.yellow}1F` : C.surfaceRaised;
  return <span style={{ background: bg, color: col, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 99 }}>{map[food] || "Food optional"}</span>;
};

/* ---------- 24-hour circadian ring ---------- */
function DayRing({ schedule, routine }) {
  const R = 74, cx = 100, cy = 100, TRACK = 7;
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
  const ticks = Array.from({ length: 8 }, (_, i) => i * 3);
  return (
    <svg viewBox="0 0 200 200" width="100%" style={{ maxWidth: 236, display: "block", margin: "0 auto" }} role="img" aria-label="24-hour dosing clock">
      <defs>
        <filter id="dayRingMarker" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor={C.accent} floodOpacity="0.55" />
        </filter>
      </defs>
      {/* base track = waking hours (present); dimmed arc = sleep hours (recedes) */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={C.line} strokeWidth={TRACK} />
      <path d={arc(sleepStart, sleepEnd, R)} fill="none" stroke={C.lineSubtle} strokeWidth={TRACK} strokeLinecap="round" />
      {ticks.map((h) => {
        const major = h % 6 === 0;
        const inner = pos(h, R + 6), outer = pos(h, R + (major ? 12 : 10));
        return <line key={h} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={major ? C.textFaint : C.line} strokeWidth={major ? 1.4 : 1} />;
      })}
      {[0, 6, 12, 18].map((h) => {
        const p = pos(h, R + 21);
        return <text key={h} x={p.x} y={p.y + 3} textAnchor="middle" fontSize="9.5" fontWeight="700" letterSpacing="0.06em" fill={C.textFaint}>{h === 0 ? "12A" : h === 12 ? "12P" : h > 12 ? `${h - 12}P` : `${h}A`}</text>;
      })}
      {schedule.map((s) => {
        const h = slotHour[s.key] ?? 12;
        const p = pos(((h % 24) + 24) % 24);
        return (
          <g key={s.key} filter="url(#dayRingMarker)">
            <circle cx={p.x} cy={p.y} r="9.5" fill={C.accent} stroke={C.surface} strokeWidth="2.5" />
            <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill={C.bg}>{s.meds.length}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="41" fill={C.surfaceRaised} stroke={C.line} strokeWidth="1" />
      <line x1={cx - 22} y1={cy} x2={cx + 22} y2={cy} stroke={C.line} strokeWidth="1" />
      <text x={cx} y={cy - 18} textAnchor="middle" fontSize="8.5" fontWeight="700" letterSpacing="0.1em" fill={C.textFaint}>WAKE</text>
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize="19" fontWeight="700" letterSpacing="-0.01em" fill={C.text}>{fmtHour(routine.wake)}</text>
      <text x={cx} y={cy + 15} textAnchor="middle" fontSize="8.5" fontWeight="700" letterSpacing="0.1em" fill={C.textFaint}>SLEEP</text>
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="19" fontWeight="700" letterSpacing="-0.01em" fill={C.text}>{fmtHour(routine.sleep)}</text>
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
  const [removeTarget, setRemoveTarget] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  const notify = (m) => setToast(m);

  const requestRemove = (med) => setRemoveTarget(med);
  const confirmRemoveMed = () => {
    setMeds((l) => l.filter((x) => x.name !== removeTarget.name));
    notify(`Removed ${removeTarget.name}`);
    setRemoveTarget(null);
  };

  const schedule = buildSchedule(meds, profile);
  const conflicts = detectConflicts(meds);

  const CONDS = [["nightShift", "Night-shift / irregular schedule"], ["liverDisease", "Liver disease"], ["kidneyDisease", "Kidney disease"], ["age65", "Age 65+"]];
  const Toggle = ({ k, label }) => {
    const [hover, setHover] = useState(false);
    const active = profile[k];
    return (
      <div
        onClick={() => setProfile((p) => ({ ...p, [k]: !p[k] }))}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          minHeight: 44, padding: "0 14px",
          border: `1px solid ${active ? C.accent : hover ? C.line : C.lineSubtle}`,
          background: active ? C.surfaceRaised : C.surface,
          borderRadius: 6, cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 14, color: C.text, lineHeight: 1 }}>{label}</span>
        <span style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${active ? C.accent : C.textMuted}`, background: active ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {active && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke={C.bg} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </div>
    );
  };

  function ExtraConditions() {
    const [q, setQ] = useState("");
    const [openCats, setOpenCats] = useState(() => new Set());
    const query = q.trim().toLowerCase();

    const toggleCat = (key) => setOpenCats((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

    const matches = query
      ? CONDITION_RULES.filter((c) => c.label.toLowerCase().includes(query))
      : null;

    return (
      <div>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conditions…"
          style={{ width: "100%", height: 44, background: C.surfaceRaised, color: C.text, colorScheme: "dark", border: `1px solid ${C.lineSubtle}`, borderRadius: 6, padding: "0 12px", fontSize: 14, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
        />
        {matches ? (
          matches.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textFaint, padding: "8px 2px" }}>No conditions match "{q}".</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {matches.map((c) => <Toggle key={c.key} k={c.key} label={c.label} />)}
            </div>
          )
        ) : (
          CONDITION_CATEGORIES.map((cat) => {
            const items = CONDITION_RULES.filter((c) => c.category === cat.key);
            const activeCount = items.filter((c) => profile[c.key]).length;
            const open = openCats.has(cat.key);
            return (
              <div key={cat.key} style={{ marginBottom: 6 }}>
                <button onClick={() => toggleCat(cat.key)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 44, padding: "0 14px", background: C.surface, border: `1px solid ${C.lineSubtle}`, borderRadius: 6, cursor: "pointer" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textFaint }}>{cat.label}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {activeCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>{activeCount} selected</span>}
                    <span style={{ fontSize: 11, color: C.textMuted }}>{items.length}</span>
                    <span style={{ color: C.textMuted, fontSize: 11, transform: open ? "rotate(180deg)" : "none", transition: "transform 120ms ease" }}>▾</span>
                  </span>
                </button>
                {open && (
                  <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                    {items.map((c) => <Toggle key={c.key} k={c.key} label={c.label} />)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }

  if (phase === "onboard") {
    return (
      <ErrorBoundary>
        <Shell noNav>
          <div style={{ padding: "32px 20px" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ position: "relative", width: 104, height: 104, margin: "0 auto 22px" }}>
                <div style={{ position: "absolute", inset: -18, borderRadius: "50%", background: `radial-gradient(circle, ${C.accent}33 0%, ${C.accent}00 72%)` }} />
                <div style={{ position: "relative", width: 64, height: 64, margin: "20px auto 0", borderRadius: 18, background: `linear-gradient(135deg, ${C.accent}, ${C.blue} 60%, #14283F)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 26, fontWeight: 700, letterSpacing: "-0.01em", boxShadow: `0 10px 24px ${C.accent}3D, 0 2px 6px rgba(0,0,0,.5)` }}>C</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent, marginBottom: 10 }}>Medication timing, optimized</div>
              <h1 style={{ fontSize: 32, fontWeight: 700, color: C.text, letterSpacing: "-0.01em", margin: "0 0 12px" }}>ChronoDose</h1>
              <p style={{ fontSize: 16, color: C.text, lineHeight: 1.55, margin: "0 auto 10px", maxWidth: 300 }}>Not just what to take — <strong style={{ color: C.accent }}>the best time to take it</strong>, built around your day.</p>
              <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>Prototype for demonstration. Educational only — never overrides your prescriber's instructions.</p>
            </div>
            <div style={fieldLabel}>Daily routine</div>
            <Card style={{ marginBottom: 20, padding: "4px 20px" }}>
              <RoutineSliders routine={routine} setRoutine={setRoutine} />
            </Card>
            <div style={fieldLabel}>Conditions that affect timing</div>
            <div style={{ display: "grid", gap: 6, marginBottom: 24 }}>
              {CONDS.map(([k, label]) => <Toggle key={k} k={k} label={label} />)}
            </div>
            <Btn onClick={() => setPhase("app")}>Build my schedule</Btn>
          </div>
        </Shell>
      </ErrorBoundary>
    );
  }

  /* ---------- SCHEDULE TAB ---------- */
  function MedRow({ m, notes, onClick }) {
    const [hover, setHover] = useState(false);
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ background: C.surface, border: `1px solid ${hover ? C.line : C.lineSubtle}`, borderRadius: 6, padding: "12px 14px", marginBottom: 6, cursor: "pointer" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{m.name}</span>
          <FoodTag food={m.food} />
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{m.cls}</div>
        {notes.length > 0 && <div style={{ fontSize: 12, color: C.accent, marginTop: 6 }}>◆ {notes[0]}</div>}
      </div>
    );
  }

  /* Permission-only: no scheduling or sending yet. Shows once, on Your Day,
     only while permission is genuinely undecided — never re-prompts after a
     grant or a real browser denial, since the browser remembers both. The
     "Not now" dismissal is session-only (this app keeps no other state across
     reloads either), so it can resurface after a refresh — a real Allow/Block
     decision is what makes it disappear for good. */
  function NotificationPrompt() {
    const supported = notificationsSupported();
    const [permission, setPermission] = useState(supported ? Notification.permission : "unsupported");
    const [dismissed, setDismissed] = useState(false);
    const [requesting, setRequesting] = useState(false);

    if (!supported || permission !== "default" || dismissed) return null;

    const handleEnable = async () => {
      setRequesting(true);
      const result = await requestNotificationPermission();
      setPermission(result);
      setRequesting(false);
      if (result === "granted") notify("Notifications enabled");
    };

    return (
      <Card style={{ marginBottom: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
          <path d="M12 3a5 5 0 0 0-5 5v3.2c0 .6-.2 1.2-.6 1.7L5 15.5c-.6.8 0 2 1 2h12c1 0 1.6-1.2 1-2l-1.4-2.6c-.4-.5-.6-1.1-.6-1.7V8a5 5 0 0 0-5-5Z" stroke={C.accent} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9.5 19a2.5 2.5 0 0 0 5 0" stroke={C.accent} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>Get reminders when it's time to take your medications?</div>
          <div style={{ fontSize: 12, color: C.textFaint, lineHeight: 1.5, marginBottom: 12 }}>We'll only ask once — you can change this anytime in your browser's site settings.</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Btn onClick={handleEnable} disabled={requesting} style={{ width: "auto", flex: "none", height: 38, padding: "0 18px", fontSize: 13 }}>
              {requesting ? "Requesting…" : "Enable notifications"}
            </Btn>
            <button onClick={() => setDismissed(true)} style={{ background: "transparent", border: 0, color: C.textMuted, fontSize: 13, cursor: "pointer", padding: "8px 4px" }}>
              Not now
            </button>
          </div>
        </div>
      </Card>
    );
  }

  function Schedule() {
    return (
      <div style={pad}>
        <h1 style={h2}>Your day</h1>
        <p style={sub}>Doses grouped into the best window for each medication, anchored to your wake and sleep times.</p>
        {meds.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 28 }}>
            <div style={{ fontSize: 14, color: C.textFaint, marginBottom: 14 }}>No medications yet. Add some to see your optimized day.</div>
            <Btn onClick={() => setTab("meds")} style={{ maxWidth: 220, margin: "0 auto" }}>Add medications</Btn>
          </Card>
        ) : (
          <>
            <NotificationPrompt />
            <div style={fieldLabel}>24-hour view</div>
            <Card style={{ marginBottom: 20, padding: "22px 20px 18px" }}>
              <DayRing schedule={schedule} routine={routine} />
            </Card>
            {conflicts.length > 0 && (
              <Card alert={C.yellow} style={{ marginBottom: 12, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.yellow, marginBottom: 6 }}>Spacing needed</div>
                {conflicts.map((c, i) => <div key={i} style={{ fontSize: 13, color: C.text, lineHeight: 1.55, marginBottom: 4 }}>· {c.why}</div>)}
              </Card>
            )}
            {schedule.map((s) => (
              <div key={s.key} style={{ marginBottom: 20 }}>
                <div style={fieldLabel}>{s.label}</div>
                {s.meds.map((m) => {
                  const { notes } = personalizeTiming(m, profile);
                  return <MedRow key={m.name} m={m} notes={notes} onClick={() => { setCurrent(m); setTab("meds"); }} />;
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

    // RxNorm name-recognition lookup, only when the curated database has no match.
    // Debounced (450ms), cancel-safe against fast retyping, and time-boxed so an
    // unreachable/slow API falls back to an honest error rather than hanging.
    const [rx, setRx] = useState({ status: "idle", name: null });
    useEffect(() => {
      if (!unknown) { setRx({ status: "idle", name: null }); return; }
      let cancelled = false;
      setRx({ status: "loading", name: null });
      const term = q.trim();
      const debounce = setTimeout(() => {
        const controller = new AbortController();
        const giveUp = setTimeout(() => controller.abort(), 6000);
        checkRxNorm(term, controller.signal)
          .then((result) => {
            if (cancelled) return;
            setRx(result.recognized ? { status: "recognized", name: result.name } : { status: "unrecognized", name: null });
          })
          .catch(() => {
            if (cancelled) return;
            setRx({ status: "error", name: null });
          })
          .finally(() => clearTimeout(giveUp));
      }, 450);
      return () => { cancelled = true; clearTimeout(debounce); };
    }, [unknown, q]);

    if (current) {
      const { slot, notes } = personalizeTiming(current, profile);
      const onList = meds.some((m) => m.name === current.name);
      return (
        <div style={pad}>
          <button onClick={() => setCurrent(null)} style={{ border: 0, background: "transparent", color: C.accent, fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 12 }}>← Back</button>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>{current.name}</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>{current.cls}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <SlotBadge slot={slot} /><FoodTag food={current.food} />
            </div>
          </Card>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>Why this timing</div>
            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{current.why}</div>
          </Card>
          {notes.length > 0 && (
            <Card style={{ marginBottom: 12 }} alert={C.yellow}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.yellow, marginBottom: 6 }}>For your profile</div>
              {notes.map((n, i) => <div key={i} style={{ fontSize: 13, color: C.text, lineHeight: 1.55, marginBottom: 6 }}>· {n}</div>)}
            </Card>
          )}
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Tips</div>
            {current.tips.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ color: C.accent }}>•</span><span style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </Card>
          {onList ? (
            <Btn kind="secondary" style={{ color: C.red, border: `1px solid ${C.red}` }} onClick={() => requestRemove(current)}>
              Remove from my medications
            </Btn>
          ) : (
            <Btn onClick={() => { setMeds((l) => [...l, current]); notify("Added — see it in Your Day"); }}>
              ＋ Add to my medications
            </Btn>
          )}
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>Timing guidance is educational. If your prescriber gave you a specific time, follow theirs.</div>
        </div>
      );
    }

    return (
      <div style={pad}>
        <h1 style={h2}>Medications</h1>
        <p style={sub}>Search to see optimal timing, or manage your list. (Live scan/pharmacy import ships in the native build.)</p>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a medication…"
            style={{ flex: 1, height: 48, background: C.surfaceRaised, color: C.text, colorScheme: "dark", border: `1px solid ${C.lineSubtle}`, borderRadius: 6, padding: "0 12px", fontSize: 15, outline: "none" }} />
          <Btn onClick={() => { setCurrent(DRUGS[Math.floor(Math.random() * DRUGS.length)]); }} style={{ width: 116 }} kind="secondary">📷 Scan</Btn>
        </div>
        {unknown && (
          <Card alert={rx.status === "recognized" ? C.accent : rx.status === "loading" ? C.lineSubtle : C.yellow} style={{ padding: 14, marginBottom: 14, fontSize: 13 }}>
            {rx.status === "loading" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.textMuted }}>
                <style>{`@keyframes cdSpin { to { transform: rotate(360deg); } }`}</style>
                <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: "cdSpin 0.8s linear infinite", flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="9" fill="none" stroke={C.lineSubtle} strokeWidth="3" />
                  <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke={C.accent} strokeWidth="3" strokeLinecap="round" />
                </svg>
                Checking RxNorm for "{q}"…
              </div>
            )}
            {rx.status === "recognized" && (
              <>
                <div style={{ fontWeight: 600, color: C.accent, marginBottom: 4 }}>
                  Recognized medication: {capitalize(rx.name) || q}
                </div>
                <div style={{ color: C.text, lineHeight: 1.5 }}>
                  Timing guidance not yet available for this medication. Check with your pharmacist for the best time to take it.
                </div>
                <div style={{ color: C.textFaint, fontSize: 11, marginTop: 6 }}>Name match via NIH RxNorm — not a clinical timing recommendation.</div>
              </>
            )}
            {rx.status === "unrecognized" && (
              <div style={{ color: C.text }}>
                "{q}" isn't in this demo database. For timing of any medication not listed, follow the label and ask your pharmacist.
              </div>
            )}
            {rx.status === "error" && (
              <div style={{ color: C.text }}>
                Couldn't verify "{q}" right now — check with your pharmacist for the best time to take this medication.
              </div>
            )}
          </Card>
        )}
        {results.length > 0 && (
          <Card style={{ padding: 0, marginBottom: 14, overflow: "hidden" }}>
            {results.map((d, i) => (
              <div key={d.name} onClick={() => setCurrent(d)}
                style={{ padding: "12px 16px", borderBottom: i < results.length - 1 ? `1px solid ${C.lineSubtle}` : "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, color: C.text }}>{d.name} <span style={{ fontSize: 12, color: C.textMuted }}>· {d.cls}</span></span>
                <SlotBadge slot={d.slot} />
              </div>
            ))}
          </Card>
        )}
        <div style={{ fontWeight: 600, fontSize: 14, color: C.text, margin: "4px 0 8px" }}>My medications ({meds.length})</div>
        {meds.length === 0 ? (
          <div style={{ fontSize: 13, color: C.textMuted }}>Nothing added yet — search above and tap a result.</div>
        ) : meds.map((m) => (
          <Card key={m.name} style={{ padding: 14, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div onClick={() => setCurrent(m)} style={{ cursor: "pointer" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{m.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{m.cls}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SlotBadge slot={personalizeTiming(m, profile).slot} />
                <button onClick={() => requestRemove(m)} aria-label={`Remove ${m.name}`}
                  style={{ border: 0, background: "transparent", color: C.textMuted, cursor: "pointer", fontSize: 16, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
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
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>Conditions & schedule</div>
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {CONDS.map(([k, label]) => <Toggle key={k} k={k} label={label} />)}
        </div>
        <div style={fieldLabel}>More conditions</div>
        <div style={{ marginBottom: 16 }}>
          <ExtraConditions />
        </div>
        <Card>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 6 }}>How timing is personalized</div>
          <div style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.6 }}>
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
        confirm={removeTarget ? {
          message: `Remove ${removeTarget.name} from your list?`,
          onCancel: () => setRemoveTarget(null),
          onConfirm: confirmRemoveMed,
        } : null}
        nav={
          <div style={{ display: "flex", borderTop: `1px solid ${C.line}`, background: C.surface }}>
            {NAV.map(([k, label, icon]) => (
              <button key={k} onClick={() => { setTab(k); if (k !== "meds") setCurrent(null); }}
                style={{ flex: 1, padding: "10px 0 12px", border: 0, background: "transparent", cursor: "pointer", color: tab === k ? C.accent : C.textMuted }}>
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
  const pct = (v, min, max) => ((v - min) / (max - min)) * 100;
  const rows = [
    { k: "wake", label: "Wake", min: 4, max: 11 },
    { k: "sleep", label: "Sleep", min: 19, max: 26 },
  ];
  return (
    <>
      <style>{`
        .cd-range { -webkit-appearance: none; appearance: none; width: 100%; height: 3px; border-radius: 2px; outline: none; display: block; }
        .cd-range::-webkit-slider-runnable-track { height: 3px; border-radius: 2px; }
        .cd-range::-moz-range-track { height: 3px; border-radius: 2px; background: ${C.lineSubtle}; }
        .cd-range::-moz-range-progress { height: 3px; border-radius: 2px; background: ${C.accent}; }
        .cd-range::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; margin-top: -6.5px; border-radius: 50%; background: ${C.accent}; border: 3px solid ${C.bg}; box-shadow: 0 0 0 1px ${C.accent}66; cursor: pointer; }
        .cd-range::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: ${C.accent}; border: 3px solid ${C.bg}; box-shadow: 0 0 0 1px ${C.accent}66; cursor: pointer; }
      `}</style>
      {rows.map((row, i) => {
        const p = pct(routine[row.k], row.min, row.max);
        return (
          <div key={row.k} style={{ padding: "18px 0", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textFaint }}>{row.label}</span>
              <span style={{ fontSize: 30, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmtHour(routine[row.k])}</span>
            </div>
            <input
              type="range" className="cd-range" min={row.min} max={row.max} step="0.5" value={routine[row.k]}
              onChange={(e) => set(row.k, parseFloat(e.target.value))}
              style={{ colorScheme: "dark", background: `linear-gradient(to right, ${C.accent} ${p}%, ${C.lineSubtle} ${p}%)` }}
            />
          </div>
        );
      })}
    </>
  );
}

/* ---------- Phone shell ---------- */
function Shell({ children, nav, noNav, toast, confirm }) {
  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", justifyContent: "center", fontFamily: "-apple-system, 'SF Pro Text', Roboto, 'Segoe UI', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420, background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: noNav ? 0 : 8 }}>{children}</div>
        {!noNav && nav}
        {toast && (
          <div style={{ position: "absolute", bottom: 76, left: "50%", transform: "translateX(-50%)", background: C.surfaceRaised, border: `1px solid ${C.line}`, color: C.text, fontSize: 13, padding: "10px 18px", borderRadius: 99, whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(0,0,0,.5)" }}>{toast}</div>
        )}
        {confirm && (
          <div role="alertdialog" aria-modal="true" aria-label={confirm.message}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 10 }}>
            <div style={{ width: "100%", maxWidth: 300, background: C.surfaceRaised, border: `1px solid ${C.line}`, borderRadius: 10, padding: 20, boxShadow: "0 12px 32px rgba(0,0,0,.5)" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.5, marginBottom: 18 }}>{confirm.message}</div>
              <div style={{ display: "flex", gap: 10 }}>
                <Btn kind="secondary" onClick={confirm.onCancel} style={{ flex: 1 }}>Cancel</Btn>
                <Btn onClick={confirm.onConfirm} style={{ flex: 1, background: C.redSolid }}>Remove</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const h2 = { fontSize: 24, fontWeight: 700, color: C.text, margin: "0 0 6px" };
const sub = { fontSize: 14, color: C.textFaint, lineHeight: 1.5, margin: "0 0 16px" };
const pad = { padding: "24px 20px" };
const fieldLabel = { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textFaint, margin: "0 0 10px" };
