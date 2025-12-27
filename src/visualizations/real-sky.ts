// The Real Sky - Transition from stylized to realistic night sky
// Based on reader's actual location when permitted

import { getAudioContext, getMasterGain, getIsAudioPlaying } from '../audio/context';
import { getCurrentLocation, requestLocation, getHemisphere, getVisibleConstellationIndices, isNightAt, getFallbackLocation, clearStoredLocation, type Location } from '../utils/geolocation';
import constellationData from '../data/constellations.json';

interface Star {
    name: string;
    x: number;
    y: number;
    distance: number;
    magnitude: number;
}

interface Constellation {
    name: string;
    description: string;
    stars: Star[];
    lines: [number, number][];
}

type SkyState = 'initial' | 'requesting' | 'loading' | 'ready' | 'denied';

let container: HTMLElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let isVisible = false;
let animationFrame: number | null = null;
let currentLocation: Location | null = null;
let skyState: SkyState = 'initial';

// Stars for the realistic sky
interface RealisticStar {
    x: number;
    y: number;
    size: number;
    brightness: number;
    twinklePhase: number;
    twinkleSpeed: number;
    color: { r: number; g: number; b: number };
}

let stars: RealisticStar[] = [];
let visibleConstellationIndices: number[] = [];

/**
 * Generate stars for the realistic sky
 */
function generateRealisticStars(count: number): RealisticStar[] {
    const result: RealisticStar[] = [];
    const colors = [
        { r: 255, g: 255, b: 255 }, // White
        { r: 200, g: 220, b: 255 }, // Blue-white
        { r: 255, g: 240, b: 220 }, // Yellow-white
        { r: 255, g: 220, b: 200 }, // Orange-white
        { r: 180, g: 200, b: 255 }, // Blue
    ];

    for (let i = 0; i < count; i++) {
        result.push({
            x: Math.random(),
            y: Math.random(),
            size: Math.random() * 1.5 + 0.5,
            brightness: Math.random() * 0.6 + 0.4,
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: Math.random() * 0.02 + 0.01,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }

    return result;
}

/**
 * Play the transition sound
 */
function playTransitionSound(): void {
    const audioCtx = getAudioContext();
    const masterGain = getMasterGain();
    if (!audioCtx || !masterGain || !getIsAudioPlaying()) return;

    const now = audioCtx.currentTime;

    // Descending chime - from wonder to reality
    const notes = [880, 660, 440, 330, 220];

    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.value = freq;

        filter.type = 'lowpass';
        filter.frequency.value = 2000;

        gain.gain.setValueAtTime(0, now + i * 0.3);
        gain.gain.linearRampToValueAtTime(0.04, now + i * 0.3 + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.3 + 1.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start(now + i * 0.3);
        osc.stop(now + i * 0.3 + 1.6);
    });
}

/**
 * Render the realistic star field
 */
function renderStarField(time: number): void {
    if (!ctx || !canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear with dark sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0a0a18');
    gradient.addColorStop(0.5, '#0d0d1f');
    gradient.addColorStop(1, '#101020');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw stars with twinkling
    stars.forEach(star => {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase) * 0.3 + 0.7;
        const brightness = star.brightness * twinkle;

        ctx!.beginPath();
        ctx!.arc(
            star.x * width,
            star.y * height,
            star.size,
            0,
            Math.PI * 2
        );
        ctx!.fillStyle = `rgba(${star.color.r}, ${star.color.g}, ${star.color.b}, ${brightness})`;
        ctx!.fill();

        // Add glow for brighter stars
        if (star.size > 1.2) {
            ctx!.beginPath();
            ctx!.arc(
                star.x * width,
                star.y * height,
                star.size * 3,
                0,
                Math.PI * 2
            );
            ctx!.fillStyle = `rgba(${star.color.r}, ${star.color.g}, ${star.color.b}, ${brightness * 0.1})`;
            ctx!.fill();
        }
    });

    // Draw visible constellations
    const constellations = constellationData.constellations as Constellation[];
    visibleConstellationIndices.forEach(index => {
        const constellation = constellations[index];
        if (!constellation) return;

        // Draw connecting lines
        ctx!.strokeStyle = 'rgba(180, 200, 230, 0.3)';
        ctx!.lineWidth = 1;
        ctx!.setLineDash([4, 4]);

        constellation.lines.forEach(([startIdx, endIdx]) => {
            const start = constellation.stars[startIdx];
            const end = constellation.stars[endIdx];

            ctx!.beginPath();
            ctx!.moveTo((start.x / 100) * width, (start.y / 100) * height);
            ctx!.lineTo((end.x / 100) * width, (end.y / 100) * height);
            ctx!.stroke();
        });

        ctx!.setLineDash([]);

        // Draw constellation stars
        constellation.stars.forEach(star => {
            const x = (star.x / 100) * width;
            const y = (star.y / 100) * height;
            const size = 4 - star.magnitude * 0.5;

            // Glow
            ctx!.beginPath();
            ctx!.arc(x, y, size * 2, 0, Math.PI * 2);
            ctx!.fillStyle = 'rgba(200, 220, 255, 0.2)';
            ctx!.fill();

            // Star
            ctx!.beginPath();
            ctx!.arc(x, y, size, 0, Math.PI * 2);
            ctx!.fillStyle = '#e8f0ff';
            ctx!.fill();
        });

        // Draw constellation name
        const centerX = constellation.stars.reduce((sum, s) => sum + s.x, 0) / constellation.stars.length;
        const centerY = constellation.stars.reduce((sum, s) => sum + s.y, 0) / constellation.stars.length;

        ctx!.font = '14px "Cinzel Decorative", serif';
        ctx!.textAlign = 'center';
        ctx!.fillStyle = 'rgba(180, 200, 230, 0.5)';
        ctx!.fillText(constellation.name, (centerX / 100) * width, (centerY / 100 - 0.05) * height);
    });
}

/**
 * Animation loop
 */
function animate(time: number): void {
    if (!isVisible || skyState !== 'ready') return;

    renderStarField(time);
    animationFrame = requestAnimationFrame(animate);
}

/**
 * Resize canvas to fill container
 */
function resizeCanvas(): void {
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    if (ctx) {
        ctx.scale(dpr, dpr);
    }
}

/**
 * Format location for display
 */
function formatLocationText(location: Location): string {
    if (location.isRealLocation) {
        // Real location from geolocation API
        if (location.city) {
            return location.country
                ? `${location.city}, ${location.country}`
                : location.city;
        }
        // Have coordinates but no city name - show coordinates
        const latDir = location.latitude >= 0 ? 'N' : 'S';
        const lonDir = location.longitude >= 0 ? 'E' : 'W';
        return `${Math.abs(location.latitude).toFixed(1)}° ${latDir}, ${Math.abs(location.longitude).toFixed(1)}° ${lonDir}`;
    } else {
        // Fallback location - just show hemisphere
        const hemisphere = getHemisphere(location);
        return `${hemisphere.name} Hemisphere (approximate)`;
    }
}

/**
 * Build the permission request UI
 */
function buildPermissionUI(): void {
    if (!container) return;

    container.innerHTML = '';

    const permissionPrompt = document.createElement('div');
    permissionPrompt.className = 'real-sky-permission';
    permissionPrompt.innerHTML = `
        <div class="permission-content">
            <h3 class="permission-title">See Your Real Sky</h3>
            <p class="permission-description">
                Share your location to see the constellations visible from where you are tonight.
                We only use this to calculate which stars are above your horizon.
            </p>
            <div class="permission-buttons">
                <button class="ascii-btn permission-allow" id="sky-allow-location">
                    SHARE LOCATION
                </button>
                <button class="ascii-btn permission-skip" id="sky-skip-location">
                    USE APPROXIMATE
                </button>
            </div>
            <p class="permission-note">
                Your location is never stored on any server.
            </p>
        </div>
    `;

    container.appendChild(permissionPrompt);

    // Add event listeners
    const allowBtn = document.getElementById('sky-allow-location');
    const skipBtn = document.getElementById('sky-skip-location');

    if (allowBtn) {
        allowBtn.addEventListener('click', handleAllowLocation);
    }
    if (skipBtn) {
        skipBtn.addEventListener('click', handleSkipLocation);
    }
}

/**
 * Build the loading UI
 */
function buildLoadingUI(): void {
    if (!container) return;

    container.innerHTML = '';

    const loadingEl = document.createElement('div');
    loadingEl.className = 'real-sky-loading';
    loadingEl.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p class="loading-text">Finding your position under the stars...</p>
        </div>
    `;

    container.appendChild(loadingEl);
}

/**
 * Build the main sky UI
 */
function buildSkyUI(): void {
    if (!container || !currentLocation) return;

    container.innerHTML = '';

    // Canvas for star field
    canvas = document.createElement('canvas');
    canvas.className = 'real-sky-canvas';
    container.appendChild(canvas);

    ctx = canvas.getContext('2d');
    resizeCanvas();

    // Location info overlay
    const overlay = document.createElement('div');
    overlay.className = 'real-sky-overlay';

    const isNight = isNightAt(currentLocation);
    const locationText = formatLocationText(currentLocation);

    const constellationNames = visibleConstellationIndices
        .map(i => (constellationData.constellations as Constellation[])[i]?.name)
        .filter(Boolean);

    overlay.innerHTML = `
        <div class="real-sky-header">
            <h3 class="real-sky-title">Your Sky${isNight ? ', Tonight' : ''}</h3>
            <p class="real-sky-location">${locationText}</p>
        </div>
        <div class="real-sky-info">
            <p class="real-sky-constellations">
                ${constellationNames.length > 0
                    ? `Visible now: ${constellationNames.join(', ')}`
                    : 'The stars await you.'
                }
            </p>
        </div>
        <div class="real-sky-prompt">
            <p class="prompt-text">Go outside. Look up.</p>
            <p class="prompt-sub">The same stars that watched over ancient civilizations watch over you.</p>
        </div>
    `;

    container.appendChild(overlay);

    // Distance annotations for constellation stars (only for real locations)
    if (currentLocation.isRealLocation) {
        const distanceAnnotations = document.createElement('div');
        distanceAnnotations.className = 'distance-annotations';

        const constellations = constellationData.constellations as Constellation[];
        visibleConstellationIndices.forEach(index => {
            const constellation = constellations[index];
            if (!constellation) return;

            // Add distance for the brightest star
            const brightestStar = [...constellation.stars].sort((a, b) => a.magnitude - b.magnitude)[0];
            if (brightestStar) {
                const annotation = document.createElement('div');
                annotation.className = 'distance-annotation';
                annotation.style.left = `${brightestStar.x}%`;
                annotation.style.top = `${brightestStar.y + 3}%`;
                annotation.innerHTML = `
                    <span class="star-name">${brightestStar.name}</span>
                    <span class="star-distance">${brightestStar.distance.toLocaleString()} ly</span>
                `;
                distanceAnnotations.appendChild(annotation);
            }
        });

        container.appendChild(distanceAnnotations);
    }

    // Start animation
    playTransitionSound();
    if (!animationFrame) {
        animationFrame = requestAnimationFrame(animate);
    }
}

/**
 * Handle allow location button click
 */
async function handleAllowLocation(): Promise<void> {
    skyState = 'loading';
    buildLoadingUI();

    const location = await requestLocation();

    if (location) {
        currentLocation = location;
        skyState = 'ready';
        visibleConstellationIndices = getVisibleConstellationIndices(location);
        buildSkyUI();
    } else {
        // Permission denied or error - fall back to approximate
        skyState = 'denied';
        handleSkipLocation();
    }
}

/**
 * Handle skip location button click
 */
function handleSkipLocation(): void {
    // Use timezone-based fallback (marked as non-real)
    currentLocation = getFallbackLocation();
    skyState = 'ready';
    visibleConstellationIndices = getVisibleConstellationIndices(currentLocation);
    buildSkyUI();
}

/**
 * Show the real sky visualization
 */
export function showRealSky(): void {
    if (!container || isVisible) return;

    isVisible = true;
    container.classList.add('visible');

    // Generate stars if not already done
    if (stars.length === 0) {
        stars = generateRealisticStars(300);
    }

    // Check if we have a stored REAL location (from geolocation API)
    const storedRealLocation = getCurrentLocation();

    if (storedRealLocation) {
        // We have a real location from a previous session
        currentLocation = storedRealLocation;
        skyState = 'ready';
        visibleConstellationIndices = getVisibleConstellationIndices(currentLocation);
        buildSkyUI();
    } else if (skyState === 'initial') {
        // No real location - show permission prompt
        skyState = 'requesting';
        buildPermissionUI();
    }
}

/**
 * Hide the real sky visualization
 */
export function hideRealSky(): void {
    if (!container) return;

    isVisible = false;
    container.classList.remove('visible');

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
}

/**
 * Toggle the real sky
 */
export function toggleRealSky(): void {
    if (isVisible) {
        hideRealSky();
    } else {
        showRealSky();
    }
}

/**
 * Initialize the real sky visualization
 */
export function initRealSky(): void {
    container = document.getElementById('real-sky-container');
    if (!container) return;

    // Handle resize
    window.addEventListener('resize', () => {
        if (isVisible && skyState === 'ready') {
            resizeCanvas();
        }
    });

    // Watch for when the real-sky section comes into view
    const section = document.getElementById('real-sky');
    if (section) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                        showRealSky();
                    }
                });
            },
            { threshold: [0.5] }
        );

        observer.observe(section);
    }
}

/**
 * Reset the real sky (for testing)
 */
export function resetRealSky(): void {
    hideRealSky();
    stars = [];
    currentLocation = null;
    skyState = 'initial';
    clearStoredLocation();

    if (container) {
        container.innerHTML = '';
    }
}
