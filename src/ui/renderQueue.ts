/**
 * Spread expensive offscreen renders (step images, thumbnails) across frames so
 * the page stays responsive: at most ~30 ms of work per animation frame.
 */
const queue: (() => void)[] = [];
let pumping = false;

export function enqueue(job: () => void) {
  queue.push(job);
  if (!pumping) pump();
}

function pump() {
  pumping = true;
  requestAnimationFrame(() => {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < 30) queue.shift()!();
    if (queue.length) pump();
    else pumping = false;
  });
}

export const pendingRenders = () => queue.length;
