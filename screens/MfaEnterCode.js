// screens/MfaEnterCode.js
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { resolveTotpSignIn } from '../auth/mfa';
import { auth } from '../firebaseConfig';


export default function MfaEnterCode() {
  const navigation = useNavigation();
  const route = useRoute();
  const mfaError = route?.params?.mfaError;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mfaError) {
      Alert.alert(
        'MFA Session Missing',
        'We could not find the MFA challenge. Please sign in again.'
      );
      navigation.goBack();
    }
  }, [mfaError, navigation]);

  const isValid = useMemo(() => /^\d{6}$/.test(code), [code]);

  const onSubmit = async () => {
    if (!isValid || loading || !mfaError) return;
    try {
      setLoading(true);
      // Your helper expects (mfaError, code)
      await resolveTotpSignIn(auth, mfaError, code.trim());

      // Success → reset to Home (adjust if your post-login route differs)
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (err) {
      console.warn('TOTP verify failed:', err);
      const msg =
        (err && err.message) ||
        'Could not verify the code. Please check the 6-digit code and try again.';
      Alert.alert('MFA Verification Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Two-Step Verification</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code from your authenticator app.
        </Text>

        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
          placeholder="123456"
          placeholderTextColor="#9aa0a6"
          textAlign="center"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.button, !isValid || loading ? styles.buttonDisabled : null]}
          onPress={onSubmit}
          disabled={!isValid || loading}
        >
          {loading ? <ActivityIndicator /> : <Text style={styles.buttonText}>Verify</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.helpBox}>
          <Text style={styles.helpText}>
            Tip: If you changed phones, you may need to re-enroll MFA in Settings.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#0b132b' },
  card: {
    backgroundColor: '#1c2541',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  title: { color: 'white', fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: '#cbd5e1', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  input: {
    backgroundColor: '#111827',
    color: 'white',
    borderRadius: 12,
    paddingVertical: 12,
    fontSize: 22,
    letterSpacing: 4,
  },
  button: {
    marginTop: 16,
    backgroundColor: '#3a86ff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  linkButton: { marginTop: 10, alignItems: 'center' },
  linkText: { color: '#8ab4f8', fontSize: 14 },
  helpBox: { marginTop: 16, backgroundColor: '#111827', borderRadius: 12, padding: 12 },
  helpText: { color: '#9aa0a6', fontSize: 12, textAlign: 'center' },
});
