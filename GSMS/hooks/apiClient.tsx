import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type ApiResponse<T> = {
  error?: string;
  [key: string]: any;
} & T;

const API_BASE_URL: string = process.env.API_BASE_URL || 'https://gsms-ten.vercel.app/api';

// ---- In-memory token cache ----
let cachedToken: string | null = null;

// ---- Token helpers ----
export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;

  try {
    if (Platform.OS === 'web') {
      cachedToken = localStorage.getItem('session');
    } else {
      cachedToken = await SecureStore.getItemAsync('session');
    }
  } catch (err) {
    console.error('Failed to read token', err);
    cachedToken = null;
  }
  return cachedToken;
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;

  try {
    if (Platform.OS === 'web') {
      localStorage.setItem('session', token);
    } else {
      await SecureStore.setItemAsync('session', token);
    }
  } catch (err) {
    console.error('Failed to store token', err);
  }
}

export async function removeToken(): Promise<void> {
  cachedToken = null;
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem('session');
    } else {
      await SecureStore.deleteItemAsync('session');
    }
  } catch (err) {
    console.error('Failed to remove token', err);
  }
}

// ---- General API request helper ----
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function apiRequest<T>(
  endpoint: string,
  method: HttpMethod = 'GET',
  body?: any,
  authRequired = false,
  timeoutMs = 10000
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (authRequired) {
    const token = await getToken();
    if (!token) throw new Error('No auth token found');
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();

    let data: ApiResponse<T>;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON response');
    }

    if (!response.ok) {
      const errMsg = data?.error || `API request failed with status ${response.status}`;
      throw new Error(errMsg);
    }

    return data;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ---- Auth API calls ----
export async function registerUser(
  email: string,
  password: string
): Promise<{ user_id: string }> {
  return apiRequest<{ user_id: string }>('/register', 'POST', { email, password });
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ token: string; user_id: string }> {
  const data = await apiRequest<{ token: string; user_id: string }>(
    '/login',
    'POST',
    { email, password }
  );
  await setToken(data.token);
  return data;
}

// ---- User Email ----
export async function getCurrentEmail(): Promise<{ email: string }> {
  return apiRequest<{ email: string }>('/user/email', 'GET', undefined, true);
}

export async function updateEmail(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/user/email', 'POST', { email }, true);
}

// ---- User Password ----
export async function updatePassword(password: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/user/password', 'POST', { password }, true);
}

// ---- User Profile ----
export type UserProfile = {
  first_name?: string;
  last_name?: string;
  profile_image?: string;
  phone_number?: string;
};

export async function getProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/user/profile', 'GET', undefined, true);
}

export async function updateProfile(profile: UserProfile): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/user/profile', 'POST', profile, true);
}

export async function logout(): Promise<void> {
  await removeToken();
}