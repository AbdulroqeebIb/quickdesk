import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { PriorityTag, StatusBadge } from "../components/Badges";

const STATUSES = ["open", "in_progress", "resolved"];
const CATEGORIES = ["hardware", "network", "software", "email"];
const PRIORITIES = ["low", "medium", "high"];

export default function Tickets() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isStaff = user.role === "it_staff";

  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    category: "",
    assigned: "",
    search: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    const id = setTimeout(() => setFilter("search", searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    api(`/api/tickets?${params.toString()}`)
      .then((data) => {
        if (cancelled) return;
        setTickets(data.tickets);
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError(t("common.error"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters, t]);

  return (
    <div>
      <div className="page-head">
        <h1>{isStaff ? t("tickets.title") : t("tickets.titleMine")}</h1>
        <Link to="/tickets/new" className="btn btn-primary btn-link">
          + {t("tickets.new")}
        </Link>
      </div>

      <div className="filters">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("tickets.search")}
          aria-label={t("tickets.search")}
        />

        <div className="chips">
          <button
            type="button"
            className={`chip ${filters.status === "" ? "active" : ""}`}
            onClick={() => setFilter("status", "")}
          >
            {t("tickets.all")}
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${filters.status === s ? "active" : ""}`}
              onClick={() => setFilter("status", s)}
            >
              {t(`status.${s}`)}
            </button>
          ))}
        </div>

        <div className="filter-row">
          <select
            value={filters.priority}
            onChange={(e) => setFilter("priority", e.target.value)}
          >
            <option value="">{t("tickets.allPriorities")}</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`priority.${p}`)}
              </option>
            ))}
          </select>
          <select
            value={filters.category}
            onChange={(e) => setFilter("category", e.target.value)}
          >
            <option value="">{t("tickets.allCategories")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`category.${c}`)}
              </option>
            ))}
          </select>
          {isStaff && (
            <select
              value={filters.assigned}
              onChange={(e) => setFilter("assigned", e.target.value)}
            >
              <option value="">{t("tickets.anyAssignee")}</option>
              <option value="none">{t("tickets.unassigned")}</option>
              <option value="me">{t("tickets.assignedToMe")}</option>
            </select>
          )}
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="muted">{t("tickets.loading")}</p>
      ) : tickets.length === 0 ? (
        <div className="card empty">
          <p>{t("tickets.empty")}</p>
          {!isStaff && <p className="muted small">{t("tickets.emptyHint")}</p>}
        </div>
      ) : (
        <div className="ticket-list">
          {tickets.map((tk) => (
            <Link key={tk.id} to={`/tickets/${tk.id}`} className="ticket-card">
              <div>
                <p className="ticket-title">{tk.title}</p>
                <p className="ticket-meta">
                  #{tk.id} · {t(`category.${tk.category}`)} ·{" "}
                  {new Date(tk.created_at).toLocaleDateString(i18n.language)}
                  {isStaff && (
                    <> · {t("tickets.by", { name: tk.created_by_name })}</>
                  )}
                </p>
                {tk.assigned_to_name && (
                  <p className="ticket-meta">
                    {t("tickets.assignedTo", { name: tk.assigned_to_name })}
                  </p>
                )}
              </div>
              <div className="ticket-side">
                <PriorityTag priority={tk.priority} />
                <StatusBadge status={tk.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
