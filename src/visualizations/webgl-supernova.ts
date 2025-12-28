// WebGL-based supernova renderer
// Renders supernova as a background effect that interacts with page content

// Maximum number of content boxes we can track for occlusion
const MAX_CONTENT_BOXES = 12;

// Fragment shader - supernova phenomena only (no background stars/nebula)
// Outputs with alpha for proper blending with existing page content
const FRAGMENT_SHADER = `
precision mediump float;

uniform vec2 R;
uniform float T;
uniform vec2 M;
uniform float fate;
uniform float age;
uniform float mobile;  // 1.0 on mobile, 0.0 on desktop

// Content box occlusion uniforms
// Each box is: vec4(x, y, width, height) in normalized screen coords (0-1)
uniform vec4 contentBoxes[${MAX_CONTENT_BOXES}];
uniform float boxOpacities[${MAX_CONTENT_BOXES}];  // 0 = transparent, 1 = opaque
uniform float boxTypes[${MAX_CONTENT_BOXES}];      // 0 = excluded, 1 = viz box, 2 = text box
uniform int numBoxes;

#define PI 3.14159265
#define TAU 6.28318530

// ══════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════

float h(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1,0)), f.x),
               mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y);
}

float fbm3(vec2 p) {
    return n(p) * 0.5 + n(p * 2.0) * 0.25 + n(p * 4.0) * 0.25;
}

float fbm2(vec2 p) {
    return n(p) * 0.65 + n(p * 2.0) * 0.35;
}

// ══════════════════════════════════════════════════════════════
// COLOR PALETTE
// ══════════════════════════════════════════════════════════════

vec3 rose = vec3(0.67, 0.29, 0.43);
vec3 teal = vec3(0.22, 0.53, 0.61);
vec3 purple = vec3(0.45, 0.29, 0.61);
vec3 blue = vec3(0.29, 0.37, 0.67);
vec3 dust = vec3(0.71, 0.55, 0.39);
vec3 warmWhite = vec3(1.0, 0.94, 0.88);

// ══════════════════════════════════════════════════════════════
// iOS-STYLE GLASS PHYSICS
// ══════════════════════════════════════════════════════════════

// Signed distance to a box (negative inside, positive outside)
float sdBox(vec2 p, vec2 boxCenter, vec2 boxHalfSize) {
    vec2 d = abs(p - boxCenter) - boxHalfSize;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Get the nearest edge normal for a point near a box
vec2 getBoxEdgeNormal(vec2 p, vec2 boxCenter, vec2 boxHalfSize) {
    vec2 d = p - boxCenter;
    vec2 ad = abs(d) - boxHalfSize;

    // Determine which edge we're closest to
    if (ad.x > ad.y) {
        return vec2(sign(d.x), 0.0);
    } else {
        return vec2(0.0, sign(d.y));
    }
}

// Glass physics structure - returns multiple effects for three-tier system
// Tier 0: Excluded (nav) - no effects
// Tier 1: Viz boxes - light pooling, caustic edges
// Tier 2: Text boxes - dramatic refraction, obscuration during flash
struct GlassData {
    // Core properties
    float behindGlass;
    float fresnel;
    float refraction;
    float specular;
    float edgeBevel;
    vec2 refractionOffset;
    float glassOpacity;

    // Tier identification
    float glassType;           // 0 = none, 1 = viz box, 2 = text box

    // Light pooling (viz boxes - Type 1)
    float poolGradient;        // Edge-to-center gradient (1 at center, 0 at edges)
    float focusingStrength;    // Edge light focusing intensity
    vec2 boxCenter;            // Center of current box (for pooling calculations)
    vec2 boxHalfSize;          // Half-size of current box

    // Dramatic effects (text boxes - Type 2)
    float warpFactor;          // Light warping magnitude
    float obscurationLevel;    // Content obscuration during flash
};

// ══════════════════════════════════════════════════════════════
// LIGHT POOLING - Viz boxes capture and concentrate light
// ══════════════════════════════════════════════════════════════

vec3 calculateLightPooling(vec2 screenUV, vec2 boxCenter, vec2 boxHalfSize,
                           float lightIntensity, float flashLevel) {
    vec3 poolEffect = vec3(0.0);

    // Normalized position within box (-1 to 1 range)
    vec2 normalizedPos = (screenUV - boxCenter) / boxHalfSize;
    float centerDist = length(normalizedPos);

    // ═══ INTERIOR GLOW ═══
    // Brighter at center, creating a "pooled light" effect
    float poolGradient = 1.0 - smoothstep(0.0, 0.85, centerDist);
    float poolIntensity = poolGradient * poolGradient; // Quadratic falloff

    // Base pool color - warm golden interior
    vec3 poolColor = mix(warmWhite, vec3(1.0, 0.92, 0.8), 0.3);
    poolEffect += poolColor * poolIntensity * lightIntensity * 0.35;

    // ═══ EDGE FOCUSING ═══
    // Light appears to "pour in" at the edges and focus toward center
    float edgeFocus = smoothstep(0.5, 0.92, centerDist);

    // Caustic-like shimmer at edges
    float causticPhase = T * 0.8;
    float caustic = sin(centerDist * 15.0 + causticPhase) * 0.5 + 0.5;
    caustic *= sin(atan(normalizedPos.y, normalizedPos.x) * 3.0 + causticPhase * 0.5) * 0.3 + 0.7;
    caustic *= edgeFocus;
    poolEffect += teal * 0.25 * caustic * lightIntensity;

    // ═══ CORNER BRIGHTENING ═══
    // Corners collect more light (Fresnel-like accumulation)
    float cornerFactor = abs(normalizedPos.x) * abs(normalizedPos.y);
    cornerFactor = smoothstep(0.25, 0.7, cornerFactor);
    poolEffect += vec3(0.95, 0.9, 0.85) * cornerFactor * lightIntensity * 0.15;

    // ═══ FLASH AMPLIFICATION ═══
    // During supernova flash, pooling becomes much more intense
    float flashBoost = 1.0 + flashLevel * 3.0;
    poolEffect *= flashBoost;

    // ═══ DEPTH PARALLAX ═══
    // Subtle layered effect suggesting depth
    float depth1 = sin(centerDist * 8.0 - T * 0.3) * 0.5 + 0.5;
    float depth2 = sin(centerDist * 5.0 + T * 0.2) * 0.5 + 0.5;
    float parallaxLayer = mix(depth1, depth2, 0.5) * poolGradient;
    poolEffect += blue * 0.08 * parallaxLayer * lightIntensity;

    return poolEffect;
}

// ══════════════════════════════════════════════════════════════
// TEXT BOX WARPING - Dramatic light distortion
// ══════════════════════════════════════════════════════════════

vec2 calculateTextWarp(vec2 screenUV, vec2 boxCenter, vec2 boxHalfSize,
                       float flashLevel) {
    vec2 normalizedPos = (screenUV - boxCenter) / boxHalfSize;
    float dist = length(normalizedPos);

    // Warp direction - radial from center
    vec2 warpDir = normalize(normalizedPos + vec2(0.001));

    // Warp strength - peaks during flash
    float warpBase = 0.015;
    float warpFlash = warpBase * (1.0 + flashLevel * 6.0);

    // Add turbulence using noise for organic feel
    float turbulence = fbm2(normalizedPos * 3.0 + T * 0.4);
    warpFlash *= (0.6 + turbulence * 0.8);

    // Stronger warp near edges (like light bending around thick glass)
    float edgeWarp = smoothstep(0.2, 0.85, dist);

    return warpDir * warpFlash * edgeWarp;
}

GlassData calculateGlassPhysics(vec2 screenUV, float lightIntensity, float flashLevel) {
    GlassData glass;
    // Core properties
    glass.behindGlass = 0.0;
    glass.fresnel = 0.0;
    glass.refraction = 0.0;
    glass.specular = 0.0;
    glass.edgeBevel = 0.0;
    glass.refractionOffset = vec2(0.0);
    glass.glassOpacity = 0.0;
    // Tier identification
    glass.glassType = 0.0;
    // Light pooling (viz boxes)
    glass.poolGradient = 0.0;
    glass.focusingStrength = 0.0;
    glass.boxCenter = vec2(0.0);
    glass.boxHalfSize = vec2(0.0);
    // Dramatic effects (text boxes)
    glass.warpFactor = 0.0;
    glass.obscurationLevel = 0.0;

    float minDist = 1000.0;
    vec2 closestNormal = vec2(0.0);
    float closestOpacity = 0.0;
    float closestType = 0.0;
    vec2 closestBoxCenter = vec2(0.0);
    vec2 closestBoxHalfSize = vec2(0.0);

    for (int i = 0; i < ${MAX_CONTENT_BOXES}; i++) {
        if (i >= numBoxes) break;

        vec4 box = contentBoxes[i];
        float opacity = boxOpacities[i];
        float boxType = boxTypes[i];

        // Skip excluded elements (type 0) or invisible boxes
        if (opacity < 0.01 || boxType < 0.5) continue;

        vec2 boxCenter = box.xy + box.zw * 0.5;
        vec2 boxHalfSize = box.zw * 0.5;

        float dist = sdBox(screenUV, boxCenter, boxHalfSize);

        // Track closest box for edge effects
        if (abs(dist) < abs(minDist)) {
            minDist = dist;
            closestNormal = getBoxEdgeNormal(screenUV, boxCenter, boxHalfSize);
            closestOpacity = opacity;
            closestType = boxType;
            closestBoxCenter = boxCenter;
            closestBoxHalfSize = boxHalfSize;
        }

        // Inside the glass
        if (dist < 0.0) {
            glass.behindGlass = max(glass.behindGlass, opacity);
            glass.glassOpacity = max(glass.glassOpacity, opacity);
            glass.glassType = boxType;
            glass.boxCenter = boxCenter;
            glass.boxHalfSize = boxHalfSize;

            float edgeDist = -dist;
            vec2 normal = getBoxEdgeNormal(screenUV, boxCenter, boxHalfSize);
            vec2 normalizedPos = (screenUV - boxCenter) / boxHalfSize;
            float centerDist = length(normalizedPos);

            // ═══ TYPE 1: VIZ BOX - Light pooling ═══
            if (boxType > 0.5 && boxType < 1.5) {
                // Wider refraction zone for stronger glass presence
                float refractionStrength = 0.018 * (1.0 - smoothstep(0.0, 0.12, edgeDist));
                refractionStrength *= opacity;
                glass.refractionOffset += normal * refractionStrength;
                glass.refraction = max(glass.refraction, refractionStrength * 8.0);

                // Pool gradient for interior glow
                glass.poolGradient = 1.0 - smoothstep(0.0, 0.85, centerDist);

                // Edge focusing strength
                glass.focusingStrength = smoothstep(0.5, 0.92, centerDist) * lightIntensity;
            }
            // ═══ TYPE 2: TEXT BOX - Dramatic warping ═══
            else if (boxType > 1.5) {
                // Standard refraction with flash amplification
                float refractionStrength = 0.02 * (1.0 - smoothstep(0.0, 0.1, edgeDist));
                refractionStrength *= opacity * (1.0 + flashLevel * 2.5);
                glass.refractionOffset += normal * refractionStrength;
                glass.refraction = max(glass.refraction, refractionStrength * 12.0);

                // Warp calculation is expensive - skip on mobile
                if (mobile < 0.5) {
                    vec2 warp = calculateTextWarp(screenUV, boxCenter, boxHalfSize, flashLevel);
                    glass.refractionOffset += warp;
                    glass.warpFactor = length(warp) * 15.0;
                }

                // Obscuration during flash (text can be partially hidden)
                glass.obscurationLevel = flashLevel * 0.5 * opacity;
            }
        }
    }

    // ═══ EDGE EFFECTS (only if near a box) ═══
    float absMinDist = abs(minDist);

    if (absMinDist < 0.06) {
        // Mobile: simplified edge effects (fresnel only, no bevel/specular)
        // These subtle effects are barely visible on small screens
        if (mobile > 0.5) {
            float fresnelWidth = 0.025;
            if (absMinDist < fresnelWidth) {
                float fresnel = 1.0 - (absMinDist / fresnelWidth);
                glass.fresnel = fresnel * closestOpacity * 0.8;
            }
        } else {
            // Desktop: full edge effects
            // ═══ FRESNEL EDGE GLOW ═══
            float fresnelWidth = 0.025;
            if (absMinDist < fresnelWidth) {
                float fresnel = 1.0 - (absMinDist / fresnelWidth);
                fresnel = pow(fresnel, 1.5);
                float lightFacing = max(0.0, dot(closestNormal, vec2(0.0, 1.0)) * 0.5 + 0.5);
                glass.fresnel = fresnel * (0.6 + lightFacing * 0.4) * closestOpacity;
            }

            // ═══ BEVEL HIGHLIGHT ═══
            float bevelWidth = 0.008;
            if (absMinDist < bevelWidth) {
                float bevel = 1.0 - (absMinDist / bevelWidth);
                bevel = pow(bevel, 2.0);
                glass.edgeBevel = bevel * closestOpacity;
            }

            // ═══ SPECULAR HIGHLIGHT ═══
            vec2 lightDir = normalize(vec2(0.0) - screenUV);
            float specAngle = dot(closestNormal, lightDir);

            if (minDist < 0.0 && minDist > -0.03) {
                float spec = pow(max(0.0, specAngle), 8.0);
                spec *= (1.0 - smoothstep(0.0, 0.03, -minDist));
                glass.specular = spec * lightIntensity * closestOpacity * 0.8;
            }
        }
    }

    return glass;
}

// Chromatic aberration - sample colors at slightly offset positions
vec3 sampleWithChromaticAberration(vec2 uv, vec2 offset, float strength) {
    // This will be used to offset R, G, B channels differently
    // Returns the offset amounts for each channel
    return vec3(
        strength * 1.0,   // Red shifts most
        strength * 0.0,   // Green stays centered
        strength * -1.0   // Blue shifts opposite
    );
}

// ══════════════════════════════════════════════════════════════
// PROGENITOR STAR - Breathing, growing
// ══════════════════════════════════════════════════════════════

vec3 progenitor(vec2 p, float t) {
    float r = length(p);
    float vis = 1.0 - smoothstep(9.0, 10.0, t);
    if (vis < 0.01) return vec3(0.0);

    float inst = smoothstep(0.0, 9.0, t);
    float pulse = 0.7 + 0.3 * sin(t * (1.5 + inst * 5.0));
    pulse += fbm2(vec2(atan(p.y, p.x) * 2.0, t * 3.0)) * 0.15 * inst;

    float size = 1.0 + inst * 0.8;
    if (t > 8.5) size *= 1.0 + (t - 8.5) * 4.0;
    if (t > 9.5) size *= max(0.0, 1.0 - (t - 9.5) * 3.0);

    float core = exp(-r * r * (80.0 / (size * size)));
    float corona = exp(-r * r * (15.0 / (size * size))) * (0.3 + inst * 0.4);

    vec3 coreCol = warmWhite;
    vec3 coronaCol = mix(dust, rose * 0.8, inst * 0.5);

    vec3 col = coreCol * core * (1.5 + inst * 0.8);
    col += coronaCol * corona;

    return col * vis * pulse;
}

// ══════════════════════════════════════════════════════════════
// EXPLOSION - Flash, shockwaves, light rays, debris
// ══════════════════════════════════════════════════════════════

vec3 explosion(vec2 p, float t) {
    float r = length(p);
    float ang = atan(p.y, p.x);

    float elapsed = t - 10.0;
    if (elapsed < 0.0) return vec3(0.0);

    float prog = clamp(elapsed / 12.0, 0.0, 1.0);
    float intensity = smoothstep(0.0, 0.03, prog) * (1.0 - smoothstep(0.25, 1.0, prog));

    vec3 col = vec3(0.0);

    // Expanding shell
    float shellR = 0.02 + prog * 1.0;
    float shellW = 0.04 + prog * 0.12;
    float shell = exp(-pow((r - shellR) / shellW, 2.0));

    float fil = fbm2(vec2(ang * 5.0, r * 4.0 - t * 0.08));
    shell *= 0.4 + 0.6 * fil;

    float temp = smoothstep(shellR + 0.05, shellR - 0.1, r);
    vec3 shellCol = mix(teal * 1.5, mix(dust, rose, 0.4) * 2.0, smoothstep(0.0, 0.5, temp));
    shellCol = mix(shellCol, warmWhite, pow(temp, 2.0));

    col += shellCol * shell * intensity;

    // Multiple shockwave rings with organic wobble
    for (float i = 0.0; i < 4.0; i++) {
        float delay = i * 0.015;
        float ringProg = clamp((elapsed - delay) / (6.0 + i), 0.0, 1.0);
        float baseRingR = ringProg * 1.2;

        float morphSpeed = 12.0 + i * 2.0;
        float morphPhase = t * morphSpeed + i * 1.5;

        float distort = 0.0;
        distort += sin(ang * 1.0 + morphPhase) * 0.03;
        distort += sin(ang * 2.0 - morphPhase * 0.7) * 0.015;
        distort += sin(ang * 3.0 + morphPhase * 1.3) * 0.008;

        float ringR = baseRingR * (1.0 + distort);
        float ringW = 0.008 + ringProg * 0.004;
        float ring = exp(-pow((r - ringR) / ringW, 2.0));
        ring *= 1.0 - ringProg;

        vec3 ringCol = i < 1.0 ? blue * 1.5 :
                       i < 2.0 ? dust * 1.3 :
                       i < 3.0 ? purple * 1.2 : teal * 1.1;
        col += ringCol * ring * 0.4;
    }

    // Light rays
    float rayIntensity = intensity * (1.0 - smoothstep(0.0, 0.3, prog));
    float numRays = 24.0;
    float rayAng = ang + t * 0.02;
    float rays = pow(abs(sin(rayAng * numRays * 0.5)), 8.0);
    rays *= exp(-r * 2.0) * rayIntensity;
    col += warmWhite * 0.15 * rays;

    // Lens flares
    float flareDist = length(p - vec2(0.08, -0.05));
    float flare1 = exp(-flareDist * flareDist * 80.0) * intensity;
    col += blue * 0.3 * flare1;

    flareDist = length(p - vec2(-0.12, 0.08));
    float flare2 = exp(-flareDist * flareDist * 120.0) * intensity;
    col += rose * 0.25 * flare2;

    flareDist = length(p - vec2(0.15, 0.1));
    float flare3 = exp(-flareDist * flareDist * 200.0) * intensity;
    col += teal * 0.35 * flare3;

    // Anamorphic streak
    float streak = exp(-p.y * p.y * 400.0) * exp(-abs(p.x) * 3.0);
    streak *= intensity * (1.0 - smoothstep(0.0, 0.2, prog));
    col += warmWhite * 0.4 * streak;

    return col;
}

// ══════════════════════════════════════════════════════════════
// REMNANT NEBULA - Subtle filamentary structure
// ══════════════════════════════════════════════════════════════

vec3 remnant(vec2 p, float t, float nebulaAge) {
    float appear = smoothstep(12.0, 18.0, t);
    if (appear < 0.01) return vec3(0.0);

    float te = t - 12.0 + nebulaAge * 4.0;
    float r = length(p);
    float th = atan(p.y, p.x);

    float shellR = 0.06 + 0.9 * (1.0 - exp(-te * 0.15));
    float shellW = 0.10 + 0.015 * smoothstep(0.0, 10.0, te);

    vec2 q = p;
    vec2 warp = vec2(
        fbm2(q * 1.0 + vec2(17.0, te * 0.03)),
        fbm2(q * 1.0 + vec2(43.0, -te * 0.02))
    );
    q += (warp - 0.5) * 0.18;

    float noiseVal = fbm3(q * 2.2 + 11.0);
    float ridge = 1.0 - abs(2.0 * noiseVal - 1.0);
    ridge = pow(ridge, 1.8);

    float shell = exp(-pow((r - shellR) / shellW, 2.0));
    float interior = exp(-r * r / ((shellR * 1.1 + 0.15) * (shellR * 1.1 + 0.15)));

    float clouds = fbm2(q * 0.7 + 23.0 + te * 0.015);
    clouds = pow(clouds, 2.5);

    float fingers = n(vec2(th * 5.0 + 5.0, r * 4.0 - te * 0.2));
    fingers = pow(1.0 - abs(2.0 * fingers - 1.0), 2.0);

    float density = 0.0;
    density += shell * (0.5 + 0.35 * ridge);
    density += interior * (0.15 + 0.2 * pow(noiseVal, 1.5));
    density += interior * clouds * 0.2;
    density *= (0.85 + 0.2 * fingers);
    density *= exp(-te * 0.025);

    vec3 H_alpha = rose * 1.1;
    vec3 O_III = teal * 1.2;
    vec3 violet = purple * 1.2;
    vec3 dustCol = dust * 0.7;

    float mixHO = smoothstep(0.3, 0.7, noiseVal);
    vec3 col = mix(H_alpha, O_III, mixHO);
    col = mix(col, violet, 0.2 * ridge);
    col = mix(col, dustCol, 0.3 * smoothstep(shellR - 0.05, shellR + 0.15, r));
    col += blue * 0.15 * interior * (1.0 - r * 2.0);

    return col * density * appear;
}

// ══════════════════════════════════════════════════════════════
// NEUTRON STAR - Rapid flickering core
// ══════════════════════════════════════════════════════════════

vec3 neutron(vec2 p, float t) {
    float r = length(p);
    float appear = smoothstep(16.0, 20.0, t);
    if (appear < 0.01) return vec3(0.0);

    float core = exp(-r * r * 12000.0);

    float flicker1 = sin(t * 8.0) * 0.25 + 0.75;
    float flicker2 = sin(t * 13.0 + 0.5) * 0.2 + 0.8;
    float flicker3 = sin(t * 21.0 + 1.2) * 0.15 + 0.85;
    float flicker4 = sin(t * 5.0 + 2.0) * 0.1 + 0.9;
    float flicker = flicker1 * flicker2 * flicker3 * flicker4;

    float noiseFlicker = 0.85 + 0.15 * n(vec2(t * 4.0, 0.0));
    flicker *= noiseFlicker;

    float glow = exp(-r * r * 1800.0) * flicker;
    float outerGlow = exp(-r * r * 400.0) * (0.3 + flicker * 0.2);

    float texture = 0.9 + 0.1 * fbm2(vec2(atan(p.y, p.x) * 3.0, r * 20.0 + t * 0.5));

    vec3 col = vec3(0.88, 0.93, 1.0) * core * 2.8 * texture * flicker;
    col += blue * 1.2 * glow * 0.7;
    col += teal * outerGlow * 0.35;

    float beamAng = t * 0.8;
    vec2 bd = vec2(cos(beamAng), sin(beamAng));

    float d1 = abs(dot(p, vec2(-bd.y, bd.x)));
    float d2 = abs(dot(p, vec2(bd.y, -bd.x)));

    float beam = exp(-d1 * d1 * 80.0) + exp(-d2 * d2 * 80.0);
    beam *= exp(-r * 2.0) * 0.5;
    beam *= smoothstep(0.0, 0.08, r);

    col += blue * 0.4 * beam * 0.15;
    col += teal * 0.12 * exp(-r * r * 120.0);

    return col * appear;
}

// ══════════════════════════════════════════════════════════════
// SHADER-BASED STARS - For gravitational lensing effects
// ══════════════════════════════════════════════════════════════

vec3 stars(vec2 p, float t, vec2 parallax) {
    vec3 col = vec3(0.0);

    // Three parallax layers (reduced to 2 on mobile)
    float maxLayers = mobile > 0.5 ? 2.0 : 3.0;

    for (float layer = 0.0; layer < 3.0; layer++) {
        if (layer >= maxLayers) break;

        float pStr = 0.02 + layer * 0.025;
        float scale = 50.0 + layer * 45.0;
        float density = 0.03 - layer * 0.008;

        vec2 sp = (p + parallax * pStr) * scale;
        vec2 id = floor(sp);
        vec2 f = fract(sp) - 0.5;
        float rnd = h(id + layer * 100.0);

        if (rnd > 1.0 - density) {
            float d = length(f);
            float core = exp(-d * d * 55.0);
            float halo = exp(-d * d * 15.0) * 0.2;

            // Gentle twinkle
            float twinkle = 0.6 + 0.4 * sin(t * (0.3 + rnd * 1.0) + rnd * TAU);

            // Color variation
            vec3 starCol = mix(vec3(0.9, 0.88, 0.85), vec3(0.85, 0.88, 0.95), rnd);
            if (rnd > 0.97) starCol = mix(starCol, vec3(1.0, 0.9, 0.8), 0.5); // Bright warm

            col += starCol * (core + halo) * twinkle * (0.6 + layer * 0.15);
        }
    }

    return col;
}

// ══════════════════════════════════════════════════════════════
// GRAVITATIONAL WAVES - Spacetime ripples from BH formation
// ══════════════════════════════════════════════════════════════

vec2 gravitationalWaves(vec2 uv, float t, float bhForm) {
    if (bhForm < 0.01) return vec2(0.0);

    float r = length(uv);
    float ang = atan(uv.y, uv.x);

    float waveStart = 12.0;
    float elapsed = t - waveStart;
    if (elapsed < 0.0) return vec2(0.0);

    vec2 totalOffset = vec2(0.0);

    // Initial burst during collapse
    float burstAge = elapsed;
    if (burstAge < 8.0) {
        float burstR = burstAge * 0.15;
        float burstW = 0.03 + burstAge * 0.02;

        float wave = sin((r - burstR) * 40.0 - burstAge * 3.0);
        wave *= exp(-pow((r - burstR) / burstW, 2.0));
        wave *= exp(-burstAge * 0.4);

        // Quadrupole pattern
        float hPlus = wave * cos(2.0 * ang);
        float hCross = wave * sin(2.0 * ang);

        float amplitude = 0.015 * bhForm;
        totalOffset += vec2(hPlus, hCross) * amplitude;
    }

    // Ringdown waves (QNM ringing)
    float ringdownStart = 4.0;
    float ringdownAge = elapsed - ringdownStart;
    if (ringdownAge > 0.0 && ringdownAge < 12.0) {
        for (float mode = 0.0; mode < 3.0; mode++) {
            float freq = 2.5 - mode * 0.6;
            float decay = 0.3 + mode * 0.15;
            float phase = mode * 1.5;

            float modeR = ringdownAge * (0.08 + mode * 0.03);
            float modeW = 0.025 + ringdownAge * 0.015;

            float wave = sin((r - modeR) * (30.0 - mode * 5.0) + phase);
            wave *= exp(-pow((r - modeR) / modeW, 2.0));
            wave *= exp(-ringdownAge * decay);
            wave *= (1.0 - mode * 0.3);

            float hPlus = wave * cos(2.0 * ang + mode);
            float hCross = wave * sin(2.0 * ang + mode);

            float amplitude = 0.008 * bhForm;
            totalOffset += vec2(hPlus, hCross) * amplitude;
        }
    }

    // Continuous subtle waves
    if (bhForm > 0.5) {
        float continuousWave = sin(r * 25.0 - t * 1.5) * 0.3;
        continuousWave += sin(r * 18.0 - t * 2.1 + 1.0) * 0.2;
        continuousWave *= exp(-r * 2.0);
        continuousWave *= (bhForm - 0.5) * 2.0;

        float hh = continuousWave * cos(2.0 * ang + t * 0.1);
        totalOffset += vec2(hh, hh * 0.5) * 0.003;
    }

    return totalOffset;
}

// Visible gravitational wave glow
vec3 gravitationalWaveGlow(vec2 uv, float t, float bhForm) {
    if (bhForm < 0.01) return vec3(0.0);

    float r = length(uv);
    float elapsed = t - 12.0;
    if (elapsed < 0.0) return vec3(0.0);

    vec3 col = vec3(0.0);

    // Expanding wave fronts
    for (float i = 0.0; i < 4.0; i++) {
        float waveStart = i * 1.5;
        float waveAge = elapsed - waveStart;

        if (waveAge > 0.0 && waveAge < 10.0) {
            float waveR = waveAge * 0.12;
            float waveW = 0.015 + waveAge * 0.008;

            float wave = exp(-pow((r - waveR) / waveW, 2.0));
            wave *= exp(-waveAge * 0.35);
            wave *= smoothstep(0.0, 0.5, waveAge);

            vec3 waveCol = mix(purple, blue, 0.5) * 0.15;
            col += waveCol * wave * bhForm;
        }
    }

    return col;
}

// ══════════════════════════════════════════════════════════════
// GRAVITATIONAL LENSING - Light bending around black hole
// ══════════════════════════════════════════════════════════════

vec2 gravitationalLens(vec2 uv, float strength, float time) {
    if (strength < 0.001) return uv;

    float r = length(uv);
    if (r < 0.001) return uv;

    float rs = 0.08 * strength;
    float rPhoton = rs * 1.5;

    // Radial deflection
    float deflection = (rs * rs) / (r * r + rs * rs * 0.2);
    deflection *= 1.5;

    // Enhanced magnification near photon sphere
    float photonBoost = exp(-pow((r - rPhoton) / (rs * 0.6), 2.0)) * 0.8;
    deflection += photonBoost;

    // Frame dragging (Kerr black hole spin)
    float spin = 0.85;
    float frameDrag = spin * rs * rs / (r * r + rs * 0.15);
    float dragAngle = frameDrag * strength * (1.0 + 0.4 * sin(time * 0.15));

    vec2 dir = uv / r;

    // Rotate by frame-dragging
    float c = cos(dragAngle);
    float s = sin(dragAngle);
    vec2 rotatedDir = vec2(dir.x * c - dir.y * s, dir.x * s + dir.y * c);

    // Push coordinates outward
    vec2 lensedUV = uv + rotatedDir * deflection * r;

    // Event horizon collapse
    float horizonPull = smoothstep(rs * 2.0, rs * 0.8, r);
    lensedUV = mix(lensedUV, uv * 0.05, horizonPull * strength);

    // Tangential stretching
    float tangentStretch = 1.0 + (rs / (r + rs * 0.5)) * 0.6 * strength;
    float ang = atan(lensedUV.y, lensedUV.x);
    float newR = length(lensedUV);
    lensedUV = vec2(cos(ang), sin(ang)) * newR * tangentStretch;

    return lensedUV;
}

// Secondary lensing for Einstein ring ghost images
vec2 secondaryLens(vec2 uv, float strength) {
    if (strength < 0.01) return uv;

    float r = length(uv);
    float rs = 0.08 * strength;

    float wrapFactor = rs * rs / (r * r + rs * rs * 0.3);
    float ang = atan(uv.y, uv.x) + PI * wrapFactor * 2.5;
    float newR = r * (1.0 + wrapFactor);

    return vec2(cos(ang), sin(ang)) * newR;
}

// Tertiary lensing - even more wrapped light
vec2 tertiaryLens(vec2 uv, float strength) {
    if (strength < 0.1) return uv;

    float r = length(uv);
    float rs = 0.08 * strength;

    float wrapFactor = rs * rs / (r * r + rs * rs * 0.2);
    float ang = atan(uv.y, uv.x) + PI * 2.0 * wrapFactor * 3.0;
    float newR = r * (1.0 + wrapFactor * 1.5);

    return vec2(cos(ang), sin(ang)) * newR;
}

// ══════════════════════════════════════════════════════════════
// BLACK HOLE - Enhanced with Einstein ring and multiple photon rings
// ══════════════════════════════════════════════════════════════

vec3 blackhole(vec2 p, float t) {
    float r = length(p);
    float ang = atan(p.y, p.x);

    float form = smoothstep(16.0, 20.0, t);
    if (form < 0.01) return vec3(0.0);

    // Larger black hole for dramatic effect
    float rH = 0.08 * form;
    float rPhoton = rH * 1.5;

    vec3 col = vec3(0.0);

    // Shadow - larger and darker
    float shadow = smoothstep(rH * 0.85, rH * 1.8, r);

    // Photon ring - brighter shimmer
    float ringW = rH * 0.15;
    float ring = exp(-pow((r - rPhoton) / ringW, 2.0));
    float shimmer = 0.6 + 0.4 * sin(ang * 6.0 + t * 2.5);
    shimmer *= 0.8 + 0.2 * sin(ang * 13.0 - t * 1.8);
    col += mix(dust, rose, 0.4) * ring * shimmer * form * 0.7;

    // Accretion disk with Doppler
    float diskTilt = 0.38;
    float diskPrecess = 0.5 + 0.08 * sin(t * 0.12);

    float ca = cos(diskPrecess), sa = sin(diskPrecess);
    vec2 diskP = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
    diskP.y /= diskTilt;

    float diskR = length(diskP);
    float diskAng = atan(diskP.y, diskP.x);

    float diskInner = rH * 2.3;
    float diskOuter = rH * 7.5;
    float diskW = rH * 1.1;

    float diskBand = exp(-pow((diskR - (diskInner + diskOuter) * 0.5) / diskW, 2.0));
    diskBand *= smoothstep(diskInner * 0.9, diskInner * 1.2, diskR);
    diskBand *= smoothstep(diskOuter * 1.1, diskOuter * 0.8, diskR);

    // Doppler effect
    float doppler = 0.5 + 0.5 * cos(diskAng - 0.6);
    doppler = pow(doppler, 1.7);

    float turb = fbm2(vec2(diskAng * 4.0 + t * 0.2, diskR * 14.0));
    diskBand *= 0.45 + 0.55 * turb;

    float diskTemp = smoothstep(diskOuter, diskInner, diskR);
    vec3 diskCool = dust * 0.6;
    vec3 diskWarm = mix(rose, dust, 0.5);
    vec3 diskHot = mix(blue, teal, 0.4) * 1.2;

    vec3 diskCol = mix(diskCool, diskWarm, diskTemp);
    diskCol = mix(diskCol, diskHot, pow(diskTemp, 2.0));

    float diskMask = smoothstep(rH * 1.1, rH * 2.3, r);
    col += diskCol * diskBand * doppler * diskMask * form * 0.6;

    // Secondary lensed arc
    vec2 diskP2 = diskP;
    diskP2.y = abs(diskP2.y) + rH * 1.0;
    float diskR2 = length(diskP2);

    float secondaryBand = exp(-pow((diskR2 - (diskInner + diskOuter) * 0.5) / (diskW * 0.28), 2.0));
    secondaryBand *= exp(-r * 7.0);
    secondaryBand *= smoothstep(rH * 1.0, rH * 1.9, r);

    col += diskCol * secondaryBand * form * 0.3;

    // Relativistic jets
    float jetW = rH * 0.2;
    float jet = exp(-pow(p.x / jetW, 2.0)) * exp(-abs(p.y) * 1.0);
    jet *= smoothstep(rH * 1.0, rH * 3.5, abs(p.y));
    col += blue * 0.5 * jet * form * 0.2;

    // Inner glow
    float innerGlow = exp(-pow(r - rH * 1.15, 2.0) * 90.0);
    innerGlow *= smoothstep(rH * 0.95, rH * 1.4, r);
    col += purple * 0.35 * innerGlow * form;

    // Event horizon
    float horizon = 1.0 - smoothstep(rH * 0.88, rH * 1.0, r);
    col *= (1.0 - horizon);
    col *= shadow;

    // Edge glow
    float edgeGlow = exp(-pow(r - rH, 2.0) * 180.0) * (1.0 - horizon);
    col += purple * 0.3 * edgeGlow * form;

    // ─── EINSTEIN RING ───
    float einsteinR = rH * 2.8;
    float einsteinW = rH * 0.2;
    float einstein = exp(-pow((r - einsteinR) / einsteinW, 2.0));

    float ringVar = 0.6 + 0.4 * sin(ang * 2.0 + t * 0.4);
    ringVar *= 0.75 + 0.25 * sin(ang * 7.0 - t * 0.25);

    vec3 einsteinCol = mix(warmWhite, mix(dust, teal, 0.5), 0.25);
    einsteinCol = mix(einsteinCol, rose * 1.3, sin(ang + t * 0.15) * 0.35 + 0.35);

    col += einsteinCol * einstein * ringVar * form * 0.5;

    // ─── SECONDARY PHOTON RING ───
    float secondaryR = rH * 1.6;
    float secondaryW = rH * 0.08;
    float secondary = exp(-pow((r - secondaryR) / secondaryW, 2.0));
    secondary *= 0.5 + 0.5 * sin(ang * 4.0 - t * 0.7);
    col += mix(blue, purple, 0.5) * secondary * form * 0.3;

    // ─── TERTIARY PHOTON RING ───
    float tertiaryR = rH * 1.25;
    float tertiaryW = rH * 0.04;
    float tertiary = exp(-pow((r - tertiaryR) / tertiaryW, 2.0));
    tertiary *= 0.6 + 0.4 * sin(ang * 5.0 + t * 0.5);
    col += teal * 0.8 * tertiary * form * 0.2;

    return col;
}

// ══════════════════════════════════════════════════════════════
// MAIN - Compose scene with iOS glass physics
// ══════════════════════════════════════════════════════════════

// Helper to sample supernova at a UV position
vec3 sampleSupernova(vec2 uv, float t) {
    vec3 col = vec3(0.0);
    col += progenitor(uv, t);
    col += explosion(uv, t);
    col += remnant(uv, t, age);

    if (fate < 0.5) {
        col += neutron(uv, t);
    } else {
        float bhAppear = smoothstep(16.0, 20.0, t);
        vec3 bh = blackhole(uv, t);
        col = mix(col, col + bh, bhAppear);
    }

    return col;
}

// ══════════════════════════════════════════════════════════════
// GAUSSIAN BLUR SIMULATION - iOS-style frosted glass
// ══════════════════════════════════════════════════════════════

vec3 sampleWithBlur(vec2 uv, float blurRadius) {
    vec3 total = vec3(0.0);

    // Mobile: use 5-sample blur (center + cross pattern)
    // Desktop: use 9-sample Gaussian blur kernel
    if (mobile > 0.5) {
        // 5-sample cross pattern - much faster
        float weights[5];
        weights[0] = 0.4;   // center
        weights[1] = 0.15;  // up
        weights[2] = 0.15;  // down
        weights[3] = 0.15;  // left
        weights[4] = 0.15;  // right

        vec2 offsets[5];
        offsets[0] = vec2(0.0, 0.0);
        offsets[1] = vec2(0.0, -1.0);
        offsets[2] = vec2(0.0, 1.0);
        offsets[3] = vec2(-1.0, 0.0);
        offsets[4] = vec2(1.0, 0.0);

        for (int i = 0; i < 5; i++) {
            vec2 sampleUV = uv + offsets[i] * blurRadius * 0.004;
            vec3 s = sampleSupernova(sampleUV, T);
            total += s * weights[i];
        }
    } else {
        // Full 9-sample Gaussian for desktop
        float weights[9];
        weights[0] = 0.0625; weights[1] = 0.125; weights[2] = 0.0625;
        weights[3] = 0.125;  weights[4] = 0.25;  weights[5] = 0.125;
        weights[6] = 0.0625; weights[7] = 0.125; weights[8] = 0.0625;

        vec2 offsets[9];
        offsets[0] = vec2(-1.0, -1.0); offsets[1] = vec2(0.0, -1.0); offsets[2] = vec2(1.0, -1.0);
        offsets[3] = vec2(-1.0,  0.0); offsets[4] = vec2(0.0,  0.0); offsets[5] = vec2(1.0,  0.0);
        offsets[6] = vec2(-1.0,  1.0); offsets[7] = vec2(0.0,  1.0); offsets[8] = vec2(1.0,  1.0);

        for (int i = 0; i < 9; i++) {
            vec2 sampleUV = uv + offsets[i] * blurRadius * 0.003;
            vec3 s = sampleSupernova(sampleUV, T);
            total += s * weights[i];
        }
    }

    return total;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * R) / R.y;
    vec2 screenUV = gl_FragCoord.xy / R;  // 0-1 screen coordinates

    // Scale down supernova on mobile so it doesn't overwhelm the smaller screen
    float mobileScale = mobile > 0.5 ? 1.35 : 1.0;
    uv *= mobileScale;

    vec2 m = (M / R) * 2.0 - 1.0;
    m.x *= R.x / R.y;
    vec2 parallax = m * 0.08;

    // Gentle drift
    uv += vec2(sin(T * 0.018), cos(T * 0.014)) * 0.008;

    // Subtle zoom during explosion
    float zoom = mix(1.04, 1.0, smoothstep(0.0, 12.0, T));
    uv *= zoom;

    // ═══ FLASH CALCULATION ═══
    float flash = smoothstep(9.8, 10.0, T) * (1.0 - smoothstep(10.0, 11.5, T));
    float screenFlash = smoothstep(9.9, 10.05, T) * (1.0 - smoothstep(10.05, 10.8, T));
    float totalFlash = flash + screenFlash;
    float flashLevel = smoothstep(9.5, 10.0, T) * (1.0 - smoothstep(10.0, 12.0, T));

    // ═══ BLACK HOLE GRAVITATIONAL EFFECTS ═══
    float bhFormation = 0.0;
    float lensStrength = 0.0;
    if (fate > 0.5) {
        bhFormation = smoothstep(12.0, 20.0, T);
        lensStrength = smoothstep(16.0, 24.0, T);
    }

    // Apply gravitational wave distortion to coordinates
    vec2 gwOffset = gravitationalWaves(uv, T, bhFormation);
    vec2 gwDistortedUV = uv + gwOffset;

    // ═══ iOS GLASS PHYSICS (THREE-TIER SYSTEM) ═══
    float lightIntensity = totalFlash * 2.0 + 0.5;
    GlassData glass = calculateGlassPhysics(screenUV, lightIntensity, flashLevel);

    vec3 col;

    if (glass.behindGlass > 0.01) {
        vec2 refractedUV = uv + glass.refractionOffset * 0.5;

        // ═══════════════════════════════════════════════════════════
        // TYPE 1: VIZ BOX - Light pooling effect
        // ═══════════════════════════════════════════════════════════
        if (glass.glassType > 0.5 && glass.glassType < 1.5) {
            // Sample with iOS-style blur for viz boxes
            float blurRadius = 2.0 + glass.poolGradient * 1.5;
            col = sampleWithBlur(refractedUV, blurRadius);

            // Chromatic aberration - skip extra samples on mobile
            if (mobile < 0.5) {
                float caStrength = glass.refraction * 0.015 * (1.0 + totalFlash * 0.5);
                vec2 caDir = normalize(glass.refractionOffset + vec2(0.001));
                vec3 colR = sampleSupernova(refractedUV + caDir * caStrength, T);
                vec3 colB = sampleSupernova(refractedUV - caDir * caStrength, T);
                col = vec3(colR.r, col.g, colB.b);
            }

            // Add flash
            col += warmWhite * flash * exp(-length(refractedUV) * 1.0) * 1.8;
            col += warmWhite * screenFlash * 1.0;

            // ═══ LIGHT POOLING ═══
            // Interior glow that concentrates light
            vec3 poolEffect = calculateLightPooling(
                screenUV, glass.boxCenter, glass.boxHalfSize,
                lightIntensity, flashLevel
            );
            col += poolEffect;

            // ═══ EDGE FOCUSING ═══
            // Caustic shimmer at edges where light "pours in"
            float caustic = sin(glass.focusingStrength * 25.0 + T * 1.5) * 0.5 + 0.5;
            col += teal * 0.12 * caustic * glass.focusingStrength;

            // Moderate frosting with saturation boost
            float luma = dot(col, vec3(0.3, 0.6, 0.1));
            float frostAmount = glass.glassOpacity * 0.35;
            col = mix(col, vec3(luma), frostAmount * 0.3);
            // Saturation boost to compensate (iOS style)
            col = mix(vec3(luma), col, 1.15);
            col *= mix(1.0, 0.5, glass.glassOpacity);

        // ═══════════════════════════════════════════════════════════
        // TYPE 2: TEXT BOX - Dramatic light warping
        // ═══════════════════════════════════════════════════════════
        } else if (glass.glassType > 1.5) {
            // Mobile: simplified rendering (single sample + flash)
            // Desktop: full chromatic aberration with color bleeding
            if (mobile > 0.5) {
                // Simple sample with basic CA approximation
                col = sampleSupernova(refractedUV, T);
                // Fake CA by shifting color channels slightly
                float caShift = 0.02 * (1.0 + flashLevel * 2.0);
                col.r *= 1.0 + caShift;
                col.b *= 1.0 - caShift * 0.5;
            } else {
                // ═══ ENHANCED CHROMATIC ABERRATION ═══
                float caBase = 0.025;
                float caFlash = caBase * (1.0 + flashLevel * 4.0);
                float flutter = sin(T * 3.0) * 0.3 + sin(T * 7.0) * 0.15;
                caFlash *= (1.0 + flutter * flashLevel);

                vec2 caDir = normalize(glass.refractionOffset + vec2(0.001));
                vec3 colR = sampleSupernova(refractedUV + caDir * caFlash * 1.5, T);
                vec3 colG = sampleSupernova(refractedUV, T);
                vec3 colB = sampleSupernova(refractedUV - caDir * caFlash * 1.5, T);
                col = vec3(colR.r, colG.g, colB.b);

                // ═══ COLOR BLEEDING DURING FLASH ═══
                if (flashLevel > 0.1) {
                    vec3 bleed = vec3(0.0);
                    bleed.r = sampleSupernova(refractedUV + vec2(0.025, 0.0) * flashLevel, T).r;
                    bleed.b = sampleSupernova(refractedUV - vec2(0.025, 0.0) * flashLevel, T).b;
                    col = mix(col, bleed, flashLevel * 0.35);
                }
            }

            // Add flash with extra intensity
            col += warmWhite * flash * exp(-length(refractedUV) * 1.0) * 2.2;
            col += warmWhite * screenFlash * 1.3;

            // ═══ OBSCURATION LAYER ═══
            // Semi-transparent overlay during flash - "too bright to read" effect
            float obscure = glass.obscurationLevel;
            col = mix(col, warmWhite * 1.8, obscure * 0.4);

            // Frosting with saturation boost
            float luma = dot(col, vec3(0.3, 0.6, 0.1));
            float frostAmount = glass.glassOpacity * 0.4;
            vec3 frostedCol = mix(col, vec3(luma), frostAmount * 0.35);
            // Strong saturation boost (iOS style)
            frostedCol = mix(vec3(luma), frostedCol, 1.25);
            col = frostedCol;
            col *= mix(1.0, 0.4, glass.glassOpacity);

        // ═══════════════════════════════════════════════════════════
        // FALLBACK: Generic glass (shouldn't happen but safety net)
        // ═══════════════════════════════════════════════════════════
        } else {
            col = sampleSupernova(refractedUV, T);
            col += warmWhite * flash * exp(-length(refractedUV) * 1.2) * 1.5;
            col += warmWhite * screenFlash * 0.9;
        }

        // ═══ COMMON GLASS EFFECTS ═══
        // Internal light scattering
        float scatter = glass.behindGlass * (0.12 + totalFlash * 0.35);
        col += warmWhite * scatter * 0.12;

        // Specular highlight
        col += warmWhite * glass.specular * (1.0 + totalFlash * 2.5);

    } else {
        // ═══ OUTSIDE GLASS: Full intensity supernova with gravitational effects ═══

        // ═══ SHADER-BASED STARS WITH GRAVITATIONAL LENSING ═══
        if (lensStrength > 0.01) {
            // Apply gravitational lensing to star coordinates
            vec2 lensedStarUV = gravitationalLens(gwDistortedUV, lensStrength, T);
            col = stars(lensedStarUV, T, parallax) * 0.3;

            // Add secondary lensed star images (ghost ring)
            if (lensStrength > 0.05 && mobile < 0.5) {
                vec2 secondaryUV = secondaryLens(gwDistortedUV, lensStrength * 0.7);
                float ringMask = smoothstep(0.06, 0.12, length(gwDistortedUV));
                ringMask *= smoothstep(0.25, 0.15, length(gwDistortedUV));
                col += stars(secondaryUV, T, parallax) * ringMask * 0.15;
            }

            // Tertiary lensing for extreme cases
            if (lensStrength > 0.3 && mobile < 0.5) {
                vec2 tertiaryUV = tertiaryLens(gwDistortedUV, lensStrength * 0.5);
                float innerRingMask = smoothstep(0.04, 0.08, length(gwDistortedUV));
                innerRingMask *= smoothstep(0.15, 0.10, length(gwDistortedUV));
                col += stars(tertiaryUV, T, parallax) * innerRingMask * 0.08;
            }
        } else {
            // Normal stars without lensing
            col = stars(gwDistortedUV, T, parallax) * 0.3;
        }

        // Main supernova with GW distortion
        col += sampleSupernova(gwDistortedUV, T);

        // Gravitational wave glow rings
        if (bhFormation > 0.01) {
            col += gravitationalWaveGlow(gwDistortedUV, T, bhFormation);
        }

        // Flash effects
        col += warmWhite * flash * exp(-length(gwDistortedUV) * 1.2) * 1.5;
        col += warmWhite * screenFlash * 0.9;
    }

    // ═══ FRESNEL EDGE GLOW ═══
    vec3 fresnelColor = mix(warmWhite, vec3(0.9, 0.95, 1.0), 0.3);
    col += fresnelColor * glass.fresnel * (0.6 + totalFlash * 1.5);

    // ═══ BEVEL HIGHLIGHT ═══
    col += warmWhite * glass.edgeBevel * (0.4 + totalFlash * 0.8);

    // ═══ ALPHA CALCULATION ═══
    float intensity = length(col);
    float alpha = smoothstep(0.0, 0.1, intensity);

    alpha = max(alpha, screenFlash * 0.95);
    alpha = max(alpha, flash * 0.9);

    // Type-specific alpha adjustments
    if (glass.glassType > 0.5 && glass.glassType < 1.5) {
        // Viz boxes: keep light visible, moderate readability reduction
        alpha *= mix(1.0, 0.6, glass.behindGlass);
    } else if (glass.glassType > 1.5) {
        // Text boxes: allow dramatic obscuration during flash
        alpha *= mix(1.0, 0.45, glass.behindGlass * (1.0 - flashLevel * 0.3));
    } else {
        alpha *= mix(1.0, 0.5, glass.behindGlass);
    }

    alpha = max(alpha, glass.fresnel * 0.8);
    alpha = max(alpha, glass.edgeBevel * 0.9);

    // Tone mapping
    col = col / (0.8 + col);
    col = pow(col, vec3(0.42));

    gl_FragColor = vec4(col, alpha);
}
`;

const VERTEX_SHADER = `attribute vec2 p; void main() { gl_Position = vec4(p, 0, 1); }`;

export interface ContentBox {
    x: number;      // Left edge (0-1 normalized)
    y: number;      // Top edge (0-1 normalized)
    width: number;  // Width (0-1 normalized)
    height: number; // Height (0-1 normalized)
    opacity: number; // 0 = transparent, 1 = opaque
    boxType: number; // 0 = excluded, 1 = viz box (light pooling), 2 = text box (dramatic)
}

export interface WebGLSupernovaConfig {
    fate: number;  // 0 = neutron star, 1 = black hole
    onPhaseChange?: (phase: string, time: number) => void;
    onComplete?: () => void;
}

export interface WebGLSupernovaRenderer {
    start: () => void;
    stop: () => void;
    destroy: () => void;
    getTime: () => number;
    isRunning: () => boolean;
    updateContentBoxes: (boxes: ContentBox[]) => void;
}

// Timeline phases (in seconds)
export const WEBGL_PHASES = {
    progenitor: { start: 0, end: 10 },
    explosion: { start: 10, end: 12 },
    remnant: { start: 12, end: 16 },
    finalState: { start: 16, end: 24 },
    fadeout: { start: 24, end: 28 }
};

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

// Query DOM for content boxes with three-tier classification
// Type 0: EXCLUDED (nav) - no glass effects
// Type 1: VIZ BOXES - light pooling effect
// Type 2: TEXT BOXES - dramatic refraction/warping
function queryContentBoxes(): ContentBox[] {
    const boxes: ContentBox[] = [];
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // ═══ TYPE 1: VIZ BOXES - Interactive visualization containers ═══
    // These get light pooling effect (light accumulates inside)
    const vizBoxSelectors = [
        '#glass-forest-container',
        '#payoff-matrix-container',
        '#light-cone-container',
        '#thermo-container',
        '#signal-container',
        '#chain-container',
        '#joining-container',
        '#carol-choice-container',
        '#window-container',
        '#mirror-container',
        '#suspicion-chain-container',
        '#transmission-container',
        '#credence-container',
        '#real-sky-container'
    ];

    // ═══ TYPE 1: STRUCTURAL ELEMENTS - Also get light pooling ═══
    const structuralSelectors = [
        '.card',
        '.content-card',
        '.glass-node-container',
        '.visualization-container',
        'footer'
    ];
    // NOTE: 'nav' is EXCLUDED - not in any selector list

    // ═══ TYPE 2: TEXT BOXES - Dramatic refraction/warping ═══
    const textBoxSelectors = [
        '.collapsible-content',
        'blockquote'
    ];

    // Query viz boxes (Type 1, highest priority)
    vizBoxSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            const rect = (el as HTMLElement).getBoundingClientRect();
            if (rect.bottom > 0 && rect.top < viewportHeight &&
                rect.right > 0 && rect.left < viewportWidth &&
                rect.width > 0 && rect.height > 0) {
                boxes.push({
                    x: rect.left / viewportWidth,
                    y: rect.top / viewportHeight,
                    width: rect.width / viewportWidth,
                    height: rect.height / viewportHeight,
                    opacity: 0.92,
                    boxType: 1  // VIZ BOX
                });
            }
        });
    });

    // Query structural elements (Type 1)
    structuralSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            const rect = (el as HTMLElement).getBoundingClientRect();
            if (rect.bottom > 0 && rect.top < viewportHeight &&
                rect.right > 0 && rect.left < viewportWidth &&
                rect.width > 0 && rect.height > 0) {
                // Avoid duplicates from viz boxes
                const isDuplicate = boxes.some(box =>
                    Math.abs(box.x - rect.left / viewportWidth) < 0.01 &&
                    Math.abs(box.y - rect.top / viewportHeight) < 0.01
                );
                if (!isDuplicate) {
                    boxes.push({
                        x: rect.left / viewportWidth,
                        y: rect.top / viewportHeight,
                        width: rect.width / viewportWidth,
                        height: rect.height / viewportHeight,
                        opacity: 0.85,
                        boxType: 1  // Structural as VIZ BOX type
                    });
                }
            }
        });
    });

    // Query text boxes (Type 2)
    textBoxSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            const rect = (el as HTMLElement).getBoundingClientRect();
            // Only include if actually visible (not collapsed)
            const style = window.getComputedStyle(el);
            const isVisible = style.display !== 'none' &&
                              style.visibility !== 'hidden' &&
                              rect.height > 10;

            if (isVisible &&
                rect.bottom > 0 && rect.top < viewportHeight &&
                rect.right > 0 && rect.left < viewportWidth) {
                boxes.push({
                    x: rect.left / viewportWidth,
                    y: rect.top / viewportHeight,
                    width: rect.width / viewportWidth,
                    height: rect.height / viewportHeight,
                    opacity: 0.5,
                    boxType: 2  // TEXT BOX
                });
            }
        });
    });

    return boxes.slice(0, MAX_CONTENT_BOXES);
}

export function createWebGLSupernova(config: WebGLSupernovaConfig): WebGLSupernovaRenderer | null {
    // Create canvas - positioned behind content
    const canvas = document.createElement('canvas');
    canvas.id = 'webgl-supernova-canvas';
    canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.5s ease-out;
        mix-blend-mode: screen;
    `;
    document.body.appendChild(canvas);

    // Get WebGL context with alpha for transparency
    const gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true
    });

    if (!gl) {
        console.error('WebGL not available');
        canvas.remove();
        return null;
    }

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Compile shaders
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) {
        canvas.remove();
        return null;
    }

    // Create program
    const program = gl.createProgram();
    if (!program) {
        canvas.remove();
        return null;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        canvas.remove();
        return null;
    }

    gl.useProgram(program);

    // Create vertex buffer (fullscreen triangle)
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const pAttr = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(pAttr);
    gl.vertexAttribPointer(pAttr, 2, gl.FLOAT, false, 0, 0);

    // Detect mobile for performance optimization
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (window.innerWidth < 768);

    // Get uniform locations
    const uR = gl.getUniformLocation(program, 'R');
    const uT = gl.getUniformLocation(program, 'T');
    const uM = gl.getUniformLocation(program, 'M');
    const uFate = gl.getUniformLocation(program, 'fate');
    const uAge = gl.getUniformLocation(program, 'age');
    const uMobile = gl.getUniformLocation(program, 'mobile');
    const uNumBoxes = gl.getUniformLocation(program, 'numBoxes');

    // Get uniform locations for content box arrays
    const uContentBoxes: WebGLUniformLocation[] = [];
    const uBoxOpacities: WebGLUniformLocation[] = [];
    const uBoxTypes: WebGLUniformLocation[] = [];
    for (let i = 0; i < MAX_CONTENT_BOXES; i++) {
        const boxLoc = gl.getUniformLocation(program, `contentBoxes[${i}]`);
        const opacityLoc = gl.getUniformLocation(program, `boxOpacities[${i}]`);
        const typeLoc = gl.getUniformLocation(program, `boxTypes[${i}]`);
        if (boxLoc) uContentBoxes.push(boxLoc);
        if (opacityLoc) uBoxOpacities.push(opacityLoc);
        if (typeLoc) uBoxTypes.push(typeLoc);
    }

    // State
    let width = 0;
    let height = 0;
    let mouse = [0, 0];
    let smoothMouse = [0, 0];
    let startTime = 0;
    let running = false;
    let animationId: number | null = null;
    let lastPhase = '';
    let contentBoxes: ContentBox[] = [];
    let boxUpdateCounter = 0;

    // Store a guaranteed non-null reference for use in closures
    const glContext = gl;

    // ══════════════════════════════════════════════════════════════
    // CANVAS SAMPLING - Adaptive glass response to WebGL content
    // ══════════════════════════════════════════════════════════════
    const SAMPLE_SIZE = 8;
    const sampleBuffer = new Uint8Array(SAMPLE_SIZE * SAMPLE_SIZE * 4);
    let sampleSkip = 0;
    const sampleEvery = isMobile ? 8 : 4; // Sample less frequently on mobile

    // Smoothed values for glass physics
    let glassLum = 0;
    let glassImpulse = 0;
    let glassRGB = [180, 170, 200];
    let lightDir = [0, -0.7];

    // Supernova position tracking (for scroll-aware lighting)
    let supernovaScreenX = 0.5;  // Normalized screen position (0-1)
    let supernovaScreenY = 0.5;
    let scrollAtStart = 0;

    // Glass element cache
    let glassElements: HTMLElement[] = [];
    let lastGlassQuery = 0;

    // CSS variable cache to avoid redundant DOM writes
    const cssCache: Map<HTMLElement, Map<string, string>> = new Map();

    // Utility functions
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const smoothstep = (a: number, b: number, x: number) => {
        const t = clamp01((x - a) / (b - a));
        return t * t * (3 - 2 * t);
    };

    // Query glass elements (cached, refresh every 500ms)
    function queryGlassElements(): HTMLElement[] {
        const now = performance.now();
        if (now - lastGlassQuery < 500 && glassElements.length > 0) {
            return glassElements;
        }
        lastGlassQuery = now;

        // Panel selectors - innermost visible containers that get rim effects
        // These get both 'glass-active' (text colors) and 'glass-panel' (pseudo-elements)
        const panelSelectors = [
            // Collapsible: header is separate panel, inner is content panel
            '.collapsible-header',
            '.collapsible-inner',
            // Cards and containers
            'blockquote',
            '.card',
            '.content-card',
            '.visualization-container',
            '.distinction-card',
            '.equation-box',
            '.interactive-box',
            '.section-header',
            '.hero-quote',
            '.show-quote',
            '.show-title',
            // ASCII interactive: header and content are separate panels
            '.ascii-header',
            '.ascii-content',
            // Prose and footer
            '.prose',
            'footer'
        ];

        // Container selectors - parents that need text color inheritance only
        // These only get 'glass-active' (no pseudo-elements to avoid stacking)
        const containerSelectors = [
            '.thought-experiment',
            '.ascii-interactive',
            '.collapsible',
            '.collapsible-content',
        ];

        const elements: HTMLElement[] = [];
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Helper to check if element is visible and in viewport
        const isVisibleInViewport = (el: HTMLElement): boolean => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return style.display !== 'none' &&
                   style.visibility !== 'hidden' &&
                   rect.height > 10 &&
                   rect.bottom > 0 && rect.top < viewportHeight &&
                   rect.right > 0 && rect.left < viewportWidth;
        };

        // Collect all visible elements
        const allSelectors = [...panelSelectors, ...containerSelectors];
        allSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                const htmlEl = el as HTMLElement;
                if (isVisibleInViewport(htmlEl)) {
                    elements.push(htmlEl);
                }
            });
        });

        // Mark which elements are panels (innermost - get pseudo-elements)
        const panelSet = new Set<string>(panelSelectors);
        elements.forEach(el => {
            // Check if this element matches any panel selector
            const isPanel = panelSelectors.some(sel => el.matches(sel));
            if (isPanel) {
                el.classList.add('glass-panel');
            }
        });

        glassElements = elements;
        return elements;
    }

    // Set CSS variable with caching to avoid redundant DOM writes
    function setGlassVar(element: HTMLElement, name: string, value: string): void {
        let cache = cssCache.get(element);
        if (!cache) {
            cache = new Map();
            cssCache.set(element, cache);
        }
        if (cache.get(name) === value) return;
        cache.set(name, value);
        element.style.setProperty(name, value);
    }

    // Sample canvas behind glass elements and update CSS variables
    function updateGlassAdaptive(t: number): void {
        const elements = queryGlassElements();
        if (elements.length === 0) return;

        // Throttled canvas sampling
        const shouldSample = (sampleSkip++ % sampleEvery) === 0;

        // Calculate supernova screen position accounting for scroll
        const scrollDelta = window.scrollY - scrollAtStart;
        const supernovaY = supernovaScreenY - scrollDelta / window.innerHeight;

        // Flash timing (mirror shader for instant response)
        // WEBGL_PHASES.progenitor ends at 10, explosion peaks around 10
        const flash = smoothstep(9.8, 10.0, t) * (1 - smoothstep(10.0, 11.5, t));
        const screenFlash = smoothstep(9.9, 10.05, t) * (1 - smoothstep(10.05, 10.8, t));
        const eventLum = clamp01(screenFlash * 1.2 + flash * 0.5);

        // Direct flash boost - bypasses smoothing for immediate rim response
        const flashBurst = smoothstep(9.85, 10.0, t) * (1 - smoothstep(10.0, 10.5, t));

        // Sample first visible element (primary glass panel)
        if (shouldSample && elements.length > 0) {
            const primaryElement = elements[0];
            const rect = primaryElement.getBoundingClientRect();

            if (rect.width > 10 && rect.height > 10) {
                const dpr = Math.min(isMobile ? 1.0 : 1.5, window.devicePixelRatio);

                // Sample center of glass panel
                const cx = (rect.left + rect.width * 0.5) * dpr;
                const cy = (window.innerHeight - (rect.top + rect.height * 0.5)) * dpr;

                const S = Math.min(SAMPLE_SIZE, width, height);
                if (S >= 2) {
                    const x0 = Math.max(0, Math.min(width - S, Math.floor(cx - S * 0.5)));
                    const y0 = Math.max(0, Math.min(height - S, Math.floor(cy - S * 0.5)));

                    try {
                        glContext.readPixels(x0, y0, S, S, glContext.RGBA, glContext.UNSIGNED_BYTE, sampleBuffer);

                        let r = 0, g = 0, b = 0;
                        let lumL = 0, lumR = 0, lumT = 0, lumB = 0;
                        const half = S >> 1;
                        const n = S * S;

                        for (let y = 0; y < S; y++) {
                            for (let x = 0; x < S; x++) {
                                const k = (y * S + x) * 4;
                                const rr = sampleBuffer[k];
                                const gg = sampleBuffer[k + 1];
                                const bb = sampleBuffer[k + 2];

                                r += rr; g += gg; b += bb;

                                // Luminance for gradient detection
                                const l = (0.2126 * rr + 0.7152 * gg + 0.0722 * bb) / 255;

                                // Split into quadrants for light direction
                                if (x < half) lumL += l; else lumR += l;
                                if (y < half) lumB += l; else lumT += l;
                            }
                        }

                        r /= n; g /= n; b /= n;
                        glassRGB = [r, g, b];

                        // Light direction: gradient pointing toward brighter region
                        const inv = 2.0 / n;
                        const gX = (lumR - lumL) * inv;
                        const gY = (lumB - lumT) * inv;

                        const gMag = Math.hypot(gX, gY);
                        if (gMag > 0.01) {
                            lightDir[0] += (gX / gMag - lightDir[0]) * 0.3;
                            lightDir[1] += (gY / gMag - lightDir[1]) * 0.3;
                        }
                    } catch {
                        // Keep last values if readPixels fails
                    }
                }
            }
        }

        // Override light direction to point toward supernova
        // Only during active phases (not progenitor or fadeout)
        if (t > 9.5 && t < 45) {
            elements.forEach(element => {
                const rect = element.getBoundingClientRect();
                const elemCenterX = (rect.left + rect.width * 0.5) / window.innerWidth;
                const elemCenterY = (rect.top + rect.height * 0.5) / window.innerHeight;

                // Direction from element toward supernova
                const dx = supernovaScreenX - elemCenterX;
                const dy = supernovaY - elemCenterY;
                const mag = Math.hypot(dx, dy);

                if (mag > 0.02) {
                    // Blend toward supernova direction during flash
                    const blendStrength = eventLum * 0.8;
                    lightDir[0] = lerp(lightDir[0], dx / mag, blendStrength);
                    lightDir[1] = lerp(lightDir[1], -dy / mag, blendStrength); // Flip for CSS coords
                }
            });
        }

        // Combine sampled luminance with event luminance
        const sampledLum = (0.2126 * glassRGB[0] + 0.7152 * glassRGB[1] + 0.0722 * glassRGB[2]) / 255;
        const targetLum = clamp01(sampledLum * 0.5 + eventLum);

        // Smooth the luminance
        const delta = targetLum - glassLum;
        glassLum += delta * 0.12;

        // Impulse tracks rate of change + direct flash contribution
        glassImpulse += (Math.abs(delta) - glassImpulse) * 0.15;
        glassImpulse = Math.max(glassImpulse, flashBurst * 0.8);
        const imp = clamp01(glassImpulse * 4 + flashBurst * 0.5);

        // ─── BLACK HOLE GRAVITATIONAL EFFECTS ───
        let bhStrength = 0;
        let bhRedshift = 0;
        let gwIntensity = 0;
        let gwPhase = 0;

        if (config.fate > 0.5 && t > 12) {
            // BH forms at T=16, strength builds
            bhStrength = smoothstep(16, 36, t);
            bhStrength *= 1.0 + 0.1 * Math.sin(t * 0.15);

            // Redshift increases with proximity
            bhRedshift = bhStrength * (0.5 + glassLum * 0.5);

            // Light direction shifts toward BH (center/up)
            const bhLightInfluence = bhStrength * 0.6;
            lightDir[0] += (0 - lightDir[0]) * bhLightInfluence * 0.1;
            lightDir[1] += (-0.8 - lightDir[1]) * bhLightInfluence * 0.1;

            // ─── GRAVITATIONAL WAVES ───
            const gwStart = 12;
            const gwEnd = 28;
            const gwElapsed = t - gwStart;

            if (gwElapsed > 0 && gwElapsed < (gwEnd - gwStart)) {
                const waveCount = 5;
                let totalIntensity = 0;

                for (let i = 0; i < waveCount; i++) {
                    const waveDelay = i * 1.8;
                    const waveAge = gwElapsed - waveDelay;

                    if (waveAge > 0 && waveAge < 8) {
                        const wavePeak = 1.5;
                        const waveDecay = 0.4 + i * 0.1;

                        let intensity: number;
                        if (waveAge < wavePeak) {
                            intensity = smoothstep(0, wavePeak, waveAge);
                        } else {
                            intensity = Math.exp(-(waveAge - wavePeak) * waveDecay);
                        }

                        intensity *= (1 - i * 0.15);
                        totalIntensity += intensity;
                    }
                }

                gwIntensity = clamp01(totalIntensity * 0.5) * smoothstep(12, 16, t);
                gwPhase = (Math.sin(gwElapsed * 0.8) * 0.5 + 0.5) * gwIntensity;
            }
        }

        // ─── ADAPTIVE TEXT COLORS ───
        // Dark bg → light text, Bright bg → dark text (like stardust)
        const tMix = smoothstep(0.25, 0.7, glassLum);

        const mainR = Math.round(lerp(255, 20, tMix));
        const mainG = Math.round(lerp(255, 18, tMix));
        const mainB = Math.round(lerp(255, 25, tMix));
        const mainA = lerp(0.9, 0.95, tMix);

        const bodyR = Math.round(lerp(255, 35, tMix));
        const bodyG = Math.round(lerp(255, 32, tMix));
        const bodyB = Math.round(lerp(255, 42, tMix));
        const bodyA = lerp(0.8, 0.9, tMix);

        const muteR = Math.round(lerp(200, 70, tMix));
        const muteG = Math.round(lerp(195, 68, tMix));
        const muteB = Math.round(lerp(210, 80, tMix));
        const muteA = lerp(0.7, 0.8, tMix);

        // ─── DIRECTIONAL SHADOWS ───
        // Shadow casts AWAY from light source
        const shadowMag = 1 + glassLum * 4 + imp * 3;
        const sx = -lightDir[0] * shadowMag;
        const sy = -lightDir[1] * shadowMag;
        const shadowBlur = 6 + glassLum * 8 + imp * 4;
        const shadowAlpha = 0.25 + glassLum * 0.4 + imp * 0.15;

        // ─── DYNAMIC BORDER ───
        // Border glows with sampled color during flash
        const borderR = Math.round(200 + glassLum * 55);
        const borderG = Math.round(195 + glassLum * 60);
        const borderB = Math.round(215 + glassLum * 40);
        const borderA = 0.08 + glassLum * 0.4;

        // ─── UPDATE CSS VARIABLES ON ALL GLASS ELEMENTS ───
        elements.forEach(element => {
            // Add glass-active class for CSS effects
            element.classList.add('glass-active');

            // Core values
            setGlassVar(element, '--lum', glassLum.toFixed(3));
            setGlassVar(element, '--impulse', imp.toFixed(3));

            // Sampled tint color
            setGlassVar(element, '--tint-r', Math.round(glassRGB[0]).toString());
            setGlassVar(element, '--tint-g', Math.round(glassRGB[1]).toString());
            setGlassVar(element, '--tint-b', Math.round(glassRGB[2]).toString());

            // Light direction
            setGlassVar(element, '--light-x', lightDir[0].toFixed(3));
            setGlassVar(element, '--light-y', lightDir[1].toFixed(3));

            // Adaptive text colors (text darkens on bright background)
            setGlassVar(element, '--text-main', `rgba(${mainR}, ${mainG}, ${mainB}, ${mainA.toFixed(2)})`);
            setGlassVar(element, '--text-body', `rgba(${bodyR}, ${bodyG}, ${bodyB}, ${bodyA.toFixed(2)})`);
            setGlassVar(element, '--text-mute', `rgba(${muteR}, ${muteG}, ${muteB}, ${muteA.toFixed(2)})`);

            // Directional shadows
            setGlassVar(element, '--shadow-x', `${sx.toFixed(1)}px`);
            setGlassVar(element, '--shadow-y', `${sy.toFixed(1)}px`);
            setGlassVar(element, '--shadow-blur', `${shadowBlur.toFixed(1)}px`);
            setGlassVar(element, '--shadow-a', shadowAlpha.toFixed(3));

            // Dynamic border
            setGlassVar(element, '--border-color', `rgba(${borderR}, ${borderG}, ${borderB}, ${borderA.toFixed(2)})`);

            // Black hole effects
            setGlassVar(element, '--bh-strength', bhStrength.toFixed(4));
            setGlassVar(element, '--bh-redshift', bhRedshift.toFixed(4));
            setGlassVar(element, '--gw-intensity', gwIntensity.toFixed(4));
            setGlassVar(element, '--gw-phase', gwPhase.toFixed(4));
        });
    }

    // Clear glass CSS variables when effect ends
    function clearGlassEffects(): void {
        glassElements.forEach(element => {
            // Remove glass classes
            element.classList.remove('glass-active');
            element.classList.remove('glass-panel');

            // Reset all CSS variables
            element.style.removeProperty('--lum');
            element.style.removeProperty('--impulse');
            element.style.removeProperty('--tint-r');
            element.style.removeProperty('--tint-g');
            element.style.removeProperty('--tint-b');
            element.style.removeProperty('--light-x');
            element.style.removeProperty('--light-y');
            element.style.removeProperty('--text-main');
            element.style.removeProperty('--text-body');
            element.style.removeProperty('--text-mute');
            element.style.removeProperty('--shadow-x');
            element.style.removeProperty('--shadow-y');
            element.style.removeProperty('--shadow-blur');
            element.style.removeProperty('--shadow-a');
            element.style.removeProperty('--border-color');
            element.style.removeProperty('--bh-strength');
            element.style.removeProperty('--bh-redshift');
            element.style.removeProperty('--gw-intensity');
            element.style.removeProperty('--gw-phase');
        });
        cssCache.clear();
        glassElements = [];
    }

    function updateContentBoxes(boxes: ContentBox[]) {
        contentBoxes = boxes.slice(0, MAX_CONTENT_BOXES);
    }

    function resize() {
        // Lower DPR cap on mobile for better performance
        const maxDpr = isMobile ? 1.0 : 1.5;
        const dpr = Math.min(maxDpr, window.devicePixelRatio);
        width = Math.floor(window.innerWidth * dpr);
        height = Math.floor(window.innerHeight * dpr);
        canvas.width = width;
        canvas.height = height;
        glContext.viewport(0, 0, width, height);

        if (smoothMouse[0] === 0) {
            smoothMouse[0] = mouse[0] = width / 2;
            smoothMouse[1] = mouse[1] = height / 2;
        }

        // Update content boxes on resize
        contentBoxes = queryContentBoxes();
    }

    function handleMouseMove(e: MouseEvent) {
        const sx = width / window.innerWidth;
        const sy = height / window.innerHeight;
        mouse[0] = e.clientX * sx;
        mouse[1] = (window.innerHeight - e.clientY) * sy;
    }

    function handleScroll() {
        // Update content boxes on scroll
        contentBoxes = queryContentBoxes();
    }

    function getTime(): number {
        if (!running) return 0;
        return (performance.now() - startTime) / 1000;
    }

    function getCurrentPhase(t: number): string {
        if (t < WEBGL_PHASES.progenitor.end) return 'progenitor';
        if (t < WEBGL_PHASES.explosion.end) return 'explosion';
        if (t < WEBGL_PHASES.remnant.end) return 'remnant';
        if (t < WEBGL_PHASES.finalState.end) return config.fate > 0.5 ? 'blackhole' : 'neutron';
        if (t < WEBGL_PHASES.fadeout.end) return 'fadeout';
        return 'complete';
    }

    function render() {
        if (!running) return;

        // Smooth mouse movement
        smoothMouse[0] += (mouse[0] - smoothMouse[0]) * 0.05;
        smoothMouse[1] += (mouse[1] - smoothMouse[1]) * 0.05;

        const t = getTime();

        // Check phase changes
        const currentPhase = getCurrentPhase(t);
        if (currentPhase !== lastPhase) {
            lastPhase = currentPhase;
            config.onPhaseChange?.(currentPhase, t);

            if (currentPhase === 'complete') {
                stop();
                config.onComplete?.();
                return;
            }
        }

        // Periodically update content boxes (every 10 frames)
        boxUpdateCounter++;
        if (boxUpdateCounter % 10 === 0) {
            contentBoxes = queryContentBoxes();
        }

        // Update uniforms
        glContext.uniform2f(uR, width, height);
        glContext.uniform1f(uT, t);
        glContext.uniform2f(uM, smoothMouse[0], smoothMouse[1]);
        glContext.uniform1f(uFate, config.fate);
        glContext.uniform1f(uAge, 0);
        glContext.uniform1f(uMobile, isMobile ? 1.0 : 0.0);
        glContext.uniform1i(uNumBoxes, contentBoxes.length);

        // Update content box uniforms (with three-tier system)
        for (let i = 0; i < MAX_CONTENT_BOXES; i++) {
            if (i < contentBoxes.length) {
                const box = contentBoxes[i];
                // Convert to shader coordinates (flip Y)
                glContext.uniform4f(
                    uContentBoxes[i],
                    box.x,
                    1.0 - box.y - box.height,  // Flip Y
                    box.width,
                    box.height
                );
                glContext.uniform1f(uBoxOpacities[i], box.opacity);
                glContext.uniform1f(uBoxTypes[i], box.boxType);  // 0=excluded, 1=viz, 2=text
            } else {
                glContext.uniform4f(uContentBoxes[i], 0, 0, 0, 0);
                glContext.uniform1f(uBoxOpacities[i], 0);
                glContext.uniform1f(uBoxTypes[i], 0);  // Excluded by default
            }
        }

        // Clear with transparency
        glContext.clearColor(0, 0, 0, 0);
        glContext.clear(glContext.COLOR_BUFFER_BIT);
        glContext.drawArrays(glContext.TRIANGLES, 0, 3);

        // Update glass elements with adaptive lighting from canvas sampling
        updateGlassAdaptive(t);

        animationId = requestAnimationFrame(render);
    }

    function start() {
        if (running) return;

        running = true;
        startTime = performance.now();
        lastPhase = '';
        boxUpdateCounter = 0;

        // Initialize scroll-aware supernova position
        scrollAtStart = window.scrollY;
        // Supernova spawns at center of viewport
        supernovaScreenX = 0.5;
        supernovaScreenY = 0.5;

        // Reset glass state
        glassLum = 0;
        glassImpulse = 0;
        glassRGB = [180, 170, 200];
        lightDir = [0, -0.7];

        resize();
        contentBoxes = queryContentBoxes();

        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('scroll', handleScroll, { passive: true });

        // Fade in
        requestAnimationFrame(() => {
            canvas.style.opacity = '1';
        });

        render();
    }

    function stop() {
        running = false;

        if (animationId !== null) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('scroll', handleScroll);

        // Clean up glass effects
        clearGlassEffects();

        // Fade out
        canvas.style.opacity = '0';
    }

    function destroy() {
        stop();

        // Clean up WebGL resources
        glContext.deleteProgram(program);
        glContext.deleteShader(vertexShader);
        glContext.deleteShader(fragmentShader);
        glContext.deleteBuffer(buffer);

        // Remove canvas after fade
        setTimeout(() => {
            canvas.remove();
        }, 600);
    }

    return {
        start,
        stop,
        destroy,
        getTime,
        isRunning: () => running,
        updateContentBoxes
    };
}
