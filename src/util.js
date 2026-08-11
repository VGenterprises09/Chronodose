import crypto from "node:crypto";

export const uid = () => crypto.randomUUID();
export const newToken = () => crypto.randomBytes(24).toString("base64url");
export const hash = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
export const now = () => new Date().toISOString();
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Strict finite-number parse. Returns null (never NaN) on anything invalid. */
export function num(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function cleanStr(v, max = 200) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > max) return null;
  return s;
}
