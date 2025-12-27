// Glass Forest and Eye Tracking Sound Effects

import {
  getAudioContext,
  getMasterGain,
  getIsAudioPlaying,
  getAudioLayers
} from './context';

/**
 * Play a glass node ping sound when a node is activated
 */
export function playGlassNodePing(nodeIndex: number, _nodeColor?: string): void {
  const audioCtx = getAudioContext();
  const masterGain = getMasterGain();
  if (!audioCtx || !masterGain || !getIsAudioPlaying()) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  const panner = audioCtx.createStereoPanner();

  // Different pitch based on node
  const baseFreq = 400 + nodeIndex * 80;
  osc.type = 'sine';
  osc.frequency.value = baseFreq;

  filter.type = 'bandpass';
  filter.frequency.value = baseFreq * 1.5;
  filter.Q.value = 8;

  gain.gain.value = 0;
  panner.pan.value = (nodeIndex - 4) * 0.2;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  panner.connect(masterGain);

  const now = audioCtx.currentTime;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

  // Pitch decay
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + 0.8);

  osc.start(now);
  osc.stop(now + 1);
}

/**
 * Play a glass shatter sound effect
 */
export function playGlassShatter(): void {
  const audioCtx = getAudioContext();
  const masterGain = getMasterGain();
  if (!audioCtx || !masterGain || !getIsAudioPlaying()) return;

  // Create multiple short noise bursts for shatter effect
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const ctx = getAudioContext();
      const master = getMasterGain();
      if (!ctx || !master) return;

      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let j = 0; j < bufferSize; j++) {
        data[j] = (Math.random() * 2 - 1) * (1 - j / bufferSize);
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2000 + Math.random() * 3000;

      const gain = ctx.createGain();
      gain.gain.value = 0.08;

      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.random() * 2 - 1;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(master);

      noise.start();
    }, i * 40);
  }
}

/**
 * Play mutual annihilation sound (deep rumble with multiple shatters)
 */
export function playMutualAnnihilation(): void {
  const audioCtx = getAudioContext();
  const masterGain = getMasterGain();
  if (!audioCtx || !masterGain || !getIsAudioPlaying()) return;

  // Deep rumble
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.value = 40;

  gain.gain.value = 0;

  osc.connect(gain);
  gain.connect(masterGain);

  const now = audioCtx.currentTime;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 3);

  osc.frequency.exponentialRampToValueAtTime(20, now + 3);

  osc.start(now);
  osc.stop(now + 3.5);

  // Multiple shatters
  playGlassShatter();
  setTimeout(playGlassShatter, 200);
  setTimeout(playGlassShatter, 450);
}

/**
 * Play a spatial star touch sound
 * x: horizontal position (0-1, left to right)
 * intensity: how bright/important the star is (0-1)
 */
export function playStarTouchSound(x: number, intensity: number = 0.5): void {
  const audioCtx = getAudioContext();
  const masterGain = getMasterGain();
  if (!audioCtx || !masterGain || !getIsAudioPlaying()) return;

  // Debounce rapid touches
  const now = Date.now();
  if (now - lastStarTouchTime < 100) return;
  lastStarTouchTime = now;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  const panner = audioCtx.createStereoPanner();

  // Higher pitch for brighter stars
  const baseFreq = 600 + intensity * 800;
  osc.type = 'sine';
  osc.frequency.value = baseFreq;

  filter.type = 'lowpass';
  filter.frequency.value = 2000;
  filter.Q.value = 2;

  gain.gain.value = 0;

  // Spatial positioning based on screen x position
  panner.pan.value = (x - 0.5) * 1.8; // -0.9 to 0.9

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  panner.connect(masterGain);

  const time = audioCtx.currentTime;
  const volume = 0.02 + intensity * 0.02;
  const duration = 0.3 + intensity * 0.4;

  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  // Slight pitch rise for sparkle effect
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.1, time + duration * 0.5);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, time + duration);

  osc.start(time);
  osc.stop(time + duration + 0.1);
}

let lastStarTouchTime = 0;

// Personality audio tone configurations
type EyePersonality = 'curious' | 'hostile' | 'indifferent' | 'ancient';

interface PersonalityAudioProfile {
  frequencyMultiplier: number;  // Base frequency modifier
  attackTime: number;           // How quickly the tone fades in
  releaseTime: number;          // How quickly the tone fades out
  volumeMultiplier: number;     // Volume adjustment
  detuneRange: number;          // Subtle pitch variation
}

const personalityAudioProfiles: Record<EyePersonality, PersonalityAudioProfile> = {
  curious: {
    frequencyMultiplier: 1.3,   // Higher pitched
    attackTime: 0.15,
    releaseTime: 0.5,
    volumeMultiplier: 1.2,
    detuneRange: 20
  },
  hostile: {
    frequencyMultiplier: 0.9,   // Slightly lower, more menacing
    attackTime: 0.05,           // Quick attack
    releaseTime: 0.3,
    volumeMultiplier: 1.4,
    detuneRange: 50             // More dissonant
  },
  indifferent: {
    frequencyMultiplier: 1.0,
    attackTime: 0.5,            // Slow fade in
    releaseTime: 1.2,
    volumeMultiplier: 0.6,      // Quieter
    detuneRange: 10
  },
  ancient: {
    frequencyMultiplier: 0.5,   // Deep, low tones
    attackTime: 0.8,            // Very slow
    releaseTime: 2.0,
    volumeMultiplier: 0.8,
    detuneRange: 5              // Very stable
  }
};

/**
 * Handle audio for eye tracking interactions with personality support
 */
export function eyeTrackingAudio(
  eyeIndex: number,
  isTracking: boolean,
  personality: EyePersonality = 'indifferent'
): void {
  const audioCtx = getAudioContext();
  const audioLayers = getAudioLayers();
  if (!audioCtx || !getIsAudioPlaying() || !audioLayers.eyes) return;

  const tone = audioLayers.eyes.tones[eyeIndex % audioLayers.eyes.tones.length];
  if (!tone) return;

  const profile = personalityAudioProfiles[personality];
  const now = audioCtx.currentTime;

  if (isTracking && !tone.active) {
    tone.active = true;
    audioLayers.eyes.activeCount++;

    // Apply personality-specific frequency modulation
    if (tone.osc) {
      const baseFreq = tone.osc.frequency.value;
      const targetFreq = baseFreq * profile.frequencyMultiplier;
      tone.osc.frequency.setValueAtTime(baseFreq, now);
      tone.osc.frequency.linearRampToValueAtTime(targetFreq, now + profile.attackTime);

      // Add subtle detune for character
      tone.osc.detune.setValueAtTime(
        (Math.random() - 0.5) * profile.detuneRange,
        now
      );
    }

    tone.gain.gain.cancelScheduledValues(now);
    tone.gain.gain.setValueAtTime(tone.gain.gain.value, now);
    tone.gain.gain.linearRampToValueAtTime(
      0.015 * profile.volumeMultiplier,
      now + profile.attackTime
    );

    // Update master eyes volume based on active count
    const masterVol = Math.min(0.08, audioLayers.eyes.activeCount * 0.012);
    audioLayers.eyes.gain.gain.linearRampToValueAtTime(masterVol, now + 0.2);
  } else if (!isTracking && tone.active) {
    tone.active = false;
    audioLayers.eyes.activeCount = Math.max(0, audioLayers.eyes.activeCount - 1);

    tone.gain.gain.cancelScheduledValues(now);
    tone.gain.gain.setValueAtTime(tone.gain.gain.value, now);
    tone.gain.gain.exponentialRampToValueAtTime(0.001, now + profile.releaseTime);

    const masterVol = Math.max(0.001, audioLayers.eyes.activeCount * 0.012);
    audioLayers.eyes.gain.gain.linearRampToValueAtTime(masterVol, now + 0.5);
  }
}
