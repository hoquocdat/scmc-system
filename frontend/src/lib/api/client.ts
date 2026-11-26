import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { supabase } from '../supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Failed to get auth token:', error);
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    // Keep the AxiosError (status, response.data.code, …) so screens can react to
    // specific refusals; only the message is replaced with the server's message.
    if (error.response) {
      const message = (error.response.data as { message?: unknown } | undefined)?.message;
      if (typeof message === 'string' && message) error.message = message;
      else if (Array.isArray(message) && message.length) error.message = message.join(', ');
    } else if (error.request) {
      error.message = 'Network error - no response from server';
    }
    return Promise.reject(error);
  }
);

export const apiClient = axiosInstance;
