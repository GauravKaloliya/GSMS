import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  ScrollView,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';

export default function EditProfile() {
  const router = useRouter();

  // State for profile image URI
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Sorry, we need camera roll permissions to make this work!');
      }
    })();
  }, []);

  // Open image picker
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // use string literals 'All', 'Images', or 'Videos'
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
  
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setProfileImage(result.assets[0].uri);
    }
  };
  

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  // Validation states
  const [usernameValid, setUsernameValid] = useState<boolean | null>(null);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [bioValid, setBioValid] = useState<boolean | null>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernameRegex = /^[^\s]{3,}$/;
  const bioMaxLength = 150;

  const handleChange = (field: string, value: string) => {
    if (field === 'username') {
      setUsername(value);
      setUsernameValid(usernameRegex.test(value));
    } else if (field === 'email') {
      setEmail(value);
      setEmailValid(emailRegex.test(value));
    } else if (field === 'bio') {
      setBio(value);
      setBioValid(value.length <= bioMaxLength);
    }
  };

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setBio('');
    setUsernameValid(null);
    setEmailValid(null);
    setBioValid(null);
    setProfileImage(null);
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();

    if (!usernameValid || !emailValid || !bioValid) {
      Alert.alert('Error', 'Please fill all fields correctly.');
      return;
    }

    setLoading(true);
    try {
      // Simulate profile update including image upload (you can integrate actual upload here)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert('Success', 'Profile updated successfully.');
      resetForm();
    } catch (error: any) {
      Alert.alert('Update Failed', error.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const renderValidationText = (valid: boolean | null, validMsg: string, invalidMsg: string) =>
    valid !== null && (
      <Text style={[styles.validationMessage, valid ? styles.validText : styles.invalidText]}>
        {valid ? validMsg : invalidMsg}
      </Text>
    );

  const isSubmitDisabled = loading || !usernameValid || !emailValid || !bioValid;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.replace('/profile')}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Icon name="chevron-back" size={28} color="#3399ff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Edit Profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
          
          {/* Profile Image Section */}
          <TouchableOpacity onPress={pickImage} activeOpacity={0.7} style={styles.imageWrapper}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Icon name="camera" size={40} color="#555" />
                <Text style={styles.imageText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={[styles.inputWrapper, usernameValid === null && styles.marginBottomSmall]}>
            <TextInput
              style={[
                styles.input,
                usernameValid === true && styles.inputValid,
                usernameValid === false && styles.inputInvalid,
              ]}
              placeholder="Username"
              autoCapitalize="none"
              onChangeText={(text) => handleChange('username', text)}
              value={username}
              placeholderTextColor="#aaa"
              textContentType="username"
            />
            {renderValidationText(
              usernameValid,
              'Valid username',
              'Username must be at least 3 characters, no spaces'
            )}
          </View>

          <View style={[styles.inputWrapper, emailValid === null && styles.marginBottomSmall]}>
            <TextInput
              style={[
                styles.input,
                emailValid === true && styles.inputValid,
                emailValid === false && styles.inputInvalid,
              ]}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={(text) => handleChange('email', text)}
              value={email}
              placeholderTextColor="#aaa"
              textContentType="emailAddress"
            />
            {renderValidationText(emailValid, 'Valid email', 'Invalid email address')}
          </View>

          <View style={[styles.inputWrapper, bioValid === null && styles.marginBottomSmall]}>
            <TextInput
              style={[
                styles.input,
                styles.bioInput,
                bioValid === true && styles.inputValid,
                bioValid === false && styles.inputInvalid,
              ]}
              placeholder="Bio (max 150 characters)"
              multiline
              numberOfLines={4}
              maxLength={bioMaxLength}
              onChangeText={(text) => handleChange('bio', text)}
              value={bio}
              placeholderTextColor="#aaa"
            />
            {renderValidationText(
              bioValid,
              `${bio.length} / ${bioMaxLength} characters`,
              `Bio must be ${bioMaxLength} characters or less`
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, isSubmitDisabled && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitDisabled}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Update Profile</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000' },
  container: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  topBar: {
    height: 60,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#eee',
  },
  imageWrapper: {
    alignSelf: 'center',
    marginBottom: 30,
  },
  profileImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3399ff',
  },
  placeholderImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#555',
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageText: {
    color: '#555',
    marginTop: 5,
    fontSize: 14,
  },
  inputWrapper: {
    width: '100%',
  },
  marginBottomSmall: {
    marginBottom: 10,
  },
  input: {
    height: 50,
    backgroundColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 15,
    color: '#eee',
    fontSize: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 15,
  },
  inputValid: {
    borderColor: '#00c851',
  },
  inputInvalid: {
    borderColor: '#ff4444',
  },
  validationMessage: {
    marginVertical: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  validText: {
    color: '#00c851',
  },
  invalidText: {
    color: '#ff4444',
  },
  button: {
    backgroundColor: '#3399ff',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#555555',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
});