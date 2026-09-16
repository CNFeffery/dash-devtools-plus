import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";

const antdLocales = {
  en: enUS,
  "zh-CN": zhCN,
};

export function getAntdLocale(locale) {
  return antdLocales[locale] || enUS;
}
