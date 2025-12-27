// Hero forest visualization module with tracking eyes

import { eyeTrackingAudio } from '../audio/effects';
import { triggerWhisper } from '../audio/whispers';
import { getAudioContext, getMasterGain, getIsAudioPlaying } from '../audio/context';

/**
 * Play a subtle sound when paired eyes are interrupted
 * A soft "noticed" sound - like a breath being held
 */
function playInterruptionSound(): void {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) return;

    const now = ctx.currentTime;

    // Two slightly detuned tones for an unsettling effect
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(280, now);
    osc1.frequency.exponentialRampToValueAtTime(200, now + 0.3);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(284, now); // Slightly detuned
    osc2.frequency.exponentialRampToValueAtTime(203, now + 0.3);

    filter.type = 'lowpass';
    filter.frequency.value = 600;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
}

// Eye personality types - each creates a distinct feeling
type EyePersonality = 'curious' | 'hostile' | 'indifferent' | 'ancient';

interface PersonalityProfile {
    trackingSpeed: number;      // Multiplier for tracking responsiveness (0.2 - 2.0)
    trackingRange: number;      // Max distance to track (pixels)
    maxOffset: number;          // How far the eye can move
    blinkFrequency: number;     // 0 = never, 1 = normal, 2 = frequent
    lookAwayChance: number;     // Chance to look away instead of tracking (0-1)
    size: number;               // Size multiplier
    colors: string[];           // Possible colors for this personality
    audioTone: 'high' | 'mid' | 'low' | 'deep';  // Audio character
}

const personalityProfiles: Record<EyePersonality, PersonalityProfile> = {
    curious: {
        trackingSpeed: 1.5,
        trackingRange: 500,
        maxOffset: 12,
        blinkFrequency: 0.3,
        lookAwayChance: 0,
        size: 1.15,
        colors: ['#e8d855', '#d4e855', '#c9e8a0'],  // Bright, eager yellows/greens
        audioTone: 'high'
    },
    hostile: {
        trackingSpeed: 2.0,
        trackingRange: 600,
        maxOffset: 14,
        blinkFrequency: 0,      // Never blinks
        lookAwayChance: 0,
        size: 1.1,
        colors: ['#ff4444', '#e83333', '#cc2222'],  // Aggressive reds
        audioTone: 'mid'
    },
    indifferent: {
        trackingSpeed: 0.4,
        trackingRange: 250,
        maxOffset: 6,
        blinkFrequency: 2.5,    // Blinks often
        lookAwayChance: 0.3,    // Sometimes looks away
        size: 0.95,
        colors: ['#8888aa', '#9999bb', '#7777aa'],  // Pale, disinterested blues
        audioTone: 'low'
    },
    ancient: {
        trackingSpeed: 0.2,
        trackingRange: 800,     // Sees far but moves slow
        maxOffset: 4,
        blinkFrequency: 0.5,
        lookAwayChance: 0.1,
        size: 1.25,
        colors: ['#e8a555', '#d4964a', '#cc8833', '#aa7722'],  // Deep amber/gold
        audioTone: 'deep'
    }
};

// Weighted distribution for personality assignment
const personalityWeights: { type: EyePersonality; weight: number }[] = [
    { type: 'curious', weight: 25 },
    { type: 'hostile', weight: 20 },
    { type: 'indifferent', weight: 35 },
    { type: 'ancient', weight: 20 }
];

function selectPersonality(): EyePersonality {
    const total = personalityWeights.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * total;

    for (const p of personalityWeights) {
        random -= p.weight;
        if (random <= 0) return p.type;
    }
    return 'indifferent';
}

interface ForestEye {
    el: HTMLElement;
    x: number;
    y: number;
    personality: EyePersonality;
    profile: PersonalityProfile;
    lookAwayAngle: number;      // Current "looking away" angle
    isLookingAway: boolean;
    observationStart: number | null;  // Timestamp when sustained observation began
    whisperTriggered: boolean;        // Has this eye whispered this session?
    // Paired eye properties
    pairedWith: number | null;        // Index of paired eye, null if unpaired
    isInterrupted: boolean;           // Currently tracking reader instead of partner
    interruptedUntil: number;         // Timestamp when interruption ends
}

// Track paired eye connections
interface EyePair {
    eye1Index: number;
    eye2Index: number;
    connectionEl: HTMLElement | null;  // Visual connection line
}

export let forestEyes: ForestEye[] = [];
export let eyePairs: EyePair[] = [];
export let forestMouseX = 0;
export let forestMouseY = 0;

export function addForestEye(container: HTMLElement, _index: number): number {
    const eye = document.createElement('span');
    eye.className = 'forest-eye';
    eye.textContent = '◉';

    // Assign personality
    const personality = selectPersonality();
    const profile = personalityProfiles[personality];

    // Responsive positioning - use percentage-based margins
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight || 180;
    const margin = Math.min(40, containerWidth * 0.1); // 10% margin, max 40px

    // Spread eyes across the container
    const x = margin + Math.random() * (containerWidth - margin * 2);
    const y = Math.min(40, containerHeight * 0.15) + Math.random() * (containerHeight * 0.7);
    eye.style.left = x + 'px';
    eye.style.top = y + 'px';

    // Color based on personality
    const color = profile.colors[Math.floor(Math.random() * profile.colors.length)];
    eye.style.color = color;

    // Size based on personality
    eye.style.fontSize = `${20 * profile.size}px`;

    // Add personality class for CSS styling
    eye.classList.add(`eye-${personality}`);
    eye.dataset.personality = personality;

    container.appendChild(eye);

    const forestEye: ForestEye = {
        el: eye,
        x,
        y,
        personality,
        profile,
        lookAwayAngle: Math.random() * Math.PI * 2,
        isLookingAway: false,
        observationStart: null,
        whisperTriggered: false,
        pairedWith: null,
        isInterrupted: false,
        interruptedUntil: 0
    };

    forestEyes.push(forestEye);

    // Fade in
    requestAnimationFrame(() => {
        eye.classList.add('visible');
    });

    return forestEyes.length - 1; // Return index of added eye
}

/**
 * Spawn a pair of eyes that observe each other
 * They face each other until the reader's cursor passes between them
 */
function addPairedEyes(container: HTMLElement): void {
    // Responsive positioning for paired eyes
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight || 180;
    const isMobile = containerWidth < 480;

    // Scale pair width based on container
    const minPairWidth = isMobile ? 80 : 120;
    const maxPairWidth = Math.min(isMobile ? 140 : 220, containerWidth * 0.5);
    const pairWidth = minPairWidth + Math.random() * (maxPairWidth - minPairWidth);

    // Calculate safe positioning area
    const margin = Math.min(40, containerWidth * 0.1);
    const availableWidth = containerWidth - margin * 2 - pairWidth;
    const centerX = margin + Math.random() * Math.max(0, availableWidth);
    const y = containerHeight * 0.2 + Math.random() * (containerHeight * 0.5);

    // Both eyes share similar personality (they're connected)
    const sharedPersonality = Math.random() > 0.7 ? 'ancient' : 'indifferent';
    const profile = personalityProfiles[sharedPersonality];
    const color = profile.colors[Math.floor(Math.random() * profile.colors.length)];

    // Create first eye
    const eye1 = document.createElement('span');
    eye1.className = 'forest-eye eye-paired';
    eye1.textContent = '◉';
    eye1.style.left = centerX + 'px';
    eye1.style.top = y + 'px';
    eye1.style.color = color;
    eye1.style.fontSize = `${20 * profile.size}px`;
    eye1.classList.add(`eye-${sharedPersonality}`);
    eye1.dataset.personality = sharedPersonality;
    container.appendChild(eye1);

    // Create second eye
    const eye2 = document.createElement('span');
    eye2.className = 'forest-eye eye-paired';
    eye2.textContent = '◉';
    eye2.style.left = (centerX + pairWidth) + 'px';
    const verticalOffset = (Math.random() - 0.5) * Math.min(40, containerHeight * 0.2);
    eye2.style.top = (y + verticalOffset) + 'px'; // Slight vertical offset
    eye2.style.color = color;
    eye2.style.fontSize = `${20 * profile.size}px`;
    eye2.classList.add(`eye-${sharedPersonality}`);
    eye2.dataset.personality = sharedPersonality;
    container.appendChild(eye2);

    const eye1Index = forestEyes.length;
    const eye2Index = forestEyes.length + 1;

    // Create eye objects
    const forestEye1: ForestEye = {
        el: eye1,
        x: centerX,
        y: y,
        personality: sharedPersonality,
        profile,
        lookAwayAngle: 0,
        isLookingAway: false,
        observationStart: null,
        whisperTriggered: false,
        pairedWith: eye2Index,
        isInterrupted: false,
        interruptedUntil: 0
    };

    const forestEye2: ForestEye = {
        el: eye2,
        x: centerX + pairWidth,
        y: y + verticalOffset,
        personality: sharedPersonality,
        profile,
        lookAwayAngle: 0,
        isLookingAway: false,
        observationStart: null,
        whisperTriggered: false,
        pairedWith: eye1Index,
        isInterrupted: false,
        interruptedUntil: 0
    };

    forestEyes.push(forestEye1, forestEye2);

    // Create subtle connection line between paired eyes
    const connectionLine = document.createElement('div');
    connectionLine.className = 'eye-connection';
    const dx = forestEye2.x - forestEye1.x;
    const dy = forestEye2.y - forestEye1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    connectionLine.style.cssText = `
        position: absolute;
        left: ${forestEye1.x + 10}px;
        top: ${forestEye1.y + 10}px;
        width: ${distance}px;
        height: 1px;
        background: linear-gradient(90deg,
            transparent 0%,
            rgba(${sharedPersonality === 'ancient' ? '200, 150, 80' : '150, 150, 180'}, 0.15) 20%,
            rgba(${sharedPersonality === 'ancient' ? '200, 150, 80' : '150, 150, 180'}, 0.25) 50%,
            rgba(${sharedPersonality === 'ancient' ? '200, 150, 80' : '150, 150, 180'}, 0.15) 80%,
            transparent 100%
        );
        transform-origin: left center;
        transform: rotate(${angle}deg);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.5s ease;
    `;
    container.appendChild(connectionLine);

    eyePairs.push({
        eye1Index,
        eye2Index,
        connectionEl: connectionLine
    });

    // Fade in with delay
    requestAnimationFrame(() => {
        eye1.classList.add('visible');
        setTimeout(() => {
            eye2.classList.add('visible');
            connectionLine.style.opacity = '1';
        }, 200);
    });
}

/**
 * Check if cursor is between a pair of eyes (interrupting their gaze)
 */
function isPointBetweenEyes(px: number, py: number, eye1: ForestEye, eye2: ForestEye): boolean {
    const e1x = eye1.x + 10;
    const e1y = eye1.y + 10;
    const e2x = eye2.x + 10;
    const e2y = eye2.y + 10;

    // Check if point is roughly on the line between eyes
    const lineLength = Math.sqrt((e2x - e1x) ** 2 + (e2y - e1y) ** 2);
    const d1 = Math.sqrt((px - e1x) ** 2 + (py - e1y) ** 2);
    const d2 = Math.sqrt((px - e2x) ** 2 + (py - e2y) ** 2);

    // Point is "between" if sum of distances to each eye is close to the line length
    // with some tolerance for the "corridor" width
    const tolerance = 40; // pixels of corridor width
    const onLine = Math.abs((d1 + d2) - lineLength) < tolerance;

    // Also check that the point isn't too far from the line perpendicularly
    // Using cross product to find perpendicular distance
    const crossProduct = Math.abs((py - e1y) * (e2x - e1x) - (px - e1x) * (e2y - e1y));
    const perpDist = crossProduct / lineLength;

    return onLine && perpDist < 50 && d1 > 30 && d2 > 30; // Not too close to either eye
}

export function initHeroForest(): void {
    const container = document.getElementById('hero-forest');
    if (!container) return;

    const treesEl = document.getElementById('forest-trees');
    const fog1 = document.getElementById('fog-1');
    const fog2 = document.getElementById('fog-2');

    // Reduce counts on mobile for performance
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    const fogChars = '░'.repeat(isMobile ? 80 : 150);
    if (fog1) fog1.textContent = fogChars;
    if (fog2) fog2.textContent = fogChars;

    let trees = '';
    const treeWidth = isMobile ? 60 : 120;
    for (let row = 0; row < 10; row++) {
        let line = '';
        const density = 0.08 + (row / 10) * 0.12;
        for (let col = 0; col < treeWidth; col++) {
            const r = Math.random();
            if (r < density * 0.3) line += '│';
            else if (r < density * 0.35) line += '┃';
            else if (r < density * 0.4) line += '╎';
            else line += ' ';
        }
        trees += line + '\n';
    }
    trees += '─'.repeat(treeWidth);
    if (treesEl) treesEl.textContent = trees;

    // Add eyes with staggered reveal - fewer on mobile
    const eyeCount = isMobile ? 4 : 8;  // Reduced to make room for paired eyes
    for (let i = 0; i < eyeCount; i++) {
        setTimeout(() => {
            addForestEye(container, i);
        }, 1500 + i * 300); // Staggered appearance
    }

    // Add paired eyes (1 pair on mobile, 2 on desktop)
    const pairCount = isMobile ? 1 : 2;
    for (let i = 0; i < pairCount; i++) {
        setTimeout(() => {
            addPairedEyes(container);
        }, 3000 + i * 1500); // Appear after solo eyes
    }

    // Performance: throttle pointer tracking on mobile
    let lastPointerUpdate = 0;
    const POINTER_THROTTLE = isMobile ? 33 : 16; // 30fps on mobile, 60fps on desktop
    let isTouchActive = false;
    let touchStartTime = 0;

    // Unified pointer tracking for mouse and touch
    function handlePointerMove(clientX: number, clientY: number, isImmediateTouch = false): void {
        if (!container) return;

        const now = performance.now();
        // Skip throttle for immediate touch events (first touch or touch start)
        if (!isImmediateTouch && now - lastPointerUpdate < POINTER_THROTTLE) return;
        lastPointerUpdate = now;

        const rect = container.getBoundingClientRect();
        forestMouseX = clientX - rect.left;
        forestMouseY = clientY - rect.top;

        // First, check for interruptions of paired eyes
        eyePairs.forEach(pair => {
            const eye1 = forestEyes[pair.eye1Index];
            const eye2 = forestEyes[pair.eye2Index];
            if (!eye1 || !eye2) return;

            const isBetween = isPointBetweenEyes(forestMouseX, forestMouseY, eye1, eye2);

            if (isBetween) {
                // Interrupt the pair - they both snap to look at the intruder
                const now = Date.now();
                if (!eye1.isInterrupted) {
                    eye1.isInterrupted = true;
                    eye2.isInterrupted = true;
                    eye1.interruptedUntil = now + 2000; // Look at intruder for 2 seconds
                    eye2.interruptedUntil = now + 2000;

                    // Visual feedback
                    eye1.el.classList.add('interrupted');
                    eye2.el.classList.add('interrupted');
                    if (pair.connectionEl) {
                        pair.connectionEl.classList.add('broken');
                    }

                    // Audio feedback - a subtle "noticed" sound
                    playInterruptionSound();
                }
                // Extend interruption while cursor is between
                eye1.interruptedUntil = Date.now() + 1000;
                eye2.interruptedUntil = Date.now() + 1000;
            }
        });

        forestEyes.forEach((eye, eyeIndex) => {
            const profile = eye.profile;
            const ex = eye.x + 10;
            const ey = eye.y + 10;
            const rawDist = Math.sqrt((forestMouseX - ex) ** 2 + (forestMouseY - ey) ** 2);
            // On touch, reduce effective distance to account for finger size (more generous hit area)
            const dist = isTouchActive ? rawDist * 0.7 : rawDist;

            let angle: number;
            let effectiveOffset: number;

            // Check if this is a paired eye
            if (eye.pairedWith !== null) {
                const partner = forestEyes[eye.pairedWith];

                // Check if interruption has expired
                if (eye.isInterrupted && Date.now() > eye.interruptedUntil) {
                    eye.isInterrupted = false;
                    eye.el.classList.remove('interrupted');

                    // Check if partner is also done being interrupted
                    if (partner && !partner.isInterrupted) {
                        const pair = eyePairs.find(p =>
                            (p.eye1Index === eyeIndex && p.eye2Index === eye.pairedWith) ||
                            (p.eye2Index === eyeIndex && p.eye1Index === eye.pairedWith)
                        );
                        if (pair?.connectionEl) {
                            pair.connectionEl.classList.remove('broken');
                        }
                    }
                }

                if (eye.isInterrupted) {
                    // Track the intruder (cursor)
                    angle = Math.atan2(forestMouseY - ey, forestMouseX - ex);
                    effectiveOffset = profile.maxOffset * 0.8;
                } else if (partner) {
                    // Look at partner
                    const px = partner.x + 10;
                    const py = partner.y + 10;
                    angle = Math.atan2(py - ey, px - ex);
                    effectiveOffset = profile.maxOffset * 0.6;
                } else {
                    angle = 0;
                    effectiveOffset = 0;
                }
            } else {
                // Regular (unpaired) eye behavior
                // Check if eye should look away (indifferent personality)
                if (profile.lookAwayChance > 0 && Math.random() < profile.lookAwayChance * 0.02) {
                    eye.isLookingAway = !eye.isLookingAway;
                    if (eye.isLookingAway) {
                        eye.lookAwayAngle = Math.random() * Math.PI * 2;
                    }
                }

                if (eye.isLookingAway) {
                    // Look in a random direction
                    angle = eye.lookAwayAngle;
                    effectiveOffset = profile.maxOffset * 0.5;
                } else {
                    // Track the pointer with personality-specific behavior
                    angle = Math.atan2(forestMouseY - ey, forestMouseX - ex);

                    // Intensity based on distance and tracking range
                    const intensity = Math.min(1, profile.trackingRange / Math.max(dist, 1));
                    effectiveOffset = profile.maxOffset * intensity * profile.trackingSpeed;

                    // Clamp to max offset
                    effectiveOffset = Math.min(effectiveOffset, profile.maxOffset);
                }
            }

            const ox = Math.cos(angle) * effectiveOffset;
            const oy = Math.sin(angle) * effectiveOffset;

            // Apply smooth transition based on personality and state
            // Faster transitions during active touch for more responsive feel
            const touchSpeedMultiplier = isTouchActive ? 0.5 : 1;

            if (eye.isInterrupted) {
                eye.el.style.transition = `transform ${0.1 * touchSpeedMultiplier}s ease-out`; // Quick snap when interrupted
            } else if (eye.pairedWith !== null) {
                eye.el.style.transition = `transform ${0.5 * touchSpeedMultiplier}s ease-in-out`; // Slow, contemplative
            } else if (eye.personality === 'ancient') {
                eye.el.style.transition = `transform ${0.8 * touchSpeedMultiplier}s ease-out`;
            } else if (eye.personality === 'hostile') {
                eye.el.style.transition = `transform ${0.05}s linear`; // Already fast, keep it
            } else if (eye.personality === 'indifferent') {
                eye.el.style.transition = `transform ${0.4 * touchSpeedMultiplier}s ease-in-out`;
            } else {
                eye.el.style.transition = `transform ${0.15 * touchSpeedMultiplier}s ease-out`;
            }

            eye.el.style.transform = `translate(${ox}px, ${oy}px)`;

            const wasTracking = eye.el.classList.contains('tracking');
            const isTracking = dist < profile.trackingRange && !eye.isLookingAway;
            eye.el.classList.toggle('tracking', isTracking);

            // Trigger audio when tracking state changes
            if (isTracking !== wasTracking) {
                eyeTrackingAudio(eyeIndex, isTracking, eye.personality);
            }

            // === Sustained observation tracking for whispers ===
            const isCloseObservation = dist < 150 && isTracking;

            if (isCloseObservation && !eye.whisperTriggered) {
                // Start or continue observation timer
                if (eye.observationStart === null) {
                    eye.observationStart = Date.now();
                    eye.el.classList.add('being-observed');
                } else {
                    // Check if observation threshold reached (3-5 seconds based on personality)
                    const thresholdMs = eye.personality === 'ancient' ? 5000
                        : eye.personality === 'curious' ? 3000
                        : eye.personality === 'hostile' ? 4000
                        : 3500; // indifferent

                    const observationDuration = Date.now() - eye.observationStart;

                    if (observationDuration >= thresholdMs) {
                        // Trigger whisper
                        const fragmentText = triggerWhisper(eyeIndex, eye.personality);
                        if (fragmentText) {
                            eye.whisperTriggered = true;
                            eye.el.classList.remove('being-observed');
                            eye.el.classList.add('has-whispered');

                            // Show subtle visual indication of the whisper
                            showWhisperFragment(eye.el, fragmentText);
                        }
                    }
                }
            } else {
                // Reset observation timer when not in close observation
                if (eye.observationStart !== null) {
                    eye.observationStart = null;
                    eye.el.classList.remove('being-observed');
                }
            }
        });
    }

    // Function to show whisper fragment as subtle visual
    function showWhisperFragment(eyeEl: HTMLElement, text: string): void {
        const fragment = document.createElement('div');
        fragment.className = 'whisper-fragment';
        fragment.textContent = text;
        fragment.style.cssText = `
            position: absolute;
            left: 50%;
            top: -40px;
            transform: translateX(-50%);
            font-family: 'Cormorant Garamond', serif;
            font-size: 12px;
            font-style: italic;
            color: rgba(180, 200, 220, 0);
            white-space: nowrap;
            pointer-events: none;
            text-shadow: 0 0 10px rgba(180, 200, 220, 0.5);
            transition: all 4s ease-out;
        `;

        eyeEl.style.position = 'absolute'; // Ensure positioning context
        eyeEl.appendChild(fragment);

        // Animate in
        requestAnimationFrame(() => {
            fragment.style.color = 'rgba(180, 200, 220, 0.7)';
            fragment.style.top = '-60px';
        });

        // Fade out and remove
        setTimeout(() => {
            fragment.style.color = 'rgba(180, 200, 220, 0)';
            fragment.style.top = '-80px';
        }, 5000);

        setTimeout(() => {
            fragment.remove();
        }, 9000);
    }

    // Mouse tracking (desktop)
    document.addEventListener('mousemove', (e: MouseEvent) => {
        handlePointerMove(e.clientX, e.clientY);
    });

    // Mobile: Touch-based eye tracking + optional gyroscope
    if (isMobile) {
        let gyroEnabled = false;
        let lastGyroUpdate = 0;
        const GYRO_THROTTLE = 33; // ~30fps for smoother updates

        // Smoothed gyro position (for interpolation)
        let smoothGyroX = 0;
        let smoothGyroY = 0;
        let targetGyroX = 0;
        let targetGyroY = 0;
        const GYRO_SMOOTHING = 0.15; // Lower = smoother but slower response

        // Gyroscope handler with smoothing
        const handleOrientation = (event: DeviceOrientationEvent) => {
            // Don't update if touch is active (touch takes priority)
            if (isTouchActive || !container) return;
            if (event.beta === null && event.gamma === null) return;

            const now = performance.now();
            if (now - lastGyroUpdate < GYRO_THROTTLE) return;
            lastGyroUpdate = now;

            const beta = event.beta ?? 0;
            const gamma = event.gamma ?? 0;

            const rect = container.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            // Map tilt to position (gamma = left/right, beta = forward/back)
            // Reduced sensitivity for more natural feel
            const normalizedGamma = Math.max(-30, Math.min(30, gamma)) / 30;
            const normalizedBeta = Math.max(-15, Math.min(45, beta - 15)) / 30;

            // Calculate target position
            targetGyroX = centerX + (normalizedGamma * centerX * 1.2);
            targetGyroY = centerY + (normalizedBeta * centerY * 0.8);

            // Smooth interpolation (lerp) toward target
            smoothGyroX += (targetGyroX - smoothGyroX) * GYRO_SMOOTHING;
            smoothGyroY += (targetGyroY - smoothGyroY) * GYRO_SMOOTHING;

            handlePointerMove(rect.left + smoothGyroX, rect.top + smoothGyroY, false);
        };

        // Create tilt mode toggle button
        const tiltButton = document.createElement('button');
        tiltButton.className = 'tilt-mode-toggle';
        tiltButton.innerHTML = '📱 tilt mode';
        tiltButton.setAttribute('aria-label', 'Enable tilt tracking - eyes follow phone movement');
        container.appendChild(tiltButton);

        // Handle tilt button click - permission request MUST be in direct click handler
        tiltButton.addEventListener('click', function() {
            if (gyroEnabled) {
                // Disable gyro
                gyroEnabled = false;
                window.removeEventListener('deviceorientation', handleOrientation);
                container?.classList.remove('gyro-active');
                tiltButton.innerHTML = '📱 tilt mode';
                tiltButton.classList.remove('active');
                return;
            }

            // Check if DeviceOrientationEvent exists and needs permission (iOS 13+)
            const DOE = DeviceOrientationEvent as unknown as {
                requestPermission?: () => Promise<string>;
            };

            if (typeof DOE.requestPermission === 'function') {
                // iOS 13+ - must request permission
                DOE.requestPermission()
                    .then((response: string) => {
                        if (response === 'granted') {
                            gyroEnabled = true;
                            window.addEventListener('deviceorientation', handleOrientation, { passive: true });
                            container?.classList.add('gyro-active');
                            tiltButton.innerHTML = '📱 tilt mode ✓';
                            tiltButton.classList.add('active');
                        } else {
                            tiltButton.innerHTML = '📱 denied';
                            setTimeout(() => { tiltButton.innerHTML = '📱 tilt mode'; }, 2000);
                        }
                    })
                    .catch(() => {
                        tiltButton.innerHTML = '📱 error';
                        setTimeout(() => { tiltButton.innerHTML = '📱 tilt mode'; }, 2000);
                    });
            } else {
                // Non-iOS or older iOS - just enable (permission not needed)
                gyroEnabled = true;
                window.addEventListener('deviceorientation', handleOrientation, { passive: true });
                container?.classList.add('gyro-active');
                tiltButton.innerHTML = '📱 tilt mode ✓';
                tiltButton.classList.add('active');
            }
        });

        // Check if touch target is an interactive element we should ignore
        function shouldIgnoreTouch(target: EventTarget | null): boolean {
            if (!target || !(target instanceof Element)) return false;
            // Ignore buttons, links, and elements with specific classes
            const ignoredSelectors = 'button, a, .audio-toggle, .tilt-mode-toggle, .nav-hamburger, input, textarea';
            return target.closest(ignoredSelectors) !== null;
        }

        // Touch handling for mobile
        document.addEventListener('touchstart', (e: TouchEvent) => {
            // Don't track eyes when tapping UI elements
            if (shouldIgnoreTouch(e.target)) return;

            if (e.touches.length > 0) {
                isTouchActive = true;
                touchStartTime = performance.now();
                const touch = e.touches[0];

                // Immediate feedback - eyes snap to touch point
                handlePointerMove(touch.clientX, touch.clientY, true);

                // Mark as activated (hides hint)
                container?.classList.add('touch-active');
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e: TouchEvent) => {
            // Only track if we started tracking (isTouchActive)
            if (!isTouchActive) return;

            if (e.touches.length > 0) {
                const touch = e.touches[0];
                handlePointerMove(touch.clientX, touch.clientY, false);
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (!isTouchActive) return;

            isTouchActive = false;

            // Smooth settle after quick tap
            if (performance.now() - touchStartTime < 200) {
                forestEyes.forEach(eye => {
                    eye.el.style.transition = 'transform 0.3s ease-out';
                });
            }
        }, { passive: true });
    }

    // Personality-aware blinking - slower interval on mobile for performance
    const blinkInterval = isMobile ? 2000 : 1000;
    setInterval(() => {
        if (forestEyes.length > 0) {
            // On mobile, only check a subset of eyes per interval
            const eyesToCheck = isMobile
                ? [forestEyes[Math.floor(Math.random() * forestEyes.length)]]
                : forestEyes;

            eyesToCheck.forEach(eye => {
                if (!eye) return;
                // Check if this eye should blink based on personality
                const blinkChance = eye.profile.blinkFrequency * (isMobile ? 0.25 : 0.15);

                if (blinkChance > 0 && Math.random() < blinkChance) {
                    eye.el.classList.add('blinking');

                    // Longer blink for indifferent eyes
                    const blinkDuration = eye.personality === 'indifferent' ? 200 : 150;

                    setTimeout(() => {
                        eye.el.classList.remove('blinking');
                    }, blinkDuration);
                }
            });
        }
    }, blinkInterval);
}
