// ===================================
// AURA TRANSITION MANAGER
// ===================================

import {
    zoomIntoCreator,
    returnToGalaxy
} from "./camera.js";

import {
    focusFallbackCreator,
    resetFallbackCamera
} from "./galaxy.js";

const $ = id => document.getElementById(id);

let currentMode = "galaxy";
let currentCreator = null;
let panelTimer = null;

// ===================================
// OPEN CREATOR
// ===================================

export function openCreatorScreen(creator, creatorObject) {

    if (!creator) return;

    currentCreator = creator;

    currentMode = "galaxy";
    clearTimeout(panelTimer);

    $("heroSection").classList.add("hidden");

    $("rankingPanel").classList.add("hidden");

    $("exploreHint").style.opacity = "0";

    $("singleReelPanel").classList.remove("active");

    zoomIntoCreator(creatorObject);
    focusFallbackCreator(creator);

    panelTimer = setTimeout(() => {

        $("creatorPanel").classList.add("active");
        $("mainContent").classList.add("creator-open");
        panelTimer = null;

    }, 450);

}

// ===================================
// CLOSE CREATOR
// ===================================

export function closeCreatorScreen() {

    currentCreator = null;

    currentMode = "galaxy";
    clearTimeout(panelTimer);
    panelTimer = null;

    $("creatorPanel").classList.remove("active");
    $("mainContent").classList.remove("creator-open");

    $("singleReelPanel").classList.remove("active");

    $("heroSection").classList.remove("hidden");

    $("rankingPanel").classList.remove("hidden");

    $("exploreHint").style.opacity = "1";

    returnToGalaxy();
    resetFallbackCamera();

}

// ===================================
// OPEN SINGLE REEL
// ===================================

export function openSingleReelScreen() {

    $("creatorPanel").classList.remove("active");

    $("singleReelPanel").classList.add("active");

    currentMode = "single";

}

// ===================================
// CLOSE SINGLE REEL
// ===================================

export function closeSingleReelScreen() {

    $("singleReelPanel").classList.remove("active");

    if (currentCreator) {

        $("creatorPanel").classList.add("active");

        currentMode = "galaxy";

    }

}

// ===================================
// MODE SWITCH
// ===================================

export function switchMode(mode) {

    currentMode = mode;

    $("galaxyViewButton").classList.toggle(
        "active",
        mode === "galaxy"
    );

    $("singleViewButton").classList.toggle(
        "active",
        mode === "single"
    );

    if (mode === "galaxy") {

        $("singleReelPanel").classList.remove("active");

        if (currentCreator) {

            $("creatorPanel").classList.add("active");

        }

    } else {

        $("creatorPanel").classList.remove("active");

        if (currentCreator) {

            openSingleReelScreen();

        } else {

            showToast(
                "Select a creator star to enter Single View."
            );

        }

    }

}

// ===================================
// TOAST MESSAGE
// ===================================

let toastTimeout;

export function showToast(message) {

    const toast = $("toastMessage");

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {

        toast.classList.remove("show");

    }, 2400);

}

// ===================================
// HELP MODAL
// ===================================

export function initializeHelp() {

    $("helpButton").addEventListener("click", () => {

        $("helpModal").classList.add("active");

    });

    $("closeHelp").addEventListener("click", () => {

        $("helpModal").classList.remove("active");

    });

    $("gotItButton").addEventListener("click", () => {

        $("helpModal").classList.remove("active");

    });

    $("helpModal").addEventListener("click", event => {

        if (event.target === $("helpModal")) {

            $("helpModal").classList.remove("active");

        }

    });

}