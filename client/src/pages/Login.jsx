import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import Toolbar from "../components/Toolbar";

export default function Login() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/tickets" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.status === 401 ? t("auth.invalid") : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword("123456");
  };

  return (
    <div className="auth-page">
      <div className="auth-toolbar">
        <Toolbar />
      </div>
      <div className="card auth-card">
        <h1 className="brand-lg">{t("app.name")}</h1>
        <p className="muted">{t("app.tagline")}</p>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>{t("auth.email")}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>{t("auth.password")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? t("auth.loggingIn") : t("auth.login")}
          </button>
        </form>

        <div className="demo">
          <p className="muted small">{t("auth.demo")}</p>
          <div className="demo-buttons">
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => fillDemo("sara@test.com")}
            >
              {t("roles.employee")}
            </button>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => fillDemo("omar@test.com")}
            >
              {t("roles.it_staff")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
