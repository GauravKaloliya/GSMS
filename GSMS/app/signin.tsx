import { router } from 'expo-router';
import { View, Text } from 'react-native';
import { useSession } from '../hooks/ctx';

export default function SignInScreen() {
  const { signIn } = useSession();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text onPress={() => {
        signIn();
        router.replace('/');
      }}>
        Sign In
      </Text>
    </View>
  );
}