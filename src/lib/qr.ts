import QRCode from "qrcode";

// Brand colours: deep purple on white. Error correction "Q" (25%) so printed
// codes survive small marks/folds while staying easy to scan.
const OPTIONS = { errorCorrectionLevel: "Q" as const, margin: 2, color: { dark: "#513477", light: "#FFFFFF" } };

export function qrPng(text: string, width = 1024): Promise<Buffer> {
  return QRCode.toBuffer(text, { ...OPTIONS, type: "png", width });
}

export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { ...OPTIONS, type: "svg" });
}

export function qrDataUrl(text: string, width = 320): Promise<string> {
  return QRCode.toDataURL(text, { ...OPTIONS, width });
}
