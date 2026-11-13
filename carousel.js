// Turns a vertical wheel gesture over an X image carousel into one-slide
// horizontal movement. Anywhere else, the event is left alone so the page
// keeps scrolling vertically. At the first or last slide, the same gesture
// returns to vertical scrolling while releaseAtEdge is on.
(function () {
  var THRESHOLD = 40;
  var COALESCE_MS = 110;
  var STALE_MS = 180;

  var config = {
    threshold: THRESHOLD,
    coalesceMs: COALESCE_MS,
    behavior: null,
    // When true, a wheel tick that cannot move another slide falls through
    // to the timeline. When false, that tick is swallowed.
    releaseAtEdge: true
  };

  var intent = new WeakMap();
  var wheelState = new WeakMap();

  function scrollBehavior() {
    if (config.behavior) return config.behavior;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return "auto";
    }
    return "smooth";
  }

  function elementsFromEvent(event) {
    var path = typeof event.composedPath === "function" ? event.composedPath() : [];
    var els = [];
    for (var i = 0; i < path.length; i++) {
      if (path[i] instanceof Element) els.push(path[i]);
    }
    if (els.length) return els;
    var el = event.target instanceof Element ? event.target : event.target && event.target.parentElement;
    while (el) {
      els.push(el);
      el = el.parentElement;
    }
    return els;
  }

  function classNameOf(el) {
    if (!el || el.getAttribute == null) return "";
    var raw = el.getAttribute("class");
    return typeof raw === "string" ? raw : "";
  }

  function isCarouselMark(el) {
    var id = el.getAttribute && el.getAttribute("data-testid");
    if (
      id === "ScrollSnap-List" ||
      id === "ScrollSnap-SwipeableList" ||
      id === "ScrollSnap-prevButtonWrapper" ||
      id === "ScrollSnap-nextButtonWrapper"
    ) {
      return true;
    }
    return classNameOf(el).indexOf("group/carousel") !== -1;
  }

  function hasPostMedia(el) {
    return !!el.querySelector(
      'img[src*="pbs.twimg.com/media"], img[src*="pbs.twimg.com/tweet_video"], img[src*="pbs.twimg.com/ext_tw_video_thumb"], img[src*="pbs.twimg.com/amplify_video"], video, a[href*="/photo/"], a[href*="/video/"]'
    );
  }

  function isMediaSnapScroller(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el === document.scrollingElement || el === document.documentElement || el === document.body) {
      return false;
    }
    if (el.clientWidth < 40 || el.clientHeight < 40) return false;
    if (el.clientWidth > window.innerWidth * 0.95 && el.clientHeight > window.innerHeight * 0.9) {
      return false;
    }
    if (el.scrollWidth <= el.clientWidth + 8) return false;
    var cs = getComputedStyle(el);
    var overflowX = cs.overflowX;
    if (overflowX !== "auto" && overflowX !== "scroll" && overflowX !== "overlay") return false;
    var snap = (cs.scrollSnapType || "").toLowerCase();
    if (snap.indexOf("x") === -1 && snap.indexOf("inline") === -1) return false;
    return hasPostMedia(el);
  }

  function scrollerInside(root) {
    if (isMediaSnapScroller(root)) return root;
    var nodes = root.querySelectorAll("*");
    for (var i = 0; i < nodes.length; i++) {
      if (isMediaSnapScroller(nodes[i])) return nodes[i];
    }
    return null;
  }

  function carouselRootFrom(el) {
    var id = el.getAttribute("data-testid") || "";
    if (id === "ScrollSnap-prevButtonWrapper" || id === "ScrollSnap-nextButtonWrapper") {
      return el.parentElement || el;
    }
    if (id === "ScrollSnap-List" && el.parentElement) return el.parentElement;
    return el;
  }

  function findHit(event) {
    var els = elementsFromEvent(event);
    if (!els.length) return null;
    var first = els[0];
    if (first.closest) {
      var field = first.closest("input, textarea, select, [contenteditable='true']");
      if (field) return null;
    }
    for (var i = 0; i < els.length && i < 30; i++) {
      var el = els[i];
      if (isMediaSnapScroller(el)) return { scroller: el, root: el };
      if (!isCarouselMark(el)) continue;
      var root = carouselRootFrom(el);
      var scroller = scrollerInside(root) || (root !== el ? scrollerInside(el) : null);
      if (scroller) return { scroller: scroller, root: root };
      if (findButton(root, 1) || findButton(root, -1)) return { scroller: null, root: root };
    }
    return null;
  }

  function slidesOf(scroller) {
    var slides = [];
    var children = scroller.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (!(child instanceof HTMLElement)) continue;
      if (child.offsetWidth < 8) continue;
      slides.push(child);
    }
    return slides;
  }

  function measureIndex(scroller, slides) {
    var box = scroller.getBoundingClientRect();
    var center = box.left + box.width / 2;
    var best = 0;
    var bestDist = Infinity;
    for (var i = 0; i < slides.length; i++) {
      var rect = slides[i].getBoundingClientRect();
      var dist = Math.abs(rect.left + rect.width / 2 - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  function logicalIndex(scroller, slides) {
    var pending = intent.get(scroller);
    if (pending && pending.index >= 0 && pending.index < slides.length) return pending.index;
    return measureIndex(scroller, slides);
  }

  function desiredScrollLeft(scroller, slide) {
    var scrollerRect = scroller.getBoundingClientRect();
    var slideRect = slide.getBoundingClientRect();
    var delta = slideRect.left + slideRect.width / 2 - (scrollerRect.left + scrollerRect.width / 2);
    var left = scroller.scrollLeft + delta;
    var max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    if (left < 0) return 0;
    if (left > max) return max;
    return left;
  }

  function rememberIntent(scroller, index) {
    var token = {};
    intent.set(scroller, { index: index, token: token });
    var clear = function () {
      var current = intent.get(scroller);
      if (current && current.token === token) intent.delete(scroller);
    };
    scroller.addEventListener("scrollend", clear, { once: true });
    scroller.addEventListener(
      "pointerdown",
      function () {
        var current = intent.get(scroller);
        if (current && current.token === token) intent.delete(scroller);
      },
      { once: true }
    );
  }

  function stepScroller(scroller, dir) {
    var slides = slidesOf(scroller);
    if (slides.length < 2) return false;
    var index = logicalIndex(scroller, slides);
    var next = index + dir;
    if (next < 0 || next >= slides.length) return false;
    var left = desiredScrollLeft(scroller, slides[next]);
    rememberIntent(scroller, next);
    scroller.scrollTo({ left: left, behavior: scrollBehavior() });
    return true;
  }

  function canStepScroller(scroller, dir) {
    var slides = slidesOf(scroller);
    if (slides.length < 2) return false;
    var index = logicalIndex(scroller, slides);
    var next = index + dir;
    return next >= 0 && next < slides.length;
  }

  // A one-slide snap list is not an end the user finished scrolling to.
  // Leave those gestures to the page even when releaseAtEdge is off.
  function holdsAtEdge(hit) {
    if (config.releaseAtEdge) return false;
    if (!hit.scroller) return true;
    return slidesOf(hit.scroller).length >= 2;
  }

  function findButton(root, dir) {
    if (!root) return null;
    var testid = dir > 0 ? "ScrollSnap-nextButtonWrapper" : "ScrollSnap-prevButtonWrapper";
    var hosts = [root];
    if (root.parentElement) hosts.push(root.parentElement);
    for (var h = 0; h < hosts.length; h++) {
      var wrap = hosts[h].querySelector('[data-testid="' + testid + '"]');
      if (!wrap) continue;
      var btn = wrap.matches("button, [role='button']")
        ? wrap
        : wrap.querySelector("button, [role='button']") || wrap;
      if (isClickable(btn)) return btn;
    }
    return null;
  }

  function isClickable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return false;
    var own = getComputedStyle(el);
    if (own.pointerEvents === "none") return false;
    var rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    var node = el;
    while (node && node !== document.body) {
      var cs = getComputedStyle(node);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      node = node.parentElement;
    }
    return true;
  }

  function stateFor(key) {
    var state = wheelState.get(key);
    if (!state) {
      state = { accum: 0, ignoreUntil: 0, lastTime: 0 };
      wheelState.set(key, state);
    }
    return state;
  }

  function primaryDelta(event) {
    var x = event.deltaX;
    var y = event.deltaY;
    if (event.deltaMode === 1) {
      x *= 100;
      y *= 100;
    } else if (event.deltaMode === 2) {
      x *= 800;
      y *= 800;
    }
    if (Math.abs(y) >= Math.abs(x)) return y;
    return x;
  }

  function consume(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleWheel(event) {
    if (event.ctrlKey || event.metaKey) return;
    if (event.defaultPrevented) return;
    var hit = findHit(event);
    if (!hit) return;

    var delta = primaryDelta(event);
    if (!delta) return;
    var dir = delta > 0 ? 1 : -1;
    var key = hit.scroller || hit.root;
    var state = stateFor(key);
    var now = performance.now();

    if (now < state.ignoreUntil) {
      consume(event);
      return;
    }

    var canMove = hit.scroller ? canStepScroller(hit.scroller, dir) : !!findButton(hit.root, dir);
    if (!canMove) {
      state.accum = 0;
      if (holdsAtEdge(hit)) consume(event);
      return;
    }

    consume(event);
    if (now - state.lastTime > STALE_MS) state.accum = 0;
    state.lastTime = now;
    state.accum += delta;
    if (Math.abs(state.accum) < config.threshold) return;

    dir = state.accum > 0 ? 1 : -1;
    state.accum = 0;
    var moved = hit.scroller ? stepScroller(hit.scroller, dir) : clickButton(hit.root, dir);
    if (moved) state.ignoreUntil = performance.now() + config.coalesceMs;
  }

  function clickButton(root, dir) {
    var btn = findButton(root, dir);
    if (!btn) return false;
    btn.click();
    return true;
  }

  function configure(next) {
    if (!next) return config;
    if (typeof next.threshold === "number") config.threshold = next.threshold;
    if (typeof next.coalesceMs === "number") config.coalesceMs = next.coalesceMs;
    if (next.behavior === "auto" || next.behavior === "smooth" || next.behavior === null) {
      config.behavior = next.behavior;
    }
    if (typeof next.releaseAtEdge === "boolean") config.releaseAtEdge = next.releaseAtEdge;
    return config;
  }

  function debugReset(el) {
    if (!el) return;
    intent.delete(el);
    wheelState.delete(el);
    if (typeof el.scrollLeft === "number") el.scrollLeft = 0;
  }

  globalThis.XCarouselWheel = {
    handleWheel: handleWheel,
    findHit: findHit,
    configure: configure,
    debugReset: debugReset
  };
})();
