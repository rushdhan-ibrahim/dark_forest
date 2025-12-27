# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"The Dark Forest - A Deep Inquiry" is an interactive multimedia essay exploring the Dark Forest Theory from game theory and international relations. Built with Vite + TypeScript.

## Commands

```bash
npm run dev      # Start development server with hot reload
npm run build    # Build for production (outputs to dist/)
npm run preview  # Preview production build locally
```

## Project Structure

```
src/
├── main.ts                 # Entry point - imports CSS and initializes all modules
├── styles/
│   ├── index.css           # Main CSS entry (imports all others)
│   ├── variables.css       # CSS custom properties (colors, spacing, typography)
│   ├── base.css            # Reset, body, focus states, animations
│   ├── components.css      # Cards, buttons, navigation, collapsibles
│   ├── sections.css        # Hero, main content, section headers
│   └── visualizations.css  # All interactive visualization styles
├── audio/
│   ├── index.ts            # Exports initAmbientAudio(), toggleAudio()
│   ├── context.ts          # AudioContext singleton, state, types
│   ├── soundscape.ts       # buildSoundscape(), layer creation
│   ├── effects.ts          # playGlassNodePing(), playGlassShatter(), eyeTrackingAudio()
│   ├── joining.ts          # playJoiningStart(), playJoiningConverge()
│   └── atmosphere.ts       # updateScrollAudio(), transitionAtmosphere()
├── visualizations/
│   ├── index.ts            # Re-exports all visualization init functions
│   ├── starfield.ts        # Parallax ASCII stars, shooting stars
│   ├── forest.ts           # Hero forest with mouse-tracking eyes
│   ├── glass-forest.ts     # Civilization network, chain reaction destruction
│   ├── thermometer.ts      # Heat ring animation
│   ├── signal.ts           # Wave propagation visualization
│   ├── chain.ts            # Transmission chain with pulse animation
│   ├── joining.ts          # Individuals converging to collective
│   ├── carol-choice.ts     # Alternating choice display
│   ├── window.ts           # Closing window animation
│   └── mirror.ts           # Glitch reflection effect
└── utils/
    ├── index.ts            # Re-exports utilities
    ├── scroll.ts           # Smooth scroll for anchor links
    └── collapsibles.ts     # Collapsible sections, credence animation
```

## Architecture

### Audio System (src/audio/)
- **context.ts**: Singleton pattern for AudioContext, masterGain, and audio state
- All synthesis uses Web Audio API (no external audio files)
- 5 layers: drone, pad, noise, signals, eyes tones
- Section-based atmosphere transitions triggered by scroll position

### Visualizations (src/visualizations/)
- Each visualization is self-contained with its own state
- Import audio functions where needed (e.g., glass-forest imports effects)
- Interactive functions exported for button onclick handlers in HTML

### Key Exports from main.ts
```typescript
// For use in HTML onclick handlers
resetGlassForest, sendChainPulse, resetChain, startJoining, resetJoining
```

## Fonts (Google Fonts)

- Cinzel Decorative (headings)
- Cormorant Garamond (body)
- JetBrains Mono (code/technical)
- Spectral (quotes)
