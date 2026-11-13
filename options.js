(function () {
  var COPY = {
    ja: {
      title: "xyokoscroll の設定",
      release: "最初・最後の画像の先は、タイムラインを縦スクロールする",
      hint: "オンのときは、端の画像まで送ったあとのホイールでタイムラインが動きます。オフにすると、画像の上では端で止まります。タイムラインを動かすには、カーソルを画像の外へ出してください。",
      language: "言語",
      auto: "ブラウザの言語"
    },
    en: {
      title: "xyokoscroll settings",
      release: "Past the first or last image, scroll the timeline vertically",
      hint: "When this is on, the wheel scrolls the timeline after the carousel reaches either end. When it is off, the wheel stops at the end while the pointer is over the image. Move the pointer off the image to scroll the timeline.",
      language: "Language",
      auto: "Browser language"
    }
  };

  var releaseInput = document.getElementById("release");
  var languageInput = document.getElementById("language");

  function browserLocale() {
    var lang = "";
    try {
      if (chrome.i18n && chrome.i18n.getUILanguage) lang = chrome.i18n.getUILanguage();
    } catch (e) {}
    if (!lang && navigator.language) lang = navigator.language;
    return String(lang).toLowerCase().indexOf("ja") === 0 ? "ja" : "en";
  }

  function resolve(choice) {
    if (choice === "ja" || choice === "en") return choice;
    return browserLocale();
  }

  function applyCopy(choice) {
    var locale = resolve(choice);
    var copy = COPY[locale];
    document.documentElement.lang = locale;
    document.title = copy.title;
    document.getElementById("release-label").textContent = copy.release;
    document.getElementById("hint").textContent = copy.hint;
    document.getElementById("language-label").textContent = copy.language;
    languageInput.querySelector('option[value="auto"]').textContent = copy.auto;
    document.body.classList.add("ready");
  }

  function savedChoice(items) {
    var choice = items && items.uiLocale;
    if (choice === "ja" || choice === "en") return choice;
    return "auto";
  }

  applyCopy("auto");
  languageInput.value = "auto";

  try {
    chrome.storage.local.get({ releaseAtEdge: true, uiLocale: "auto" }, function (items) {
      if (chrome.runtime && chrome.runtime.lastError) return;
      releaseInput.checked = !items || items.releaseAtEdge !== false;
      var choice = savedChoice(items);
      languageInput.value = choice;
      applyCopy(choice);
    });
  } catch (e) {}

  releaseInput.addEventListener("change", function () {
    chrome.storage.local.set({ releaseAtEdge: releaseInput.checked });
  });

  languageInput.addEventListener("change", function () {
    var choice = savedChoice({ uiLocale: languageInput.value });
    languageInput.value = choice;
    applyCopy(choice);
    chrome.storage.local.set({ uiLocale: choice });
  });
})();
