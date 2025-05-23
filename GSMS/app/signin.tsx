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
import { loginUser, registerUser } from '../hooks/apiClient';
import { router } from 'expo-router';


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

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!emailValid || !passwordValid || (mode === 'signUp' && !confirmPasswordValid)) {
      Alert.alert('Error', 'Please fill all fields correctly');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signIn') {
        const data = await loginUser(email, password);
        
        if (data) {
          Alert.alert('Success', `Welcome back, user #${data.user_id}`);
          router.replace('/');
        }
        resetForm();
      } else {
        const data = await registerUser(email, password);
        Alert.alert('Success', `Account created. Your user ID is ${data.user_id}. Please sign in.`);
        setMode('signIn');
        resetForm();
      }
    } catch (error: any) {
      Alert.alert(
        `${mode === 'signIn' ? 'Sign In' : 'Sign Up'} Failed`,
        error.message || 'An error occurred'
      );
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
            <TouchableOpacity onPress={() => handleToggle(mode === 'signIn' ? 'signUp' : 'signIn')} activeOpacity={0.7}>
              <Text style={styles.bottomLink}>{mode === 'signIn' ? 'Create Account' : 'Sign In'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
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
    width: '90%',
    maxWidth: 320,
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