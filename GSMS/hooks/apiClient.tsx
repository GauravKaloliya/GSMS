import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { jwtDecode } from 'jwt-decode';

export type ApiResponse<T> = {
  error?: string;
  [key: string]: any;
} & T;

const API_BASE_URL: string = process.env.API_BASE_URL || 'https://gsms-ten.vercel.app/api';

let cachedToken: string | null = null;

// --- Token helpers ---

export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;

  try {
    cachedToken =
      Platform.OS === 'web'
        ? localStorage.getItem('session')
        : await SecureStore.getItemAsync('session');
  } catch (error) {
    console.error('Failed to read token:', error);
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
  } catch (error) {
    console.error('Failed to store token:', error);
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
  } catch (error) {
    console.error('Failed to remove token:', error);
  }
}

// --- Session helpers ---

type TokenPayload = {
  uid: string; // user_id
  sid: string; // session_id
  exp: number;
  iat: number;
};

export async function getSessionInfo(): Promise<TokenPayload | null> {
  const token = await getToken();
  if (!token) return null;

  try {
    return jwtDecode<TokenPayload>(token);
  } catch (err) {
    console.error('Failed to decode JWT:', err);
    return null;
  }
}

// --- API request helper ---

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function apiRequest<T>(
  endpoint: string,
  method: HttpMethod = 'GET',
  body?: unknown,
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
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Auth API calls ---

export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<{ user_id: string }> {
  return apiRequest<{ user_id: string }>('/register', 'POST', { username, email, password });
}

export async function loginUser(
  credentials: { username?: string; email?: string; password: string }
): Promise<{ token: string; user_id: string }> {
  const data = await apiRequest<{ token: string; user_id: string; session_id?: string }>(
    '/login',
    'POST',
    credentials
  );
  await setToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  await removeToken();
}