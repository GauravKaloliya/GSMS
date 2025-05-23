import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { getToken, removeToken } from '../../hooks/apiClient';

export default function HomeScreen() {
  useEffect(() => {
    const checkAuth = async () => {
      const token = await getToken();
      if (!token) {
        router.replace('/signin'); // Redirect to sign-in if no token
      }
    };

    checkAuth();
  }, []);

  const handleSignOut = async () => {
    try {
      await removeToken();
      router.replace('/signin');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <Text style={styles.companyName}>GSMS</Text>
        <View style={styles.topRightButtons}>
          <Pressable
            onPress={() => router.push('/profile')}
            accessibilityLabel="Go to profile"
            style={styles.iconButton}
          >
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1499714608240-22fc6ad53fb2?ixlib=rb-4.0.3&auto=format&fit=crop&w=880&q=80',
              }}
              style={styles.profileIcon}
            />
          </Pressable>

          <Pressable
            onPress={handleSignOut}
            accessibilityLabel="Sign out"
            style={styles.signOutButton}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
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
  topRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginRight: 15,
  },
  profileIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  signOutButton: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e63946',
    borderRadius: 6,
  },
  signOutText: {
    color: '#fff',
    fontWeight: '700',
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