// ═══════════════════════════════════════════════════════════════════════════
// HAPTIC ENGINE FOR "THE DARK FOREST"
// iOS Safari 17.4+ compatible via <input switch> workaround
// Android/Chrome compatible via Vibration API
// Based on iOS_Haptics_Design_Document.md
// ═══════════════════════════════════════════════════════════════════════════

// ─── STATE ───
let enabled = true;
let lastTapTime = 0;
const MIN_TAP_INTERVAL = 50; // Prevent overwhelming the Taptic Engine
let debugMode = false;

// Track if we've been "armed" by a user gesture
let userGestureReceived = false;

// ─── PLATFORM DETECTION ───
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(navigator.userAgent);
const hasVibration = 'vibrate' in navigator;

// Safari version detection for switch support
const isSafari17Plus = (() => {
  const match = navigator.userAgent.match(/Version\/(\d+)\.(\d+)/);
  if (match) {
    const major = parseInt(match[1]);
    const minor = parseInt(match[2]);
    return major > 17 || (major === 17 && minor >= 4);
  }
  // Chrome on iOS also uses WebKit and supports the switch
  if (isIOS && /CriOS/.test(navigator.userAgent)) {
    return true; // Chrome on iOS 17.4+ should work
  }
  return false;
})();

// On iOS, we can always try (worst case nothing happens)
// On Android, we need Vibration API
const canHaptic = isIOS || (hasVibration && isAndroid);

// ─── HIDDEN SWITCH ELEMENT ───
let switchContainer: HTMLElement | null = null;
let switchInput: HTMLInputElement | null = null;
let switchLabel: HTMLLabelElement | null = null;

function createSwitch(): void {
  if (!isIOS) return;
  if (switchContainer) return; // Already created

  switchContainer = document.createElement('div');
  switchContainer.id = 'haptic-trigger';
  switchContainer.setAttribute('aria-hidden', 'true');
  switchContainer.style.cssText = `
    position: fixed !important;
    top: -9999px !important;
    left: -9999px !important;
    width: 1px !important;
    height: 1px !important;
    opacity: 0 !important;
    pointer-events: none !important;
    visibility: hidden !important;
    z-index: -9999 !important;
  `;

  switchInput = document.createElement('input');
  switchInput.type = 'checkbox';
  switchInput.id = 'haptic-switch';
  switchInput.setAttribute('switch', '');

  switchLabel = document.createElement('label');
  switchLabel.setAttribute('for', 'haptic-switch');

  switchContainer.appendChild(switchInput);
  switchContainer.appendChild(switchLabel);
  document.body.appendChild(switchContainer);
}

// Auto-create switch when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createSwitch);
  } else {
    createSwitch();
  }
}

// ─── CORE HAPTIC FUNCTION ───
function triggerTap(): boolean {
  if (!enabled || !canHaptic) return false;

  const now = performance.now();
  if (now - lastTapTime < MIN_TAP_INTERVAL) return false;
  lastTapTime = now;

  if (isIOS) {
    // Ensure switch is created
    if (!switchLabel) {
      createSwitch();
    }
    // Try to trigger haptic
    if (switchLabel) {
      switchLabel.click();
      if (debugMode) console.log('[Haptic] iOS tap triggered');
      return true;
    }
    if (debugMode) console.log('[Haptic] iOS switch not available');
    return false;
  } else if (hasVibration && isAndroid) {
    navigator.vibrate(10);
    if (debugMode) console.log('[Haptic] Android vibrate triggered');
    return true;
  }
  return false;
}

/**
 * Call this from user gesture handlers to "arm" the haptic system
 * This helps ensure the switch is properly initialized
 */
export function armHaptics(): void {
  userGestureReceived = true;
  if (isIOS && !switchLabel) {
    createSwitch();
  }
  if (debugMode) console.log('[Haptic] Armed by user gesture');
}

// ═══════════════════════════════════════════════════════════════════════════
// UI INTERACTION HAPTICS - One-shot patterns for user actions
// NOTE: iOS Safari only triggers haptics from direct user gestures (tap, click)
// Timeline-synced haptics (requestAnimationFrame, touchmove) don't work on iOS
// ═══════════════════════════════════════════════════════════════════════════

/** Single tap - for UI selections */
export function tap(): void {
  triggerTap();
}

/** Double tap - confirmation feel */
export function confirm(): void {
  if (!enabled || !canHaptic) return;
  triggerTap();
  setTimeout(() => triggerTap(), 100);
}

/** Triple tap - warning/error feel */
export function warn(): void {
  if (!enabled || !canHaptic) return;
  triggerTap();
  setTimeout(() => triggerTap(), 80);
  setTimeout(() => triggerTap(), 160);
}

/** Custom pattern - array of intervals between taps */
export function pattern(intervals: number[]): void {
  if (!enabled || !canHaptic) return;
  let delay = 0;
  triggerTap();
  intervals.forEach(interval => {
    delay += interval;
    setTimeout(() => triggerTap(), delay);
  });
}

/** Rapid pulse - count taps at interval */
export function pulse(count: number, interval: number = 150): void {
  if (!enabled || !canHaptic) return;
  for (let i = 0; i < count; i++) {
    setTimeout(() => triggerTap(), i * interval);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLASS FOREST HAPTICS
// ═══════════════════════════════════════════════════════════════════════════

/** Chain reaction starting - ominous */
export function chainStart(): void {
  if (!enabled || !canHaptic) return;
  triggerTap();
  setTimeout(() => triggerTap(), 60);
  setTimeout(() => triggerTap(), 110);
}

/** Accelerating cascade of destruction */
export function chainCascade(): void {
  if (!enabled || !canHaptic) return;
  // Accelerating pattern
  const intervals = [80, 60, 45, 35, 25, 20];
  let delay = 0;
  triggerTap();
  intervals.forEach(interval => {
    delay += interval;
    setTimeout(() => triggerTap(), delay);
  });
}

/** Heavy impact - mutual destruction */
export function heavyImpact(): void {
  if (!enabled || !canHaptic) return;
  triggerTap();
  setTimeout(() => triggerTap(), 30);
  setTimeout(() => triggerTap(), 55);
}

// ═══════════════════════════════════════════════════════════════════════════
// EYE TRACKING HAPTICS
// ═══════════════════════════════════════════════════════════════════════════

/** Eye focus - when eyes lock onto user position (touchstart) */
export function eyeFocus(): void {
  if (!enabled || !canHaptic) return;
  triggerTap();
}

/** Eyes alert - all eyes suddenly focus on user */
export function eyesAlert(): void {
  if (!enabled || !canHaptic) return;
  triggerTap();
  setTimeout(() => triggerTap(), 80);
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Check if haptics are available */
export function isSupported(): boolean {
  return canHaptic;
}

/** Toggle haptics on/off */
export function toggle(): boolean {
  enabled = !enabled;
  return enabled;
}

/** Set enabled state */
export function setEnabled(value: boolean): void {
  enabled = value;
}

/** Get enabled state */
export function isEnabled(): boolean {
  return enabled;
}

/** Cancel any ongoing vibration (Android only) */
export function cancel(): void {
  if (hasVibration && isAndroid) {
    navigator.vibrate(0);
  }
}

/** Enable debug logging */
export function setDebug(value: boolean): void {
  debugMode = value;
  console.log(`[Haptics] Debug mode ${value ? 'enabled' : 'disabled'}`);
}

/** Get platform info for debugging */
export function getDebugInfo(): object {
  return {
    isIOS,
    isAndroid,
    isSafari17Plus,
    hasVibration,
    canHaptic,
    enabled,
    userGestureReceived,
    switchCreated: !!switchLabel
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export const haptics = {
  // One-shot UI patterns (triggered by user gestures)
  tap,
  confirm,
  warn,
  pattern,
  pulse,

  // Glass Forest (triggered by button clicks)
  chainStart,
  chainCascade,
  heavyImpact,

  // Eye Tracking (triggered by touchstart)
  eyeFocus,
  eyesAlert,

  // Utility
  isSupported,
  toggle,
  setEnabled,
  isEnabled,
  cancel,
  armHaptics,
  setDebug,
  getDebugInfo
};

export default haptics;

// Expose to window for debugging in console
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).haptics = haptics;
}

// Log availability on load
if (typeof console !== 'undefined') {
  console.log(`[Haptics] ${canHaptic ? 'Available' : 'Not available'} (iOS: ${isIOS}, Safari17+: ${isSafari17Plus}, Vibration: ${hasVibration})`);
}
