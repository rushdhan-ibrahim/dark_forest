// Return Greeting - Welcome back returning readers with personalized insights

import { getAudioContext, getMasterGain, getIsAudioPlaying } from '../audio/context';
import { getReadingInsights, isReturningReader, type ReadingInsights } from '../utils/session';
import { getRememberedStarCount } from '../utils/persistence';

let greetingElement: HTMLElement | null = null;
let isVisible = false;
let dismissTimeout: number | null = null;

/**
 * Play welcome back sound
 */
function playWelcomeSound(): void {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) return;

    const now = ctx.currentTime;

    // Gentle ascending chime
    const notes = [220, 330, 440];

    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, now + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.03, now + i * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.8);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.85);
    });
}

/**
 * Generate personalized greeting message
 */
function generateGreeting(insights: ReadingInsights): string {
    const greetings = [
        `Welcome back. It's been ${insights.timeSinceLastVisit} since you last looked up.`,
        `You've returned. The cosmos has been waiting.`,
        `Back again. The stars remember you.`,
        `Welcome back to the dark forest.`
    ];

    // Pick based on visit count
    const index = Math.min(insights.visitCount - 1, greetings.length - 1);
    return greetings[Math.max(0, index)];
}

/**
 * Generate insight about the reader's journey
 */
function generateInsight(insights: ReadingInsights): string {
    const starCount = getRememberedStarCount();

    const possibleInsights: string[] = [];

    // Time-based insight
    if (insights.totalTimeFormatted) {
        possibleInsights.push(
            `You've spent ${insights.totalTimeFormatted} contemplating the silence.`
        );
    }

    // Section-based insight
    if (insights.mostTimeSectionName) {
        possibleInsights.push(
            `You lingered longest on ${insights.mostTimeSectionName}.`
        );
    }

    // Star memory insight
    if (starCount > 0) {
        possibleInsights.push(
            `${starCount} star${starCount === 1 ? '' : 's'} still remember${starCount === 1 ? 's' : ''} your touch.`
        );
    }

    // Last position insight
    if (insights.lastSection && insights.lastSection !== 'intro') {
        possibleInsights.push(
            `Last time, you were exploring ${insights.lastSectionName}.`
        );
    }

    // Choice-based insight
    if (insights.choicesMade['carol']) {
        const choice = insights.choicesMade['carol'];
        if (choice === 'world') {
            possibleInsights.push(`You chose to save the world. Would you do it again?`);
        } else if (choice === 'girl') {
            possibleInsights.push(`You chose love over everything. Would you do it again?`);
        }
    }

    // Completion insight
    if (insights.completedReading) {
        possibleInsights.push(`You've reached the end before. But understanding takes more than one journey.`);
    }

    // Pick a random insight
    if (possibleInsights.length === 0) {
        return '';
    }

    return possibleInsights[Math.floor(Math.random() * possibleInsights.length)];
}

/**
 * Build the greeting UI
 */
function buildGreeting(insights: ReadingInsights): HTMLElement {
    const element = document.createElement('div');
    element.className = 'return-greeting';

    const greeting = generateGreeting(insights);
    const insight = generateInsight(insights);

    element.innerHTML = `
        <div class="greeting-content">
            <p class="greeting-main">${greeting}</p>
            ${insight ? `<p class="greeting-insight">${insight}</p>` : ''}
            <button class="greeting-dismiss" aria-label="Dismiss greeting">&times;</button>
        </div>
    `;

    // Add dismiss handler
    const dismissBtn = element.querySelector('.greeting-dismiss');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', hideGreeting);
    }

    // Also dismiss on click anywhere on the greeting
    element.addEventListener('click', (e) => {
        if (e.target === element) {
            hideGreeting();
        }
    });

    return element;
}

/**
 * Show the greeting
 */
function showGreeting(): void {
    if (isVisible || greetingElement) return;

    const insights = getReadingInsights();

    greetingElement = buildGreeting(insights);
    document.body.appendChild(greetingElement);

    // Trigger animation
    requestAnimationFrame(() => {
        greetingElement?.classList.add('visible');
    });

    isVisible = true;
    playWelcomeSound();

    // Auto-dismiss after 8 seconds
    dismissTimeout = window.setTimeout(() => {
        hideGreeting();
    }, 8000);
}

/**
 * Hide the greeting
 */
function hideGreeting(): void {
    if (!isVisible || !greetingElement) return;

    if (dismissTimeout) {
        clearTimeout(dismissTimeout);
        dismissTimeout = null;
    }

    greetingElement.classList.remove('visible');

    // Remove after animation
    setTimeout(() => {
        if (greetingElement && greetingElement.parentNode) {
            greetingElement.parentNode.removeChild(greetingElement);
        }
        greetingElement = null;
        isVisible = false;
    }, 500);
}

/**
 * Initialize the return greeting
 * Shows a personalized welcome for returning readers
 */
export function initReturnGreeting(): void {
    // Only show for returning readers
    if (!isReturningReader()) {
        return;
    }

    // Wait for page to be ready and audio to potentially start
    setTimeout(() => {
        showGreeting();
    }, 1500);
}

/**
 * Force show the greeting (for testing)
 */
export function forceShowGreeting(): void {
    showGreeting();
}

/**
 * Reset greeting state (for testing)
 */
export function resetGreeting(): void {
    hideGreeting();
}
