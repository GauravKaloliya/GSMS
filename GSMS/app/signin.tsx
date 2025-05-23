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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { loginUser } from '../hooks/apiClient'; // Your API login function

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [passwordValid, setPasswordValid] = useState<boolean | null>(null);
  const [confirmPasswordValid, setConfirmPasswordValid] = useState<boolean | null>(null);
  const [toggleWidth, setToggleWidth] = useState<number | null>(null);
  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const handleChange = (field: 'email' | 'password' | 'confirmPassword', value: string) => {
    if (field === 'email') {
      setEmail(value);
      setEmailValid(value ? emailRegex.test(value) : null);
    } else if (field === 'password') {
      setPassword(value);
      const isValid = value.length >= 6;
      setPasswordValid(value ? isValid : null);
      if (mode === 'signUp' && confirmPassword) {
        setConfirmPasswordValid(value === confirmPassword);
      }
    } else {
      setConfirmPassword(value);
      setConfirmPasswordValid(value ? value === password : null);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
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

  // Updated signIn that calls API loginUser and updates session context
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await loginUser(email, password); // apiClient loginUser
     
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!emailValid || !passwordValid || (mode === 'signUp' && !confirmPasswordValid)) {
      Alert.alert('Error', 'Please fill all fields correctly');
      return;
    }

    if (mode === 'signIn') {
      await signIn(email, password);
    } else {
      Alert.alert('Sign Up', 'Sign up flow not implemented yet.');
    }
  };

  const renderValidationText = (valid: boolean | null, validMsg: string, invalidMsg: string) =>
    valid !== null && (
      <Text style={[styles.validationMessage, valid ? styles.validText : styles.invalidText]}>
        {valid ? validMsg : invalidMsg}
      </Text>
    );

  const renderInput = ({
    placeholder,
    value,
    onChangeText,
    isVisible,
    toggleVisibility,
    valid,
    validMsg,
    invalidMsg,
  }: {
    placeholder: string;
    value: string;
    onChangeText: (text: string) => void;
    isVisible: boolean;
    toggleVisibility: () => void;
    valid: boolean | null;
    validMsg: string;
    invalidMsg: string;
  }) => (
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
    loading || !emailValid || !passwordValid || (mode === 'signUp' && !confirmPasswordValid);

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

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <Text style={styles.title}>{mode === 'signIn' ? 'Sign In' : 'Create Account'}</Text>

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

          {renderInput({
            placeholder: 'Password',
            value: password,
            onChangeText: (text) => handleChange('password', text),
            isVisible: passwordVisible,
            toggleVisibility: () => setPasswordVisible((v) => !v),
            valid: passwordValid,
            validMsg: 'Password looks good',
            invalidMsg: 'Password must be at least 6 characters',
          })}

          {mode === 'signUp' &&
            renderInput({
              placeholder: 'Confirm Password',
              value: confirmPassword,
              onChangeText: (text) => handleChange('confirmPassword', text),
              isVisible: confirmPasswordVisible,
              toggleVisibility: () => setConfirmPasswordVisible((v) => !v),
              valid: confirmPasswordValid,
              validMsg: 'Passwords match',
              invalidMsg: 'Passwords do not match',
            })}

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
            <Text style={styles.buttonText}>
              {loading
                ? `${mode === 'signIn' ? 'Signing In' : 'Signing Up'}...`
                : mode === 'signIn'
                ? 'Sign In'
                : 'Sign Up'}
            </Text>
          </TouchableOpacity>

          <View style={styles.bottomTextContainerColumn}>
            <Text style={styles.bottomText}>
              {mode === 'signIn' ? "Don't have an account?" : 'Already have an account?'}
            </Text>
            <TouchableOpacity onPress={() => handleToggle(mode === 'signIn' ? 'signUp' : 'signIn')}>
              <Text style={[styles.bottomText, styles.toggleLink]}>
                {mode === 'signIn' ? 'Sign Up' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  topBar: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  companyName: { fontSize: 22, fontWeight: 'bold', color: '#3399ff' },
  toggleContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  toggleInner: {
    flexDirection: 'row',
    backgroundColor: '#ddd',
    borderRadius: 24,
    overflow: 'hidden',
    width: 240,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 16,
    color: '#555',
    fontWeight: '500',
  },
  activeToggleText: {
    color: '#fff',
    fontWeight: '700',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
    backgroundColor: '#3399ff',
    borderRadius: 24,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 32,
    color: '#222',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  marginBottomSmall: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
    fontSize: 16,
    color: '#222',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  inputValid: {
    borderColor: 'green',
  },
  inputInvalid: {
    borderColor: 'red',
  },
  validationMessage: {
    marginTop: 4,
    fontSize: 12,
  },
  validText: {
    color: 'green',
  },
  invalidText: {
    color: 'red',
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPassword: {
    color: '#3399ff',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#3399ff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    backgroundColor: '#9fcfff',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  bottomTextContainerColumn: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  bottomText: {
    fontSize: 14,
    color: '#555',
  },
  toggleLink: {
    color: '#3399ff',
    fontWeight: '600',
  },
  inputWithIconContainer: {
    position: 'relative',
  },
  iconInsideInput: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
});