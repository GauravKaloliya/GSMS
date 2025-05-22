import { useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Image
} from 'react-native';
import { useSession } from '../../hooks/ctx';
import { router } from 'expo-router';

export default function HomeScreen() {
  const { isLoading, session } = useSession();

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/signin');
    }
  }, [isLoading, session]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3399ff" />
      </View>
    );
  }

  if (!session) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.companyName}>GSMS</Text>
        <Pressable onPress={() => router.push('/profile')} accessibilityLabel="Go to profile">
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1499714608240-22fc6ad53fb2?ixlib=rb-4.0.3&auto=format&fit=crop&w=880&q=80',
            }}
            style={styles.profileIcon}
          />
        </Pressable>
      </View>

      <View style={styles.container}>
        <Text style={styles.text}>Welcome back 👋</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  topBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    backgroundColor: '#000',
  },
  companyName: {
    color: '#eee',
    fontSize: 22,
    fontWeight: '700',
  },
  profileIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  container: {
    padding: 20,
  },
  text: {
    color: '#eee',
    fontSize: 28,
    fontWeight: '600',
  },
});