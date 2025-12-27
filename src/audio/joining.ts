// Joining Animation Sound Effects

import {
  getAudioContext,
  getMasterGain,
  getIsAudioPlaying
} from './context';

interface JoiningTone {
  osc: OscillatorNode;
  gain: GainNode;
  panner: StereoPannerNode;
  targetFreq: number;
}

// Module-level state for joining tones
let joiningTones: JoiningTone[] = [];

/**
 * Get the current joining tones array
 */
export function getJoiningTones(): JoiningTone[] {
  return joiningTones;
}

/**
 * Start the joining sound - creates individual tones that will converge
 */
export function playJoiningStart(): void {
  const audioCtx = getAudioContext();
  const masterGain = getMasterGain();
  if (!audioCtx || !masterGain || !getIsAudioPlaying()) return;

  // Create individual tones that will converge
  const baseFreq = 220;
  joiningTones = [];

  for (let i = 0; i < 12; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const panner = audioCtx.createStereoPanner();

    // Spread frequencies
    const freq = baseFreq * (1 + (Math.random() - 0.5) * 0.5);
    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.value = 0.02;
    panner.pan.value = (i - 6) / 6;

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(masterGain);

    osc.start();
    joiningTones.push({ osc, gain, panner, targetFreq: baseFreq });
  }
}

/**
 * Converge the joining tones to unison
 */
export function playJoiningConverge(): void {
  const audioCtx = getAudioContext();
  const masterGain = getMasterGain();
  if (!audioCtx || !masterGain || !getIsAudioPlaying() || joiningTones.length === 0) return;

  const now = audioCtx.currentTime;
  const convergeDuration = 2;

  joiningTones.forEach((tone) => {
    // All frequencies converge to unison
    tone.osc.frequency.exponentialRampToValueAtTime(220, now + convergeDuration);
    // All panning converges to center
    tone.panner.pan.linearRampToValueAtTime(0, now + convergeDuration);
    // Slight volume swell
    tone.gain.gain.linearRampToValueAtTime(0.035, now + convergeDuration * 0.7);
    tone.gain.gain.linearRampToValueAtTime(0.025, now + convergeDuration);
  });

  // Add the "collective" harmonic after convergence
  setTimeout(() => {
    const ctx = getAudioContext();
    const master = getMasterGain();
    if (!ctx || !master || !getIsAudioPlaying()) return;

    const collectiveOsc = ctx.createOscillator();
    const collectiveGain = ctx.createGain();

    collectiveOsc.type = 'sine';
    collectiveOsc.frequency.value = 220;

    collectiveGain.gain.value = 0;

    collectiveOsc.connect(collectiveGain);
    collectiveGain.connect(master);

    const now2 = ctx.currentTime;
    collectiveGain.gain.linearRampToValueAtTime(0.1, now2 + 1);
    collectiveGain.gain.linearRampToValueAtTime(0.05, now2 + 4);

    collectiveOsc.start();

    // Fade out individual tones
    joiningTones.forEach(tone => {
      tone.gain.gain.exponentialRampToValueAtTime(0.001, now2 + 2);
      setTimeout(() => {
        tone.osc.stop();
      }, 2500);
    });

    setTimeout(() => {
      const ctx2 = getAudioContext();
      if (ctx2) {
        collectiveGain.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + 2);
        setTimeout(() => collectiveOsc.stop(), 2500);
      }
    }, 5000);
  }, convergeDuration * 1000 + 500);
}
