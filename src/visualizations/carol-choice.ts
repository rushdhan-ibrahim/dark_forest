// Carol choice visualization module - interactive moral dilemma
// The choice should have weight - no automatic oscillation, reader must decide

import { getAudioContext, getMasterGain, getIsAudioPlaying } from '../audio/context';

type Choice = 'world' | 'girl' | null;

let currentChoice: Choice = null;
let hasChosen = false;
let container: HTMLElement | null = null;
let worldEl: HTMLElement | null = null;
let girlEl: HTMLElement | null = null;
let promptEl: HTMLElement | null = null;
let responseEl: HTMLElement | null = null;

const STORAGE_KEY = 'carol-choice';

/**
 * Play choice sound
 */
function playChoiceSound(choice: Choice): void {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) return;

    const now = ctx.currentTime;

    if (choice === 'world') {
        // Bittersweet chord - sacrifice
        const frequencies = [220, 261, 330, 392]; // A minor add 9
        frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.04, now + 0.1 + i * 0.05);
            gain.gain.setValueAtTime(0.04, now + 1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(now + i * 0.05);
            osc.stop(now + 2.6);
        });
    } else if (choice === 'girl') {
        // Warm but questioning chord
        const frequencies = [196, 247, 294, 370]; // G major 7
        frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.035, now + 0.1 + i * 0.05);
            gain.gain.setValueAtTime(0.035, now + 1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(now + i * 0.05);
            osc.stop(now + 2.1);
        });
    }
}

/**
 * Save choice to localStorage
 */
function saveChoice(choice: Choice): void {
    try {
        if (choice) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                choice,
                timestamp: Date.now()
            }));
        }
    } catch (e) {
        // localStorage might be unavailable
    }
}

/**
 * Load choice from localStorage
 */
function loadChoice(): Choice {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            return data.choice as Choice;
        }
    } catch (e) {
        // localStorage might be unavailable
    }
    return null;
}

/**
 * Format timestamp for display
 */
function getTimeSinceChoice(): string {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            const days = Math.floor((Date.now() - data.timestamp) / (1000 * 60 * 60 * 24));
            if (days === 0) return 'today';
            if (days === 1) return 'yesterday';
            return `${days} days ago`;
        }
    } catch (e) {
        // Ignore
    }
    return '';
}

/**
 * Update visual state after choice
 */
function updateVisualState(choice: Choice, isReturning: boolean = false): void {
    if (!worldEl || !girlEl || !promptEl || !responseEl) return;

    // Remove oscillation classes
    worldEl.classList.remove('oscillating');
    girlEl.classList.remove('oscillating');

    if (choice === 'world') {
        worldEl.classList.add('chosen');
        girlEl.classList.add('not-chosen');

        if (isReturning) {
            const timeSince = getTimeSinceChoice();
            responseEl.innerHTML = `
                <span class="response-text">You chose to save the world.</span>
                <span class="response-time">${timeSince}</span>
            `;
        } else {
            responseEl.innerHTML = `
                <span class="response-text">She watches from the other side of the glass as you walk away.</span>
            `;
        }
    } else if (choice === 'girl') {
        girlEl.classList.add('chosen');
        worldEl.classList.add('not-chosen');

        if (isReturning) {
            const timeSince = getTimeSinceChoice();
            responseEl.innerHTML = `
                <span class="response-text">You chose her.</span>
                <span class="response-time">${timeSince}</span>
            `;
        } else {
            responseEl.innerHTML = `
                <span class="response-text">The antenna rises behind you. You don't look back.</span>
            `;
        }
    }

    responseEl.classList.add('visible');
    promptEl.classList.add('hidden');
}

/**
 * Handle choice selection
 */
function makeChoice(choice: Choice): void {
    if (hasChosen || !choice) return;

    hasChosen = true;
    currentChoice = choice;

    // Update visuals
    updateVisualState(choice, false);

    // Play sound
    playChoiceSound(choice);

    // Save choice
    saveChoice(choice);

    // Add chosen class to container for CSS effects
    container?.classList.add('choice-made');
    container?.classList.add(`chose-${choice}`);
}

/**
 * Reset choice (for testing)
 */
export function resetCarolChoice(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        // Ignore
    }

    hasChosen = false;
    currentChoice = null;

    if (worldEl && girlEl && promptEl && responseEl && container) {
        worldEl.classList.remove('chosen', 'not-chosen');
        girlEl.classList.remove('chosen', 'not-chosen');
        worldEl.classList.add('oscillating');
        girlEl.classList.add('oscillating');
        promptEl.classList.remove('hidden');
        responseEl.classList.remove('visible');
        responseEl.innerHTML = '';
        container.classList.remove('choice-made', 'chose-world', 'chose-girl');
    }

    startOscillation();
}

/**
 * Start the oscillation animation (before choice is made)
 */
function startOscillation(): void {
    if (hasChosen) return;

    let currentHighlight = 0;

    const oscillate = () => {
        if (hasChosen) return;

        if (worldEl && girlEl) {
            worldEl.classList.toggle('highlight', currentHighlight === 0);
            girlEl.classList.toggle('highlight', currentHighlight === 1);
        }

        currentHighlight = (currentHighlight + 1) % 2;
        setTimeout(oscillate, 2500);
    };

    oscillate();
}

/**
 * Get the current choice (for external use)
 */
export function getCarolChoice(): Choice {
    return currentChoice;
}

/**
 * Initialize Carol's Choice visualization
 */
export function initCarolChoice(): void {
    container = document.getElementById('carol-choice-container');
    worldEl = document.getElementById('choice-world');
    girlEl = document.getElementById('choice-girl');

    if (!container || !worldEl || !girlEl) return;

    // Create prompt element
    promptEl = document.createElement('div');
    promptEl.className = 'choice-prompt';
    promptEl.textContent = 'Click to choose';
    container.appendChild(promptEl);

    // Create response element
    responseEl = document.createElement('div');
    responseEl.className = 'choice-response';
    container.appendChild(responseEl);

    // Add click handlers
    worldEl.addEventListener('click', () => makeChoice('world'));
    girlEl.addEventListener('click', () => makeChoice('girl'));

    // Add oscillating class for initial state
    worldEl.classList.add('oscillating');
    girlEl.classList.add('oscillating');

    // Check for saved choice
    const savedChoice = loadChoice();
    if (savedChoice) {
        hasChosen = true;
        currentChoice = savedChoice;
        updateVisualState(savedChoice, true);
        container.classList.add('choice-made', `chose-${savedChoice}`);
    } else {
        // Start oscillation
        startOscillation();
    }
}
