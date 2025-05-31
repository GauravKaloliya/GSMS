import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { router } from 'expo-router';
import { logoutUser } from '../../hooks/apiClient';
export default function ProfileScreen() {
  const handleSignOut = async () => {
    try {
      await logoutUser();
      router.replace('/signin');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const goToEditProfile = () => {
    router.push('/editprofile');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableWithoutFeedback onPress={handleSignOut}>
          <View style={styles.topBarButton}>
            <Icon name="log-out" size={24} color="#ff4444" />
          </View>
        </TouchableWithoutFeedback>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Image
          source={{ uri: 'https://i.pravatar.cc/150?img=12' }}
          style={styles.avatar}
        />

        <Text style={styles.name}>John Doe</Text>
        <Text style={styles.email}>john.doe@example.com</Text>

        <TouchableWithoutFeedback onPress={goToEditProfile}>
          <View style={styles.button}>
            <Icon name="edit" size={20} color="#fff" style={styles.iconLeft} />
            <Text style={styles.buttonText}>Edit Profile</Text>
          </View>
        </TouchableWithoutFeedback>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.sectionText}>
            Software developer passionate about mobile apps and design. Loves React Native and open source.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    height: 60,
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  topBarButton: {
    marginLeft: 20,
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3399ff',
    marginBottom: 20,
    backgroundColor: '#222',
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: '#eee',
  },
  email: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 30,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3399ff',
    paddingVertical: 14,
    paddingHorizontal: 50,
    borderRadius: 10,
    marginBottom: 30,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  iconLeft: {
    marginRight: 10,
  },
  section: {
    width: '100%',
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#3399ff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionText: {
    color: '#ddd',
    fontSize: 14,
  },
});