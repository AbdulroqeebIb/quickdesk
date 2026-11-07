import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";

const CATEGORIES = ["hardware", "network", "software", "email"];
const PRIORITIES = ["low", "medium", "high"];

// Client-side image resize helper to keep files small (max 1280px width)
async function resizeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 1280;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            const resizedFile = new File([blob], file.name, {
              type: file.type || "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(resizedFile);
          },
          file.type || "image/jpeg",
          0.85,
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function NewTicket() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    category: "hardware",
    priority: "medium",
    description: "",
  });
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiNote, setAiNote] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleAiSuggest = async () => {
    if (!`${form.title}${form.description}`.trim()) {
      setError(t("common.aiNeedText"));
      return;
    }
    setError("");
    setLoadingAi(true);
    try {
      const data = await api("/api/ai/suggest", {
        method: "POST",
        body: { title: form.title, description: form.description },
      });
      setForm((f) => ({
        ...f,
        category: CATEGORIES.includes(data.category)
          ? data.category
          : f.category,
        priority: PRIORITIES.includes(data.priority)
          ? data.priority
          : f.priority,
      }));
      setAiNote(
        data.source === "ai" ? t("common.aiDone") : t("common.aiLocal"),
      );
    } catch {
      setError(t("common.aiFailed"));
    } finally {
      setLoadingAi(false);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    await processAndAddFiles(files);
    e.target.value = ""; // Reset input
  };

  const processAndAddFiles = async (newFiles) => {
    setError("");
    const validImages = newFiles.filter((f) =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type),
    );

    if (validImages.length !== newFiles.length) {
      setError(
        t("attachments.invalidType") ||
          "Only PNG, JPEG, and WebP images are allowed.",
      );
    }

    if (attachments.length + validImages.length > 3) {
      setError(
        t("attachments.maxLimit") ||
          "Maximum 3 attachments allowed per ticket.",
      );
      return;
    }

    const processed = [];
    for (const file of validImages) {
      if (file.size > 5 * 1024 * 1024) {
        setError(
          t("attachments.tooLarge") ||
            "File is too large (max 2MB after resize).",
        );
        continue;
      }
      const resized = await resizeImage(file);
      processed.push(resized);
    }

    setAttachments((prev) => [...prev, ...processed].slice(0, 3));
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      await processAndAddFiles(pastedFiles);
    }
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // 1. Create ticket
      const data = await api("/api/tickets", { method: "POST", body: form });
      const ticketId = data.ticket.id;

      // 2. Upload attachments if any exist (pointing directly to backend port 5000)
      if (attachments.length > 0) {
        const formData = new FormData();
        attachments.forEach((file) => {
          formData.append("images", file);
        });

        const token =
          localStorage.getItem("token") || sessionStorage.getItem("token");
        const uploadRes = await fetch(
          `http://localhost:5000/api/tickets/${ticketId}/attachments`,
          {
            method: "POST",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
          },
        );

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to upload attachments");
        }
      }

      navigate(`/tickets/${ticketId}`);
    } catch (err) {
      setError(err.message || t("common.error"));
      setLoading(false);
    }
  };

  return (
    <div className="narrow">
      <h1>{t("newTicket.title")}</h1>
      <p className="muted">{t("newTicket.subtitle")}</p>

      <form className="card form" onSubmit={handleSubmit} onPaste={handlePaste}>
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

        {/* Attachment Section */}
        <div className="field">
          <span>
            {t("attachments.label") ||
              "Attachments (Max 3 screenshots, Ctrl+V to paste)"}
          </span>
          <input
            type="file"
            accept="image/png, image/jpeg, image/webp"
            multiple
            onChange={handleFileSelect}
            disabled={attachments.length >= 3}
          />
          {attachments.length > 0 && (
            <div
              className="attachment-previews"
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "10px",
                flexWrap: "wrap",
              }}
            >
              {attachments.map((file, idx) => (
                <div
                  key={idx}
                  style={{
                    position: "relative",
                    border: "1px solid #ccc",
                    padding: "4px",
                    borderRadius: "4px",
                  }}
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${idx}`}
                    style={{
                      width: "80px",
                      height: "80px",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    style={{
                      position: "absolute",
                      top: "-6px",
                      right: "-6px",
                      background: "red",
                      color: "white",
                      border: "none",
                      borderRadius: "50%",
                      width: "20px",
                      height: "20px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btn-outline"
          onClick={handleAiSuggest}
          disabled={loadingAi}
        >
          {loadingAi ? t("common.aiLoading") : t("common.aiButton")}
        </button>
        {aiNote && <p className="m">{aiNote}</p>}
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
