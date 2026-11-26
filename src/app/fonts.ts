import { Cormorant_Garamond, Inter, Moul, Noto_Sans_Khmer, Noto_Serif_Khmer } from "next/font/google";

// Self-hosted at build time by next/font (no runtime requests to Google, CSP stays 'self').

export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

export const notoSansKhmer = Noto_Sans_Khmer({ subsets: ["khmer"], variable: "--font-noto-sans-khmer", display: "swap" });

export const notoSerifKhmer = Noto_Serif_Khmer({ subsets: ["khmer"], variable: "--font-noto-serif-khmer", display: "swap" });

// Traditional Khmer display face, used sparingly for the couple's names.
export const moul = Moul({ subsets: ["khmer"], weight: "400", variable: "--font-moul", display: "swap" });

export const fontVariables = [inter, cormorant, notoSansKhmer, notoSerifKhmer, moul].map((f) => f.variable).join(" ");
