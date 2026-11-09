
/* ============================================
   AURA-CREATOR-MUSEUM
   REALISTIC DEEP SPACE GALAXY ENGINE
   Three.js r161
============================================ */

import * as THREE from "three";

import { OrbitControls } from
"three/addons/controls/OrbitControls.js";

import {
    initializeCamera,
    moveCamera,
    cancelCameraAnimation,
    destroyCamera
} from "./camera.js";

// ============================================
// GLOBAL STATE
// ============================================

let scene;
let camera;
let renderer;
let controls;
let raycaster;
let pointer;

let galaxyGroup;
let creatorGroup;

let animationFrame = null;
let clickCallback = null;
let contextLost = false;
let renderFailureLogged = false;
let fallbackCanvas = null;
let fallbackContext = null;
let fallbackCreators = [];
let fallbackYaw = 0.28;
let fallbackPitch = 0.72;
let fallbackDistance = 390;
let fallbackPointer = null;
let fallbackDrawFrame = null;
let fallbackCameraFrame = null;
let fallbackTarget = { x: 0, y: 0, z: 0 };
let focusedCreatorId = null;
let creatorFocusExitTimer = null;
let statusTimeout = null;
const fallbackStars = createFallbackStars(720);
const fallbackGalaxyParticles = createFallbackGalaxyParticles();
const fallbackDistantGalaxies = createFallbackDistantGalaxies();
let fallbackHitTargets = [];
let fallbackTouchPoints = new Map();
let universeExitCallback = null;
let creatorFocusGraceUntil = 0;
let creatorFocusHasArrived = false;
let creatorAvatarOverlay = null;

let pointerStart = null;
let lastFrame = 0;

const creatorObjects = new Map();
const creatorAvatarElements = new Map();
const animatedObjects = [];
const creatorOverlayWorldPosition = new THREE.Vector3();
const creatorOverlayScreenPosition = new THREE.Vector3();

const clock = new THREE.Clock();
let glowTexture = null;

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    galaxyRadius: 180,
    dustCount: 3000,

    creatorMinRadius: 68,
    creatorMaxRadius: 210,

    rotationSpeed: 0.000035,

    background: 0x02030b
};

// ============================================
// INITIALIZE GALAXY
// ============================================

export function initializeGalaxy(
    canvas,
    creators,
    onCreatorSelect,
    onCreatorExit
) {

    if (renderer || scene || fallbackCanvas) {
        destroyGalaxy();
    }

    contextLost = false;
    renderFailureLogged = false;
    lastFrame = 0;
    pointerStart = null;
    showGalaxyStatus("");
    clickCallback = onCreatorSelect;
    universeExitCallback = onCreatorExit;

    // Scene

    scene = new THREE.Scene();

    scene.background = new THREE.Color(
        CONFIG.background
    );

    scene.fog = new THREE.FogExp2(
        CONFIG.background,
        0.00085
    );

    // Camera

    camera = new THREE.PerspectiveCamera(
        58,
        Math.max(canvas.clientWidth, 1) / Math.max(canvas.clientHeight, 1),
        0.1,
        3000
    );

    camera.position.set(0, 165, 260);

    // Renderer

    try {
        const webglContext = canvas.getContext("webgl2", {
            alpha: false,
            antialias: false,
            powerPreference: "low-power",
            preserveDrawingBuffer: false
        });

        if (!webglContext) {
            throw new Error("WebGL2 is disabled or unavailable.");
        }

        renderer = new THREE.WebGLRenderer({
            canvas,
            context: webglContext,
            antialias: false,
            alpha: false,
            powerPreference: "low-power",
            preserveDrawingBuffer: false
        });
    } catch (error) {
        console.warn(
            "AURA WebGL is unavailable; starting the interactive perspective fallback.",
            error.message
        );
        scene = null;
        camera = null;
        createFallbackGalaxy(canvas, creators, onCreatorSelect);
        showGalaxyStatus(
            "WebGL is unavailable here; interactive perspective exploration is active.",
            6000
        );
        return false;
    }

    renderer.setPixelRatio(getAdaptivePixelRatio());

    renderer.setSize(
        Math.max(canvas.clientWidth, 1),
        Math.max(canvas.clientHeight, 1),
        false
    );

    renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    renderer.toneMapping =
        THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure = 0.9;

    // Controls

    controls = new OrbitControls(
        camera,
        renderer.domElement
    );

    controls.enableDamping = true;
    controls.dampingFactor = 0.045;

    controls.enablePan = true;
    controls.screenSpacePanning = true;

    controls.minDistance = 9;
    controls.maxDistance = 2600;

    controls.maxPolarAngle = Math.PI * 0.94;
    controls.minPolarAngle = 0.08;

    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.85;
    controls.panSpeed = 0.8;

    controls.target.set(0, 0, 0);
    controls.addEventListener("change", handleCreatorZoomChange);
    controls.addEventListener("start", () => setExplorationChromeVisible(false));
    controls.addEventListener("end", () => {
        if (camera.position.distanceTo(controls.target) >= 300) {
            setExplorationChromeVisible(true);
        }
    });

    // Interaction

    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    raycaster.params.Points.threshold = 1.5;

    initializeCamera(camera, controls);

    // Main world groups

    galaxyGroup = new THREE.Group();
    galaxyGroup.name = "mainGalaxy";

    scene.add(galaxyGroup);

    creatorGroup = new THREE.Group();
    creatorGroup.name = "creatorSystems";

    scene.add(creatorGroup);

    // Build universe

    glowTexture = createGlowTexture();
    createLighting();

    createBackgroundStars();

    createSpiralGalaxy();

    createNebulaClouds();

    createGalaxyDust();

    createCentralCore();

    createDistantGalaxies();

    createCreatorStars(creators);

    // Events

    renderer.domElement.addEventListener(
        "pointerdown",
        handlePointerDown
    );

    renderer.domElement.addEventListener(
        "pointerup",
        handlePointerUp
    );

    renderer.domElement.addEventListener(
        "pointermove",
        handlePointerMove
    );

    renderer.domElement.addEventListener(
        "webglcontextlost",
        handleWebGLContextLost,
        false
    );

    renderer.domElement.addEventListener(
        "webglcontextrestored",
        handleWebGLContextRestored,
        false
    );

    window.addEventListener(
        "resize",
        resizeGalaxy
    );

    // Start

    clock.start();

    animate();

    moveCamera(
        new THREE.Vector3(0, 205, 270),
        new THREE.Vector3(0, 0, 0),
        5200
    );

    console.log(
        "AURA Galaxy initialized with",
        creators.length,
        "creator systems."
    );
    return true;
}

function getAdaptivePixelRatio() {

    const deviceMemory = navigator.deviceMemory || 8;
    const hardwareConcurrency = navigator.hardwareConcurrency || 8;
    const lowPowerDevice = deviceMemory <= 4 || hardwareConcurrency <= 4;
    const cap = lowPowerDevice ? 1 : 1.35;

    return Math.max(1, Math.min(window.devicePixelRatio || 1, cap));

}

function showGalaxyStatus(message, duration = 0) {

    const status = document.getElementById("galaxyStatus");
    if (!status) return;

    clearTimeout(statusTimeout);
    status.textContent = message;
    status.classList.toggle("visible", Boolean(message));

    if (message && duration > 0) {
        statusTimeout = setTimeout(() => {
            status.classList.remove("visible");
            statusTimeout = null;
        }, duration);
    }

}

function setExplorationChromeVisible(visible) {

    document.getElementById("heroSection")
        ?.classList.toggle("hidden", !visible);
    document.getElementById("rankingPanel")
        ?.classList.toggle("hidden", !visible);
    const hint = document.getElementById("exploreHint");
    if (hint) hint.style.opacity = visible ? "1" : "0";

}

function createFallbackGalaxy(canvas, creators, onCreatorSelect) {

    const host = canvas.parentElement;
    if (!host) return;

    fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.setAttribute("aria-label", "Interactive perspective creator universe");
    fallbackCanvas.style.cssText =
        "position:absolute;inset:0;z-index:1;width:100%;height:100%;touch-action:none;cursor:grab;";
    host.appendChild(fallbackCanvas);
    fallbackContext = fallbackCanvas.getContext("2d");
    if (!fallbackContext) {
        fallbackCanvas.remove();
        fallbackCanvas = null;
        showGalaxyStatus(
            "WebGL and 2D canvas are unavailable. Enable browser graphics acceleration and reload."
        );
        return;
    }

    canvas.style.visibility = "hidden";
    fallbackCreators = creators.map((creator, index) => {
        const angle = index * Math.PI * (3 - Math.sqrt(5));
        const radius = THREE.MathUtils.mapLinear(
            index,
            0,
            Math.max(creators.length - 1, 1),
            CONFIG.creatorMinRadius,
            CONFIG.creatorMaxRadius
        );
        return {
            creator,
            x: Math.cos(angle) * radius,
            y: Math.sin(index * 2.3) * 24 + Math.cos(index * 1.7) * 10,
            z: Math.sin(angle) * radius,
            sprite: createFallbackCreatorSprite(creator)
        };
    });

    fallbackCanvas.addEventListener("pointerdown", handleFallbackPointerDown);
    fallbackCanvas.addEventListener("pointermove", handleFallbackPointerMove);
    fallbackCanvas.addEventListener("pointerup", handleFallbackPointerUp);
    fallbackCanvas.addEventListener("pointercancel", handleFallbackPointerCancel);
    fallbackCanvas.addEventListener("wheel", handleFallbackWheel, { passive: false });
    fallbackCanvas.addEventListener("contextmenu", event => event.preventDefault());
    window.addEventListener("resize", resizeGalaxy);
    resizeGalaxy();

}

function createFallbackRandom(seed) {

    let value = seed;
    return () => {
        value += 0x6d2b79f5;
        let next = value;
        next = Math.imul(next ^ (next >>> 15), next | 1);
        next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
        return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
    };

}

function createFallbackStars(count) {

    const random = createFallbackRandom(0x41555241);
    return Array.from({ length: count }, () => {
        const theta = random() * Math.PI * 2;
        const y = random() * 2 - 1;
        const ring = Math.sqrt(1 - y * y);
        const radius = 230 + random() * 520;
        return {
            x: Math.cos(theta) * ring * radius,
            y: y * radius,
            z: Math.sin(theta) * ring * radius,
            size: 0.45 + random() * 1.35,
            alpha: 0.25 + random() * 0.7,
            color: ["#d9d8ff", "#9ebeff", "#c9aaff", "#83e3ff", "#ffc6eb"][
                Math.floor(random() * 5)
            ]
        };
    });

}

function createFallbackGalaxyParticles() {

    const random = createFallbackRandom(0x47414c41);
    const palette = ["172,125,255", "88,151,255", "244,134,221", "126,204,255"];
    const particles = [];
    for (let arm = 0; arm < 5; arm++) {
        for (let index = 0; index < 280; index++) {
            const progress = random();
            const radius = 7 + progress * 180;
            const angle = arm * Math.PI * 2 / 5 + radius * 0.095 +
                (random() - 0.5) * (0.12 + progress * 0.36);
            particles.push({
                x: Math.cos(angle) * radius + (random() - 0.5) * 5,
                y: (random() - 0.5) * (3 + progress * 8),
                z: Math.sin(angle) * radius + (random() - 0.5) * 5,
                size: 0.55 + random() * 1.15,
                color: palette[Math.floor(random() * palette.length)],
                alpha: 0.22 + (1 - progress) * 0.48
            });
        }
    }
    return particles;

}

function createFallbackDistantGalaxies() {

    const random = createFallbackRandom(0x4d554c54);
    const palette = ["176,145,255", "113,171,255", "220,137,255", "107,220,255"];
    const particles = [];

    for (let galaxy = 0; galaxy < 32; galaxy++) {
        const theta = random() * Math.PI * 2;
        const vertical = random() * 2 - 1;
        const ring = Math.sqrt(1 - vertical * vertical);
        const distance = 440 + random() * 1100;
        const center = {
            x: Math.cos(theta) * ring * distance,
            y: vertical * distance,
            z: Math.sin(theta) * ring * distance
        };
        const tilt = random() * Math.PI;
        const rotation = random() * Math.PI * 2;
        for (let star = 0; star < 28; star++) {
            const progress = random();
            const radius = 2 + progress * (7 + random() * 7);
            const angle = star % 3 * Math.PI * 2 / 3 + radius * 0.19 +
                (random() - 0.5) * 0.48 + rotation;
            const flatZ = Math.sin(angle) * radius * 0.58;
            particles.push({
                x: center.x + Math.cos(angle) * radius,
                y: center.y + flatZ * Math.sin(tilt),
                z: center.z + flatZ * Math.cos(tilt),
                size: 0.5 + random() * 0.8,
                alpha: 0.32 + random() * 0.5,
                color: palette[galaxy % palette.length]
            });
        }
    }

    return particles;

}

function createFallbackCreatorSprite(creator) {

    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext("2d");
    if (!context) return canvas;

    const color = `#${new THREE.Color(creator.color).getHexString()}`;
    const glow = context.createRadialGradient(48, 48, 9, 48, 48, 46);
    glow.addColorStop(0, `${color}bb`);
    glow.addColorStop(0.62, `${color}55`);
    glow.addColorStop(1, `${color}00`);
    context.fillStyle = glow;
    context.fillRect(0, 0, 96, 96);
    context.save();
    context.beginPath();
    context.arc(48, 48, 30, 0, Math.PI * 2);
    context.clip();
    const background = context.createLinearGradient(18, 18, 78, 78);
    background.addColorStop(0, color);
    background.addColorStop(1, "#10142d");
    context.fillStyle = background;
    context.fillRect(18, 18, 60, 60);
    context.fillStyle = "#dca985";
    context.beginPath();
    context.ellipse(48, 49, 18, 22, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#221b34";
    context.beginPath();
    context.ellipse(48, 39, 20, 17, 0, Math.PI, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(29, 42);
    context.quadraticCurveTo(32, 18, 49, 20);
    context.quadraticCurveTo(68, 20, 68, 44);
    context.quadraticCurveTo(49, 30, 29, 42);
    context.fill();
    context.restore();
    context.strokeStyle = "rgba(255,255,255,0.82)";
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(48, 48, 32, 0, Math.PI * 2);
    context.stroke();
    const portrait = new Image();
    portrait.onload = () => {
        context.clearRect(18, 18, 60, 60);
        context.save();
        context.beginPath();
        context.arc(48, 48, 29, 0, Math.PI * 2);
        context.clip();
        context.drawImage(portrait, 18, 18, 60, 60);
        context.restore();
        context.strokeStyle = "rgba(255,255,255,0.82)";
        context.lineWidth = 2.5;
        context.beginPath();
        context.arc(48, 48, 32, 0, Math.PI * 2);
        context.stroke();
        scheduleFallbackDraw();
    };
    portrait.src = creator.avatar;
    return canvas;

}

function projectFallbackPoint(point, width, height) {

    const relativeX = point.x - fallbackTarget.x;
    const relativeY = point.y - fallbackTarget.y;
    const relativeZ = point.z - fallbackTarget.z;
    const cosYaw = Math.cos(fallbackYaw);
    const sinYaw = Math.sin(fallbackYaw);
    const rotatedX = relativeX * cosYaw - relativeZ * sinYaw;
    const rotatedZ = relativeX * sinYaw + relativeZ * cosYaw;
    const cosPitch = Math.cos(fallbackPitch);
    const sinPitch = Math.sin(fallbackPitch);
    const rotatedY = relativeY * cosPitch - rotatedZ * sinPitch;
    const depth = fallbackDistance + relativeY * sinPitch + rotatedZ * cosPitch;
    if (depth < 8) return null;

    const focalLength = Math.min(width, height) * 0.92;
    const perspective = focalLength / depth;
    return {
        x: width / 2 + rotatedX * perspective,
        y: height / 2 - rotatedY * perspective,
        depth,
        perspective
    };

}

function drawFallbackGalaxy() {

    if (!fallbackContext || !fallbackCanvas) return;

    const width = fallbackCanvas.clientWidth;
    const height = fallbackCanvas.clientHeight;
    const context = fallbackContext;

    context.clearRect(0, 0, width, height);
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#050513");
    background.addColorStop(0.52, "#080719");
    background.addColorStop(1, "#02030b");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    for (const nebula of [
        { x: 0.38, y: 0.48, color: "94,48,184", radius: 0.36 },
        { x: 0.68, y: 0.62, color: "37,86,174", radius: 0.31 },
        { x: 0.54, y: 0.3, color: "157,48,141", radius: 0.26 }
    ]) {
        const glow = context.createRadialGradient(
            width * nebula.x, height * nebula.y, 0,
            width * nebula.x, height * nebula.y,
            Math.min(width, height) * nebula.radius
        );
        glow.addColorStop(0, `rgba(${nebula.color},0.2)`);
        glow.addColorStop(1, `rgba(${nebula.color},0)`);
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);
    }

    for (const star of fallbackStars) {
        const point = projectFallbackPoint(star, width, height);
        if (!point || point.x < -2 || point.x > width + 2 ||
            point.y < -2 || point.y > height + 2) continue;
        context.globalAlpha = star.alpha * Math.min(1, 320 / point.depth);
        context.fillStyle = star.color;
        context.beginPath();
        context.arc(
            point.x,
            point.y,
            Math.max(0.35, star.size * point.perspective * 0.8),
            0,
            Math.PI * 2
        );
        context.fill();
    }
    context.globalAlpha = 1;

    for (const galaxy of fallbackDistantGalaxies) {
        const point = projectFallbackPoint(galaxy, width, height);
        if (!point || point.x < -2 || point.x > width + 2 ||
            point.y < -2 || point.y > height + 2) continue;
        context.globalAlpha = galaxy.alpha * Math.min(1, 520 / point.depth);
        context.fillStyle = `rgba(${galaxy.color},1)`;
        context.beginPath();
        context.arc(
            point.x,
            point.y,
            Math.max(0.35, galaxy.size * point.perspective * 3),
            0,
            Math.PI * 2
        );
        context.fill();
    }
    context.globalAlpha = 1;

    const projectedGalaxy = fallbackGalaxyParticles
        .map(particle => ({
            particle,
            point: projectFallbackPoint(particle, width, height)
        }))
        .filter(item => item.point && item.point.x > -12 && item.point.x < width + 12 &&
            item.point.y > -12 && item.point.y < height + 12)
        .sort((a, b) => b.point.depth - a.point.depth);
    for (const { particle, point } of projectedGalaxy) {
        context.fillStyle = `rgba(${particle.color},${particle.alpha})`;
        context.beginPath();
        context.arc(
            point.x,
            point.y,
            Math.max(0.45, particle.size * point.perspective * 1.6),
            0,
            Math.PI * 2
        );
        context.fill();
    }

    fallbackHitTargets = [];
    const projectedCreators = fallbackCreators
        .map(item => ({ item, point: projectFallbackPoint(item, width, height) }))
        .filter(item => item.point && item.point.x > -80 && item.point.x < width + 80 &&
            item.point.y > -100 && item.point.y < height + 100)
        .sort((a, b) => b.point.depth - a.point.depth);

    for (const { item, point } of projectedCreators) {
        const avatarSize = Math.max(28, Math.min(70, 30 * point.perspective));
        if (item.creator.id === focusedCreatorId) {
            for (let index = 0; index < item.creator.reels.length; index++) {
                const reel = item.creator.reels[index];
                const angle = index * Math.PI * 0.5;
                const cardPoint = projectFallbackPoint({
                    x: item.x + Math.cos(angle) * 17,
                    y: item.y + [-5, 5, 8, -2][index % 4],
                    z: item.z + Math.sin(angle) * 17
                }, width, height);
                if (!cardPoint) continue;

                const cardWidth = THREE.MathUtils.clamp(
                    9.5 * cardPoint.perspective,
                    22,
                    112
                );
                const cardHeight = cardWidth * 1.25;
                if (cardPoint.x < -cardWidth || cardPoint.x > width + cardWidth ||
                    cardPoint.y < -cardHeight || cardPoint.y > height + cardHeight) continue;

                const cardColor = context.createLinearGradient(
                    cardPoint.x, cardPoint.y - cardHeight / 2,
                    cardPoint.x, cardPoint.y + cardHeight / 2
                );
                cardColor.addColorStop(0, item.creator.color);
                cardColor.addColorStop(1, "#10142d");
                context.fillStyle = "rgba(8,10,26,0.96)";
                context.strokeStyle = `${item.creator.color}dd`;
                context.lineWidth = 1.2;
                context.beginPath();
                context.roundRect(
                    cardPoint.x - cardWidth / 2,
                    cardPoint.y - cardHeight / 2,
                    cardWidth,
                    cardHeight,
                    Math.min(6, cardWidth * 0.12)
                );
                context.fill();
                context.stroke();
                context.fillStyle = cardColor;
                context.beginPath();
                context.roundRect(
                    cardPoint.x - cardWidth / 2 + 2,
                    cardPoint.y - cardHeight / 2 + 2,
                    cardWidth - 4,
                    cardHeight * 0.68,
                    Math.min(5, cardWidth * 0.1)
                );
                context.fill();
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.font = `${Math.max(14, cardWidth * 0.45)}px sans-serif`;
                context.fillText(
                    reel.art,
                    cardPoint.x,
                    cardPoint.y - cardHeight * 0.04
                );
                context.fillStyle = "#fff";
                context.font = `600 ${Math.max(7, cardWidth * 0.12)}px Inter, sans-serif`;
                context.fillText(
                    reel.title,
                    cardPoint.x,
                    cardPoint.y + cardHeight * 0.39,
                    cardWidth - 8
                );
                fallbackHitTargets.push({
                    creator: item.creator,
                    reel,
                    x: cardPoint.x,
                    y: cardPoint.y,
                    radius: cardWidth * 0.6
                });
            }
        }

        const glow = context.createRadialGradient(
            point.x, point.y, avatarSize * 0.15,
            point.x, point.y, avatarSize * 1.5
        );
        glow.addColorStop(0, `${item.creator.color}b0`);
        glow.addColorStop(1, `${item.creator.color}00`);
        context.fillStyle = glow;
        context.beginPath();
        context.arc(point.x, point.y, avatarSize * 1.5, 0, Math.PI * 2);
        context.fill();
        context.drawImage(
            item.sprite,
            point.x - avatarSize / 2,
            point.y - avatarSize / 2,
            avatarSize,
            avatarSize
        );
        fallbackHitTargets.push({
            creator: item.creator,
            x: point.x,
            y: point.y,
            radius: Math.max(12, avatarSize * 0.7)
        });

        if (item.creator.id === focusedCreatorId) {
            const labelScale = Math.max(0.72, Math.min(1.25, point.perspective * 1.8));
            const labelWidth = 148 * labelScale;
            const labelHeight = 28 * labelScale;
            const labelX = point.x - labelWidth / 2;
            const labelY = point.y - avatarSize * 0.75 - labelHeight;
            context.fillStyle = "rgba(7,9,24,0.88)";
            context.strokeStyle = `${item.creator.color}aa`;
            context.lineWidth = 0.9;
            context.beginPath();
            context.roundRect(labelX, labelY, labelWidth, labelHeight, 14 * labelScale);
            context.fill();
            context.stroke();
            context.drawImage(
                item.sprite,
                labelX + 3 * labelScale,
                labelY + 3 * labelScale,
                labelHeight - 6 * labelScale,
                labelHeight - 6 * labelScale
            );
            context.fillStyle = "#f4f2ff";
            context.textAlign = "left";
            context.textBaseline = "middle";
            context.font = `600 ${Math.max(7, 9 * labelScale)}px Inter, sans-serif`;
            context.fillText(
                item.creator.username,
                labelX + labelHeight,
                labelY + labelHeight / 2,
                labelWidth - labelHeight - 6 * labelScale
            );
        }
    }

}

function handleFallbackPointerDown(event) {

    if (event.pointerType === "touch") {
        fallbackTouchPoints.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY
        });
        if (fallbackTouchPoints.size === 2) {
            const touches = [...fallbackTouchPoints.values()];
            fallbackPointer = {
                id: event.pointerId,
                pinch: true,
                moved: true,
                startDistance: Math.hypot(
                    touches[0].x - touches[1].x,
                    touches[0].y - touches[1].y
                ),
                startCameraDistance: fallbackDistance,
                startCenterX: (touches[0].x + touches[1].x) / 2,
                startCenterY: (touches[0].y + touches[1].y) / 2,
                targetX: fallbackTarget.x,
                targetY: fallbackTarget.y
            };
            fallbackCanvas.setPointerCapture(event.pointerId);
            fallbackCanvas.style.cursor = "grabbing";
            event.preventDefault();
            return;
        }
    }

    fallbackPointer = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        yaw: fallbackYaw,
        pitch: fallbackPitch,
        targetX: fallbackTarget.x,
        targetY: fallbackTarget.y,
        pan: event.button === 2 || event.shiftKey,
        moved: false
    };
    fallbackCanvas.setPointerCapture(event.pointerId);
    fallbackCanvas.style.cursor = "grabbing";

}

function handleFallbackPointerMove(event) {

    if (fallbackTouchPoints.has(event.pointerId)) {
        fallbackTouchPoints.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY
        });
    }
    if (fallbackPointer?.pinch && fallbackTouchPoints.size >= 2) {
        setExplorationChromeVisible(false);
        const touches = [...fallbackTouchPoints.values()];
        const distance = Math.max(1, Math.hypot(
            touches[0].x - touches[1].x,
            touches[0].y - touches[1].y
        ));
        const centerX = (touches[0].x + touches[1].x) / 2;
        const centerY = (touches[0].y + touches[1].y) / 2;
        fallbackDistance = THREE.MathUtils.clamp(
            fallbackPointer.startCameraDistance * fallbackPointer.startDistance / distance,
            28,
            1200
        );
        const unitsPerPixel = fallbackDistance / Math.max(
            Math.min(fallbackCanvas.clientWidth, fallbackCanvas.clientHeight) * 0.92,
            1
        );
        fallbackTarget.x = fallbackPointer.targetX -
            (centerX - fallbackPointer.startCenterX) * unitsPerPixel;
        fallbackTarget.y = fallbackPointer.targetY +
            (centerY - fallbackPointer.startCenterY) * unitsPerPixel;
        updateFallbackZoomExit();
        scheduleFallbackDraw();
        event.preventDefault();
        return;
    }

    if (!fallbackPointer || event.pointerId !== fallbackPointer.id) return;
    const deltaX = event.clientX - fallbackPointer.startX;
    const deltaY = event.clientY - fallbackPointer.startY;
    fallbackPointer.moved =
        fallbackPointer.moved || Math.hypot(deltaX, deltaY) > 5;

    if (fallbackPointer.moved) {
        setExplorationChromeVisible(false);
        if (fallbackPointer.pan) {
            const unitsPerPixel = fallbackDistance / Math.max(
                Math.min(fallbackCanvas.clientWidth, fallbackCanvas.clientHeight) * 0.92,
                1
            );
            fallbackTarget.x = fallbackPointer.targetX - deltaX * unitsPerPixel;
            fallbackTarget.y = fallbackPointer.targetY + deltaY * unitsPerPixel;
        } else {
            fallbackYaw = fallbackPointer.yaw - deltaX * 0.006;
            fallbackPitch = THREE.MathUtils.clamp(
                fallbackPointer.pitch + deltaY * 0.005,
                0.12,
                1.48
            );
        }
        scheduleFallbackDraw();
    }

}

function handleFallbackPointerUp(event) {

    fallbackTouchPoints.delete(event.pointerId);
    if (fallbackPointer?.pinch) {
        fallbackPointer = null;
        fallbackCanvas.style.cursor = "grab";
        if (fallbackDistance >= 360) setExplorationChromeVisible(true);
        return;
    }

    if (!fallbackPointer || event.pointerId !== fallbackPointer.id) return;
    const moved = fallbackPointer.moved;
    fallbackPointer = null;
    fallbackCanvas.style.cursor = "grab";
    if (fallbackDistance >= 360) setExplorationChromeVisible(true);

    if (!moved && clickCallback) {
        const rect = fallbackCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const closest = fallbackHitTargets
            .map(target => ({
                target,
                distance: Math.hypot(target.x - x, target.y - y)
            }))
            .filter(item => item.distance <= item.target.radius + 9)
            .sort((a, b) => a.distance - b.distance)[0];
        if (closest) clickCallback(closest.target.creator, closest.target.reel);
    }

}

function handleFallbackPointerCancel() {

    fallbackPointer = null;
    fallbackTouchPoints.clear();
    if (fallbackCanvas) fallbackCanvas.style.cursor = "grab";

}

function updateFallbackZoomExit() {

    if (!fallbackCanvas || !focusedCreatorId ||
        performance.now() < creatorFocusGraceUntil) return;
    if (fallbackDistance <= 120) {
        creatorFocusHasArrived = true;
        return;
    }
    if (!creatorFocusHasArrived || fallbackDistance < 260) return;
    clearTimeout(creatorFocusExitTimer);
    creatorFocusExitTimer = null;
    focusedCreatorId = null;
    creatorFocusHasArrived = false;
    for (const group of creatorObjects.values()) {
        setCreatorUniverseDetailsVisible(group, false);
    }
    scheduleFallbackDraw();
    if (universeExitCallback) universeExitCallback();

}

function handleCreatorZoomChange() {

    if (!focusedCreatorId || !camera || !controls ||
        performance.now() < creatorFocusGraceUntil) return;
    const distance = camera.position.distanceTo(controls.target);
    if (distance <= 120) {
        creatorFocusHasArrived = true;
        return;
    }
    if (!creatorFocusHasArrived || distance < 260) return;

    focusedCreatorId = null;
    creatorFocusHasArrived = false;
    for (const group of creatorObjects.values()) {
        setCreatorUniverseDetailsVisible(group, false);
    }
    if (universeExitCallback) universeExitCallback();

}

function setCreatorUniverseDetailsVisible(group, visible) {

    const nameplate = group.getObjectByName("creatorNameplate");
    const posts = group.getObjectByName("creatorPosts");
    if (nameplate) nameplate.visible = visible;
    if (posts) posts.visible = visible;

}

function handleFallbackWheel(event) {

    event.preventDefault();
    setExplorationChromeVisible(false);
    fallbackDistance = THREE.MathUtils.clamp(
        fallbackDistance * (event.deltaY < 0 ? 0.89 : 1.12),
        28,
        1200
    );
    updateFallbackZoomExit();
    if (fallbackDistance >= 360) setExplorationChromeVisible(true);
    scheduleFallbackDraw();

}

function animateFallbackCamera(target, distance, duration) {

    if (fallbackCameraFrame !== null) {
        cancelAnimationFrame(fallbackCameraFrame);
    }

    const startTarget = { ...fallbackTarget };
    const startDistance = fallbackDistance;
    const startTime = performance.now();

    function animate(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        fallbackTarget.x = THREE.MathUtils.lerp(startTarget.x, target.x, eased);
        fallbackTarget.y = THREE.MathUtils.lerp(startTarget.y, target.y, eased);
        fallbackTarget.z = THREE.MathUtils.lerp(startTarget.z, target.z, eased);
        fallbackDistance = THREE.MathUtils.lerp(startDistance, distance, eased);
        scheduleFallbackDraw();

        if (progress < 1) {
            fallbackCameraFrame = requestAnimationFrame(animate);
        } else {
            fallbackCameraFrame = null;
        }
    }

    fallbackCameraFrame = requestAnimationFrame(animate);

}

export function focusFallbackCreator(creator) {

    focusedCreatorId = creator?.id || null;
    creatorFocusHasArrived = false;
    creatorFocusGraceUntil = performance.now() + 2200;
    clearTimeout(creatorFocusExitTimer);
    creatorFocusExitTimer = fallbackCanvas
        ? setTimeout(updateFallbackZoomExit, 2300)
        : null;
    for (const group of creatorObjects.values()) {
        setCreatorUniverseDetailsVisible(group, group.userData.creator.id === focusedCreatorId);
    }

    const item = fallbackCreators.find(entry => entry.creator.id === creator?.id);
    if (item) {
        animateFallbackCamera(
            { x: item.x, y: item.y, z: item.z },
            48,
            1050
        );
    }

}

export function resetFallbackCamera() {

    clearTimeout(creatorFocusExitTimer);
    creatorFocusExitTimer = null;
    focusedCreatorId = null;
    creatorFocusHasArrived = false;
    for (const group of creatorObjects.values()) {
        setCreatorUniverseDetailsVisible(group, false);
    }
    if (fallbackCanvas) animateFallbackCamera({ x: 0, y: 0, z: 0 }, 390, 850);
    else scheduleFallbackDraw();

}

function scheduleFallbackDraw() {

    if (fallbackDrawFrame !== null) return;
    fallbackDrawFrame = requestAnimationFrame(() => {
        fallbackDrawFrame = null;
        drawFallbackGalaxy();
    });

}

// ============================================
// LIGHTING SYSTEM
// ============================================

function createLighting() {

    const ambient = new THREE.AmbientLight(
        0x8794ce,
        0.75
    );

    scene.add(ambient);

    const violet = new THREE.PointLight(
        0x7652ff,
        180,
        260
    );

    violet.position.set(0, 12, 0);

    scene.add(violet);

    const blue = new THREE.PointLight(
        0x247dff,
        100,
        220
    );

    blue.position.set(-85, 20, 65);

    scene.add(blue);

    const pink = new THREE.PointLight(
        0xd65bcb,
        90,
        200
    );

    pink.position.set(85, -15, -65);

    scene.add(pink);
}

// ============================================
// BACKGROUND STARFIELD
// ============================================

function createBackgroundStars() {

    createStarLayer(
        3400,
        180,
        650,
        0.75,
        0.72
    );

    createStarLayer(
        1200,
        90,
        420,
        1.25,
        0.64
    );

    createStarLayer(
        500,
        40,
        230,
        2.0,
        0.78
    );
}

function createStarLayer(
    count,
    minRadius,
    maxRadius,
    size,
    opacity
) {

    const positions = new Float32Array(
        count * 3
    );

    const colors = new Float32Array(
        count * 3
    );

    const palette = [
        new THREE.Color(0xffffff),
        new THREE.Color(0x9ebeff),
        new THREE.Color(0xc9aaff),
        new THREE.Color(0x83e3ff),
        new THREE.Color(0xffc6eb)
    ];

    for (let i = 0; i < count; i++) {

        const radius = THREE.MathUtils.randFloat(
            minRadius,
            maxRadius
        );

        const theta = Math.random() * Math.PI * 2;

        const phi = Math.acos(
            2 * Math.random() - 1
        );

        positions[i * 3] =
            radius * Math.sin(phi) * Math.cos(theta);

        positions[i * 3 + 1] =
            radius * Math.cos(phi);

        positions[i * 3 + 2] =
            radius * Math.sin(phi) * Math.sin(theta);

        const color = palette[
            Math.floor(Math.random() * palette.length)
        ];

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
    );

    geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(colors, 3)
    );

    const material = new THREE.PointsMaterial({
        size,
        map: glowTexture,
        vertexColors: true,
        transparent: true,
        opacity: opacity * 0.78,
        alphaTest: 0.015,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const stars = new THREE.Points(
        geometry,
        material
    );

    scene.add(stars);

}

// ============================================
// SPIRAL GALAXY
// ============================================

function createSpiralGalaxy() {

    const arms = 5;
    const particlesPerArm = 1400;

    const total = arms * particlesPerArm;

    const positions = new Float32Array(
        total * 3
    );

    const colors = new Float32Array(
        total * 3
    );

    const palette = [
        new THREE.Color(0x9b70ff),
        new THREE.Color(0x4f8fff),
        new THREE.Color(0xd37aff),
        new THREE.Color(0x62caff),
        new THREE.Color(0xffa6dd)
    ];

    let index = 0;

    for (let arm = 0; arm < arms; arm++) {

        const armOffset =
            (Math.PI * 2 / arms) * arm;

        for (let i = 0; i < particlesPerArm; i++) {

            const progress = Math.random();

            const radius =
                8 + progress * CONFIG.galaxyRadius;

            const spiralAngle =
                armOffset +
                radius * 0.095 +
                (Math.random() - 0.5) * 0.45;

            const spread =
                (Math.random() - 0.5) *
                (5 + progress * 13);

            const x =
                Math.cos(spiralAngle) * radius + spread;

            const z =
                Math.sin(spiralAngle) * radius + spread;

            const y =
                (Math.random() - 0.5) *
                (3 + progress * 9);

            positions[index * 3] = x;
            positions[index * 3 + 1] = y;
            positions[index * 3 + 2] = z;

            const color = palette[
                Math.floor(Math.random() * palette.length)
            ].clone();

            const brightness =
                0.55 + Math.random() * 0.65;

            color.multiplyScalar(brightness);

            colors[index * 3] = color.r;
            colors[index * 3 + 1] = color.g;
            colors[index * 3 + 2] = color.b;

            index++;
        }
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
    );

    geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(colors, 3)
    );

    const material = new THREE.PointsMaterial({

        size: 1.5,

        map: glowTexture,
        vertexColors: true,

        transparent: true,

        opacity: 0.58,

        alphaTest: 0.015,

        sizeAttenuation: true,

        depthWrite: false,

        blending: THREE.AdditiveBlending

    });

    const spiral = new THREE.Points(
        geometry,
        material
    );

    galaxyGroup.add(spiral);

}

// ============================================
// NEBULA CLOUDS
// ============================================

function createNebulaClouds() {

    const nebulaRegions = [

        {
            position: [-48, 9, 30],
            color: 0x7544e8,
            size: 35
        },

        {
            position: [48, -8, -35],
            color: 0x315de8,
            size: 42
        },

        {
            position: [5, 15, -78],
            color: 0xc14acb,
            size: 32
        },

        {
            position: [-95, -12, -45],
            color: 0x3464c9,
            size: 30
        },

        {
            position: [105, 15, 55],
            color: 0x963ac7,
            size: 35
        }

    ];

    const particlesPerRegion = 160;
    const positions = new Float32Array(
        nebulaRegions.length * particlesPerRegion * 3
    );
    const colors = new Float32Array(positions.length);
    let pointIndex = 0;

    nebulaRegions.forEach((region, regionIndex) => {

        const cloud = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: glowTexture,
                color: region.color,
                transparent: true,
                opacity: 0.27,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );

        cloud.position.set(...region.position);
        cloud.scale.set(region.size * 2.7, region.size * 1.5, 1);
        cloud.material.rotation = regionIndex * 0.31;
        galaxyGroup.add(cloud);

        animatedObjects.push({
            object: cloud,
            type: "nebula",
            speed: 0.000025 * (regionIndex % 2 ? 1 : -1)
        });

        const tint = new THREE.Color(region.color);
        for (let i = 0; i < particlesPerRegion; i++) {
            const spread = region.size * 0.34;
            positions[pointIndex * 3] =
                region.position[0] + (Math.random() - 0.5) * spread * 2;
            positions[pointIndex * 3 + 1] =
                region.position[1] + (Math.random() - 0.5) * spread * 0.4;
            positions[pointIndex * 3 + 2] =
                region.position[2] + (Math.random() - 0.5) * spread * 2;
            colors[pointIndex * 3] = tint.r;
            colors[pointIndex * 3 + 1] = tint.g;
            colors[pointIndex * 3 + 2] = tint.b;
            pointIndex++;
        }

    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
    );
    geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(colors, 3)
    );

    galaxyGroup.add(new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
            map: glowTexture,
            size: 7,
            vertexColors: true,
            transparent: true,
            opacity: 0.34,
            alphaTest: 0.015,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
    ));

}

function createGlowTexture() {

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;

    const context = canvas.getContext("2d");
    if (!context) return null;

    const glow = context.createRadialGradient(64, 64, 1, 64, 64, 64);
    glow.addColorStop(0, "rgba(255,255,255,0.95)");
    glow.addColorStop(0.13, "rgba(255,255,255,0.65)");
    glow.addColorStop(0.38, "rgba(255,255,255,0.2)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;

}

// ============================================
// GALAXY DUST
// ============================================

function createGalaxyDust() {

    const count = CONFIG.dustCount;

    const positions = new Float32Array(
        count * 3
    );

    const colors = new Float32Array(
        count * 3
    );

    const colorA = new THREE.Color(0x7d6bff);
    const colorB = new THREE.Color(0x5ac9ff);
    const colorC = new THREE.Color(0xff8bdf);

    for (let i = 0; i < count; i++) {

        const angle =
            Math.random() * Math.PI * 2;

        const radius =
            Math.random() * CONFIG.galaxyRadius;

        positions[i * 3] =
            Math.cos(angle) * radius;

        positions[i * 3 + 1] =
            (Math.random() - 0.5) * 16;

        positions[i * 3 + 2] =
            Math.sin(angle) * radius;

        const color = Math.random() > 0.5
            ? colorA
            : Math.random() > 0.5
                ? colorB
                : colorC;

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
    );

    geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(colors, 3)
    );

    const material = new THREE.PointsMaterial({

        size: 0.7,

        map: glowTexture,
        vertexColors: true,

        transparent: true,

        opacity: 0.2,

        alphaTest: 0.015,

        depthWrite: false,

        blending: THREE.AdditiveBlending

    });

    galaxyGroup.add(
        new THREE.Points(geometry, material)
    );

}

// ============================================
// CENTRAL GALACTIC CORE
// ============================================

function createCentralCore() {

    const core = new THREE.Mesh(

        new THREE.SphereGeometry(
            12,
            48,
            48
        ),

        new THREE.MeshBasicMaterial({

            color: 0x8d70ff,

            transparent: true,

            opacity: 0.18,

            side: THREE.BackSide,

            depthWrite: false

        })

    );

    galaxyGroup.add(core);

    // Multiple glowing rings

    for (let i = 0; i < 4; i++) {

        const ring = new THREE.Mesh(

            new THREE.TorusGeometry(
                15 + i * 3,
                0.055,
                8,
                128
            ),

            new THREE.MeshBasicMaterial({

                color: i % 2
                    ? 0x638cff
                    : 0xc47aff,

                transparent: true,

                opacity: 0.34 - i * 0.045

            })

        );

        ring.rotation.x =
            Math.PI / 2 + i * 0.12;

        ring.rotation.y = i * 0.25;

        galaxyGroup.add(ring);

        animatedObjects.push({
            object: ring,
            type: "ring",
            speed: 0.00035 * (i % 2 ? 1 : -1)
        });

    }

}

// ============================================
// DISTANT GALAXIES
// ============================================

function createDistantGalaxies() {

    const galaxyCount = 42;
    const starsPerGalaxy = 84;
    const positions = new Float32Array(galaxyCount * starsPerGalaxy * 3);
    const colors = new Float32Array(positions.length);
    const random = createFallbackRandom(0x4d554c54);
    const palette = [
        new THREE.Color(0x8ca9ff),
        new THREE.Color(0xc28cff),
        new THREE.Color(0x69d5ff),
        new THREE.Color(0xff9ed5)
    ];
    let cursor = 0;

    for (let galaxyIndex = 0; galaxyIndex < galaxyCount; galaxyIndex++) {
        const direction = new THREE.Vector3(
            random() * 2 - 1,
            random() * 2 - 1,
            random() * 2 - 1
        ).normalize();
        const center = direction.multiplyScalar(420 + random() * 1100);
        const tilt = random() * Math.PI;
        const rotation = random() * Math.PI * 2;
        const tint = palette[galaxyIndex % palette.length];

        for (let starIndex = 0; starIndex < starsPerGalaxy; starIndex++) {
            const progress = random();
            const arm = starIndex % 3;
            const radius = 3 + progress * (8 + random() * 9);
            const angle = arm * Math.PI * 2 / 3 + radius * 0.16 +
                (random() - 0.5) * 0.5;
            const localX = Math.cos(angle + rotation) * radius;
            const flatZ = Math.sin(angle + rotation) * radius * 0.58;
            const localY = flatZ * Math.sin(tilt);
            const localZ = flatZ * Math.cos(tilt);

            positions[cursor * 3] = center.x + localX;
            positions[cursor * 3 + 1] = center.y + localY;
            positions[cursor * 3 + 2] = center.z + localZ;
            const brightness = 0.48 + random() * 0.58;
            colors[cursor * 3] = tint.r * brightness;
            colors[cursor * 3 + 1] = tint.g * brightness;
            colors[cursor * 3 + 2] = tint.b * brightness;
            cursor++;
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
        map: glowTexture,
        size: 2.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        alphaTest: 0.015,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const galaxies = new THREE.Points(geometry, material);
    galaxies.name = "distantMultiverse";
    scene.add(galaxies);
    animatedObjects.push({
        object: galaxies,
        type: "distant",
        speed: 0.000012
    });

}

// ============================================
// ORIGINAL CREATOR PORTRAIT TEXTURES
// ============================================

function createCreatorTexture(creator, index) {

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;

    const context = canvas.getContext("2d");
    if (!context) return null;

    const skinTones = [
        "#e5aa83", "#b9795e", "#d99b78", "#8d5b45", "#d7a07b",
        "#bc8061", "#e0ae8e", "#a76d50", "#dba984", "#c08b68"
    ];
    const skin = skinTones[index % skinTones.length];
    const hair = index % 2 ? "#201a32" : "#30223e";
    context.save();
    context.beginPath();
    context.arc(128, 128, 124, 0, Math.PI * 2);
    context.clip();
    const background = context.createLinearGradient(0, 0, 256, 256);
    background.addColorStop(0, creator.color);
    background.addColorStop(1, "#10142d");
    context.fillStyle = background;
    context.fillRect(0, 0, 256, 256);

    const aura = context.createRadialGradient(186, 58, 4, 186, 58, 112);
    aura.addColorStop(0, "rgba(255,255,255,0.42)");
    aura.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = aura;
    context.fillRect(0, 0, 256, 256);

    context.strokeStyle = "rgba(255,255,255,0.2)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(128, 128, 102, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = "#17182d";
    context.beginPath();
    context.ellipse(128, 246, 94, 78, 0, Math.PI, 0);
    context.fill();

    context.fillStyle = skin;
    context.beginPath();
    context.moveTo(105, 177);
    context.lineTo(105, 147);
    context.lineTo(151, 147);
    context.lineTo(151, 177);
    context.lineTo(128, 196);
    context.closePath();
    context.fill();

    context.fillStyle = hair;
    context.beginPath();
    context.ellipse(128, 100, 54, 68, 0, Math.PI, Math.PI * 2);
    context.fill();

    const face = context.createLinearGradient(85, 70, 170, 172);
    face.addColorStop(0, "#f2c5a1");
    face.addColorStop(1, skin);
    context.fillStyle = face;
    context.beginPath();
    context.ellipse(128, 120, 45, 59, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = hair;
    context.beginPath();
    context.moveTo(82, 103);
    context.quadraticCurveTo(84, 40, 130, 39);
    context.quadraticCurveTo(174, 42, 176, 108);
    context.quadraticCurveTo(151, 88, 130, 68);
    context.quadraticCurveTo(108, 91, 82, 103);
    context.fill();

    context.strokeStyle = "#30243a";
    context.lineWidth = 4;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(105, 116);
    context.lineTo(116, 116);
    context.moveTo(140, 116);
    context.lineTo(151, 116);
    context.stroke();

    context.strokeStyle = "#9f6656";
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(128, 119);
    context.lineTo(124, 139);
    context.lineTo(132, 141);
    context.stroke();

    context.strokeStyle = "#884f55";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(119, 153);
    context.quadraticCurveTo(128, 160, 138, 153);
    context.stroke();

    context.fillStyle = creator.color;
    context.beginPath();
    context.arc(85, 124, 6, 0, Math.PI * 2);
    context.fill();

    context.restore();

    context.strokeStyle = creator.color;
    context.lineWidth = 6;
    context.beginPath();
    context.arc(128, 128, 123, 0, Math.PI * 2);
    context.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;

}

function createCreatorLabelTexture(creator, portraitTexture) {

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 112;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.fillStyle = "rgba(8,10,26,0.88)";
    context.beginPath();
    context.roundRect(4, 4, 504, 104, 52);
    context.fill();
    context.strokeStyle = `${creator.color}cc`;
    context.lineWidth = 3;
    context.stroke();
    context.save();
    context.beginPath();
    context.arc(58, 56, 42, 0, Math.PI * 2);
    context.clip();
    if (portraitTexture && portraitTexture.image) {
        context.drawImage(portraitTexture.image, 16, 14, 84, 84);
    } else {
        context.fillStyle = creator.color;
        context.fillRect(16, 14, 84, 84);
        context.fillStyle = "#fff";
        context.font = "bold 30px Inter, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(creator.initials, 58, 58);
    }
    context.restore();

    context.fillStyle = "#f6f3ff";
    context.font = "700 30px Inter, sans-serif";
    context.textBaseline = "middle";
    context.fillText(creator.username, 122, 48, 350);
    context.fillStyle = creator.color;
    context.font = "500 15px Inter, sans-serif";
    context.fillText("CREATOR UNIVERSE", 124, 79);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;

}

function createCreatorPostTexture(creator, reel) {

    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 216;
    const context = canvas.getContext("2d");
    if (!context) return null;

    const color = new THREE.Color(creator.color);
    const background = context.createLinearGradient(0, 0, 160, 216);
    background.addColorStop(0, creator.color);
    background.addColorStop(0.65, `#${color.clone().multiplyScalar(0.5).getHexString()}`);
    background.addColorStop(1, "#080b1b");
    context.fillStyle = background;
    context.beginPath();
    context.roundRect(2, 2, 156, 212, 18);
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.84)";
    context.lineWidth = 3;
    context.stroke();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = creator.color;
    context.beginPath();
    context.roundRect(15, 13, 70, 18, 9);
    context.fill();
    context.fillStyle = "#fff";
    context.font = "700 9px Inter, sans-serif";
    context.fillText(reel.tag, 50, 22);
    context.font = "64px sans-serif";
    context.fillText(reel.art, 80, 99);
    context.fillStyle = "#fff";
    context.font = "700 12px Inter, sans-serif";
    context.fillText(reel.title, 80, 169, 132);
    context.fillStyle = "rgba(255,255,255,0.82)";
    context.font = "500 9px Inter, sans-serif";
    context.fillText(`${reel.views} views · ${reel.likes} likes`, 80, 190, 132);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;

}

// ============================================
// CREATE TEN CREATOR STARS
// ============================================

function createCreatorStars(creators) {

    creatorObjects.clear();
    creatorAvatarElements.clear();
    creatorAvatarOverlay?.remove();
    creatorAvatarOverlay = document.createElement("div");
    creatorAvatarOverlay.setAttribute("aria-hidden", "true");
    creatorAvatarOverlay.style.cssText =
        "position:absolute;inset:0;z-index:3;overflow:hidden;pointer-events:none;";
    document.getElementById("galaxyContainer")?.appendChild(creatorAvatarOverlay);

    creators.forEach((creator, index) => {

        const creatorSystem = new THREE.Group();

        creatorSystem.name =
            `creator-${creator.id}`;

        creatorSystem.userData.creator = creator;

        // Spread creators throughout the galaxy

        const goldenAngle = Math.PI * (
            3 - Math.sqrt(5)
        );

        const angle = index * goldenAngle;

        const radius = THREE.MathUtils.mapLinear(
            index,
            0,
            Math.max(creators.length - 1, 1),
            CONFIG.creatorMinRadius,
            CONFIG.creatorMaxRadius
        );

        const variation =
            Math.sin(index * 2.3) * 28 +
            Math.cos(index * 1.7) * 12;

        creatorSystem.position.set(

            Math.cos(angle) * radius,

            variation,

            Math.sin(angle) * radius

        );

        const portraitTexture = createCreatorTexture(creator, index);
        if (portraitTexture?.image && creatorAvatarOverlay) {
            const avatar = document.createElement("img");
            avatar.alt = "";
            avatar.src = portraitTexture.image.toDataURL();
            avatar.style.cssText =
                `position:absolute;display:none;transform:translate(-50%,-50%);border:2px solid ${creator.color};border-radius:50%;object-fit:cover;box-shadow:0 0 18px ${creator.color}99;`;
            creatorAvatarOverlay.appendChild(avatar);
            creatorAvatarElements.set(creator.id, avatar);
        }

        const globe = new THREE.Mesh(
            new THREE.SphereGeometry(8, 32, 24),
            new THREE.MeshBasicMaterial({
                color: creator.color,
                transparent: true,
                opacity: 0.18,
                depthWrite: false
            })
        );
        globe.name = "creatorGlobe";
        globe.userData.creator = creator;
        creatorSystem.add(globe);

        // Outer glow

        const glow = new THREE.Mesh(

            new THREE.SphereGeometry(
                8.8,
                32,
                32
            ),

            new THREE.MeshBasicMaterial({

                color: creator.color,

                transparent: true,

                opacity: 0.17,

                side: THREE.BackSide,

                depthWrite: false

            })

        );

        creatorSystem.add(glow);

        // Orbital ring

        const orbit = new THREE.Mesh(

            new THREE.TorusGeometry(
                7.5,
                0.085,
                8,
                56
            ),

            new THREE.MeshBasicMaterial({

                color: creator.color,

                transparent: true,

                opacity: 0.78

            })

        );

        orbit.name = "creatorOrbit";
        orbit.rotation.x = Math.PI / 2.5;

        creatorSystem.add(orbit);

        // Second orbit

        const secondOrbit = new THREE.Mesh(

            new THREE.TorusGeometry(
                8.7,
                0.035,
                6,
                48
            ),

            new THREE.MeshBasicMaterial({

                color: 0xffffff,

                transparent: true,

                opacity: 0.32

            })

        );

        secondOrbit.name = "creatorSecondaryOrbit";
        secondOrbit.rotation.y = 0.8;

        secondOrbit.rotation.x = 0.5;

        creatorSystem.add(secondOrbit);

        const labelTexture = createCreatorLabelTexture(creator, portraitTexture);
        if (labelTexture) {
            const label = new THREE.Sprite(new THREE.SpriteMaterial({
                map: labelTexture,
                transparent: true,
                depthWrite: false,
                sizeAttenuation: true
            }));
            label.name = "creatorNameplate";
            label.position.set(0, 27, 0);
            label.scale.set(34, 7.44, 1);
            label.visible = false;
            label.renderOrder = 30;
            label.userData.creator = creator;
            creatorSystem.add(label);
        }

        const posts = new THREE.Group();
        posts.name = "creatorPosts";
        posts.visible = false;
        creator.reels.forEach((reel, reelIndex) => {
            const texture = createCreatorPostTexture(creator, reel);
            if (!texture) return;
            const post = new THREE.Sprite(new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthWrite: false,
                depthTest: false
            }));
            const angle = reelIndex * Math.PI * 0.5 + Math.PI * 0.25;
            post.name = `creatorPost-${reel.id}`;
            post.position.set(
                Math.cos(angle) * 19,
                [-5, 5, 8, -2][reelIndex % 4],
                Math.sin(angle) * 19
            );
            post.scale.set(9, 12.15, 1);
            post.renderOrder = 4;
            post.userData.creator = creator;
            post.userData.reel = reel;
            posts.add(post);
        });
        creatorSystem.add(posts);

        // Ranking marker

        creatorSystem.userData.rank = index + 1;

        creatorGroup.add(creatorSystem);

        creatorObjects.set(
            creator.id,
            creatorSystem
        );

        animatedObjects.push({
            object: creatorSystem,
            type: "creator",
            index
        });

    });

}

function updateCreatorAvatarOverlays() {

    if (!camera || !renderer || !creatorAvatarOverlay) return;

    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;
    const minimumSize = width < 600 ? 28 : 34;
    const maximumSize = width < 600 ? 60 : 76;

    creatorObjects.forEach((group, creatorId) => {
        const avatar = creatorAvatarElements.get(creatorId);
        if (!avatar) return;

        group.getWorldPosition(creatorOverlayWorldPosition);
        creatorOverlayScreenPosition
            .copy(creatorOverlayWorldPosition)
            .project(camera);
        const visible = creatorOverlayScreenPosition.z >= -1 &&
            creatorOverlayScreenPosition.z <= 1 &&
            Math.abs(creatorOverlayScreenPosition.x) <= 1.08 &&
            Math.abs(creatorOverlayScreenPosition.y) <= 1.08;
        avatar.style.display = visible ? "block" : "none";
        if (!visible) return;

        const distance = camera.position.distanceTo(creatorOverlayWorldPosition);
        const worldSize = 17 * height /
            (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance);
        const size = THREE.MathUtils.clamp(worldSize, minimumSize, maximumSize);
        avatar.style.width = `${size}px`;
        avatar.style.height = `${size}px`;
        avatar.style.left =
            `${(creatorOverlayScreenPosition.x * 0.5 + 0.5) * width}px`;
        avatar.style.top =
            `${(-creatorOverlayScreenPosition.y * 0.5 + 0.5) * height}px`;
    });

}

// ============================================
// CLICK DETECTION
// ============================================

function handlePointerDown(event) {

    pointerStart = {
        x: event.clientX,
        y: event.clientY
    };

}

function handlePointerMove(event) {

    if (!renderer || !pointer) return;

    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

}

function handlePointerUp(event) {

    if (!pointerStart) return;

    const distance = Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y
    );

    pointerStart = null;

    // Ignore camera drag gestures

    if (distance > 6) return;

    const rect =
        renderer.domElement.getBoundingClientRect();

    pointer.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;

    pointer.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const intersections =
        raycaster.intersectObjects(
            creatorGroup.children,
            true
        );

    for (const hit of intersections) {

        let object = hit.object;

        while (object && object !== creatorGroup) {

            const creator =
                object.userData.creator;

            if (creator) {

                if (clickCallback) {

                    clickCallback(creator, hit.object.userData.reel);

                }

                return;

            }

            object = object.parent;

        }

    }

}

// ============================================
// CAMERA HOVER CURSOR
// ============================================

function updateCursor() {

    if (!renderer || !camera) return;

    const rect =
        renderer.domElement.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(
        creatorGroup.children,
        true
    );

    renderer.domElement.style.cursor =
        hits.length ? "pointer" : "grab";

}

// ============================================
// ANIMATION ENGINE
// ============================================

function animate() {

    if (!renderer || contextLost) {
        animationFrame = null;
        return;
    }

    animationFrame = requestAnimationFrame(
        animate
    );

    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;

    const deltaFactor = Math.min(
        delta * 60,
        2
    );

    // Galaxy slow rotation

    galaxyGroup.rotation.y +=
        CONFIG.rotationSpeed * deltaFactor;
    creatorGroup.rotation.y +=
        CONFIG.rotationSpeed * deltaFactor * 0.6;

    // Creator systems

    creatorObjects.forEach((group, index) => {

        const pulse =
            1 + Math.sin(elapsed * 1.5 + index) * 0.035;

        const orbit = group.getObjectByName("creatorOrbit");

        if (orbit) {

            orbit.rotation.z +=
                0.002 * deltaFactor;

        }

        const secondOrbit = group.getObjectByName("creatorSecondaryOrbit");

        if (secondOrbit) {

            secondOrbit.rotation.z -=
                0.001 * deltaFactor;

        }

    });

    // Animated nebula and distant systems

    animatedObjects.forEach(item => {

        if (item.type === "nebula") {

            item.object.material.rotation +=
                item.speed * deltaFactor;

        }

        if (item.type === "ring") {

            item.object.rotation.z +=
                item.speed * deltaFactor;

        }

        if (item.type === "distant") {

            item.object.rotation.y +=
                item.speed * deltaFactor;

        }

    });

    controls.update();
    handleCreatorZoomChange();
    updateCreatorAvatarOverlays();

    // Throttle cursor raycasting

    if (elapsed - lastFrame > 0.08) {

        updateCursor();

        lastFrame = elapsed;

    }

    try {
        renderer.render(scene, camera);
    } catch (error) {
        handleRenderFailure(error);
    }

}

function handleWebGLContextLost(event) {

    event.preventDefault();
    contextLost = true;

    if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }

    cancelCameraAnimation();
    showGalaxyStatus(
        "The 3D context was interrupted. The museum will resume when your browser restores it."
    );

}

function handleWebGLContextRestored() {

    contextLost = false;
    renderFailureLogged = false;
    showGalaxyStatus("");
    clock.start();

    if (animationFrame === null) {
        animate();
    }

}

function handleRenderFailure(error) {

    if (!renderFailureLogged) {
        console.error("AURA stopped rendering after a WebGL error.", error);
        renderFailureLogged = true;
    }

    if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }

    destroyCamera();
    showGalaxyStatus(
        "The 3D scene encountered a rendering error. Reload the page to try again."
    );

}

// ============================================
// RESIZE
// ============================================

function resizeGalaxy() {

    if (fallbackCanvas && fallbackContext) {
        const width = Math.max(fallbackCanvas.clientWidth, 1);
        const height = Math.max(fallbackCanvas.clientHeight, 1);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1);
        fallbackCanvas.width = Math.round(width * pixelRatio);
        fallbackCanvas.height = Math.round(height * pixelRatio);
        fallbackContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        drawFallbackGalaxy();
        return;
    }

    if (!camera || !renderer) return;

    const canvas = renderer.domElement;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (!width || !height) return;

    camera.aspect = width / height;

    camera.updateProjectionMatrix();

    renderer.setPixelRatio(getAdaptivePixelRatio());
    renderer.setSize(
        width,
        height,
        false
    );

}

// ============================================
// GET CREATOR OBJECT
// ============================================

export function getCreatorObject(id) {

    return creatorObjects.get(id);

}

// ============================================
// GET GALAXY SCENE
// ============================================

export function getGalaxyScene() {

    return scene;

}

// ============================================
// CLEANUP
// ============================================

export function destroyGalaxy() {

    if (animationFrame !== null) {

        cancelAnimationFrame(animationFrame);

        animationFrame = null;

    }

    if (fallbackCameraFrame !== null) {
        cancelAnimationFrame(fallbackCameraFrame);
        fallbackCameraFrame = null;
    }

    if (fallbackDrawFrame !== null) {
        cancelAnimationFrame(fallbackDrawFrame);
        fallbackDrawFrame = null;
    }

    window.removeEventListener(
        "resize",
        resizeGalaxy
    );

    if (fallbackCanvas) {
        fallbackCanvas.removeEventListener("pointerdown", handleFallbackPointerDown);
        fallbackCanvas.removeEventListener("pointermove", handleFallbackPointerMove);
        fallbackCanvas.removeEventListener("pointerup", handleFallbackPointerUp);
        fallbackCanvas.removeEventListener("pointercancel", handleFallbackPointerCancel);
        fallbackCanvas.removeEventListener("wheel", handleFallbackWheel);
        fallbackCanvas.remove();
    }

    const canvas = renderer && renderer.domElement
        ? renderer.domElement
        : document.getElementById("galaxyCanvas");
    if (canvas) canvas.style.visibility = "";

    if (renderer) {

        renderer.domElement.removeEventListener(
            "pointerdown",
            handlePointerDown
        );

        renderer.domElement.removeEventListener(
            "pointerup",
            handlePointerUp
        );

        renderer.domElement.removeEventListener(
            "pointermove",
            handlePointerMove
        );

        renderer.domElement.removeEventListener(
            "webglcontextlost",
            handleWebGLContextLost
        );

        renderer.domElement.removeEventListener(
            "webglcontextrestored",
            handleWebGLContextRestored
        );

    }

    destroyCamera();

    if (controls) {

        controls.dispose();

    }

    if (scene) {

        const geometries = new Set();
        const disposedMaterials = new Set();
        const textures = new Set();

        scene.traverse(object => {

            if (object.geometry && !geometries.has(object.geometry)) {
                geometries.add(object.geometry);
                object.geometry.dispose();

            }

            if (object.material) {

                const objectMaterials = Array.isArray(
                    object.material
                )
                    ? object.material
                    : [object.material];

                objectMaterials.forEach(material => {

                    if (disposedMaterials.has(material)) return;
                    disposedMaterials.add(material);

                    if (material.map && !textures.has(material.map)) {
                        textures.add(material.map);
                        material.map.dispose();
                    }

                    material.dispose();

                });

            }

        });

    }

    if (renderer) {

        renderer.dispose();

    }

    creatorObjects.clear();

    animatedObjects.length = 0;

    clickCallback = null;
    pointerStart = null;
    scene = null;
    camera = null;
    renderer = null;
    controls = null;
    raycaster = null;
    pointer = null;
    galaxyGroup = null;
    creatorGroup = null;
    contextLost = false;
    fallbackCanvas = null;
    fallbackContext = null;
    fallbackCreators = [];
    fallbackPointer = null;
    fallbackHitTargets = [];
    creatorAvatarElements.clear();
    creatorAvatarOverlay?.remove();
    creatorAvatarOverlay = null;
    focusedCreatorId = null;
    creatorFocusHasArrived = false;
    fallbackYaw = 0.28;
    fallbackPitch = 0.72;
    fallbackDistance = 390;
    fallbackTarget = { x: 0, y: 0, z: 0 };
    glowTexture = null;
    clearTimeout(statusTimeout);
    statusTimeout = null;

}
