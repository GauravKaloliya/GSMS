import { Slot } from 'expo-router';
import { SessionProvider } from '../hooks/ctx';

export default function RootLayout() {
  return (
    <SessionProvider>
      <Slot />
    </SessionProvider>
  );
}
