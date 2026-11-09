// ===================================
// AURA CAMERA CONTROLLER
// ===================================

import * as THREE from "three";

let camera = null;
let controls = null;
let currentAnimation = null;

export function initializeCamera(cameraObject, orbitControls) {

    cancelCameraAnimation();

    camera = cameraObject;
    controls = orbitControls;

}

export function cancelCameraAnimation() {

    if (currentAnimation !== null) {
        cancelAnimationFrame(currentAnimation);
        currentAnimation = null;
    }

}

export function destroyCamera() {

    cancelCameraAnimation();
    camera = null;
    controls = null;

}

// ===================================
// SMOOTH CAMERA ANIMATION
// ===================================

export function moveCamera(position, target, duration = 1400) {

    if (!camera || !controls) return;

    cancelCameraAnimation();

    const startingPosition = camera.position.clone();
    const startingTarget = controls.target.clone();

    const destinationPosition = position.clone();
    const destinationTarget = target.clone();

    const startTime = performance.now();

    function animate(now) {

        const elapsed = now - startTime;

        const progress = Math.min(elapsed / Math.max(duration, 1), 1);

        // Smooth cubic easing
        const eased = 1 - Math.pow(1 - progress, 3);

        camera.position.lerpVectors(
            startingPosition,
            destinationPosition,
            eased
        );

        controls.target.lerpVectors(
            startingTarget,
            destinationTarget,
            eased
        );

        controls.update();

        if (progress < 1) {

            currentAnimation = requestAnimationFrame(animate);

        } else {

            currentAnimation = null;

        }

    }

    currentAnimation = requestAnimationFrame(animate);

}

// ===================================
// ZOOM INTO CREATOR
// ===================================

export function zoomIntoCreator(creatorObject) {

    if (!camera || !controls || !creatorObject) return;

    const creatorPosition = new THREE.Vector3();

    creatorObject.getWorldPosition(creatorPosition);

    const direction = new THREE.Vector3()
        .subVectors(camera.position, controls.target)
        .normalize();

    const destination = creatorPosition.clone().add(
        direction.multiplyScalar(48)
    );

    moveCamera(
        destination,
        creatorPosition,
        1500
    );

}

// ===================================
// RETURN TO GALAXY
// ===================================

export function returnToGalaxy() {

    if (!camera || !controls) return;

    moveCamera(
        new THREE.Vector3(0, 205, 270),
        new THREE.Vector3(0, 0, 0),
        1300
    );

}

// ===================================
// ZOOM CONTROLS
// ===================================

export function setZoom(distance) {

    if (!camera || !controls) return;

    const direction = new THREE.Vector3()
        .subVectors(camera.position, controls.target)
        .normalize();

    const newPosition = controls.target.clone().add(
        direction.multiplyScalar(distance)
    );

    moveCamera(
        newPosition,
        controls.target.clone(),
        600
    );

}