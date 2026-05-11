import "server-only";
import { ensureTickEngine } from "./tick";
import { ensureScheduler } from "./schedule";
import { ensureAlerts } from "./alerts";

ensureTickEngine();
ensureScheduler();
ensureAlerts();
