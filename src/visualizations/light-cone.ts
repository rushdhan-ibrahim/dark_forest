// Light Cone Visualization - Earth's radio sphere and incoming light
// Shows which stars have "heard" us and which could be observing us

import { getAudioContext, getMasterGain, getIsAudioPlaying } from '../audio/context';
import starData from '../data/nearby-stars.json';

interface Star {
    name: string;
    distance: number;
    type: string;
    note: string;
    el?: HTMLElement;
    angle?: number;
    reached?: boolean;
}

interface Broadcast {
    year: number;
    event: string;
    note: string;
}

type ViewMode = 'outgoing' | 'incoming';

let container: HTMLElement | null = null;
let starsContainer: HTMLElement | null = null;
let sphereEl: HTMLElement | null = null;
let yearSlider: HTMLInputElement | null = null;
let yearDisplay: HTMLElement | null = null;
let statsDisplay: HTMLElement | null = null;
let messageDisplay: HTMLElement | null = null;

let stars: Star[] = [];
let broadcasts: Broadcast[] = [];
let currentYear = 2025;
let currentMode: ViewMode = 'outgoing';
let animationFrame: number | null = null;
let isPlaying = false;

const START_YEAR = 1895;
const MAX_DISPLAY_DISTANCE = 150; // Light years to show in visualization
const CONTAINER_RADIUS = 180; // Pixels

/**
 * Play a ping sound when a star is reached
 */
function playStarReachedSound(distance: number): void {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Higher pitch for closer stars
    const freq = 800 - (distance / MAX_DISPLAY_DISTANCE) * 400;
    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.35);
}

/**
 * Play broadcast event sound
 */
function playBroadcastSound(): void {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) return;

    const now = ctx.currentTime;

    // Static/transmission sound
    const noise = ctx.createBufferSource();
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    noise.start(now);
    noise.stop(now + 0.25);
}

/**
 * Calculate light years traveled since a given year
 */
function getLightYearsTraveled(year: number): number {
    return Math.max(0, year - START_YEAR);
}

/**
 * Get stars within the current radio sphere
 */
function getStarsInSphere(year: number): Star[] {
    const distance = getLightYearsTraveled(year);
    return stars.filter(s => s.distance <= distance);
}

/**
 * Get broadcast events up to the current year
 */
function getBroadcastsToYear(year: number): Broadcast[] {
    return broadcasts.filter(b => b.year <= year);
}

/**
 * Position a star element in the visualization
 */
function positionStar(star: Star): void {
    if (!star.el) return;

    const scaledDistance = (star.distance / MAX_DISPLAY_DISTANCE) * CONTAINER_RADIUS;
    const angle = star.angle || 0;

    const x = Math.cos(angle) * scaledDistance;
    const y = Math.sin(angle) * scaledDistance;

    star.el.style.left = `calc(50% + ${x}px)`;
    star.el.style.top = `calc(50% + ${y}px)`;
}

/**
 * Update the visualization for a given year
 */
function updateVisualization(year: number): void {
    currentYear = year;

    if (yearDisplay) {
        yearDisplay.textContent = String(year);
    }

    const lightYears = getLightYearsTraveled(year);
    const starsReached = getStarsInSphere(year);
    const recentBroadcasts = getBroadcastsToYear(year);

    // Update sphere size
    if (sphereEl) {
        const sphereRadius = (lightYears / MAX_DISPLAY_DISTANCE) * CONTAINER_RADIUS * 2;
        sphereEl.style.width = `${sphereRadius}px`;
        sphereEl.style.height = `${sphereRadius}px`;
    }

    // Update stars
    stars.forEach(star => {
        if (!star.el) return;

        const isInSphere = star.distance <= lightYears;
        const wasReached = star.reached;

        if (currentMode === 'outgoing') {
            star.el.classList.toggle('reached', isInSphere);
            star.el.classList.toggle('unreached', !isInSphere);

            if (isInSphere && !wasReached) {
                star.reached = true;
                playStarReachedSound(star.distance);
            } else if (!isInSphere) {
                star.reached = false;
            }
        } else {
            // Incoming mode: show which stars could have detected us
            // They need to be close enough AND enough time for round trip
            const canDetect = star.distance <= lightYears / 2;
            star.el.classList.toggle('reached', canDetect);
            star.el.classList.toggle('unreached', !canDetect);
        }
    });

    // Update stats
    if (statsDisplay) {
        if (currentMode === 'outgoing') {
            const starsWithPlanets = starsReached.filter(s =>
                s.note.toLowerCase().includes('planet') ||
                s.note.toLowerCase().includes('habitable')
            ).length;

            statsDisplay.innerHTML = `
                <div class="stat">
                    <span class="stat-value">${lightYears}</span>
                    <span class="stat-label">light-years traveled</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${starsReached.length}</span>
                    <span class="stat-label">stars reached</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${starsWithPlanets}</span>
                    <span class="stat-label">with known planets</span>
                </div>
            `;
        } else {
            const detectableStars = stars.filter(s => s.distance <= lightYears / 2);
            statsDisplay.innerHTML = `
                <div class="stat">
                    <span class="stat-value">${Math.floor(lightYears / 2)}</span>
                    <span class="stat-label">max detection distance</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${detectableStars.length}</span>
                    <span class="stat-label">stars could know we exist</span>
                </div>
            `;
        }
    }

    // Update message based on broadcasts
    if (messageDisplay) {
        const latestBroadcast = recentBroadcasts[recentBroadcasts.length - 1];
        if (latestBroadcast && latestBroadcast.year === year) {
            messageDisplay.textContent = `${latestBroadcast.year}: ${latestBroadcast.event}`;
            messageDisplay.classList.add('highlight');
            playBroadcastSound();
            setTimeout(() => messageDisplay?.classList.remove('highlight'), 500);
        } else if (starsReached.length > 0) {
            const latest = starsReached[starsReached.length - 1];
            if (currentMode === 'outgoing') {
                messageDisplay.textContent = `Our signals have reached ${latest.name} (${latest.distance.toFixed(1)} ly)`;
            } else {
                messageDisplay.textContent = `Intelligence at ${latest.name} could have detected our radio emissions`;
            }
        } else {
            messageDisplay.textContent = currentMode === 'outgoing'
                ? 'Our radio signals are still traveling toward the nearest stars...'
                : 'No stars close enough for round-trip detection yet...';
        }
    }
}

/**
 * Start automatic year progression
 */
function startAnimation(): void {
    if (isPlaying) return;
    isPlaying = true;

    const animate = () => {
        if (!isPlaying) return;

        if (currentYear < 2025) {
            currentYear++;
            if (yearSlider) yearSlider.value = String(currentYear);
            updateVisualization(currentYear);
            animationFrame = requestAnimationFrame(() => {
                setTimeout(animate, 50); // ~20 years per second
            });
        } else {
            isPlaying = false;
            updatePlayButton();
        }
    };

    animate();
    updatePlayButton();
}

/**
 * Stop animation
 */
function stopAnimation(): void {
    isPlaying = false;
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    updatePlayButton();
}

/**
 * Toggle animation
 */
function toggleAnimation(): void {
    if (isPlaying) {
        stopAnimation();
    } else {
        if (currentYear >= 2025) {
            currentYear = START_YEAR;
            if (yearSlider) yearSlider.value = String(currentYear);
            // Reset all stars
            stars.forEach(s => s.reached = false);
        }
        startAnimation();
    }
}

/**
 * Update play button state
 */
function updatePlayButton(): void {
    const playBtn = container?.querySelector('.play-btn');
    if (playBtn) {
        playBtn.textContent = isPlaying ? '⏸' : '▶';
        playBtn.setAttribute('title', isPlaying ? 'Pause' : 'Play');
    }
}

/**
 * Switch between outgoing and incoming view modes
 */
function setViewMode(mode: ViewMode): void {
    currentMode = mode;

    const modeButtons = container?.querySelectorAll('.mode-btn');
    modeButtons?.forEach(btn => {
        const btnEl = btn as HTMLElement;
        btn.classList.toggle('active', btnEl.dataset.mode === mode);
    });

    // Update sphere label
    const sphereLabel = container?.querySelector('.sphere-label');
    if (sphereLabel) {
        sphereLabel.textContent = mode === 'outgoing'
            ? 'Radio Sphere'
            : 'Detection Zone';
    }

    // Reset and update
    stars.forEach(s => s.reached = false);
    updateVisualization(currentYear);
}

/**
 * Create star element
 */
function createStarElement(star: Star, index: number): HTMLElement {
    const el = document.createElement('div');
    el.className = 'light-cone-star unreached';
    el.dataset.name = star.name;
    el.dataset.distance = String(star.distance);

    // Assign random angle for positioning
    star.angle = (index / stars.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;

    // Size based on brightness (closer = brighter = larger, roughly)
    const size = star.distance < 15 ? 8 : star.distance < 50 ? 6 : 4;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;

    // Color based on spectral type
    if (star.type.startsWith('M')) {
        el.style.background = 'rgba(255, 180, 150, 0.9)';
    } else if (star.type.startsWith('K')) {
        el.style.background = 'rgba(255, 220, 180, 0.9)';
    } else if (star.type.startsWith('G')) {
        el.style.background = 'rgba(255, 255, 220, 0.9)';
    } else if (star.type.startsWith('F')) {
        el.style.background = 'rgba(255, 255, 255, 0.9)';
    } else if (star.type.startsWith('A')) {
        el.style.background = 'rgba(200, 220, 255, 0.9)';
    } else if (star.type.startsWith('B')) {
        el.style.background = 'rgba(170, 200, 255, 0.9)';
    } else {
        el.style.background = 'rgba(200, 200, 200, 0.7)';
    }

    // Tooltip
    el.title = `${star.name}\n${star.distance.toFixed(1)} light-years\n${star.note}`;

    return el;
}

/**
 * Reset to initial state
 */
export function resetLightCone(): void {
    stopAnimation();
    currentYear = START_YEAR;
    if (yearSlider) yearSlider.value = String(currentYear);
    stars.forEach(s => s.reached = false);
    updateVisualization(currentYear);
}

/**
 * Initialize the Light Cone visualization
 */
export function initLightCone(): void {
    container = document.getElementById('light-cone-container');
    if (!container) return;

    // Load data
    stars = starData.stars.filter(s => s.distance <= MAX_DISPLAY_DISTANCE) as Star[];
    broadcasts = starData.broadcasts as Broadcast[];

    // Create structure
    container.innerHTML = `
        <div class="light-cone-header">
            <div class="mode-toggle">
                <button class="mode-btn active" data-mode="outgoing" title="Our signals spreading outward">
                    Outgoing
                </button>
                <button class="mode-btn" data-mode="incoming" title="Who could detect us">
                    Incoming
                </button>
            </div>
        </div>
        <div class="light-cone-viz">
            <div class="earth-marker">
                <span class="earth-icon">⊕</span>
                <span class="earth-label">Earth</span>
            </div>
            <div class="radio-sphere">
                <span class="sphere-label">Radio Sphere</span>
            </div>
            <div class="stars-container"></div>
            <div class="distance-rings">
                <div class="distance-ring" style="--ring-distance: 25"></div>
                <div class="distance-ring" style="--ring-distance: 50"></div>
                <div class="distance-ring" style="--ring-distance: 100"></div>
            </div>
            <div class="distance-labels">
                <span class="distance-label" style="--label-distance: 25">25 ly</span>
                <span class="distance-label" style="--label-distance: 50">50 ly</span>
                <span class="distance-label" style="--label-distance: 100">100 ly</span>
            </div>
        </div>
        <div class="light-cone-controls">
            <button class="ascii-btn play-btn" title="Play">▶</button>
            <input type="range" class="year-slider" min="${START_YEAR}" max="2025" value="${START_YEAR}">
            <span class="year-display">${START_YEAR}</span>
        </div>
        <div class="light-cone-stats"></div>
        <div class="light-cone-message">Our radio signals are still traveling toward the nearest stars...</div>
    `;

    // Get references
    starsContainer = container.querySelector('.stars-container');
    sphereEl = container.querySelector('.radio-sphere');
    yearSlider = container.querySelector('.year-slider');
    yearDisplay = container.querySelector('.year-display');
    statsDisplay = container.querySelector('.light-cone-stats');
    messageDisplay = container.querySelector('.light-cone-message');

    // Create star elements
    stars.forEach((star, i) => {
        const el = createStarElement(star, i);
        star.el = el;
        starsContainer?.appendChild(el);
        positionStar(star);
    });

    // Event listeners
    yearSlider?.addEventListener('input', () => {
        stopAnimation();
        updateVisualization(parseInt(yearSlider!.value));
    });

    const playBtn = container.querySelector('.play-btn');
    playBtn?.addEventListener('click', toggleAnimation);

    const modeButtons = container.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = (btn as HTMLElement).dataset.mode as ViewMode;
            setViewMode(mode);
        });
    });

    // Initial state
    updateVisualization(START_YEAR);
}
