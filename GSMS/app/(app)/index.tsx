import { View, Text } from 'react-native';
import { useSession } from '../../hooks/ctx';

export default function HomeScreen() {
  const { signOut } = useSession();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text onPress={signOut}>
        Sign Out
      </Text>
    </View>
  );
}
