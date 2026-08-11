// Drop-in API client for the ChronoDose frontend (React / React Native).
// Usage:
//   import { ChronoDoseAPI } from "./api";
//   const api = new ChronoDoseAPI(import.meta.env.VITE_API_URL);
//   const { token } = await api.register({ name, wake: 7, sleep: 23, nightShift: true });
//   api.setToken(token);
//   const schedule = await api.getSchedule();

export class ChronoDoseAPI {
  constructor(baseUrl) {
    this.base = String(baseUrl || "").replace(/\/$/, "");
    this.token = null;
  }
  setToken(t) { this.token = t; }

  async _req(method, path, body) {
    let res;
    try {
      res = await fetch(this.base + path, {
        method,
        headers: {
          "content-type": "application/json",
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error("Network unreachable — changes were not saved. Retry when back online.");
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  }

  // Onboarding / routine / profile
  register(profile) { return this._req("POST", "/auth/register", profile); } // {name, wake?, sleep?, liverDisease?, kidneyDisease?, age65?, nightShift?}
  getProfile() { return this._req("GET", "/me"); }
  updateProfile(patch) { return this._req("PATCH", "/me", patch); }          // routine (wake/sleep) + conditions

  // Meds tab
  lookupTiming(name) { return this._req("GET", `/drugs/timing?name=${encodeURIComponent(name)}`); }
  listCatalog() { return this._req("GET", "/drugs"); }
  addMed(name) { return this._req("POST", "/meds", { name }); }
  getMeds() { return this._req("GET", "/meds"); }
  removeMed(name) { return this._req("DELETE", `/meds/${encodeURIComponent(name)}`); }

  // Your Day tab
  getSchedule() { return this._req("GET", "/schedule"); }                    // slots + conflicts + routine

  // Clinician export
  exportSummary() { return this._req("GET", "/export/summary"); }
}
