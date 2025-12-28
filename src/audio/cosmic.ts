// Cosmic Event Audio - Supernova/Black Hole/Neutron Star sounds
// Inspired by stardust_merged aesthetics but adapted for Dark Forest

import {
  getAudioContext,
  getMasterGain,
  getIsAudioPlaying
} from './context';

// ═══════════════════════════════════════════════════════════════
// FREQUENCY CONSTANTS - Musical relationships for cosmic harmony
// ═══════════════════════════════════════════════════════════════

const ROOT = 81.38; // E2 - foundational cosmic frequency

const FREQ = {
  cosmicDrone: ROOT / 2,         // ~40Hz - the void hum
  stellarHeart: ROOT,            // ~81Hz - stellar pulse
  fusionRumble: ROOT * 1.5,      // ~122Hz - nuclear fire
  tensionRise: ROOT * 2,         // ~162Hz - building tension
  collapseBottom: 28,            // Sub-bass - core collapse
  neutronBase: ROOT,             // ~81Hz - pulsar warmth
  blackHoleDeep: 18,             // Near infrasound - singularity
  accretionDisk: 55,             // A1 - orbiting matter
};

// ═══════════════════════════════════════════════════════════════
// COSMIC AUDIO STATE
// ═══════════════════════════════════════════════════════════════

interface CosmicNodes {
  // Progenitor phase
  cosmicDrone?: OscillatorNode;
  cosmicDroneGain?: GainNode;
  stellarHeart?: OscillatorNode;
  stellarHeartGain?: GainNode;
  pulseLFO?: OscillatorNode;

  // Flash phase
  noiseBuffer?: AudioBufferSourceNode;
  noiseGain?: GainNode;
  noiseFilter?: BiquadFilterNode;
  choirOscs?: OscillatorNode[];
  choirGain?: GainNode;

  // Neutron Star
  pulsarOsc?: OscillatorNode;
  pulsarGain?: GainNode;
  pulsarFilter?: BiquadFilterNode;

  // Black Hole
  bhDrone?: OscillatorNode;
  bhDroneGain?: GainNode;
  bhFilter?: BiquadFilterNode;
  bhLFO?: OscillatorNode;
  accretionOsc?: OscillatorNode;
  accretionGain?: GainNode;

  // Gravitational Waves
  gwOscs?: OscillatorNode[];
  gwGain?: GainNode;
  chirpOsc?: OscillatorNode;
  chirpGain?: GainNode;
}

let cosmicNodes: CosmicNodes = {};
let isCosmicAudioInitialized = false;
let animationFrameId: number | null = null;

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function setParam(param: AudioParam, value: number, rampTime: number = 0.1): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  param.setTargetAtTime(value, ctx.currentTime, rampTime);
}

function createNoise(ctx: AudioContext, duration: number): AudioBuffer {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

export function initCosmicAudio(): void {
  const ctx = getAudioContext();
  const master = getMasterGain();
  if (!ctx || !master || isCosmicAudioInitialized) return;

  // ─── COSMIC DRONE ───
  // Deep space hum with subtle chorus
  cosmicNodes.cosmicDrone = ctx.createOscillator();
  cosmicNodes.cosmicDrone.type = 'sine';
  cosmicNodes.cosmicDrone.frequency.value = FREQ.cosmicDrone;

  cosmicNodes.cosmicDroneGain = ctx.createGain();
  cosmicNodes.cosmicDroneGain.gain.value = 0;

  // Detuned second oscillator for chorus
  const cosmicDrone2 = ctx.createOscillator();
  cosmicDrone2.type = 'sine';
  cosmicDrone2.frequency.value = FREQ.cosmicDrone * 1.003;

  cosmicNodes.cosmicDrone.connect(cosmicNodes.cosmicDroneGain);
  cosmicDrone2.connect(cosmicNodes.cosmicDroneGain);
  cosmicNodes.cosmicDroneGain.connect(master);

  cosmicNodes.cosmicDrone.start();
  cosmicDrone2.start();

  // ─── STELLAR HEARTBEAT ───
  cosmicNodes.stellarHeart = ctx.createOscillator();
  cosmicNodes.stellarHeart.type = 'sine';
  cosmicNodes.stellarHeart.frequency.value = FREQ.stellarHeart;

  cosmicNodes.stellarHeartGain = ctx.createGain();
  cosmicNodes.stellarHeartGain.gain.value = 0;

  // Heartbeat LFO
  cosmicNodes.pulseLFO = ctx.createOscillator();
  cosmicNodes.pulseLFO.type = 'sine';
  cosmicNodes.pulseLFO.frequency.value = 0.5; // 0.5 Hz pulse

  const pulseLFOGain = ctx.createGain();
  pulseLFOGain.gain.value = 0.4;

  cosmicNodes.pulseLFO.connect(pulseLFOGain);
  pulseLFOGain.connect(cosmicNodes.stellarHeartGain.gain);

  cosmicNodes.stellarHeart.connect(cosmicNodes.stellarHeartGain);
  cosmicNodes.stellarHeartGain.connect(master);

  cosmicNodes.stellarHeart.start();
  cosmicNodes.pulseLFO.start();

  // ─── CHOIR (for flash moment) ───
  cosmicNodes.choirGain = ctx.createGain();
  cosmicNodes.choirGain.gain.value = 0;

  const choirFilter = ctx.createBiquadFilter();
  choirFilter.type = 'lowpass';
  choirFilter.frequency.value = 600;
  choirFilter.Q.value = 2;

  choirFilter.connect(cosmicNodes.choirGain);
  cosmicNodes.choirGain.connect(master);

  // E minor choir: E3, G3, B3, D4, E4
  const choirNotes = [164.81, 196.00, 246.94, 293.66, 329.63];
  cosmicNodes.choirOscs = choirNotes.map(freq => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 12;
    osc.connect(choirFilter);
    osc.start();
    return osc;
  });

  // ─── NOISE LAYER ───
  cosmicNodes.noiseFilter = ctx.createBiquadFilter();
  cosmicNodes.noiseFilter.type = 'bandpass';
  cosmicNodes.noiseFilter.frequency.value = 1000;
  cosmicNodes.noiseFilter.Q.value = 0.5;

  cosmicNodes.noiseGain = ctx.createGain();
  cosmicNodes.noiseGain.gain.value = 0;

  cosmicNodes.noiseFilter.connect(cosmicNodes.noiseGain);
  cosmicNodes.noiseGain.connect(master);

  // ─── PULSAR ───
  cosmicNodes.pulsarFilter = ctx.createBiquadFilter();
  cosmicNodes.pulsarFilter.type = 'lowpass';
  cosmicNodes.pulsarFilter.frequency.value = 400;
  cosmicNodes.pulsarFilter.Q.value = 1;

  cosmicNodes.pulsarGain = ctx.createGain();
  cosmicNodes.pulsarGain.gain.value = 0;

  cosmicNodes.pulsarFilter.connect(cosmicNodes.pulsarGain);
  cosmicNodes.pulsarGain.connect(master);

  // Pulsar harmonics: fundamental + fifth + octave + sub
  [1, 1.5, 2, 0.5].forEach((mult, i) => {
    const osc = ctx.createOscillator();
    osc.type = i === 2 ? 'triangle' : 'sine';
    osc.frequency.value = FREQ.neutronBase * mult;

    const oscGain = ctx.createGain();
    oscGain.gain.value = [0.5, 0.25, 0.15, 0.35][i];

    osc.connect(oscGain);
    oscGain.connect(cosmicNodes.pulsarFilter!);
    osc.start();

    if (i === 0) cosmicNodes.pulsarOsc = osc;
  });

  // ─── BLACK HOLE DRONE ───
  cosmicNodes.bhFilter = ctx.createBiquadFilter();
  cosmicNodes.bhFilter.type = 'lowpass';
  cosmicNodes.bhFilter.frequency.value = 100;
  cosmicNodes.bhFilter.Q.value = 8;

  cosmicNodes.bhDroneGain = ctx.createGain();
  cosmicNodes.bhDroneGain.gain.value = 0;

  cosmicNodes.bhFilter.connect(cosmicNodes.bhDroneGain);
  cosmicNodes.bhDroneGain.connect(master);

  // BH drone layers: 18Hz, 27Hz (fifth below), 36Hz (octave), 9Hz (infrasound)
  [18, 27, 36, 9].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = i === 0 ? 'sawtooth' : (i === 2 ? 'triangle' : 'sine');
    osc.frequency.value = freq;
    osc.connect(cosmicNodes.bhFilter!);
    osc.start();

    if (i === 0) cosmicNodes.bhDrone = osc;
  });

  // BH breathing LFO
  cosmicNodes.bhLFO = ctx.createOscillator();
  cosmicNodes.bhLFO.type = 'sine';
  cosmicNodes.bhLFO.frequency.value = 0.08; // Very slow ~12s cycle

  const bhLFOGain = ctx.createGain();
  bhLFOGain.gain.value = 0.4;

  cosmicNodes.bhLFO.connect(bhLFOGain);
  bhLFOGain.connect(cosmicNodes.bhDroneGain!.gain);
  cosmicNodes.bhLFO.start();

  // ─── ACCRETION DISK ───
  cosmicNodes.accretionGain = ctx.createGain();
  cosmicNodes.accretionGain.gain.value = 0;

  const accretionFilter = ctx.createBiquadFilter();
  accretionFilter.type = 'lowpass';
  accretionFilter.frequency.value = 60;
  accretionFilter.Q.value = 2;

  cosmicNodes.accretionOsc = ctx.createOscillator();
  cosmicNodes.accretionOsc.type = 'sawtooth';
  cosmicNodes.accretionOsc.frequency.value = FREQ.accretionDisk;

  // Doppler-like modulation
  const accretionLFO = ctx.createOscillator();
  accretionLFO.type = 'sine';
  accretionLFO.frequency.value = 0.3;

  const accretionLFOGain = ctx.createGain();
  accretionLFOGain.gain.value = 15;

  accretionLFO.connect(accretionLFOGain);
  accretionLFOGain.connect(cosmicNodes.accretionOsc.frequency);
  accretionLFO.start();

  cosmicNodes.accretionOsc.connect(accretionFilter);
  accretionFilter.connect(cosmicNodes.accretionGain);
  cosmicNodes.accretionGain.connect(master);
  cosmicNodes.accretionOsc.start();

  // ─── GRAVITATIONAL WAVES ───
  cosmicNodes.gwGain = ctx.createGain();
  cosmicNodes.gwGain.gain.value = 0;

  const gwFilter = ctx.createBiquadFilter();
  gwFilter.type = 'lowpass';
  gwFilter.frequency.value = 60;
  gwFilter.Q.value = 4;

  gwFilter.connect(cosmicNodes.gwGain);
  cosmicNodes.gwGain.connect(master);

  // GW layers: 20, 28, 36, 44 Hz
  cosmicNodes.gwOscs = [20, 28, 36, 44].map(freq => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gwFilter);
    osc.start();
    return osc;
  });

  // GW chirp oscillator
  cosmicNodes.chirpGain = ctx.createGain();
  cosmicNodes.chirpGain.gain.value = 0;

  cosmicNodes.chirpOsc = ctx.createOscillator();
  cosmicNodes.chirpOsc.type = 'sine';
  cosmicNodes.chirpOsc.frequency.value = 25;
  cosmicNodes.chirpOsc.connect(cosmicNodes.chirpGain);
  cosmicNodes.chirpGain.connect(master);
  cosmicNodes.chirpOsc.start();

  isCosmicAudioInitialized = true;
}

// ═══════════════════════════════════════════════════════════════
// PHASE-BASED AUDIO UPDATE
// ═══════════════════════════════════════════════════════════════

export function updateCosmicAudio(t: number, fate: number): void {
  if (!isCosmicAudioInitialized || !getIsAudioPlaying()) return;

  const n = cosmicNodes;

  // ─── PROGENITOR PHASE (0-10s) ───
  if (t < 10) {
    // Cosmic drone fades in
    const droneLevel = 0.12 * smoothstep(0, 3, t);
    setParam(n.cosmicDroneGain!.gain, droneLevel, 0.3);

    // Stellar heartbeat with increasing pulse rate
    const heartLevel = 0.1 * smoothstep(0, 2, t);
    setParam(n.stellarHeartGain!.gain, heartLevel, 0.2);

    // Pulse rate increases as collapse approaches
    const pulseRate = 0.5 + smoothstep(5, 9.5, t) * 1.5;
    n.pulseLFO!.frequency.value = pulseRate;

    // Tension rises in final seconds
    if (t > 8) {
      const tension = smoothstep(8, 10, t);
      // Add high-frequency noise
      n.noiseFilter!.frequency.value = 800 + tension * 3000;
      setParam(n.noiseGain!.gain, tension * 0.15, 0.1);
    }
  }

  // ─── FLASH PHASE (10-11s) ───
  if (t >= 10 && t < 11) {
    const flashProgress = (t - 10);

    // Noise burst
    n.noiseFilter!.frequency.value = 500 + flashProgress * 4000;
    const noiseLevel = 0.5 * flashProgress * (1 - flashProgress * 0.5);
    setParam(n.noiseGain!.gain, noiseLevel, 0.02);

    // Choir swells
    const choirLevel = 0.12 * Math.sin(flashProgress * Math.PI);
    setParam(n.choirGain!.gain, choirLevel, 0.05);

    // Drone drops
    setParam(n.cosmicDroneGain!.gain, 0.04, 0.1);
    setParam(n.stellarHeartGain!.gain, 0.02, 0.1);
  }

  // ─── POST-FLASH TRANSITION (11-16s) ───
  if (t >= 11 && t < 16) {
    const transProgress = smoothstep(11, 16, t);

    // Noise fades
    const noiseFade = 0.3 * (1 - transProgress);
    n.noiseFilter!.frequency.value = 2000 - transProgress * 1500;
    setParam(n.noiseGain!.gain, noiseFade, 0.1);

    // Choir lingers then fades
    const choirFade = 0.08 * (1 - transProgress * 0.8);
    setParam(n.choirGain!.gain, choirFade, 0.2);

    // Drone settles
    setParam(n.cosmicDroneGain!.gain, 0.06 * (1 - transProgress * 0.5), 0.3);
  }

  // ─── REMNANT PHASE (16+) ───
  if (t >= 16) {
    const remnantAge = t - 16;
    const ageFade = 1 / (1 + remnantAge * 0.03);

    // Fade out transitional sounds
    setParam(n.noiseGain!.gain, 0, 0.5);
    setParam(n.choirGain!.gain, 0.02 * ageFade, 0.3);
    setParam(n.cosmicDroneGain!.gain, 0.04 * ageFade, 0.5);
    setParam(n.stellarHeartGain!.gain, 0, 0.5);

    // ─── NEUTRON STAR (fate < 0.5) ───
    if (fate < 0.5) {
      const nsForm = smoothstep(16, 20, t);

      // Pulsar spins up
      const spinRate = 2 + nsForm * 6; // 2-8 Hz rotation
      const pulsarEnv = 0.5 + 0.5 * Math.sin(t * spinRate * Math.PI * 2);
      const pulsarLevel = 0.12 * nsForm * ageFade * pulsarEnv;
      setParam(n.pulsarGain!.gain, pulsarLevel, 0.05);

      // Subtle frequency modulation
      const pulsarMod = Math.sin(t * 0.3);
      n.pulsarOsc!.frequency.value = FREQ.neutronBase * (1 + pulsarMod * 0.02);
    }

    // ─── BLACK HOLE (fate >= 0.5) ───
    if (fate >= 0.5) {
      const bhForm = smoothstep(16, 24, t);
      const bhFull = smoothstep(20, 28, t);

      // BH drone rises
      const bhLevel = 0.15 * bhForm * ageFade;
      setParam(n.bhDroneGain!.gain, bhLevel, 0.3);
      n.bhFilter!.frequency.value = 50 + bhFull * 60;

      // Accretion disk rumble
      const accLevel = 0.08 * bhFull * ageFade;
      setParam(n.accretionGain!.gain, accLevel, 0.2);

      // Gravitational wave chirp (T=12-18)
      if (t >= 12 && t < 22) {
        const gwStart = 12;
        const gwEnd = 18;
        const gwProgress = (t - gwStart) / (gwEnd - gwStart);

        if (gwProgress < 1) {
          // Chirp: frequency rises following inspiral pattern
          const chirpFreq = 25 + gwProgress * gwProgress * 150;
          n.chirpOsc!.frequency.value = Math.min(180, chirpFreq);

          const chirpAmp = 0.08 * Math.sin(gwProgress * Math.PI);
          setParam(n.chirpGain!.gain, chirpAmp * bhForm, 0.02);

          // GW background
          const gwAmp = 0.04 * (0.5 + gwProgress * 0.5) * bhForm;
          setParam(n.gwGain!.gain, gwAmp, 0.1);
        } else {
          // Ringdown
          const ringdown = t - gwEnd;
          const ringdownFreq = 180 * Math.exp(-ringdown * 0.25);
          n.chirpOsc!.frequency.value = Math.max(25, ringdownFreq);

          const ringdownAmp = 0.06 * Math.exp(-ringdown * 0.3);
          setParam(n.chirpGain!.gain, ringdownAmp, 0.1);
          setParam(n.gwGain!.gain, 0.02 * Math.exp(-ringdown * 0.2), 0.1);
        }
      } else if (t >= 22) {
        // GW fades to background
        setParam(n.chirpGain!.gain, 0, 0.5);
        setParam(n.gwGain!.gain, 0.01 * ageFade, 0.3);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// START/STOP COSMIC AUDIO
// ═══════════════════════════════════════════════════════════════

export function startCosmicAudio(fate: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (!isCosmicAudioInitialized) {
    initCosmicAudio();
  }

  // Create fresh noise buffer for each run
  if (cosmicNodes.noiseBuffer) {
    try { cosmicNodes.noiseBuffer.stop(); } catch {}
  }

  cosmicNodes.noiseBuffer = ctx.createBufferSource();
  cosmicNodes.noiseBuffer.buffer = createNoise(ctx, 30);
  cosmicNodes.noiseBuffer.loop = true;
  cosmicNodes.noiseBuffer.connect(cosmicNodes.noiseFilter!);
  cosmicNodes.noiseBuffer.start();

  // Start animation loop
  let startTime = ctx.currentTime;
  const animate = () => {
    const t = ctx.currentTime - startTime;
    updateCosmicAudio(t, fate);
    animationFrameId = requestAnimationFrame(animate);
  };
  animate();
}

export function stopCosmicAudio(): void {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Fade out all nodes
  const n = cosmicNodes;
  setParam(n.cosmicDroneGain?.gain!, 0, 0.5);
  setParam(n.stellarHeartGain?.gain!, 0, 0.5);
  setParam(n.noiseGain?.gain!, 0, 0.3);
  setParam(n.choirGain?.gain!, 0, 0.5);
  setParam(n.pulsarGain?.gain!, 0, 0.5);
  setParam(n.bhDroneGain?.gain!, 0, 0.5);
  setParam(n.accretionGain?.gain!, 0, 0.3);
  setParam(n.gwGain?.gain!, 0, 0.3);
  setParam(n.chirpGain?.gain!, 0, 0.2);

  // Stop noise buffer
  if (cosmicNodes.noiseBuffer) {
    setTimeout(() => {
      try { cosmicNodes.noiseBuffer?.stop(); } catch {}
    }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════
// ONE-SHOT EFFECTS
// ═══════════════════════════════════════════════════════════════

/**
 * Play a touch ripple sound when user taps the supernova canvas
 */
export function playCosmicRipple(x: number, t: number): void {
  const ctx = getAudioContext();
  const master = getMasterGain();
  if (!ctx || !master || !getIsAudioPlaying()) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const panner = ctx.createStereoPanner();

  // Pitch varies by time (higher during flash)
  const flashBoost = t >= 9.5 && t <= 11 ? 1.5 : 1;
  const baseFreq = (400 + Math.random() * 200) * flashBoost;

  osc.type = 'sine';
  osc.frequency.value = baseFreq;

  filter.type = 'bandpass';
  filter.frequency.value = baseFreq * 1.5;
  filter.Q.value = 8;

  gain.gain.value = 0;
  panner.pan.value = (x - 0.5) * 1.6;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  panner.connect(master);

  const now = ctx.currentTime;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + 0.6);

  osc.start(now);
  osc.stop(now + 0.8);
}
