// The Transmission - Compose a message to an alien civilization
// Confronts the impossibility of verification

import { getAudioContext, getMasterGain, getIsAudioPlaying } from '../audio/context';

interface TransmissionState {
    message: string;
    submitted: boolean;
    questionsShown: number;
}

const MAX_CHARS = 280; // Force concision like a cosmic tweet

const QUESTIONS = [
    "How do they know this isn't a trap?",
    "How do you prove peaceful intent?",
    "What if they interpret this as a threat?",
    "Would you trust a message like this from the void?",
    "Is silence safer than sincerity?"
];

let state: TransmissionState = {
    message: '',
    submitted: false,
    questionsShown: 0
};

let container: HTMLElement | null = null;
let inputEl: HTMLTextAreaElement | null = null;
let countEl: HTMLElement | null = null;
let submitBtn: HTMLButtonElement | null = null;
let journeyContainer: HTMLElement | null = null;
let questionsContainer: HTMLElement | null = null;

const STORAGE_KEY = 'transmission-message';

/**
 * Play transmission sound effect
 */
function playTransmissionSound(type: 'keypress' | 'send' | 'question'): void {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    if (!ctx || !masterGain || !getIsAudioPlaying()) return;

    const now = ctx.currentTime;

    if (type === 'keypress') {
        // Subtle blip for each character
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = 800 + Math.random() * 400;

        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.06);
    } else if (type === 'send') {
        // Ascending sweep - message departing
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(2000, now + 1.5);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.setValueAtTime(0.08, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 2.1);

        // Add some harmonics
        [2, 3, 5].forEach((mult, i) => {
            const harmOsc = ctx.createOscillator();
            const harmGain = ctx.createGain();

            harmOsc.type = 'sine';
            harmOsc.frequency.setValueAtTime(200 * mult, now);
            harmOsc.frequency.exponentialRampToValueAtTime(2000 * mult, now + 1.5);

            harmGain.gain.setValueAtTime(0.03 / (i + 1), now);
            harmGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

            harmOsc.connect(harmGain);
            harmGain.connect(masterGain);

            harmOsc.start(now + i * 0.1);
            harmOsc.stop(now + 2);
        });
    } else if (type === 'question') {
        // Descending tone - doubt creeping in
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.8);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.1);
        gain.gain.setValueAtTime(0.04, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 1.1);
    }
}

/**
 * Create the message journey visualization
 */
function createMessageJourney(message: string): void {
    if (!journeyContainer) return;

    journeyContainer.innerHTML = '';
    journeyContainer.classList.add('active');

    // Create the traveling message
    const messageEl = document.createElement('div');
    messageEl.className = 'traveling-message';
    messageEl.textContent = message.substring(0, 50) + (message.length > 50 ? '...' : '');
    journeyContainer.appendChild(messageEl);

    // Create expanding rings
    for (let i = 0; i < 5; i++) {
        const ring = document.createElement('div');
        ring.className = 'transmission-ring';
        ring.style.animationDelay = `${i * 0.8}s`;
        journeyContainer.appendChild(ring);
    }

    // Create distant stars that the message passes
    const stars = ['Alpha Centauri', 'Barnard\'s Star', 'Sirius', 'Tau Ceti', 'Epsilon Eridani'];
    stars.forEach((name, i) => {
        const star = document.createElement('div');
        star.className = 'transmission-star';
        star.dataset.name = name;

        // Position in arc
        const angle = (Math.PI * 0.3) + (i / stars.length) * Math.PI * 0.4;
        const distance = 30 + i * 15;
        star.style.left = `${50 + Math.cos(angle) * distance}%`;
        star.style.top = `${80 - Math.sin(angle) * distance * 0.8}%`;
        star.style.animationDelay = `${2 + i * 1.5}s`;

        journeyContainer!.appendChild(star);
    });

    // Play send sound
    playTransmissionSound('send');

    // Start showing questions after journey begins
    setTimeout(() => showNextQuestion(), 4000);
}

/**
 * Show the next philosophical question
 */
function showNextQuestion(): void {
    if (!questionsContainer || state.questionsShown >= QUESTIONS.length) return;

    const question = QUESTIONS[state.questionsShown];
    const questionEl = document.createElement('div');
    questionEl.className = 'transmission-question';
    questionEl.textContent = question;

    questionsContainer.appendChild(questionEl);

    // Animate in
    requestAnimationFrame(() => {
        questionEl.classList.add('visible');
    });

    playTransmissionSound('question');
    state.questionsShown++;

    // Show next question after delay
    if (state.questionsShown < QUESTIONS.length) {
        setTimeout(() => showNextQuestion(), 3000);
    } else {
        // All questions shown - add final reflection
        setTimeout(() => showFinalReflection(), 3500);
    }
}

/**
 * Show final reflection after all questions
 */
function showFinalReflection(): void {
    if (!questionsContainer) return;

    const reflection = document.createElement('div');
    reflection.className = 'transmission-reflection';
    reflection.innerHTML = `
        <p>Your message travels at the speed of light.</p>
        <p>It will reach the nearest star in 4.24 years.</p>
        <p>Any response would take another 4.24 years.</p>
        <p class="reflection-final">In the silence between, you must simply trust.</p>
    `;

    questionsContainer.appendChild(reflection);

    requestAnimationFrame(() => {
        reflection.classList.add('visible');
    });
}

/**
 * Handle message submission
 */
function submitMessage(): void {
    if (!inputEl || state.submitted || !state.message.trim()) return;

    state.submitted = true;

    // Save to localStorage
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            message: state.message,
            timestamp: Date.now()
        }));
    } catch (e) {
        // Ignore storage errors
    }

    // Hide input, show journey
    if (container) {
        container.classList.add('submitted');
    }

    // Start the journey visualization
    setTimeout(() => {
        createMessageJourney(state.message);
    }, 500);
}

/**
 * Handle input changes
 */
function handleInput(): void {
    if (!inputEl || !countEl || !submitBtn) return;

    state.message = inputEl.value;
    const remaining = MAX_CHARS - state.message.length;

    countEl.textContent = `${remaining}`;
    countEl.classList.toggle('warning', remaining < 50);
    countEl.classList.toggle('danger', remaining < 20);

    submitBtn.disabled = state.message.trim().length === 0 || remaining < 0;

    // Occasional keypress sound
    if (Math.random() < 0.3) {
        playTransmissionSound('keypress');
    }
}

/**
 * Check for previously submitted message
 */
function loadSavedMessage(): boolean {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            state.message = data.message;
            state.submitted = true;
            return true;
        }
    } catch (e) {
        // Ignore
    }
    return false;
}

/**
 * Reset transmission (for testing)
 */
export function resetTransmission(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        // Ignore
    }

    state = {
        message: '',
        submitted: false,
        questionsShown: 0
    };

    if (container) {
        container.classList.remove('submitted');
    }
    if (journeyContainer) {
        journeyContainer.innerHTML = '';
        journeyContainer.classList.remove('active');
    }
    if (questionsContainer) {
        questionsContainer.innerHTML = '';
    }
    if (inputEl) {
        inputEl.value = '';
        inputEl.disabled = false;
    }
    if (submitBtn) {
        submitBtn.disabled = false;
    }
    if (countEl) {
        countEl.textContent = `${MAX_CHARS}`;
        countEl.classList.remove('warning', 'danger');
    }
}

/**
 * Initialize the transmission component
 */
export function initTransmission(): void {
    container = document.getElementById('transmission-container');
    if (!container) return;

    // Check for saved message first
    const hasSaved = loadSavedMessage();

    // Create input section
    const inputSection = document.createElement('div');
    inputSection.className = 'transmission-input-section';

    const prompt = document.createElement('div');
    prompt.className = 'transmission-prompt';
    prompt.innerHTML = `
        <p class="prompt-main">You have one chance to send a message into the void.</p>
        <p class="prompt-sub">What would you say to a civilization that might be listening?</p>
    `;

    inputEl = document.createElement('textarea');
    inputEl.className = 'transmission-input';
    inputEl.placeholder = 'Compose your message...';
    inputEl.maxLength = MAX_CHARS;
    inputEl.addEventListener('input', handleInput);

    const controls = document.createElement('div');
    controls.className = 'transmission-controls';

    countEl = document.createElement('span');
    countEl.className = 'char-count';
    countEl.textContent = `${MAX_CHARS}`;

    submitBtn = document.createElement('button');
    submitBtn.className = 'ascii-btn transmission-send';
    submitBtn.textContent = 'TRANSMIT';
    submitBtn.disabled = true;
    submitBtn.addEventListener('click', submitMessage);

    controls.appendChild(countEl);
    controls.appendChild(submitBtn);

    inputSection.appendChild(prompt);
    inputSection.appendChild(inputEl);
    inputSection.appendChild(controls);

    // Create journey visualization container
    journeyContainer = document.createElement('div');
    journeyContainer.className = 'transmission-journey';

    // Create questions container
    questionsContainer = document.createElement('div');
    questionsContainer.className = 'transmission-questions';

    container.appendChild(inputSection);
    container.appendChild(journeyContainer);
    container.appendChild(questionsContainer);

    // If there's a saved message, show the aftermath
    if (hasSaved) {
        container.classList.add('submitted');
        setTimeout(() => {
            createMessageJourney(state.message);
        }, 500);
    }
}
