// Whispered Fragments - atmospheric audio triggered by sustained observation
// These are not literal words but evocations of whispered secrets

import {
    getAudioContext,
    getMasterGain,
    getIsAudioPlaying
} from './context';

import fragmentsData from '../data/fragments.json';

type EyePersonality = 'curious' | 'hostile' | 'indifferent' | 'ancient';

interface Fragment {
    text: string;
    theme: string;
    weight: number;
}

// Track which eyes have already whispered this session
const whisperedEyes = new Set<number>();

// Convolver for reverb effect
let convolverNode: ConvolverNode | null = null;
let reverbBuffer: AudioBuffer | null = null;

/**
 * Create an impulse response for reverb
 * This simulates a large, dark space
 */
function createReverbImpulse(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 3; // 3 second reverb tail
    const buffer = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            // Exponential decay with some randomness
            const decay = Math.exp(-3 * i / length);
            // Add slight variation between channels for width
            const variation = channel === 0 ? 1 : 0.97;
            data[i] = (Math.random() * 2 - 1) * decay * variation;
        }
    }

    return buffer;
}

/**
 * Get or create the reverb convolver
 */
function getReverb(ctx: AudioContext): ConvolverNode {
    if (!convolverNode) {
        convolverNode = ctx.createConvolver();
        reverbBuffer = createReverbImpulse(ctx);
        convolverNode.buffer = reverbBuffer;
    }
    return convolverNode;
}

/**
 * Select a fragment based on eye personality
 */
function selectFragment(personality: EyePersonality): Fragment {
    const fragments = fragmentsData.fragments as Fragment[];
    const affinities = fragmentsData.personalityAffinities as Record<EyePersonality, string[]>;

    // Get themes this personality favors
    const preferredThemes = affinities[personality] || [];

    // Weight fragments by affinity
    const weightedFragments = fragments.map(f => ({
        fragment: f,
        weight: preferredThemes.includes(f.theme) ? f.weight * 2 : f.weight
    }));

    const totalWeight = weightedFragments.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (const { fragment, weight } of weightedFragments) {
        random -= weight;
        if (random <= 0) return fragment;
    }

    return fragments[0];
}

/**
 * Create a whisper-like sound
 * Not actual speech, but an atmospheric evocation of whispered words
 */
function createWhisperSound(
    ctx: AudioContext,
    masterGain: GainNode,
    personality: EyePersonality,
    duration: number = 4
): void {
    const now = ctx.currentTime;
    const reverb = getReverb(ctx);

    // Dry/wet mix for reverb
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    dryGain.gain.value = 0.3;
    wetGain.gain.value = 0.7;

    // === Layer 1: Sibilant noise (the "breath" of whisper) ===
    const noiseLength = ctx.sampleRate * duration;
    const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);

    // Create noise with speech-like amplitude modulation
    for (let i = 0; i < noiseLength; i++) {
        const t = i / ctx.sampleRate;
        // Modulate amplitude to suggest syllables
        const syllableRate = 3 + Math.random() * 2; // 3-5 syllables per second
        const syllableEnv = 0.5 + 0.5 * Math.sin(t * syllableRate * Math.PI * 2);
        // Add micro-variations
        const microVar = 0.8 + 0.2 * Math.sin(t * 47);
        noiseData[i] = (Math.random() * 2 - 1) * syllableEnv * microVar;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // Bandpass filter for sibilance
    const sibilantFilter = ctx.createBiquadFilter();
    sibilantFilter.type = 'bandpass';
    sibilantFilter.frequency.value = 4000; // High frequencies for "s" sounds
    sibilantFilter.Q.value = 2;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.04, now + 0.5);
    noiseGain.gain.setValueAtTime(0.04, now + duration - 1);
    noiseGain.gain.linearRampToValueAtTime(0, now + duration);

    // === Layer 2: Tonal undertone (suggests voice formants) ===
    const formantFreqs = personality === 'ancient'
        ? [180, 800, 2400]  // Deeper, older voice
        : personality === 'hostile'
            ? [220, 1200, 2800]  // Sharper, more aggressive
            : personality === 'curious'
                ? [200, 1000, 2600]  // Brighter
                : [190, 900, 2500];  // Neutral (indifferent)

    const formantGains: GainNode[] = [];
    const formantOscs: OscillatorNode[] = [];

    formantFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.value = freq;
        // Subtle frequency wandering
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq * 0.95, now + duration * 0.3);
        osc.frequency.linearRampToValueAtTime(freq * 1.02, now + duration * 0.7);
        osc.frequency.linearRampToValueAtTime(freq * 0.98, now + duration);

        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = 10;

        // Lower formants are louder
        const baseVol = 0.015 / (i + 1);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(baseVol, now + 0.8);
        gain.gain.setValueAtTime(baseVol, now + duration - 1.2);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        osc.connect(filter);
        filter.connect(gain);

        formantOscs.push(osc);
        formantGains.push(gain);
    });

    // === Layer 3: Spectral shimmer (otherworldly quality) ===
    const shimmerOsc = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    const shimmerFilter = ctx.createBiquadFilter();

    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.value = personality === 'ancient' ? 60 : 80;

    shimmerFilter.type = 'lowpass';
    shimmerFilter.frequency.value = 200;

    shimmerGain.gain.setValueAtTime(0, now);
    shimmerGain.gain.linearRampToValueAtTime(0.02, now + 1);
    shimmerGain.gain.setValueAtTime(0.02, now + duration - 1.5);
    shimmerGain.gain.linearRampToValueAtTime(0, now + duration);

    shimmerOsc.connect(shimmerFilter);
    shimmerFilter.connect(shimmerGain);

    // === Spatial positioning ===
    const panner = ctx.createStereoPanner();
    // Whispers come from slightly off-center, random direction
    panner.pan.value = (Math.random() - 0.5) * 0.6;

    // === Final lowpass to soften everything ===
    const finalFilter = ctx.createBiquadFilter();
    finalFilter.type = 'lowpass';
    finalFilter.frequency.value = 3000;

    // === Connect the graph ===
    const mixBus = ctx.createGain();
    mixBus.gain.value = 1;

    noiseSource.connect(sibilantFilter);
    sibilantFilter.connect(noiseGain);
    noiseGain.connect(mixBus);

    formantGains.forEach(gain => gain.connect(mixBus));
    shimmerGain.connect(mixBus);

    // Dry path
    mixBus.connect(finalFilter);
    finalFilter.connect(dryGain);
    dryGain.connect(panner);

    // Wet path (through reverb)
    mixBus.connect(reverb);
    reverb.connect(wetGain);
    wetGain.connect(panner);

    panner.connect(masterGain);

    // Start all sources
    noiseSource.start(now);
    noiseSource.stop(now + duration);
    formantOscs.forEach(osc => {
        osc.start(now);
        osc.stop(now + duration);
    });
    shimmerOsc.start(now);
    shimmerOsc.stop(now + duration);
}

/**
 * Trigger a whisper for an eye
 * Returns the fragment text (for potential visual display) or null if already whispered
 */
export function triggerWhisper(
    eyeIndex: number,
    personality: EyePersonality
): string | null {
    // Check if this eye has already whispered
    if (whisperedEyes.has(eyeIndex)) {
        return null;
    }

    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) {
        return null;
    }

    // Mark this eye as having whispered
    whisperedEyes.add(eyeIndex);

    // Select appropriate fragment
    const fragment = selectFragment(personality);

    // Create the whisper sound
    createWhisperSound(ctx, masterGain, personality, 4 + Math.random() * 2);

    return fragment.text;
}

/**
 * Check if an eye has already whispered this session
 */
export function hasWhispered(eyeIndex: number): boolean {
    return whisperedEyes.has(eyeIndex);
}

/**
 * Reset whisper state (for testing or new sessions)
 */
export function resetWhispers(): void {
    whisperedEyes.clear();
}

/**
 * Get count of eyes that have whispered
 */
export function getWhisperCount(): number {
    return whisperedEyes.size;
}
