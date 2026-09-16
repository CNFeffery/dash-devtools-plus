import en from "./en";
import zhCN from "./zh-CN";

export const dictionaries = {en, "zh-CN": zhCN};
export const locales = ["en", "zh-CN"];

export function normalizeLocale(locale) {
  if (dictionaries[locale]) return locale;
  if (String(locale).toLowerCase().startsWith("zh")) return "zh-CN";
  return "en";
}

export function createTranslator(locale) {
  const selected = dictionaries[normalizeLocale(locale)];
  return (key) => selected[key] ?? dictionaries.en[key] ?? key;
}

