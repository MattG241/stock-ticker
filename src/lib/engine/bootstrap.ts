import "server-only";
import { ensureTickEngine } from "./tick";
import { ensureScheduler } from "./schedule";
import { ensureAlerts } from "./alerts";
import { ensureClosingBell } from "./bell";

ensureTickEngine();
ensureScheduler();
ensureAlerts();
ensureClosingBell();
