// Offscreen document — the only place an MV3 extension can play audio. The
// service worker can't; it messages us to beep when the timer goal is reached.

function beep() {
  const ctx = new (self.AudioContext || self.webkitAudioContext)();
  const play = () => {
    const now = ctx.currentTime;
    // Three short rising beeps.
    [880, 1046, 1318].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = now + i * 0.32;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.start(t);
      osc.stop(t + 0.3);
    });
    setTimeout(() => ctx.close(), 1400);
  };
  if (ctx.state === "suspended") ctx.resume().then(play);
  else play();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "PLAY_ALARM") beep();
});
