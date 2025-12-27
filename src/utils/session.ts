// Session tracking utilities for reading progress and return visits

import { saveData, loadData } from './persistence';

export interface SectionTime {
    sectionId: string;
    timeSpent: number; // milliseconds
    visits: number;
}

export interface ReadingSession {
    id: string;
    startTime: number;
    endTime?: number;
    scrollDepth: number;
    sectionsVisited: string[];
    sectionTimes: Record<string, SectionTime>;
    lastSection: string;
    completedReading: boolean;
}

export interface ReaderProfile {
    firstVisit: number;
    visitCount: number;
    totalTimeSpent: number;
    lastVisit: number;
    lastSection: string;
    choicesMade: Record<string, string>;
    scrollDepthMax: number;
    mostTimeSection: string;
    completedReading: boolean;
    sessions: ReadingSession[];
}

const PROFILE_KEY = 'reader-profile';
const CURRENT_SESSION_KEY = 'current-session';
const SECTION_TRACKING_INTERVAL = 1000; // Track section time every second

let currentSession: ReadingSession | null = null;
let currentSection = 'intro';
let sectionStartTime = 0;
let trackingInterval: number | null = null;

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get or create reader profile
 */
export function getReaderProfile(): ReaderProfile {
    const stored = loadData<ReaderProfile>(PROFILE_KEY);

    if (stored) {
        return stored;
    }

    // New reader
    const newProfile: ReaderProfile = {
        firstVisit: Date.now(),
        visitCount: 0,
        totalTimeSpent: 0,
        lastVisit: Date.now(),
        lastSection: 'intro',
        choicesMade: {},
        scrollDepthMax: 0,
        mostTimeSection: '',
        completedReading: false,
        sessions: []
    };

    return newProfile;
}

/**
 * Check if this is a returning reader
 */
export function isReturningReader(): boolean {
    const profile = getReaderProfile();
    return profile.visitCount > 0;
}

/**
 * Get time since last visit
 */
export function getTimeSinceLastVisit(): number {
    const profile = getReaderProfile();
    return Date.now() - profile.lastVisit;
}

/**
 * Get formatted time since last visit
 */
export function getFormattedTimeSinceLastVisit(): string {
    const ms = getTimeSinceLastVisit();
    const hours = ms / (1000 * 60 * 60);
    const days = hours / 24;

    if (days >= 1) {
        const d = Math.floor(days);
        return d === 1 ? '1 day' : `${d} days`;
    } else if (hours >= 1) {
        const h = Math.floor(hours);
        return h === 1 ? '1 hour' : `${h} hours`;
    } else {
        const minutes = Math.floor(ms / (1000 * 60));
        return minutes <= 1 ? 'a moment' : `${minutes} minutes`;
    }
}

/**
 * Start a new reading session
 */
export function startSession(): void {
    const profile = getReaderProfile();

    currentSession = {
        id: generateSessionId(),
        startTime: Date.now(),
        scrollDepth: 0,
        sectionsVisited: [],
        sectionTimes: {},
        lastSection: 'intro',
        completedReading: false
    };

    // Update profile
    profile.visitCount++;
    profile.lastVisit = Date.now();
    saveData(PROFILE_KEY, profile);

    // Start section timing
    currentSection = 'intro';
    sectionStartTime = Date.now();
    startSectionTracking();
}

/**
 * Start the section tracking interval
 */
function startSectionTracking(): void {
    if (trackingInterval) return;

    trackingInterval = window.setInterval(() => {
        if (currentSession && currentSection) {
            updateSectionTime();
        }
    }, SECTION_TRACKING_INTERVAL);
}

/**
 * Update time spent in current section
 */
function updateSectionTime(): void {
    if (!currentSession) return;

    const timeSpent = Date.now() - sectionStartTime;

    if (!currentSession.sectionTimes[currentSection]) {
        currentSession.sectionTimes[currentSection] = {
            sectionId: currentSection,
            timeSpent: 0,
            visits: 1
        };
    }

    currentSession.sectionTimes[currentSection].timeSpent = timeSpent;
}

/**
 * Track when the reader enters a new section
 */
export function enterSection(sectionId: string): void {
    if (!currentSession) return;

    // Finalize time for previous section
    if (currentSection && currentSection !== sectionId) {
        updateSectionTime();

        // Add time to previous section's total
        const prevTime = currentSession.sectionTimes[currentSection];
        if (prevTime) {
            const timeSpent = Date.now() - sectionStartTime;
            currentSession.sectionTimes[currentSection].timeSpent += timeSpent;
        }
    }

    // Start timing new section
    currentSection = sectionId;
    sectionStartTime = Date.now();

    // Track visit
    if (!currentSession.sectionsVisited.includes(sectionId)) {
        currentSession.sectionsVisited.push(sectionId);
    }

    // Update section visits count
    if (!currentSession.sectionTimes[sectionId]) {
        currentSession.sectionTimes[sectionId] = {
            sectionId,
            timeSpent: 0,
            visits: 0
        };
    }
    currentSession.sectionTimes[sectionId].visits++;

    currentSession.lastSection = sectionId;

    // Save current session state
    saveData(CURRENT_SESSION_KEY, currentSession);
}

/**
 * Update scroll depth
 */
export function updateScrollDepth(depth: number): void {
    if (!currentSession) return;

    if (depth > currentSession.scrollDepth) {
        currentSession.scrollDepth = depth;
    }

    // Check if reached the end
    if (depth > 0.95) {
        currentSession.completedReading = true;
    }
}

/**
 * Record a choice made by the reader
 */
export function recordChoice(choiceId: string, value: string): void {
    const profile = getReaderProfile();
    profile.choicesMade[choiceId] = value;
    saveData(PROFILE_KEY, profile);
}

/**
 * Get a specific choice the reader made
 */
export function getChoice(choiceId: string): string | null {
    const profile = getReaderProfile();
    return profile.choicesMade[choiceId] || null;
}

/**
 * End the current session and save to profile
 */
export function endSession(): void {
    if (!currentSession) return;

    // Stop tracking
    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }

    // Finalize current section time
    updateSectionTime();

    // Mark end time
    currentSession.endTime = Date.now();

    // Update profile
    const profile = getReaderProfile();
    const sessionDuration = (currentSession.endTime || Date.now()) - currentSession.startTime;

    profile.totalTimeSpent += sessionDuration;
    profile.lastSection = currentSession.lastSection;

    if (currentSession.scrollDepth > profile.scrollDepthMax) {
        profile.scrollDepthMax = currentSession.scrollDepth;
    }

    if (currentSession.completedReading) {
        profile.completedReading = true;
    }

    // Calculate most time section across all sessions
    const allSectionTimes: Record<string, number> = {};
    profile.sessions.forEach(s => {
        Object.entries(s.sectionTimes).forEach(([id, time]) => {
            allSectionTimes[id] = (allSectionTimes[id] || 0) + time.timeSpent;
        });
    });

    // Add current session times
    Object.entries(currentSession.sectionTimes).forEach(([id, time]) => {
        allSectionTimes[id] = (allSectionTimes[id] || 0) + time.timeSpent;
    });

    let maxTime = 0;
    let maxSection = '';
    Object.entries(allSectionTimes).forEach(([id, time]) => {
        if (time > maxTime) {
            maxTime = time;
            maxSection = id;
        }
    });
    profile.mostTimeSection = maxSection;

    // Keep only last 10 sessions
    profile.sessions.push(currentSession);
    if (profile.sessions.length > 10) {
        profile.sessions = profile.sessions.slice(-10);
    }

    saveData(PROFILE_KEY, profile);
    currentSession = null;
}

/**
 * Get insights about the reader's journey
 */
export interface ReadingInsights {
    isReturning: boolean;
    timeSinceLastVisit: string;
    lastSection: string;
    lastSectionName: string;
    visitCount: number;
    totalTimeFormatted: string;
    mostTimeSection: string;
    mostTimeSectionName: string;
    completedReading: boolean;
    scrollDepth: number;
    choicesMade: Record<string, string>;
}

const SECTION_NAMES: Record<string, string> = {
    'intro': 'the introduction',
    'hero': 'the opening',
    'steelman': 'the Dark Forest argument',
    'cracks': 'the cracks in the theory',
    'pluribus': 'Carol\'s story',
    'alternatives': 'alternative hypotheses',
    'assessment': 'the final assessment',
    'transmission': 'the transmission',
    'credence': 'the belief mapping',
    'real-sky': 'the real sky'
};

export function getReadingInsights(): ReadingInsights {
    const profile = getReaderProfile();

    // Format total time
    const totalMinutes = Math.floor(profile.totalTimeSpent / (1000 * 60));
    let totalTimeFormatted: string;
    if (totalMinutes < 1) {
        totalTimeFormatted = 'less than a minute';
    } else if (totalMinutes === 1) {
        totalTimeFormatted = '1 minute';
    } else if (totalMinutes < 60) {
        totalTimeFormatted = `${totalMinutes} minutes`;
    } else {
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        totalTimeFormatted = hours === 1
            ? `1 hour${mins > 0 ? ` ${mins}m` : ''}`
            : `${hours} hours${mins > 0 ? ` ${mins}m` : ''}`;
    }

    return {
        isReturning: profile.visitCount > 0,
        timeSinceLastVisit: getFormattedTimeSinceLastVisit(),
        lastSection: profile.lastSection,
        lastSectionName: SECTION_NAMES[profile.lastSection] || profile.lastSection,
        visitCount: profile.visitCount,
        totalTimeFormatted,
        mostTimeSection: profile.mostTimeSection,
        mostTimeSectionName: SECTION_NAMES[profile.mostTimeSection] || profile.mostTimeSection,
        completedReading: profile.completedReading,
        scrollDepth: Math.round(profile.scrollDepthMax * 100),
        choicesMade: profile.choicesMade
    };
}

/**
 * Initialize session tracking
 * Sets up scroll tracking and section detection
 */
export function initSessionTracking(): void {
    startSession();

    // Track scroll depth
    let maxScroll = 0;
    window.addEventListener('scroll', () => {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;

        if (scrollPercent > maxScroll) {
            maxScroll = scrollPercent;
            updateScrollDepth(scrollPercent);
        }
    }, { passive: true });

    // Detect section changes via Intersection Observer
    const sections = document.querySelectorAll('section[id]');
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
                    enterSection(entry.target.id);
                }
            });
        },
        { threshold: [0.3] }
    );

    sections.forEach(section => observer.observe(section));

    // End session when page unloads
    window.addEventListener('beforeunload', () => {
        endSession();
    });

    // Also end session on visibility change (mobile)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            endSession();
        } else if (document.visibilityState === 'visible' && !currentSession) {
            startSession();
        }
    });
}

/**
 * Reset all reading data (for testing)
 */
export function resetReadingData(): void {
    try {
        localStorage.removeItem('dark-forest-' + PROFILE_KEY);
        localStorage.removeItem('dark-forest-' + CURRENT_SESSION_KEY);
    } catch {
        // Ignore
    }
    currentSession = null;
}
