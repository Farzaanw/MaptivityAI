/**
 * useDisintegrate Hook
 *
 * Creates a particle disintegration effect by cloning the target DOM element
 * into many small tile fragments, then animating each fragment with random
 * velocity, rotation, and opacity — producing a "Thanos snap" dissolution.
 *
 * This approach avoids html2canvas entirely by using CSS transforms
 * on clipped DOM fragments for maximum compatibility.
 */

import { useCallback, RefObject } from 'react';

interface ParticleInfo {
    el: HTMLDivElement;
    startX: number;
    startY: number;
    vx: number;
    vy: number;
    rotationSpeed: number;
    delay: number;
}

const TILE_SIZE = 30; // Size of each fragment tile
const DURATION_MS = 1200;
const STAGGER_MS = 500;

export function useDisintegrate(elementRef: RefObject<HTMLElement | null>) {
    const trigger = useCallback((): Promise<void> => {
        return new Promise((resolve) => {
            const el = elementRef.current;
            if (!el) {
                resolve();
                return;
            }

            const rect = el.getBoundingClientRect();
            const cols = Math.ceil(rect.width / TILE_SIZE);
            const rows = Math.ceil(rect.height / TILE_SIZE);

            // Create a container for all particle fragments
            const container = document.createElement('div');
            container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 10000;
        pointer-events: none;
        overflow: hidden;
      `;
            document.body.appendChild(container);

            const particles: ParticleInfo[] = [];

            // Create tile fragments using CSS clip-path on clones
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const tileX = col * TILE_SIZE;
                    const tileY = row * TILE_SIZE;
                    const tileW = Math.min(TILE_SIZE, rect.width - tileX);
                    const tileH = Math.min(TILE_SIZE, rect.height - tileY);

                    if (tileW <= 0 || tileH <= 0) continue;

                    // Create a wrapper div for each tile
                    const tile = document.createElement('div');
                    tile.style.cssText = `
            position: absolute;
            left: ${rect.left + tileX}px;
            top: ${rect.top + tileY}px;
            width: ${tileW}px;
            height: ${tileH}px;
            overflow: hidden;
            will-change: transform, opacity;
          `;

                    // Clone the original element and position it so only this tile's portion is visible
                    const clone = el.cloneNode(true) as HTMLElement;
                    clone.style.cssText = `
            position: absolute;
            left: ${-tileX}px;
            top: ${-tileY}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            margin: 0;
            pointer-events: none;
          `;
                    // Remove backdrop-filter from clone to avoid rendering artifacts
                    clone.style.backdropFilter = 'none';
                    clone.style.webkitBackdropFilter = 'none';
                    clone.style.backgroundColor = 'rgba(0, 0, 0, 0.45)';

                    tile.appendChild(clone);
                    container.appendChild(tile);

                    // Calculate stagger based on distance from top-right
                    const normalizedX = col / cols;
                    const normalizedY = row / rows;
                    const distFromTopRight = Math.sqrt(
                        Math.pow(1 - normalizedX, 2) + Math.pow(normalizedY, 2)
                    );

                    particles.push({
                        el: tile,
                        startX: rect.left + tileX,
                        startY: rect.top + tileY,
                        vx: (Math.random() - 0.3) * 5,
                        vy: (Math.random() - 0.6) * 4,
                        rotationSpeed: (Math.random() - 0.5) * 15,
                        delay: distFromTopRight * STAGGER_MS * (0.4 + Math.random() * 0.6),
                    });
                }
            }

            // Hide the original element immediately
            el.style.visibility = 'hidden';

            // Animate using requestAnimationFrame
            const startTime = performance.now();

            function animate(currentTime: number) {
                const elapsed = currentTime - startTime;
                let allDone = true;

                for (const p of particles) {
                    const particleElapsed = elapsed - p.delay;

                    if (particleElapsed < 0) {
                        // Not started yet — keep in place
                        allDone = false;
                        continue;
                    }

                    const progress = Math.min(particleElapsed / DURATION_MS, 1);

                    if (progress >= 1) {
                        p.el.style.opacity = '0';
                        continue;
                    }

                    allDone = false;

                    // Calculate movement
                    const dx = p.vx * particleElapsed * 0.12;
                    const dy = p.vy * particleElapsed * 0.12 + 0.08 * particleElapsed * 0.08;
                    const rotation = p.rotationSpeed * progress * 10;

                    // Ease-out opacity
                    const opacity = 1 - Math.pow(progress, 0.5);

                    p.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotation}deg) scale(${1 - progress * 0.3})`;
                    p.el.style.opacity = String(opacity);
                }

                if (allDone || elapsed > DURATION_MS + STAGGER_MS + 300) {
                    // Cleanup
                    document.body.removeChild(container);
                    resolve();
                } else {
                    requestAnimationFrame(animate);
                }
            }

            requestAnimationFrame(animate);
        });
    }, [elementRef]);

    return { trigger };
}
