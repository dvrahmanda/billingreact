import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 12000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('billing_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('billing_token');
      localStorage.removeItem('billing_user');
      if (!window.location.pathname.includes('/login')) window.location.href = '/login';
    }
    const message = error.response?.data?.message || error.message || 'Terjadi kesalahan';
    return Promise.reject(Object.assign(error, { friendlyMessage: message }));
  }
);

export const apiGet = async (url, config) => (await api.get(url, config)).data;
export const apiPost = async (url, body, config) => (await api.post(url, body, config)).data;
export const apiPut = async (url, body, config) => (await api.put(url, body, config)).data;
export const apiDelete = async (url, config) => (await api.delete(url, config)).data;

export const apiDownload = async (url, filename) => {
  const response = await api.get(url, { responseType: 'blob' });
  const objectUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

export const apiOpenFile = async (url) => {
  const popup = window.open('about:blank', '_blank');
  if (popup) popup.opener = null;
  try {
    const response = await api.get(url, { responseType: 'blob' });
    const objectUrl = URL.createObjectURL(response.data);
    if (popup) popup.location.href = objectUrl;
    else window.location.href = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
};

export const privateFileUrl = (storedPath) => {
  if (!storedPath) return '';
  const match = String(storedPath).replaceAll('\\', '/').match(/(?:uploads\/)?([^/]+)\/([^/]+)$/);
  return match ? `/files/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}` : '';
};

export default api;
