import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const api = axios.create({ baseURL: '/api/v1' });

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  if (config.method === 'get') {
    // config.params = { ...config.params, _t: Date.now() }; // Disabled to prevent backend validation errors
  }
  
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    // O 401 do próprio login é resposta esperada a uma senha errada — não há
    // sessão para encerrar. Tratá-lo como expiração recarregava a página e
    // apagava a mensagem de erro antes de ela aparecer.
    const isLoginAttempt = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLoginAttempt) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  },
);

export default api;
