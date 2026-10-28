import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";

const CATEGORIES = ["hardware", "network", "software", "email"];
const PRIORITIES = ["low", "medium", "high"];

export default function NewTicket() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    category: "hardware",
    priority: "medium",
    description: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api("/api/tickets", { method: "POST", body: form });
      navigate(`/tickets/${data.ticket.id}`);
    } catch {
      setError(t("common.error"));
      setLoading(false);
    }
  };

  return (
    <div className="narrow">
      <h1>{t("newTicket.title")}</h1>
      <p className="muted">{t("newTicket.subtitle")}</p>

      <form className="card form" onSubmit={handleSubmit}>
        <label className="field">
          <span>{t("newTicket.fieldTitle")}</span>
          <input
            type="text"
            value={form.title}
            onChange={set("title")}
            placeholder={t("newTicket.titlePlaceholder")}
            maxLength={120}
            required
          />
        </label>

        <div className="two-col">
          <label className="field">
            <span>{t("newTicket.category")}</span>
            <select value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`category.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("newTicket.priority")}</span>
            <select value={form.priority} onChange={set("priority")}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`priority.${p}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>{t("newTicket.description")}</span>
          <textarea
            value={form.description}
            onChange={set("description")}
            placeholder={t("newTicket.descriptionPlaceholder")}
            required
          />
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? t("newTicket.submitting") : t("newTicket.submit")}
          </button>
          <Link to="/tickets" className="btn btn-outline btn-link">
            {t("newTicket.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
