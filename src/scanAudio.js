let context;
let originalSessionType;

// Called from the Skano navigation gesture as well as from the scanner page.
export function prepareScanAudio() {
  try {
    if ('audioSession' in navigator) {
      originalSessionType ??= navigator.audioSession.type;
      navigator.audioSession.type = 'playback';
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;
    if (!context || context.state === 'closed') context = new Audio();
    if (context.state !== 'running') void context.resume().catch(() => {});
    return context;
  } catch { return null; }
}

export function playScanTone(kind) {
  const current = prepareScanAudio();
  // Never queue a delayed success tone that could refer to a previous card.
  if (!current || current.state !== 'running') return;
  const notes = kind === 'good' ? [660, 880] : kind === 'bad' ? [220, 160] : [440];
  notes.forEach((frequency, index) => {
    const oscillator = current.createOscillator();
    const gain = current.createGain();
    const start = current.currentTime + index * 0.19;
    oscillator.type = kind === 'bad' ? 'triangle' : 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.17);
    oscillator.connect(gain); gain.connect(current.destination);
    oscillator.start(start); oscillator.stop(start + 0.18);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}

export function releaseScanAudio() {
  context?.close().catch(() => {});
  context = undefined;
  if (originalSessionType !== undefined) {
    try { navigator.audioSession.type = originalSessionType; } catch { /* Unsupported session setting. */ }
    originalSessionType = undefined;
  }
}
