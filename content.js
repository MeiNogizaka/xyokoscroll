(function () {
  if (globalThis.__xCarouselWheelInstalled) return;
  if (!globalThis.XCarouselWheel) return;
  globalThis.__xCarouselWheelInstalled = true;

  function applyReleaseAtEdge(value) {
    globalThis.XCarouselWheel.configure({ releaseAtEdge: value !== false });
  }

  function watchSetting() {
    var storage = globalThis.chrome && chrome.storage && chrome.storage.local;
    if (!storage || !chrome.storage.onChanged) return;
    storage.get({ releaseAtEdge: true }, function (items) {
      if (chrome.runtime && chrome.runtime.lastError) return;
      applyReleaseAtEdge(items && items.releaseAtEdge);
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local" || !changes.releaseAtEdge) return;
      applyReleaseAtEdge(changes.releaseAtEdge.newValue);
    });
  }

  watchSetting();
  window.addEventListener("wheel", globalThis.XCarouselWheel.handleWheel, {
    capture: true,
    passive: false
  });
})();
