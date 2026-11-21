let activeGuardSeq = 0;
let guardDepth = 0;
let userScrollListenerAttached = false;

function ensureUserScrollListeners(): void {
  if (userScrollListenerAttached || typeof window === "undefined") return;
  userScrollListenerAttached = true;
  const cancel = () => {
    activeGuardSeq++;
  };
  window.addEventListener("wheel", cancel, { passive: true });
  window.addEventListener("touchstart", cancel, { passive: true });
  window.addEventListener("touchmove", cancel, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) {
      cancel();
    }
  });
}

/**
 * Cancel any pending post-render scroll restoration.
 * Call immediately before an intentional programmatic scroll (e.g. scrollIntoView).
 */
export function cancelPendingScrollGuard(): void {
  activeGuardSeq++;
}

export interface PreserveScrollOptions {
  /** Element whose viewport top coordinate should stay pinned across the DOM update. */
  anchorEl?: HTMLElement | null;
  /** Fallback CSS selector to re-find the anchor if its DOM node was replaced. */
  anchorSelector?: string;
  /** Additional containers whose heights are temporarily locked during innerHTML swaps. */
  lockEls?: Array<HTMLElement | null | undefined>;
}

/**
 * Run a synchronous DOM update while preventing scroll jumping (especially iOS/iPadOS
 * Safari WebKit UIScrollView clamping during innerHTML teardown or above-the-fold reflows).
 */
export function runWithPreservedScroll(fn: () => void, options: PreserveScrollOptions = {}): void {
  if (typeof window === "undefined" || typeof document === "undefined" || guardDepth > 0) {
    fn();
    return;
  }
  ensureUserScrollListeners();

  const savedScrollX = window.scrollX;
  const savedScrollY = window.scrollY;
  const initialAnchor =
    (options.anchorEl && options.anchorEl.isConnected ? options.anchorEl : null) ||
    (options.anchorSelector ? document.querySelector<HTMLElement>(options.anchorSelector) : null);
  const initialAnchorTop = initialAnchor ? initialAnchor.getBoundingClientRect().top : null;

  const locked: Array<{ el: HTMLElement; prevMinH: string }> = [];
  const lock = (el: HTMLElement | null | undefined) => {
    if (!el || !el.isConnected || locked.some((x) => x.el === el)) return;
    const h = el.getBoundingClientRect().height;
    if (h > 0) {
      locked.push({ el, prevMinH: el.style.minHeight });
      el.style.minHeight = `${Math.ceil(h)}px`;
    }
  };

  if (options.lockEls) {
    for (const el of options.lockEls) lock(el);
  }
  const appShell = document.querySelector<HTMLElement>(".app-shell");
  const outputRail = document.querySelector<HTMLElement>(".output-rail");
  lock(appShell);
  if (outputRail && getComputedStyle(outputRail).position !== "sticky") {
    lock(outputRail);
  }

  const docEl = document.documentElement;
  const prevDocMinH = docEl.style.minHeight;
  if (savedScrollY > 0) {
    const docH = docEl.scrollHeight;
    if (docH > window.innerHeight) {
      docEl.style.minHeight = `${docH}px`;
    }
  }

  const restoreNow = () => {
    const targetAnchor =
      (initialAnchor && initialAnchor.isConnected ? initialAnchor : null) ||
      (options.anchorSelector ? document.querySelector<HTMLElement>(options.anchorSelector) : null);

    if (targetAnchor && initialAnchorTop !== null) {
      const delta = targetAnchor.getBoundingClientRect().top - initialAnchorTop;
      if (Math.abs(delta) > 0.5) {
        window.scrollTo(savedScrollX, Math.max(0, Math.round(window.scrollY + delta)));
        return;
      }
    }
    if (Math.abs(window.scrollY - savedScrollY) > 0.5 || Math.abs(window.scrollX - savedScrollX) > 0.5) {
      window.scrollTo(savedScrollX, savedScrollY);
    }
  };

  guardDepth++;
  try {
    fn();
  } finally {
    guardDepth--;
    for (const item of locked) {
      item.el.style.minHeight = item.prevMinH;
    }
    restoreNow();
    docEl.style.minHeight = prevDocMinH;

    // One-frame WebKit/Safari guard: iOS/iPadOS Safari can sync UIScrollView
    // contentOffset on the next composite frame after a DOM mutation.
    const mySeq = ++activeGuardSeq;
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        if (mySeq !== activeGuardSeq) return;
        restoreNow();
      });
    }
  }
}
