// ===================================
// AURA-CREATOR-MUSEUM
// MAIN APPLICATION
// ===================================

import {
    creators,
    calculateRanking,
    renderRanking
} from "./ranking.js";

import {
    initializeGalaxy,
    getCreatorObject
} from "./galaxy.js";

import {
    openCreatorProfile,
    openReelPreview,
    openFirstCreatorReel,
    initializeCreatorNavigation
} from "./creators.js";

import {
    openCreatorScreen,
    closeCreatorScreen,
    closeSingleReelScreen,
    switchMode,
    showToast,
    initializeHelp
} from "./transitions.js";

// ===================================
// HTML ELEMENT REFERENCES
// ===================================

const $ = id => document.getElementById(id);

// ===================================
// APP STATE
// ===================================

let rankedCreators = [];

let selectedCreator = null;

let currentMode = "galaxy";

// ===================================
// INITIALIZE APP
// ===================================

function initializeApp() {

    console.log(
        "AURA-CREATOR-MUSEUM initializing..."
    );

    // 1. Calculate creator ranking.

    rankedCreators = calculateRanking(creators);

    // 2. Render creator ranking panel.

    renderRanking(
        rankedCreators,
        handleCreatorSelection
    );

    // 3. Initialize galaxy engine.

    initializeGalaxy(
        $("galaxyCanvas"),
        rankedCreators,
        handleCreatorSelection,
        handleCreatorExit
    );

    initializeCreatorNavigation();

    // 4. Initialize help system.

    initializeHelp();

    // 5. Initialize all buttons.

    initializeButtons();

    // 6. Show opening animation.

    startOpeningAnimation();

    console.log(
        "AURA-CREATOR-MUSEUM ready."
    );
    document.documentElement.dataset.auraReady = "true";

}

// ===================================
// CREATOR SELECTION
// ===================================

function handleCreatorSelection(creator, reel = null) {

    if (!creator) return;

    selectedCreator = creator;

    openCreatorProfile(creator);

    const creatorObject = getCreatorObject(
        creator.id
    );

    openCreatorScreen(
        creator,
        creatorObject
    );

    if (reel) {
        setTimeout(() => {
            if (selectedCreator?.id === creator.id) {
                openReelPreview(creator, reel);
            }
        }, 500);
    }

    currentMode = "galaxy";

    $("galaxyViewButton").classList.add("active");

    $("singleViewButton").classList.remove("active");

}

function handleCreatorExit() {

    if (!selectedCreator) return;

    selectedCreator = null;
    openCreatorProfile(null);
    closeCreatorScreen();
    currentMode = "galaxy";
    $("galaxyViewButton").classList.add("active");
    $("singleViewButton").classList.remove("active");

}

// ===================================
// BUTTON CONTROLS
// ===================================

function initializeButtons() {

    // HOME BUTTON

    $("homeButton").addEventListener("click", () => {

        selectedCreator = null;

        closeCreatorScreen();

        currentMode = "galaxy";

        $("galaxyViewButton").classList.add("active");

        $("singleViewButton").classList.remove("active");

    });

    // CLOSE CREATOR

    $("closeCreator").addEventListener("click", () => {

        selectedCreator = null;

        closeCreatorScreen();

        currentMode = "galaxy";

        $("galaxyViewButton").classList.add("active");

        $("singleViewButton").classList.remove("active");

    });

    // CLOSE SINGLE REEL

    $("closeSingleReel").addEventListener("click", () => {

        closeSingleReelScreen();

        currentMode = "galaxy";

        $("galaxyViewButton").classList.add("active");

        $("singleViewButton").classList.remove("active");

    });

    // GALAXY VIEW

    $("galaxyViewButton").addEventListener("click", () => {

        currentMode = "galaxy";

        switchMode("galaxy");

    });

    // SINGLE VIEW

    $("singleViewButton").addEventListener("click", () => {

        if (!selectedCreator) {

            showToast(
                "Select a creator star first."
            );

            return;

        }

        currentMode = "single";

        switchMode("single");

        openFirstCreatorReel();

    });

}

// ===================================
// OPENING ANIMATION
// ===================================

function startOpeningAnimation() {

    const intro = $("introScreen");

    setTimeout(() => {

        intro.classList.add("finished");

    }, 2800);

}

// ===================================
// START APPLICATION
// ===================================

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );

} else {

    initializeApp();

}