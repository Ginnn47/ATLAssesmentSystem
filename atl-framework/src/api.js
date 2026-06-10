import axios from "axios";

const configuredApiUrl = import.meta.env.VITE_ATL_API_URL?.trim();
const browserHost = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
const browserProtocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
const apiBaseUrl = configuredApiUrl || `${browserProtocol}//${browserHost}:8000/api/`;

const api = axios.create({
  baseURL: apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`,
  withCredentials: true,
});

export default api;
