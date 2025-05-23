import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type ApiResponse<T> = {
  error?: string;
  [key: string]: any;
} & T;

const API_BASE_URL = process.env.API_BASE_URL || '';

// Async token helpers to handle both web and native securely
export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem('session');
    } catch {
      return null;
    }
  } else {
    return await SecureStore.getItemAsync('session');
  }
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem('session', token);
    } catch {
      // optionally log or handle errors
    }
  } else {
    await SecureStore.setItemAsync('session', token);
  }
}

export async function removeToken(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem('session');
    } catch {
      // optionally log or handle errors
    }
  } else {
    await SecureStore.deleteItemAsync('session');
  }
}

// General API request helper
export async function apiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  authRequired = false
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (authRequired) {
    const token = await getToken();
    if (!token) {
      throw new Error('No auth token found');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: ApiResponse<T>;
  try {
    data = await response.json();
  } catch {
    throw new Error('Invalid JSON response');
  }

  if (!response.ok) {
    const errMsg = data.error || `API request failed with status ${response.status}`;
    throw new Error(errMsg);
  }

  return data;
}

// Auth API calls

export async function registerUser(email: string, password: string): Promise<{ user_id: string }> {
  return apiRequest<{ user_id: string }>('/register', 'POST', { email, password });
}

export async function loginUser(email: string, password: string): Promise<{ token: string; user_id: string }> {
  const data = await apiRequest<{ token: string; user_id: string }>('/login', 'POST', { email, password });
  await setToken(data.token);
  return data;
}

// Example of authenticated API call
export async function getProtectedData(): Promise<any> {
  return apiRequest('/protected/data', 'GET', undefined, true);
}

// Logout helper clears stored token
export async function logout(): Promise<void> {
  await removeToken();
}