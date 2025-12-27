// Credence Collector - Let readers express their beliefs about cosmic scenarios
// Stores locally and visualizes against simulated collective responses

import { getAudioContext, getMasterGain, getIsAudioPlaying } from '../audio/context';

interface Credence {
    id: string;
    label: string;
    description: string;
    value: number;  // 0-100 probability
}

interface CredenceProfile {
    credences: Record<string, number>;
    timestamp: number;
}

const SCENARIOS: Omit<Credence, 'value'>[] = [
    {
        id: 'life-common',
        label: 'Life is common',
        description: 'Simple life arises frequently on suitable planets'
    },
    {
        id: 'intelligence-rare',
        label: 'Intelligence is rare',
        description: 'The leap to technological intelligence is exceptionally unlikely'
    },
    {
        id: 'dark-forest',
        label: 'Dark Forest dynamics',
        description: 'Advanced civilizations adopt hostile or hiding strategies'
    },
    {
        id: 'great-filter-ahead',
        label: 'Great Filter ahead',
        description: 'Technological civilizations typically destroy themselves'
    },
    {
        id: 'we-are-alone',
        label: 'We are alone',
        description: 'Earth hosts the only technological civilization in the observable universe'
    },
    {
        id: 'contact-century',
        label: 'Contact this century',
        description: 'Humanity will detect unambiguous alien signals by 2100'
    }
];

const STORAGE_KEY = 'credence-profile';

let container: HTMLElement | null = null;
let credences: Credence[] = [];
let submitted = false;
let mapContainer: HTMLElement | null = null;

// Simulated collective data (would come from backend in production)
const SIMULATED_PROFILES = generateSimulatedProfiles(150);

/**
 * Generate simulated reader profiles for visualization
 */
function generateSimulatedProfiles(count: number): CredenceProfile[] {
    const profiles: CredenceProfile[] = [];

    // Define some "archetype" distributions
    const archetypes = [
        { name: 'optimist', weights: { 'life-common': 80, 'intelligence-rare': 30, 'dark-forest': 15, 'great-filter-ahead': 20, 'we-are-alone': 10, 'contact-century': 60 } },
        { name: 'pessimist', weights: { 'life-common': 40, 'intelligence-rare': 70, 'dark-forest': 60, 'great-filter-ahead': 70, 'we-are-alone': 50, 'contact-century': 5 } },
        { name: 'dark-forester', weights: { 'life-common': 70, 'intelligence-rare': 40, 'dark-forest': 85, 'great-filter-ahead': 40, 'we-are-alone': 5, 'contact-century': 20 } },
        { name: 'lonely-earth', weights: { 'life-common': 20, 'intelligence-rare': 90, 'dark-forest': 30, 'great-filter-ahead': 50, 'we-are-alone': 85, 'contact-century': 2 } },
        { name: 'uncertain', weights: { 'life-common': 50, 'intelligence-rare': 50, 'dark-forest': 50, 'great-filter-ahead': 50, 'we-are-alone': 50, 'contact-century': 25 } }
    ];

    for (let i = 0; i < count; i++) {
        // Pick a random archetype with some noise
        const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];
        const credences: Record<string, number> = {};

        for (const [id, baseValue] of Object.entries(archetype.weights)) {
            // Add gaussian-ish noise
            const noise = (Math.random() + Math.random() + Math.random() - 1.5) * 25;
            credences[id] = Math.max(0, Math.min(100, baseValue + noise));
        }

        profiles.push({
            credences,
            timestamp: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000 // Random time in last 30 days
        });
    }

    return profiles;
}

/**
 * Play slider sound
 */
function playSliderSound(value: number): void {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Pitch maps to value
    osc.type = 'sine';
    osc.frequency.value = 200 + (value / 100) * 400;

    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.15);
}

/**
 * Play submission sound
 */
function playSubmitSound(): void {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) return;

    const now = ctx.currentTime;

    // Ascending arpeggio
    [0, 4, 7, 12].forEach((semitone, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = 220 * Math.pow(2, semitone / 12);

        gain.gain.setValueAtTime(0, now + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.04, now + i * 0.1 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.35);
    });
}

/**
 * Calculate position in 2D space based on credences
 * Uses first two principal components of the belief space
 */
function calculatePosition(profile: Record<string, number>): { x: number; y: number } {
    // Simplified dimensionality reduction
    // x-axis: optimism (life common, contact likely) vs pessimism
    // y-axis: hostile universe (dark forest, filter ahead) vs benign

    const optimism = (
        (profile['life-common'] || 50) * 0.4 +
        (100 - (profile['intelligence-rare'] || 50)) * 0.3 +
        (profile['contact-century'] || 25) * 0.3
    ) / 100;

    const hostility = (
        (profile['dark-forest'] || 50) * 0.5 +
        (profile['great-filter-ahead'] || 50) * 0.5
    ) / 100;

    return {
        x: optimism,
        y: hostility
    };
}

/**
 * Render the collective map visualization
 */
function renderCollectiveMap(userProfile: Record<string, number> | null): void {
    if (!mapContainer) return;

    mapContainer.innerHTML = '';

    // Create axes
    const axisLabels = document.createElement('div');
    axisLabels.className = 'map-axes';
    axisLabels.innerHTML = `
        <span class="axis-label axis-top">Hostile Universe</span>
        <span class="axis-label axis-bottom">Benign Universe</span>
        <span class="axis-label axis-left">Pessimistic</span>
        <span class="axis-label axis-right">Optimistic</span>
    `;
    mapContainer.appendChild(axisLabels);

    // Create dot container
    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'map-dots';
    mapContainer.appendChild(dotsContainer);

    // Plot simulated profiles
    SIMULATED_PROFILES.forEach((profile, i) => {
        const pos = calculatePosition(profile.credences);
        const dot = document.createElement('div');
        dot.className = 'map-dot other';
        dot.style.left = `${pos.x * 100}%`;
        dot.style.top = `${(1 - pos.y) * 100}%`;
        dot.style.animationDelay = `${i * 0.02}s`;
        dotsContainer.appendChild(dot);
    });

    // Plot user's position if submitted
    if (userProfile) {
        const userPos = calculatePosition(userProfile);
        const userDot = document.createElement('div');
        userDot.className = 'map-dot user';
        userDot.style.left = `${userPos.x * 100}%`;
        userDot.style.top = `${(1 - userPos.y) * 100}%`;

        // Add label
        const label = document.createElement('span');
        label.className = 'user-label';
        label.textContent = 'You';
        userDot.appendChild(label);

        dotsContainer.appendChild(userDot);

        // Calculate and show cluster info
        const clusterInfo = identifyCluster(userProfile);
        const infoEl = document.createElement('div');
        infoEl.className = 'cluster-info';
        infoEl.innerHTML = `
            <p class="cluster-name">${clusterInfo.name}</p>
            <p class="cluster-description">${clusterInfo.description}</p>
            <p class="cluster-stats">${clusterInfo.percentage}% of readers share similar views</p>
        `;
        mapContainer.appendChild(infoEl);
    }
}

/**
 * Identify which "cluster" the user falls into
 */
function identifyCluster(profile: Record<string, number>): { name: string; description: string; percentage: number } {
    const pos = calculatePosition(profile);

    // Simple quadrant-based clustering
    if (pos.x > 0.6 && pos.y < 0.4) {
        return {
            name: 'The Hopeful',
            description: 'You believe life is common and the universe is fundamentally benign. Contact seems possible, even likely.',
            percentage: 18
        };
    } else if (pos.x > 0.6 && pos.y >= 0.4) {
        return {
            name: 'The Cautious Optimist',
            description: 'Life may be common, but dangers lurk. You hope for the best while acknowledging the risks.',
            percentage: 22
        };
    } else if (pos.x <= 0.4 && pos.y >= 0.6) {
        return {
            name: 'The Dark Forester',
            description: 'You take the Dark Forest seriously. Intelligence may be common, but survival demands silence.',
            percentage: 15
        };
    } else if (pos.x <= 0.4 && pos.y < 0.4) {
        return {
            name: 'The Lonely Realist',
            description: 'You suspect we may be alone—not because the universe is hostile, but because intelligence is rare.',
            percentage: 20
        };
    } else {
        return {
            name: 'The Uncertain',
            description: 'You remain genuinely uncertain. The evidence supports multiple interpretations.',
            percentage: 25
        };
    }
}

/**
 * Save credences to localStorage
 */
function saveCredences(): void {
    const profile: Record<string, number> = {};
    credences.forEach(c => {
        profile[c.id] = c.value;
    });

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            credences: profile,
            timestamp: Date.now()
        }));
    } catch (e) {
        // Ignore storage errors
    }
}

/**
 * Load saved credences
 */
function loadCredences(): CredenceProfile | null {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        // Ignore
    }
    return null;
}

/**
 * Handle slider change
 */
function handleSliderChange(id: string, value: number): void {
    const credence = credences.find(c => c.id === id);
    if (credence) {
        credence.value = value;

        // Update display
        const valueEl = document.querySelector(`[data-credence="${id}"] .credence-value`);
        if (valueEl) {
            valueEl.textContent = `${value}%`;
        }

        playSliderSound(value);
    }
}

/**
 * Handle form submission
 */
function handleSubmit(): void {
    if (submitted) return;

    submitted = true;
    saveCredences();
    playSubmitSound();

    // Transition UI
    if (container) {
        container.classList.add('submitted');
    }

    // Get user profile
    const profile: Record<string, number> = {};
    credences.forEach(c => {
        profile[c.id] = c.value;
    });

    // Show the map after a delay
    setTimeout(() => {
        if (mapContainer) {
            mapContainer.classList.add('visible');
        }
        renderCollectiveMap(profile);
    }, 500);
}

/**
 * Reset credences (for testing)
 */
export function resetCredences(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        // Ignore
    }

    submitted = false;
    credences.forEach(c => {
        c.value = 50;
    });

    if (container) {
        container.classList.remove('submitted');
        // Re-initialize
        container.innerHTML = '';
        buildUI();
    }
    if (mapContainer) {
        mapContainer.classList.remove('visible');
        mapContainer.innerHTML = '';
    }
}

/**
 * Build the UI
 */
function buildUI(): void {
    if (!container) return;

    // Input section
    const inputSection = document.createElement('div');
    inputSection.className = 'credence-input-section';

    const intro = document.createElement('div');
    intro.className = 'credence-intro';
    intro.innerHTML = `
        <p class="intro-main">What do you believe?</p>
        <p class="intro-sub">Assign your probability estimates to each scenario. There are no right answers—only your honest assessment.</p>
    `;
    inputSection.appendChild(intro);

    // Create sliders
    const slidersContainer = document.createElement('div');
    slidersContainer.className = 'credence-sliders';

    credences.forEach(credence => {
        const row = document.createElement('div');
        row.className = 'credence-row';
        row.dataset.credence = credence.id;

        row.innerHTML = `
            <div class="credence-label">
                <span class="label-text">${credence.label}</span>
                <span class="label-description">${credence.description}</span>
            </div>
            <div class="credence-slider-container">
                <input type="range"
                       class="credence-slider"
                       min="0"
                       max="100"
                       value="${credence.value}"
                       data-id="${credence.id}">
                <span class="credence-value">${credence.value}%</span>
            </div>
        `;

        const slider = row.querySelector('.credence-slider') as HTMLInputElement;
        slider.addEventListener('input', () => {
            handleSliderChange(credence.id, parseInt(slider.value));
        });

        slidersContainer.appendChild(row);
    });

    inputSection.appendChild(slidersContainer);

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.className = 'ascii-btn credence-submit';
    submitBtn.textContent = 'SEE WHERE YOU STAND';
    submitBtn.addEventListener('click', handleSubmit);
    inputSection.appendChild(submitBtn);

    container.appendChild(inputSection);

    // Map container (initially hidden)
    mapContainer = document.createElement('div');
    mapContainer.className = 'credence-map';
    container.appendChild(mapContainer);
}

/**
 * Initialize the credence input component
 */
export function initCredenceInput(): void {
    container = document.getElementById('credence-container');
    if (!container) return;

    // Initialize credences with default values
    credences = SCENARIOS.map(s => ({
        ...s,
        value: 50
    }));

    // Check for saved profile
    const savedProfile = loadCredences();
    if (savedProfile) {
        // Restore values
        credences.forEach(c => {
            if (savedProfile.credences[c.id] !== undefined) {
                c.value = savedProfile.credences[c.id];
            }
        });
        submitted = true;
    }

    buildUI();

    // If already submitted, show the map
    if (submitted) {
        container.classList.add('submitted');
        setTimeout(() => {
            if (mapContainer) {
                mapContainer.classList.add('visible');
            }
            const profile: Record<string, number> = {};
            credences.forEach(c => {
                profile[c.id] = c.value;
            });
            renderCollectiveMap(profile);
        }, 300);
    }
}
