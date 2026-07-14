import axios from "axios";

const configuredApiUrl = import.meta.env.VITE_ATL_API_URL?.trim();
const apiBaseUrl = configuredApiUrl || "/api/";

const api = axios.create({
  baseURL: apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`,
  withCredentials: true,
  timeout: 10000,
});

export default api;
