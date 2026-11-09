// ===================================
// AURA CREATOR EXPLORER
// ===================================

import { formatNumber } from "./ranking.js";

import {
    openSingleReelScreen,
    showToast
} from "./transitions.js";

const $ = id => document.getElementById(id);

let activeCreator = null;
let activeReelIndex = 0;

// ===================================
// LOAD CREATOR PROFILE
// ===================================

export function openCreatorProfile(creator) {

    if (!creator) return;

    activeCreator = creator;

    const avatar = $("creatorAvatar");

    avatar.textContent = creator.initials;

    avatar.style.background =
        creator.avatar || creator.color;

    // Show real profile picture if available.
    if (creator.avatar) {

        avatar.style.backgroundImage =
            `url("${creator.avatar}")`;

        avatar.textContent = "";

    }

    $("creatorUsername").textContent =
        creator.username;

    $("creatorStats").textContent =
        `${formatNumber(creator.followers)} followers · ` +
        `${formatNumber(creator.interactions)} interactions`;

    renderCreatorReels(creator);

}

export function initializeCreatorNavigation() {

    $("previousReelButton").addEventListener("click", () => {
        navigateReel(-1);
    });

    $("nextReelButton").addEventListener("click", () => {
        navigateReel(1);
    });

}

// ===================================
// RENDER CREATOR REELS
// ===================================

function renderCreatorReels(creator) {

    const universe = $("reelUniverse");

    universe.innerHTML = "";

    creator.reels.forEach((reel, index) => {

        const card = document.createElement("button");

        card.type = "button";

        card.className = "reel-card";

        card.style.background = reel.background;

        card.style.animationDelay =
            `${index * 0.1}s`;

        card.setAttribute("aria-label", `Open ${reel.title}`);

        const tag = document.createElement("span");
        tag.className = "reel-tag";
        tag.textContent = reel.tag;

        const art = document.createElement("span");
        art.className = "reel-art";
        art.setAttribute("aria-hidden", "true");
        art.textContent = reel.art;

        const info = document.createElement("span");
        info.className = "reel-info";

        const title = document.createElement("strong");
        title.textContent = reel.title;

        const stats = document.createElement("small");
        stats.textContent = `▶ ${reel.views} views · ♥ ${reel.likes}`;

        info.append(title, stats);
        card.append(tag, art, info);

        card.addEventListener("click", () => {

            if (card.dataset.suppressClick === "true") {
                delete card.dataset.suppressClick;
                return;
            }

            const index = creator.reels.indexOf(reel);
            if (index >= 0) activeReelIndex = index;
            openReelPreview(creator, reel);

        });

        universe.appendChild(card);

    });

}

// ===================================
// REEL PREVIEW
// ===================================

export function openReelPreview(creator, reel) {

    if (!creator || !reel) return;

    activeCreator = creator;
    const reelIndex = creator.reels.indexOf(reel);
    if (reelIndex >= 0) activeReelIndex = reelIndex;

    const avatar = $("singleReelAvatar");

    avatar.textContent = creator.initials;

    avatar.style.background =
        creator.avatar || creator.color;

    if (creator.avatar) {

        avatar.style.backgroundImage =
            `url("${creator.avatar}")`;

        avatar.textContent = "";

    }

    $("singleReelUsername").textContent =
        creator.username;

    $("singleReelTitle").textContent =
        reel.title;

    $("singleReelStats").textContent =
        `▶ ${reel.views} views  ·  ♥ ${reel.likes}`;

    $("singleReelPosition").textContent =
        `${activeReelIndex + 1} / ${creator.reels.length}`;

    $("previousReelButton").disabled = creator.reels.length < 2;
    $("nextReelButton").disabled = creator.reels.length < 2;

    const media = $("singleReelMedia");

    media.style.background = reel.background;

    media.style.backgroundSize = "cover";

    media.style.backgroundPosition = "center";

    openSingleReelScreen();

}

function navigateReel(direction) {

    if (!activeCreator || activeCreator.reels.length < 2) return;

    activeReelIndex = (
        activeReelIndex + direction + activeCreator.reels.length
    ) % activeCreator.reels.length;

    openReelPreview(
        activeCreator,
        activeCreator.reels[activeReelIndex]
    );

}

// ===================================
// SINGLE VIEW DEFAULT REEL
// ===================================

export function openFirstCreatorReel() {

    if (!activeCreator || !activeCreator.reels.length) {

        showToast("This creator has no content yet.");

        return;

    }

    openReelPreview(
        activeCreator,
        activeCreator.reels[0]
    );

}

// ===================================
// CURRENT CREATOR
// ===================================

export function getActiveCreator() {

    return activeCreator;

}
