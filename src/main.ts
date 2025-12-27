// Import styles
import './styles/index.css';

// Import visualizations
import {
    initStarfield,
    initNebulae,
    initCosmicEvents,
    initConstellations,
    initHeroForest,
    initGlassForest,
    initThermo,
    initSignal,
    initChain,
    initSuspicionChain,
    initPayoffMatrix,
    initLightCone,
    initJoining,
    initCarolChoice,
    initWindow,
    initMirror,
    initRealSky,
    resetRealSky
} from './visualizations';

// Import audio
import { initAmbientAudio } from './audio';

// Import components
import { initTransmission, resetTransmission } from './components/transmission';
import { initCredenceInput, resetCredences } from './components/credence-input';
import { initReturnGreeting, forceShowGreeting } from './components/return-greeting';

// Import session tracking
import { initSessionTracking, resetReadingData } from './utils/session';

// Import utilities
import { initSmoothScroll, initCollapsibles, initCredenceAnimation, initMobileNav } from './utils';

// Register service worker for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .catch(() => {
                // Service worker registration failed - continue without it
            });
    });
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Visualizations
    initNebulae();  // Initialize nebulae first (behind stars)
    initStarfield();
    initCosmicEvents();  // Rare astronomical phenomena
    initConstellations();  // Star patterns with distance info
    initHeroForest();
    initGlassForest();
    initThermo();
    initSignal();
    initChain();
    initSuspicionChain();
    initPayoffMatrix();
    initLightCone();
    initJoining();
    initCarolChoice();
    initWindow();
    initMirror();

    // Utilities
    initMobileNav();  // Mobile hamburger menu
    initCollapsibles();
    initCredenceAnimation();
    initSmoothScroll();

    // Audio
    initAmbientAudio();

    // Components
    initTransmission();
    initCredenceInput();
    initReturnGreeting();  // Welcome back returning readers

    // Phase 8: The Return
    initRealSky();
    initSessionTracking();  // Track reading progress
});

// Import interactive functions
import {
    resetGlassForest,
    setAllTrust,
    setGameMode,
    sendChainPulse,
    resetChain,
    resetSuspicionChain,
    resetPayoffMatrix,
    resetLightCone,
    startJoining,
    resetJoining,
    resetCarolChoice
} from './visualizations';

// Expose interactive functions globally for onclick handlers
declare global {
    interface Window {
        resetGlassForest: typeof resetGlassForest;
        setAllTrust: typeof setAllTrust;
        setGameMode: typeof setGameMode;
        sendChainPulse: typeof sendChainPulse;
        resetChain: typeof resetChain;
        resetSuspicionChain: typeof resetSuspicionChain;
        resetPayoffMatrix: typeof resetPayoffMatrix;
        resetLightCone: typeof resetLightCone;
        startJoining: typeof startJoining;
        resetJoining: typeof resetJoining;
        resetCarolChoice: typeof resetCarolChoice;
        resetTransmission: typeof resetTransmission;
        resetCredences: typeof resetCredences;
        resetRealSky: typeof resetRealSky;
        forceShowGreeting: typeof forceShowGreeting;
        resetReadingData: typeof resetReadingData;
    }
}

window.resetGlassForest = resetGlassForest;
window.setAllTrust = setAllTrust;
window.setGameMode = setGameMode;
window.sendChainPulse = sendChainPulse;
window.resetChain = resetChain;
window.resetSuspicionChain = resetSuspicionChain;
window.resetPayoffMatrix = resetPayoffMatrix;
window.resetLightCone = resetLightCone;
window.startJoining = startJoining;
window.resetJoining = resetJoining;
window.resetCarolChoice = resetCarolChoice;
window.resetTransmission = resetTransmission;
window.resetCredences = resetCredences;
window.resetRealSky = resetRealSky;
window.forceShowGreeting = forceShowGreeting;
window.resetReadingData = resetReadingData;
