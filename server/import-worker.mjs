import { parentPort, workerData } from "node:worker_threads";
import { readFiles } from "./import-parser.mjs";
try {
  parentPort.postMessage({ sheets: await readFiles(workerData.files) });
} catch (e) {
  parentPort.postMessage({ error: e.message });
}
