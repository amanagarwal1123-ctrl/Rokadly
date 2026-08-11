import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const api = axios.create({ baseURL: `${BACKEND_URL}/api` });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("rokadly_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith("/login")) {
      localStorage.removeItem("rokadly_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ---- Money helpers (integer paise <-> display) ----
export const fmtINR = (paise, { signed = false, dash = "\u2014" } = {}) => {
  if (paise === null || paise === undefined) return dash;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const p = abs % 100;
  const grouped = new Intl.NumberFormat("en-IN").format(rupees);
  const frac = p ? `.${String(p).padStart(2, "0")}` : "";
  const sign = paise < 0 ? "\u2212" : signed && paise > 0 ? "+" : "";
  return `${sign}\u20B9${grouped}${frac}`;
};

export const toPaise = (val) => {
  if (val === null || val === undefined || val === "") return 0;
  const n = parseFloat(String(val).replace(/,/g, ""));
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
};

export const fromPaise = (paise) => {
  if (paise === null || paise === undefined) return "";
  return String(paise % 100 === 0 ? paise / 100 : (paise / 100).toFixed(2));
};

export const errMsg = (err) => {
  const d = err?.response?.data?.detail;
  if (!d) return err?.message || "Something went wrong";
  if (typeof d === "string") return d;
  if (d.message) return d.message;
  return JSON.stringify(d);
};

export const fmtDate = (iso) => {
  if (!iso) return "\u2014";
  try {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
};

export const fmtDateTime = (iso) => {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export const PAYMENT_LABELS = {
  cash: "Cash", card: "Card", cheque: "Cheque", bank: "Bank", other: "Other",
};

export const RECON_LABELS = {
  unreviewed: "Unreviewed", matched: "Matched", pending: "Pending",
  cleared: "Cleared", exception_approved: "Exception Approved", finally_tallied: "Finally Tallied",
};
