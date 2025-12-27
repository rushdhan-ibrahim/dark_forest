/**
 * Mobile navigation handling - hamburger menu with drawer
 */

let isOpen = false;
let hamburger: HTMLButtonElement | null = null;
let drawer: HTMLElement | null = null;
let overlay: HTMLElement | null = null;
let focusableElements: HTMLElement[] = [];
let lastFocusedElement: HTMLElement | null = null;

/**
 * Initialize mobile navigation
 */
export function initMobileNav(): void {
    hamburger = document.querySelector('.nav-hamburger');
    drawer = document.getElementById('nav-drawer');
    overlay = document.getElementById('nav-overlay');

    if (!hamburger || !drawer || !overlay) return;

    // Toggle on hamburger click
    hamburger.addEventListener('click', toggleNav);

    // Close on overlay click
    overlay.addEventListener('click', closeNav);

    // Close on escape key
    document.addEventListener('keydown', handleKeyDown);

    // Close when clicking a nav link (for smooth scroll navigation)
    const links = drawer.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', () => {
            // Small delay to allow scroll to start
            setTimeout(closeNav, 100);
        });
    });

    // Update focusable elements list
    updateFocusableElements();
}

/**
 * Toggle navigation open/closed
 */
export function toggleNav(): void {
    if (isOpen) {
        closeNav();
    } else {
        openNav();
    }
}

/**
 * Open the navigation drawer
 */
export function openNav(): void {
    if (!hamburger || !drawer || !overlay) return;

    isOpen = true;
    lastFocusedElement = document.activeElement as HTMLElement;

    hamburger.setAttribute('aria-expanded', 'true');
    drawer.classList.add('open');
    overlay.classList.add('open');

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Focus first link in drawer
    updateFocusableElements();
    if (focusableElements.length > 0) {
        focusableElements[0].focus();
    }
}

/**
 * Close the navigation drawer
 */
export function closeNav(): void {
    if (!hamburger || !drawer || !overlay) return;

    isOpen = false;

    hamburger.setAttribute('aria-expanded', 'false');
    drawer.classList.remove('open');
    overlay.classList.remove('open');

    // Restore body scroll
    document.body.style.overflow = '';

    // Return focus to hamburger button
    if (lastFocusedElement) {
        lastFocusedElement.focus();
    }
}

/**
 * Handle keyboard navigation
 */
function handleKeyDown(e: KeyboardEvent): void {
    if (!isOpen) return;

    if (e.key === 'Escape') {
        closeNav();
        return;
    }

    // Trap focus within drawer
    if (e.key === 'Tab') {
        trapFocus(e);
    }
}

/**
 * Trap focus within the drawer when open
 */
function trapFocus(e: KeyboardEvent): void {
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
        // Shift + Tab - going backwards
        if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
        }
    } else {
        // Tab - going forwards
        if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
        }
    }
}

/**
 * Update list of focusable elements in drawer
 */
function updateFocusableElements(): void {
    if (!drawer) return;

    focusableElements = Array.from(
        drawer.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
    );
}

/**
 * Check if mobile nav is currently open
 */
export function isMobileNavOpen(): boolean {
    return isOpen;
}
