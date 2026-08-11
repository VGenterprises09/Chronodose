// Fail-safe persistence: in-memory state + atomic JSON snapshots.
// Zero native dependencies, survives restarts, corrupt-file resistant
// (writes to a temp file first, then renames; keeps a .bak of the last good save).
import fs from "node:fs";
import path from "node:path";

const DEFAULT_STATE = () => ({
  patients: {},    // id -> patient record (profile + all logs)
  tokens: {},      // sha256(token) -> { patientId, role: "patient" }
  cgTokens: {},    // sha256(token) -> { patientId, caregiverId, access }
});

export class Store {
  constructor(file = process.env.CHRONODOSE_DB || "./data/db.json") {
    this.file = path.resolve(file);
    this.state = DEFAULT_STATE();
    this.persist = process.env.NODE_ENV !== "test"; // tests run purely in memory
    this._load();
  }

  _load() {
    if (!this.persist) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      if (fs.existsSync(this.file)) {
        this.state = { ...DEFAULT_STATE(), ...JSON.parse(fs.readFileSync(this.file, "utf8")) };
      }
    } catch (err) {
      // Corrupt main file: try backup, else start fresh but never crash.
      try {
        this.state = { ...DEFAULT_STATE(), ...JSON.parse(fs.readFileSync(this.file + ".bak", "utf8")) };
        console.warn("[store] main db unreadable, recovered from backup");
      } catch {
        console.warn("[store] no readable db found, starting fresh:", err.message);
        this.state = DEFAULT_STATE();
      }
    }
  }

  save() {
    if (!this.persist) return;
    try {
      const tmp = this.file + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(this.state));
      if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.file + ".bak");
      fs.renameSync(tmp, this.file); // atomic on same filesystem
    } catch (err) {
      console.error("[store] save failed (data kept in memory):", err.message);
    }
  }
}

export const store = new Store();
