import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Easing,
  ScrollView, 
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { loginUser, registerUser } from '../hooks/apiClient';
import { router } from 'expo-router';

export default function SignInScreen() {
  const [userIdentifier, setUserIdentifier] = useState(''); // for login: username or email
  const [username, setUsername] = useState(''); // only for sign-up
  const [email, setEmail] = useState(''); // only for sign-up
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');

  const [refreshing, setRefreshing] = useState(false);

  // Validation states
  const [userIdValid, setUserIdValid] = useState<boolean | null>(null);
  const [usernameValid, setUsernameValid] = useState<boolean | null>(null);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [passwordValid, setPasswordValid] = useState<boolean | null>(null);
  const [confirmPasswordValid, setConfirmPasswordValid] = useState<boolean | null>(null);

  const [toggleWidth, setToggleWidth] = useState<number | null>(null);
  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernameRegex = /^[^\s]{3,}$/;

  useEffect(() => {
    if (toggleWidth !== null) {
      Animated.timing(indicatorPosition, {
        toValue: mode === 'signIn' ? 0 : toggleWidth,
        duration: 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start();
    }
  }, [mode, toggleWidth]);

  const onRefresh = () => {
    setRefreshing(true);
    resetForm();
    setTimeout(() => setRefreshing(false), 500);
  };

  // Validate inputs on change
  const handleChange = (field: string, value: string) => {
    if (field === 'userIdentifier') {
      setUserIdentifier(value);
      // For login: accept anything non-empty as valid (can be username or email)
      setUserIdValid(value.trim().length > 0);
    } else if (field === 'username') {
      setUsername(value);
      setUsernameValid(usernameRegex.test(value));
    } else if (field === 'email') {
      setEmail(value);
      setEmailValid(emailRegex.test(value));
    } else if (field === 'password') {
      setPassword(value);
      setPasswordValid(value.length >= 6);
      if (mode === 'signUp' && confirmPassword) {
        setConfirmPasswordValid(value === confirmPassword);
      }
    } else if (field === 'confirmPassword') {
      setConfirmPassword(value);
      setConfirmPasswordValid(value === password);
    }
  };

  const resetForm = () => {
    setUserIdentifier('');
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setUserIdValid(null);
    setUsernameValid(null);
    setEmailValid(null);
    setPasswordValid(null);
    setConfirmPasswordValid(null);
    setPasswordVisible(false);
    setConfirmPasswordVisible(false);
  };

  const handleToggle = (selectedMode: 'signIn' | 'signUp') => {
    Keyboard.dismiss();
    setMode(selectedMode);
    resetForm();
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();

    setLoading(true);

    if (mode === 'signIn') {
      const trimmedIdentifier = userIdentifier.trim();
      const isEmail = emailRegex.test(trimmedIdentifier);
      const credentials = isEmail
        ? { email: trimmedIdentifier, password }
        : { username: trimmedIdentifier, password };
    
        try {
          const data = await loginUser(credentials);
          if (data) {
            Alert.alert('Success', `Welcome back, user #${data.user_id}`);
            router.replace('/');
          } else {
            Alert.alert('Sign In Failed', 'Invalid username/email or password.');
          }
        } catch (error: any) {
          Alert.alert('Sign In Failed', error.message || 'An error occurred during sign in.');
        } finally {
          setLoading(false);
          resetForm();
        }
    }
    else {
      // signUp validations:
      if (!usernameValid || !emailValid || !passwordValid || !confirmPasswordValid) {
        Alert.alert('Error', 'Fill all fields correctly');
        return;
      }
      setLoading(true);
      try {
        const data = await registerUser(username.trim(), email.trim(), password);
        Alert.alert('Success', `Account created. Your user ID is ${data.user_id}. Sign in.`);
        setMode('signIn');
        resetForm();
      } catch (error: any) {
        Alert.alert('Sign Up Failed', error.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
  };

  // Validation helper text
  const renderValidationText = (valid: boolean | null, validMsg: string, invalidMsg: string) =>
    valid !== null && (
      <Text style={[styles.validationMessage, valid ? styles.validText : styles.invalidText]}>
        {valid ? validMsg : invalidMsg}
      </Text>
    );

  // Password input with show/hide toggle
  const renderPasswordInput = (
    placeholder: string,
    value: string,
    onChangeText: (text: string) => void,
    isVisible: boolean,
    toggleVisibility: () => void,
    valid: boolean | null,
    validMsg: string,
    invalidMsg: string
  ) => (
    <View style={[styles.inputWrapper, valid === null && styles.marginBottomSmall]}>
      <View style={styles.inputWithIconContainer}>
        <TextInput
          style={[
            styles.input,
            valid === true && styles.inputValid,
            valid === false && styles.inputInvalid,
          ]}
          placeholder={placeholder}
          secureTextEntry={!isVisible}
          autoCapitalize="none"
          onChangeText={onChangeText}
          value={value}
          placeholderTextColor="#aaa"
          textContentType="password"
        />
        <TouchableOpacity
          onPress={toggleVisibility}
          style={styles.iconInsideInput}
          accessibilityRole="button"
          accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
        >
          <Ionicons name={isVisible ? 'eye' : 'eye-off'} size={22} color="#3399ff" />
        </TouchableOpacity>
      </View>
      {renderValidationText(valid, validMsg, invalidMsg)}
    </View>
  );

  const isSubmitDisabled =
    loading ||
    (mode === 'signIn' ? !userIdValid || !passwordValid : !usernameValid || !emailValid || !passwordValid || !confirmPasswordValid);

  return (
    <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Text style={styles.companyName}>GSMS</Text>
        </View>

        <View style={styles.toggleContainer}>
          <View
            style={styles.toggleInner}
            onLayout={(e) => {
              if (!toggleWidth) setToggleWidth(e.nativeEvent.layout.width / 2);
            }}
          >
            <Animated.View style={[styles.indicator, { left: indicatorPosition }]} />
            {['signIn', 'signUp'].map((m) => (
              <TouchableOpacity
                key={m}
                style={styles.toggleButton}
                onPress={() => handleToggle(m as 'signIn' | 'signUp')}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, mode === m && styles.activeToggleText]}>
                  {m === 'signIn' ? 'Sign In' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3399ff"
              colors={['#3399ff']}
              progressBackgroundColor="#222"
            />
          }
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.container}>
              <Text style={styles.title}>{mode === 'signIn' ? 'Sign In' : 'Create Account'}</Text>

              {mode === 'signIn' ? (
                <View style={[styles.inputWrapper, userIdValid === null && styles.marginBottomSmall]}>
                  <TextInput
                    style={[
                      styles.input,
                      userIdValid === true && styles.inputValid,
                      userIdValid === false && styles.inputInvalid,
                    ]}
                    placeholder="Username or Email"
                    autoCapitalize="none"
                    onChangeText={(text) => handleChange('userIdentifier', text)}
                    value={userIdentifier}
                    placeholderTextColor="#aaa"
                    textContentType="username"
                  />
                  {renderValidationText(userIdValid, 'Looks good', 'Enter your username or email')}
                </View>
              ) : (
                <>
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
                </>
              )}

              {renderPasswordInput(
                'Password',
                password,
                (text) => handleChange('password', text),
                passwordVisible,
                () => setPasswordVisible((v) => !v),
                passwordValid,
                'Password looks good',
                'Password must be at least 6 characters'
              )}

              {mode === 'signUp' &&
                renderPasswordInput(
                  'Confirm Password',
                  confirmPassword,
                  (text) => handleChange('confirmPassword', text),
                  confirmPasswordVisible,
                  () => setConfirmPasswordVisible((v) => !v),
                  confirmPasswordValid,
                  'Passwords match',
                  'Passwords do not match'
                )}

              {mode === 'signIn' && (
                <View style={styles.forgotPasswordContainer}>
                  <TouchableOpacity onPress={() => Alert.alert('Reset flow not implemented')} activeOpacity={0.6}>
                    <Text style={styles.forgotPassword}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.button, isSubmitDisabled && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitDisabled}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    {mode === 'signIn' ? 'Sign In' : 'Sign Up'}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.bottomTextContainerColumn}>
                <Text style={styles.bottomText}>
                  {mode === 'signIn' ? "Don't have an account?" : 'Already have an account?'}
                </Text>
                <TouchableOpacity onPress={() => handleToggle(mode === 'signIn' ? 'signUp' : 'signIn')} activeOpacity={0.7}>
                  <Text style={styles.bottomLink}>{mode === 'signIn' ? 'Create Account' : 'Sign In'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000' },
  topBar: {
    padding: 20,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyName: {
    color: '#eee',
    fontSize: 20,
    fontWeight: '700',
  },
  toggleContainer: {
    width: '90%',
    alignSelf: 'center',
    marginBottom: 10,
  },
  toggleInner: {
    flexDirection: 'row',
    borderRadius: 20,
    backgroundColor: '#222',
    position: 'relative',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toggleText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '600',
  },
  activeToggleText: {
    color: '#fff',
    fontWeight: '700',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '53%',
    backgroundColor: '#3399ff',
    borderRadius: 20,
  },
  container: {
    marginTop: 100,
    width: '90%',
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 20,
    color: '#eee',
    textAlign: 'center',
  },
  inputWrapper: {
    width: '100%',
  },
  marginBottomSmall: {
    marginBottom: 10,
  },
  inputWithIconContainer: {
    position: 'relative',
    width: '100%',
  },
  input: {
    height: 50,
    backgroundColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingRight: 45,
    color: '#eee',
    fontSize: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconInsideInput: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -11 }],
    height: 22,
    width: 22,
    justifyContent: 'center',
    alignItems: 'center',
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
  forgotPasswordContainer: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  forgotPassword: {
    color: '#3399ff',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#3399ff',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#555555',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  bottomTextContainerColumn: {
    width: '90%',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    flexDirection: 'column',
  },
  bottomText: {
    fontSize: 16,
    color: '#aaa',
  },
  bottomLink: {
    fontSize: 16,
    color: '#3399ff',
    fontWeight: '700',
  },
});