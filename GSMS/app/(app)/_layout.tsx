import { Redirect, Stack, createPath } from 'expo-router';
import { Text } from 'react-native';
import { useSession } from '../../hooks/ctx';

export default function ProtectedLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  if (!session) {
    return <Redirect href="/signin" />;
  }

  return <Stack />;
}