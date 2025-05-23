import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Image
} from 'react-native';

import { router } from 'expo-router';

export default function HomeScreen() {
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