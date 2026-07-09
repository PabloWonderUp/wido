// Tiny alarm chime via the Web Audio API — no audio asset needed.
// The context is primed on a user gesture (starting the timer) so the later,
// gesture-less alarm is allowed to play.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Warm up the audio context on a user gesture so the alarm can fire later. */
export function primeAudio() {
  getCtx();
}

/** Play a short three-note chime. */
export function playAlarm() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const notes = [880, 1108.73, 1318.51]; // A5, C#6, E6
  notes.forEach((freq, i) => {
    const t = now + i * 0.22;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  });
}
