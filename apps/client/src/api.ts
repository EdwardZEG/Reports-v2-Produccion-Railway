import axios from 'axios';
import { getToken } from '../src/auth/authService';

const api = axios.create({
  baseURL: import.meta.env.PROD ? '/api/' : 'http://localhost:4000/api/',
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;