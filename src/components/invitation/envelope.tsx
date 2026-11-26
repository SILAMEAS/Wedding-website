"use client";

import { Music2, Pause } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { openInvitationAction } from "@/server/actions/public-invitation.actions";

type Props = {
  token: string;
  storageKey: string;
  greeting: string; // "Dear …"
  invitedLine: string;
  coupleLine: string;
  openLabel: string;
  monogram: string;
  musicUrl?: string | null;
  musicLabels?: { play: string; pause: string };
  children: ReactNode;
};

/**
 * Sealed envelope → opens on tap → reveals the invitation.
 * - The page content is server-rendered behind it and `inert` until opened.
 * - Opening calls the server to record a genuine open (bots never press it).
 * - Re-opening in the same browser session skips the envelope.
 * - prefers-reduced-motion: simple fade instead of the flap animation.
 */
export function Envelope({ token, storageKey, greeting, invitedLine, coupleLine, openLabel, monogram, musicUrl, musicLabels, children }: Props) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"closed" | "opening" | "open">("closed");
  // Already opened in this browser session? (server snapshot: no)
  const seen = useSyncExternalStore(noopSubscribe, () => readSeen(storageKey), () => false);
  const state = seen && phase === "closed" ? "open" : phase;
  const button = useRef<HTMLButtonElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (state === "closed") button.current?.focus();
  }, [state]);

  useEffect(() => {
    document.documentElement.style.overflow = state === "open" ? "" : "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [state]);

  function open() {
    if (state !== "closed") return;
    setPhase("opening");
    void openInvitationAction(token).catch(() => undefined);
    // The tap is a user gesture, so browsers allow the music to start now.
    if (audio.current) {
      audio.current.volume = 0.5;
      void audio.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setTimeout(() => setPhase("open"), reduce ? 250 : 1500);
  }

  return (
    <>
      <div inert={state !== "open"} aria-hidden={state !== "open"}>
        {children}
      </div>

      {musicUrl && (
        <>
          <audio ref={audio} src={musicUrl} loop preload="none" onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
          {state === "open" && musicLabels && (
            <button
              type="button"
              onClick={() => (playing ? audio.current?.pause() : void audio.current?.play())}
              aria-label={playing ? musicLabels.pause : musicLabels.play}
              aria-pressed={playing}
              className="fixed right-4 bottom-4 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 focus-visible:ring-4 focus-visible:ring-gold/50"
            >
              {playing ? <Pause className="size-5" aria-hidden /> : <Music2 className="size-5" aria-hidden />}
              {playing && <span aria-hidden className="absolute inset-0 rounded-full border-2 border-primary motion-safe:animate-ping" />}
            </button>
          )}
        </>
      )}

      <AnimatePresence>
        {state !== "open" && (
          <motion.div
            key="envelope"
            role="dialog"
            aria-modal="true"
            aria-labelledby="envelope-greeting"
            className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gradient-to-b from-ivory via-lavender to-soft-purple px-5"
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.2 : 0.6 }}
          >
            <Petals disabled={!!reduce} />
            <div className="relative w-full max-w-sm [perspective:1200px]">
              {/* Envelope body */}
              <div className="relative aspect-[4/3] w-full">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-background to-lavender shadow-[0_30px_60px_-20px_rgba(81,52,119,0.35)]" />
                {/* Letter inside the envelope; slides up out of it when opened */}
                <motion.div
                  className="absolute inset-x-[6%] top-[6%] bottom-[8%] flex items-start justify-center rounded-xl border border-gold/40 bg-background px-4 pt-5 shadow-md"
                  animate={state === "opening" && !reduce ? { y: "-55%" } : { y: 0 }}
                  transition={{ delay: 0.55, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  aria-hidden
                >
                  <p className="text-center font-display text-base leading-relaxed text-purple-deep">{coupleLine}</p>
                </motion.div>
                {/* Front pocket (covers the letter) */}
                <div
                  className="absolute inset-x-0 bottom-0 h-full rounded-2xl bg-gradient-to-t from-background to-ivory"
                  style={{ clipPath: "polygon(0 35%, 50% 72%, 100% 35%, 100% 100%, 0 100%)" }}
                />
                {/* Flap */}
                <motion.div
                  className="absolute inset-x-0 top-0 h-[62%] origin-top rounded-t-2xl bg-gradient-to-b from-soft-purple to-lavender"
                  style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", backfaceVisibility: "hidden" }}
                  animate={state === "opening" && !reduce ? { rotateX: 180 } : { rotateX: 0 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  aria-hidden
                />
                {/* Wax seal */}
                <motion.div
                  className="absolute top-[52%] left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary font-serif text-lg text-primary-foreground shadow-lg ring-4 ring-gold/40"
                  animate={state === "opening" ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  aria-hidden
                >
                  {monogram}
                </motion.div>
              </div>

              <div className="relative mt-8 text-center">
                <p id="envelope-greeting" className="font-serif text-2xl text-purple-deep">
                  {greeting}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{invitedLine}</p>
                <button
                  ref={button}
                  type="button"
                  onClick={open}
                  disabled={state !== "closed"}
                  className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-base font-medium text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-purple-deep focus-visible:ring-4 focus-visible:ring-gold/50 disabled:opacity-80"
                >
                  {openLabel}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function noopSubscribe() {
  return () => {};
}

function readSeen(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false; // storage unavailable (private mode)
  }
}

/** A few drifting petals for atmosphere (decorative, hidden from AT, off for reduced motion). */
function Petals({ disabled }: { disabled: boolean }) {
  if (disabled) return null;
  const petals = [8, 22, 38, 55, 70, 86];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {petals.map((left, i) => (
        <motion.span
          key={left}
          className="absolute -top-6 block size-3 rounded-[60%_0_60%_0] bg-soft-purple/80"
          style={{ left: `${left}%` }}
          animate={{ y: ["0vh", "110vh"], x: [0, i % 2 ? 30 : -30, 0], rotate: [0, 180, 360] }}
          transition={{ duration: 12 + i * 2, repeat: Infinity, delay: i * 1.6, ease: "linear" }}
        />
      ))}
    </div>
  );
}
