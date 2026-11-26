// Copies the QR decoder WebAssembly into /public so the check-in scanner never
// loads code from a third-party CDN (keeps CSP strict, works on venue Wi-Fi
// without external access). Runs on `npm install` (postinstall).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

// zxing-wasm does not export its package.json, so look in the usual install locations.
const candidates = [
  "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm",
  "node_modules/barcode-detector/node_modules/zxing-wasm/dist/reader/zxing_reader.wasm",
];
const source = candidates.find((p) => existsSync(p));
if (!source) {
  console.warn("[copy-vendor] zxing_reader.wasm not found; the check-in scanner will not work");
  process.exit(0);
}
mkdirSync("public/vendor", { recursive: true });
copyFileSync(source, "public/vendor/zxing_reader.wasm");
console.log("[copy-vendor] public/vendor/zxing_reader.wasm updated");
