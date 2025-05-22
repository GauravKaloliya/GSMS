import { use, createContext, type PropsWithChildren } from 'react';
import { useStorageState } from './useStorageState';
import { router } from 'expo-router';

// Context type definition
type AuthContextType = {
  signIn: () => void;
  signOut: () => void;
  session?: string | null;
  isLoading: boolean;
  isSignedIn: boolean;
};

// Create context
const AuthContext = createContext<AuthContextType | null>(null);

// Custom hook to use context
export function useSession() {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useSession must be used within a <SessionProvider />');
  }
  return context;
}

// Provider component
export function SessionProvider({ children }: PropsWithChildren) {
  const [[isLoading, session], setSession] = useStorageState('session');

  const signIn = () => {
    setSession('mock-session-token');
    router.replace('/');
  };

  const signOut = () => {
    setSession(null);
    router.replace('/signin');
  };

  return (
    <AuthContext.Provider
      value={{
        signIn,
        signOut,
        session,
        isLoading,
        isSignedIn: !!session,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}