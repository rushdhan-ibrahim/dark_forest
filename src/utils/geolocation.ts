// Geolocation utilities for location-based sky rendering

export interface Location {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
    isRealLocation?: boolean;  // True if from geolocation API, false if fallback
}

export interface Hemisphere {
    north: boolean;
    name: string;
}

const STORAGE_KEY = 'dark-forest-location';

let cachedLocation: Location | null = null;

/**
 * Attempt to get the user's location via Geolocation API
 */
export async function requestLocation(): Promise<Location | null> {
    if (!navigator.geolocation) {
        return null;
    }

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const location: Location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    isRealLocation: true
                };

                // Try to get city/region name via reverse geocoding
                try {
                    const cityInfo = await reverseGeocode(location.latitude, location.longitude);
                    if (cityInfo) {
                        location.city = cityInfo.city;
                        location.country = cityInfo.country;
                    }
                } catch {
                    // Ignore geocoding errors - we still have coordinates
                }

                cachedLocation = location;
                saveLocation(location);
                resolve(location);
            },
            () => {
                // Permission denied or error
                resolve(null);
            },
            {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 3600000 // 1 hour cache
            }
        );
    });
}

/**
 * Reverse geocoding using OpenStreetMap Nominatim API
 * Returns city and country name from coordinates
 */
async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; country: string } | null> {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
            {
                headers: {
                    'Accept-Language': 'en',
                    'User-Agent': 'DarkForest/1.0'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Geocoding request failed');
        }

        const data = await response.json();

        if (data && data.address) {
            // Try to get the most specific location name
            const city = data.address.city ||
                        data.address.town ||
                        data.address.village ||
                        data.address.municipality ||
                        data.address.county ||
                        data.address.state ||
                        '';

            const country = data.address.country || '';

            if (city || country) {
                return { city, country };
            }
        }

        return null;
    } catch {
        // Geocoding failed - return null, caller will handle fallback
        return null;
    }
}

/**
 * Get the hemisphere for a location
 */
export function getHemisphere(location: Location): Hemisphere {
    return {
        north: location.latitude >= 0,
        name: location.latitude >= 0 ? 'Northern' : 'Southern'
    };
}

/**
 * Get stored location (only returns real locations from geolocation API)
 */
export function getStoredLocation(): Location | null {
    if (cachedLocation && cachedLocation.isRealLocation) {
        return cachedLocation;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const location = JSON.parse(stored) as Location;
            // Only return if it's a real location from geolocation API
            if (location.isRealLocation) {
                cachedLocation = location;
                return cachedLocation;
            }
        }
    } catch {
        // Ignore
    }
    return null;
}

/**
 * Save location to storage (only saves real locations)
 */
function saveLocation(location: Location): void {
    if (!location.isRealLocation) return;  // Don't save fallback locations

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
    } catch {
        // Ignore
    }
}

/**
 * Clear stored location
 */
export function clearStoredLocation(): void {
    cachedLocation = null;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Ignore
    }
}

/**
 * Get a fallback location based on browser timezone
 * These are approximate and marked as non-real locations
 */
export function getFallbackLocation(): Location {
    const hemisphere = getTimezoneHemisphere();

    // Return a location at the center of the relevant hemisphere
    // We don't use specific cities to avoid confusion
    if (hemisphere === 'southern') {
        return {
            latitude: -33.0,
            longitude: 150.0,
            isRealLocation: false
        };
    }

    // Default to northern hemisphere
    return {
        latitude: 40.0,
        longitude: -100.0,
        isRealLocation: false
    };
}

/**
 * Determine hemisphere from timezone
 */
function getTimezoneHemisphere(): 'northern' | 'southern' {
    try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Southern hemisphere timezones
        if (
            timezone.includes('Australia') ||
            timezone.includes('Auckland') ||
            timezone.includes('Pacific/Fiji') ||
            timezone.includes('Antarctica') ||
            timezone.includes('America/Sao_Paulo') ||
            timezone.includes('America/Buenos_Aires') ||
            timezone.includes('Africa/Johannesburg') ||
            timezone.includes('Africa/Cape')
        ) {
            return 'southern';
        }
    } catch {
        // Ignore
    }

    return 'northern';
}

/**
 * Get current location (cached real location, stored real location, or null)
 * Does NOT return fallback - caller should handle fallback case
 */
export function getCurrentLocation(): Location | null {
    const stored = getStoredLocation();
    if (stored && stored.isRealLocation) {
        return stored;
    }
    return null;
}

/**
 * Check if we have a real (geolocation-based) location
 */
export function hasRealLocation(): boolean {
    return getCurrentLocation() !== null;
}

/**
 * Calculate if it's currently night at a location
 */
export function isNightAt(location: Location): boolean {
    const now = new Date();

    // Simple approximation based on time and longitude
    // Calculate local solar time
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
    const solarOffset = location.longitude / 15; // 15 degrees per hour
    const localSolarHour = (utcHours + solarOffset + 24) % 24;

    // Night is roughly 6pm to 6am local solar time
    return localSolarHour < 6 || localSolarHour > 18;
}

/**
 * Get visible constellations based on location and time
 * Returns indices of constellations that are visible from this hemisphere/season
 */
export function getVisibleConstellationIndices(location: Location): number[] {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const hemisphere = getHemisphere(location);

    // Constellation visibility by hemisphere and season
    // Indices correspond to constellations.json order:
    // 0: Orion, 1: Ursa Major, 2: Cassiopeia, 3: Cygnus, 4: Scorpius, 5: Leo

    if (hemisphere.north) {
        // Northern hemisphere
        if (month >= 11 || month <= 2) {
            // Winter: Orion prominent, Cassiopeia, Ursa Major
            return [0, 1, 2];
        } else if (month >= 3 && month <= 5) {
            // Spring: Leo, Ursa Major
            return [1, 2, 5];
        } else if (month >= 6 && month <= 8) {
            // Summer: Cygnus, Scorpius (low), Cassiopeia
            return [2, 3, 4];
        } else {
            // Autumn: Cassiopeia, Cygnus, Ursa Major
            return [1, 2, 3];
        }
    } else {
        // Southern hemisphere (seasons reversed)
        if (month >= 11 || month <= 2) {
            // Summer: Scorpius prominent, Cygnus visible
            return [3, 4];
        } else if (month >= 3 && month <= 5) {
            // Autumn: Scorpius setting, Orion rising
            return [0, 4];
        } else if (month >= 6 && month <= 8) {
            // Winter: Orion prominent
            return [0, 5];
        } else {
            // Spring: Leo, Cygnus rising
            return [3, 5];
        }
    }
}
