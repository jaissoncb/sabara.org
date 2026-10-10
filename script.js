// Traduções estáticas, sem solicitações a serviços externos ou seletor de idioma.
const translations = {
  "sq": "E gjete.",
  "be": "Вы знайшлі гэта.",
  "bs": "Pronašli ste ga.",
  "bg": "Открихте го.",
  "ca": "Ho has trobat.",
  "hr": "Pronašli ste ga.",
  "cs": "Našli jste to.",
  "da": "Du fandt det.",
  "nl": "Je hebt het gevonden.",
  "en": "You found it.",
  "et": "Leidsid selle üles.",
  "fi": "Löysit sen.",
  "fr": "Vous l'avez trouvé.",
  "de": "Du hast es gefunden.",
  "el": "Το βρήκατε.",
  "hu": "Megtaláltad.",
  "is": "Þú fannst það.",
  "ga": "D'aimsigh tú é.",
  "it": "L'hai trovato.",
  "lv": "Tu to atradi.",
  "lt": "Tu tai radai.",
  "lb": "Du hues et fonnt.",
  "mk": "Го најдовте.",
  "mt": "Sibtu.",
  "no": "Du fant det.",
  "pl": "Znalezione!",
  "pt-PT": "Encontraste!",
  "pt-BR": "Você achou!",
  "ro": "L-ai găsit.",
  "ru": "Вы нашли это.",
  "sr": "Пронашли сте га.",
  "sk": "Našli ste to.",
  "sl": "Našli ste ga.",
  "es": "Lo encontraste.",
  "sv": "Du hittade det.",
  "tr": "Buldunuz.",
  "uk": "Ви знайшли це.",
  "zh-CN": "你找到了。",
  "zh-TW": "你找到了。",
  "ja": "見つけましたね。"
};

function normalizeLocale(rawLocale) {
  const normalized = String(rawLocale || "").trim().replace(/_/g, "-").toLowerCase();
  if (normalized === "pt-br" || normalized.startsWith("pt-br-")) return "pt-BR";
  if (normalized === "pt" || normalized.startsWith("pt-")) return "pt-PT";
  if (normalized === "zh-tw" || normalized === "zh-hk" || normalized === "zh-mo" || normalized.includes("hant")) return "zh-TW";
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
  const language = normalized.split("-")[0];
  return Object.prototype.hasOwnProperty.call(translations, language) ? language : null;
}

function chooseLocale(browserLanguages, testLocale) {
  const override = testLocale ? normalizeLocale(testLocale) : null;
  if (override) return override;
  for (const browserLocale of browserLanguages) {
    const match = normalizeLocale(browserLocale);
    if (match) return match;
  }
  return "en";
}

const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language || "en"];
const requestedTestLocale = new URLSearchParams(window.location.search).get("lang");
const locale = chooseLocale(browserLanguages, requestedTestLocale);
document.documentElement.lang = locale;
const tagline = document.getElementById("tagline");
if (tagline) tagline.textContent = translations[locale];
const description = document.querySelector('meta[name="description"]');
if (description) description.content = `Sabará. ${translations[locale]}`;
