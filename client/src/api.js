const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? "" : "http://localhost:5000");

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";

  let token = null;
  try {
    token = localStorage.getItem("token");
  } catch {
    token = null;
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Network error", 0);
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !path.startsWith("/api/auth/login")) {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch {
      // ignore
    }
    window.location.assign("/login");
  }

  if (!res.ok) throw new ApiError(data.error || "Request failed", res.status);
  return data;
}
