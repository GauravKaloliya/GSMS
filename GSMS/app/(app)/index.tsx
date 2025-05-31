import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';
// import useAuthNotifications from '../../hooks/useAuthNotifications';

export default function HomeScreen() {
  // useAuthNotifications();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <Text style={styles.companyName}>GSMS</Text>
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
  container: {
    padding: 20,
  },
  text: {
    color: '#eee',
    fontSize: 28,
    fontWeight: '600',
  },
});