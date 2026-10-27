import { Link, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import Toolbar from "./Toolbar";

export default function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app">
      <header className="header">
        <Link to="/tickets" className="brand">
          {t("app.name")}
        </Link>
        <div className="header-actions">
          <Toolbar />
          <span className="user-name">{user.name}</span>
          <span className="badge">{t(`roles.${user.role}`)}</span>
          <button
            className="btn btn-outline"
            type="button"
            onClick={handleLogout}
          >
            {t("nav.logout")}
          </button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
