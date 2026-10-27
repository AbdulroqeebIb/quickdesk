import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

export default function Tickets() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div>
      <h1>{t("tickets.title")}</h1>
      <p className="muted">{t("tickets.hello", { name: user.name })}</p>
      <div className="card">{t("tickets.placeholder")}</div>
    </div>
  );
}
