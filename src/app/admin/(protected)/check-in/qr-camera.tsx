"use client";

import { type IDetectedBarcode, Scanner, setZXingModuleOverrides } from "@yudiel/react-qr-scanner";

// Load the QR decoder from our own origin (copied by scripts/copy-vendor.mjs), never a CDN.
setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/vendor/zxing_reader.wasm" : prefix + path),
});

/** Camera QR scanner. Loaded only on the client (see dynamic import in check-in-console). */
export default function QrCamera({ paused, onScan, onError }: { paused: boolean; onScan: (text: string) => void; onError: (message: string) => void }) {
  return (
    <Scanner
      paused={paused}
      formats={["qr_code"]}
      constraints={{ facingMode: "environment" }}
      sound={false}
      onScan={(codes: IDetectedBarcode[]) => {
        const text = codes[0]?.rawValue;
        if (text) onScan(text);
      }}
      onError={(e) => onError(e instanceof Error ? e.message : String(e))}
      styles={{ container: { width: "100%", aspectRatio: "1 / 1", borderRadius: "1rem", overflow: "hidden" } }}
    />
  );
}
