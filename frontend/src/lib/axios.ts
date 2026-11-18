import axios from 'axios';
import { isBlockedUser } from './blockedUsers';

const API_BASE_URL = import.meta.env.VITE_API_URL;

// Create axios instance
const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add Clerk session token
axiosInstance.interceptors.request.use(
    async (config) => {
        try {
            // Get the Clerk instance from window
            const clerkInstance = (window as any).Clerk;

            if (clerkInstance?.session) {
                // Block all API requests for restricted users
                const userId = clerkInstance.user?.id;
                if (isBlockedUser(userId)) {
                    return Promise.reject(new axios.Cancel('Service temporarily unavailable'));
                }

                // Get the session token from Clerk
                const token = await clerkInstance.session.getToken();

                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            }
        } catch (error) {
            console.error('Error getting Clerk token:', error);
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle errors
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If unauthorized and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const clerkInstance = (window as any).Clerk;

                if (clerkInstance?.session) {
                    // Force refresh the token
                    const token = await clerkInstance.session.getToken({ skipCache: true });

                    if (token) {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return axiosInstance(originalRequest);
                    }
                }
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                // Redirect to sign-in or handle logout
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
