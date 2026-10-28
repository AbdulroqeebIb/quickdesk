import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { PriorityTag, StatusBadge } from "../components/Badges";

const STATUSES = ["open", "in_progress", "resolved"];

export default function TicketDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isStaff = user.role === "it_staff";

  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const fmt = (value) => new Date(value).toLocaleString(i18n.language);

  useEffect(() => {
    let cancelled = false;
    api(`/api/tickets/${id}`)
      .then((data) => {
        if (cancelled) return;
        setTicket(data.ticket);
        setComments(data.comments);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          [400, 403, 404].includes(err.status)
            ? t("detail.notFound")
            : t("common.error"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  useEffect(() => {
    if (!isStaff) return;
    api("/api/tickets/staff")
      .then((data) => setStaff(data.staff))
      .catch(() => {});
  }, [isStaff]);

  const update = async (path, payload) => {
    setActionError("");
    try {
      const data = await api(`/api/tickets/${id}/${path}`, {
        method: "PATCH",
        body: payload,
      });
      setTicket(data.ticket);
    } catch {
      setActionError(t("common.error"));
    }
  };

  const postComment = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    setActionError("");
    try {
      const data = await api(`/api/tickets/${id}/comments`, {
        method: "POST",
        body: { body: text },
      });
      setComments((c) => [...c, data.comment]);
      setText("");
    } catch {
      setActionError(t("common.error"));
    } finally {
      setPosting(false);
    }
  };

  const back = (
    <Link to="/tickets" className="back">
      <span className="flip">←</span> {t("detail.back")}
    </Link>
  );

  if (loading) return <p className="muted">{t("tickets.loading")}</p>;

  if (error || !ticket) {
    return (
      <div>
        {back}
        <div className="card">
          <p className="error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div>
        {back}
        <div className="card">
          <div className="page-head">
            <h1>{ticket.title}</h1>
            <div className="ticket-side">
              <PriorityTag priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>
          </div>

          <dl className="detail-grid">
            <div>
              <dt>{t("detail.category")}</dt>
              <dd>{t(`category.${ticket.category}`)}</dd>
            </div>
            <div>
              <dt>{t("detail.createdBy")}</dt>
              <dd>{ticket.created_by_name}</dd>
            </div>
            <div>
              <dt>{t("detail.assignedTo")}</dt>
              <dd>{ticket.assigned_to_name || t("detail.nobody")}</dd>
            </div>
            <div>
              <dt>{t("detail.created")}</dt>
              <dd>{fmt(ticket.created_at)}</dd>
            </div>
            {ticket.resolved_at && (
              <div>
                <dt>{t("detail.resolved")}</dt>
                <dd>{fmt(ticket.resolved_at)}</dd>
              </div>
            )}
          </dl>

          <p className="description">{ticket.description}</p>
        </div>
      </div>

      {isStaff && (
        <div className="card">
          <h2>{t("detail.manage")}</h2>
          <div className="manage-row">
            <label>
              <span>{t("detail.status")}</span>
              <select
                value={ticket.status}
                onChange={(e) => update("status", { status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("detail.assignLabel")}</span>
              <select
                value={ticket.assigned_to ?? ""}
                onChange={(e) =>
                  update("assign", { assigned_to: Number(e.target.value) })
                }
              >
                <option value="" disabled>
                  {t("detail.choose")}
                </option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            {ticket.assigned_to !== user.id && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => update("assign", {})}
              >
                {t("detail.assignMe")}
              </button>
            )}
          </div>
        </div>
      )}

      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}

      <div className="card">
        <h2>{t("detail.comments")}</h2>
        {comments.length === 0 ? (
          <p className="muted">{t("detail.noComments")}</p>
        ) : (
          <div className="comments">
            {comments.map((c) => (
              <div
                key={c.id}
                className={`comment ${c.user_role === "it_staff" ? "comment-staff" : ""}`}
              >
                <div className="comment-head">
                  <strong>{c.user_name}</strong>
                  {c.user_role === "it_staff" && (
                    <span className="badge">{t("roles.it_staff")}</span>
                  )}
                  <span className="muted small">{fmt(c.created_at)}</span>
                </div>
                <p className="comment-body">{c.body}</p>
              </div>
            ))}
          </div>
        )}

        <form className="form" onSubmit={postComment}>
          <label className="field">
            <span>{t("detail.addComment")}</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          </label>
          <div className="form-actions">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={posting}
            >
              {posting ? t("detail.posting") : t("detail.post")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
