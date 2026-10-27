import { useTranslation } from "react-i18next";
import { useSettings } from "../context/SettingsContext";

export default function Toolbar() {
  const { t } = useTranslation();
  const { theme, toggleTheme, toggleLang } = useSettings();

  return (
    <div className="toolbar">
      <button className="btn btn-ghost" type="button" onClick={toggleLang}>
        {t("common.switchLang")}
      </button>
      <button
        className="btn btn-ghost"
        type="button"
        onClick={toggleTheme}
        aria-label={t("common.toggleTheme")}
      >
        {theme === "dark" ? t("common.light") : t("common.dark")}
      </button>
    </div>
  );
}
