# The Dark Forest: Design Philosophy & Patterns

This document captures the technical and creative patterns that guide implementation decisions. It serves as a reference for maintaining consistency as the project evolves.

---

## I. Core Design Principles

### 1. Meaning Before Spectacle

Every visual effect, sound, and interaction must serve understanding. We ask:
- **Does this deepen the reader's felt understanding?**
- **Does it create genuine wonder or just visual noise?**
- **Would removing it diminish the philosophical experience?**

If an effect is merely decorative, it doesn't belong. Beauty must carry weight.

### 2. Emergent Complexity from Simple Rules

Rather than scripting elaborate sequences, we define simple behaviors and let complexity emerge:

```
Simple Rule → Varied Outcomes
─────────────────────────────
Eye personality profiles → Each eye feels distinct
Star touch memory → "Your sky" emerges over visits
Weighted random events → Unpredictable but coherent cosmos
```

This creates experiences that feel alive rather than choreographed.

### 3. Layered Revelation

Information and effects are revealed progressively:

| Layer | Timing | Purpose |
|-------|--------|---------|
| Immediate | 0-2s | Establish presence (stars, basic layout) |
| Early | 2-8s | Create atmosphere (nebulae fade in, eyes appear) |
| Sustained | 8-30s | Reward attention (constellations, cosmic events) |
| Discovery | Minutes+ | Reward exploration (whispers, rare events) |

The reader who lingers discovers more. The reader who rushes still gets a complete experience.

### 4. Personality Over Uniformity

Elements that could be uniform are given individual character:

- **Eyes**: Four personality types with distinct behaviors
- **Stars**: Varied colors, sizes, and remembered states
- **Nebulae**: Different drift patterns and color temperatures
- **Audio tones**: Personality-specific frequencies and envelopes

This creates a world that feels inhabited rather than generated.

### 5. Graceful Degradation

Every feature must work across the capability spectrum:

```
Full Experience          Reduced Experience       Minimum Experience
────────────────────────────────────────────────────────────────────
WebGL shaders        →   CSS animations       →   Static images
Spatial audio        →   Stereo panning       →   Mono audio
60fps animations     →   30fps animations     →   CSS transitions
Full star count      →   50% stars on mobile  →   Key stars only
```

Mobile users get a complete experience, not a broken one.

---

## II. Technical Patterns

### Module Architecture

```
src/
├── visualizations/     # Visual modules (one concern per file)
│   ├── starfield.ts    # Stars, shooting stars, nebulae
│   ├── forest.ts       # Hero forest with eyes
│   ├── cosmic-events.ts # Rare astronomical phenomena
│   ├── constellations.ts # Star patterns with data
│   └── index.ts        # Re-exports all public APIs
├── audio/              # Sound modules
│   ├── context.ts      # Shared AudioContext management
│   ├── effects.ts      # Interactive sound effects
│   ├── whispers.ts     # Sustained observation audio
│   └── index.ts
├── data/               # Static data files
│   ├── constellations.json
│   └── fragments.json
├── utils/              # Shared utilities
│   ├── persistence.ts  # localStorage with expiry
│   └── index.ts
└── styles/             # CSS organized by concern
    ├── variables.css   # Design tokens
    ├── base.css        # Reset and fundamentals
    ├── components.css  # Reusable UI elements
    ├── sections.css    # Page-specific layout
    └── visualizations.css # Visual effects
```

### Initialization Pattern

All visual modules follow this pattern:

```typescript
// 1. Type definitions at top
interface ModuleConfig { ... }

// 2. Module state (mutable where necessary)
let moduleState: State[] = [];

// 3. Private helper functions
function helperFunction(): void { ... }

// 4. Exported initialization function
export function initModule(): void {
    // Mobile detection for performance scaling
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    // Create DOM elements
    // Set up event listeners
    // Start any intervals/animations
}

// 5. Exported interaction functions
export function triggerEffect(): void { ... }
```

### Event Handling Pattern

Unified pointer handling for mouse and touch:

```typescript
function handlePointerMove(clientX: number, clientY: number): void {
    // Shared logic for both input types
}

// Mouse
document.addEventListener('mousemove', (e) => {
    handlePointerMove(e.clientX, e.clientY);
});

// Touch (passive for scroll performance)
document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: true });
```

### Audio Pattern

Lazy initialization with shared context:

```typescript
// Get or create AudioContext (handles browser restrictions)
const ctx = getAudioContext();
if (!ctx || !getIsAudioPlaying()) return;

// Create audio graph
const osc = ctx.createOscillator();
const gain = ctx.createGain();
const filter = ctx.createBiquadFilter();

// Connect: source → processing → output
osc.connect(filter);
filter.connect(gain);
gain.connect(getMasterGain());

// Schedule changes (never set values directly during playback)
const now = ctx.currentTime;
gain.gain.setValueAtTime(0, now);
gain.gain.linearRampToValueAtTime(0.1, now + 0.1);

// Start and auto-cleanup
osc.start(now);
osc.stop(now + duration);
```

### Persistence Pattern

All stored data includes timestamps for expiry:

```typescript
interface StoredData<T> {
    data: T;
    timestamp: number;
}

function saveData<T>(key: string, data: T): void {
    localStorage.setItem(PREFIX + key, JSON.stringify({
        data,
        timestamp: Date.now()
    }));
}

function loadData<T>(key: string): T | null {
    const stored = JSON.parse(localStorage.getItem(PREFIX + key));
    if (isExpired(stored.timestamp)) {
        localStorage.removeItem(PREFIX + key);
        return null;
    }
    return stored.data;
}
```

### CSS Animation Pattern

Prefer CSS for animations, JS for interactivity:

```css
/* Base state */
.element {
    opacity: 0;
    transition: opacity 0.3s ease;
}

/* Activated state */
.element.active {
    opacity: 1;
}

/* Continuous animation (CSS, not JS) */
.element--animated {
    animation: drift 60s ease-in-out infinite;
}

@keyframes drift {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(5%, -3%); }
}
```

JavaScript triggers state changes; CSS handles the animation.

---

## III. Interaction Philosophy

### Observation as Interaction

The most meaningful interactions are often passive:

| Action | Response | Philosophy |
|--------|----------|------------|
| Cursor near star | Star brightens | You affect what you observe |
| Dwell near eye | Eye tracks you | You are being observed back |
| Sustained observation | Whisper triggers | Patience reveals secrets |
| Touch star | Star remembered | Your presence leaves traces |

### Rarity Creates Meaning

Events are weighted to create genuine discovery:

```typescript
const cosmicEvents = [
    { type: 'pulsar', weight: 60 },      // Common enough to see
    { type: 'supernova', weight: 35 },   // Memorable when it happens
    { type: 'gamma-ray-burst', weight: 5 } // Story-worthy rare
];
```

A gamma-ray burst should make the reader pause and remember.

### Audio as Emotional Logic

Sound is not background music—it's the emotional undercurrent:

- **Drone pitch** drops during the steelman (dread building)
- **Eye tones** vary by personality (each watcher has a voice)
- **Whispers** are barely audible (secrets, not announcements)
- **Cosmic events** have spatial presence (universe is vast)

The reader may not consciously notice, but they will feel it.

---

## IV. Performance Philosophy

### Budget Consciousness

Every feature has a performance cost. We track:

| Resource | Budget | Mitigation |
|----------|--------|------------|
| DOM elements | <500 | Reduce counts on mobile |
| Animations | 60fps | Use CSS transforms, will-change |
| Audio nodes | <20 concurrent | Cleanup after playback |
| localStorage | <100KB | Limit stored items, add expiry |

### Mobile-First Performance

Mobile gets reduced complexity, not broken features:

```typescript
const isMobile = window.matchMedia('(max-width: 768px)').matches;

// Reduce counts
const starCount = isMobile ? baseCount * 0.5 : baseCount;
const eyeCount = isMobile ? 6 : 10;
const nebulaCount = isMobile ? 3 : 5;

// Reduce visual intensity
// (blur is expensive on mobile)
.nebula { filter: blur(60px); }
@media (max-width: 768px) {
    .nebula { filter: blur(40px); }
}
```

### Lazy Loading

Heavy features load on demand:

```typescript
// Constellations pre-created but hidden
createConstellationElements();
setTimeout(() => showConstellations(), 5000);

// Cosmic events start after initial load
setTimeout(() => initCosmicEvents(), 8000);

// Whispers only load when needed
let whispersLoaded = false;
function loadWhispersOnDemand() { ... }
```

---

## V. Accessibility Considerations

### Reduced Motion

Respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
    .nebula,
    .shooting-star,
    .cosmic-event {
        animation: none !important;
    }

    .element {
        transition-duration: 0.01ms !important;
    }
}
```

### Keyboard Navigation

Interactive elements are keyboard accessible:

```typescript
// Toggle constellations with 'C' key
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
        toggleConstellations();
    }
});
```

### Screen Reader Coherence

The reading experience should be meaningful without visuals:

- Semantic HTML structure
- Meaningful alt text for essential visuals
- ARIA labels for interactive elements
- Content makes sense when read linearly

---

## VI. Future Considerations

### State Management

As the project grows, consider centralizing state:

```typescript
// Potential future pattern
const appState = {
    reader: {
        progress: 0,
        choices: {},
        starsTouched: Set<string>,
        visitCount: number
    },
    audio: {
        isPlaying: boolean,
        currentSection: string
    },
    visualizations: {
        constellationsVisible: boolean,
        activeEyes: number[]
    }
};
```

### Analytics (If Added)

If we track reader behavior, we track for insight, not manipulation:

- Time spent per section (what resonates?)
- Scroll depth (where do people stop?)
- Return visits (does it stick?)
- NOT: A/B testing engagement hacks

### Collective Features

Future phases may aggregate reader responses:

- Credence distributions
- Message submissions
- Reading patterns

Privacy and anonymity are paramount. We observe patterns, not individuals.

---

## VII. The Test

Before adding any feature, ask:

1. **Does this serve the philosophy?** (Not just look cool)
2. **Does it work on mobile?** (Not just desktop)
3. **Does it respect the reader?** (Not manipulate them)
4. **Does it degrade gracefully?** (Not break without JS/audio)
5. **Is it discoverable but not intrusive?** (Rewards attention, doesn't demand it)

If yes to all five, build it. If not, reconsider.

---

*This document evolves with the project. Update it when patterns change or new principles emerge.*
