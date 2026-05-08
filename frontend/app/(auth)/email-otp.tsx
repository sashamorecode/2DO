import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authApi } from '../../services/auth.api';
import { useAuthStore } from '../../store/authStore';

export default function EmailOTPScreen() {
  const params = useLocalSearchParams<{ email: string }>();
  const email = params.email ?? '';
  const setAuth = useAuthStore((s) => s.setAuth);

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  async function onVerify() {
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Enter the 6-digit code from your email');
      return;
    }
    setVerifying(true);
    try {
      const res = await authApi.verifyEmailOTP(email, code);
      await setAuth(res.token, res.user);
    } catch (e: any) {
      Alert.alert('Sign In Failed', e?.response?.data?.error ?? 'Invalid or expired code');
    } finally {
      setVerifying(false);
    }
  }

  async function onResend() {
    setResending(true);
    try {
      await authApi.startEmailOTP(email);
      Alert.alert('Code Sent', 'Check your inbox for a new code');
    } catch (e: any) {
      Alert.alert('Could Not Send Code', e?.response?.data?.error ?? 'Try again in a moment');
    } finally {
      setResending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      style={styles.kav}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to <Text style={styles.email}>{email}</Text>
        </Text>

        <Input
          label="Code"
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          autoFocus
          maxLength={6}
          textContentType="oneTimeCode"
        />

        <Button title="Verify & Sign In" onPress={onVerify} loading={verifying} style={{ marginTop: 8 }} />

        <TouchableOpacity onPress={onResend} disabled={resending} style={styles.resend}>
          <Text style={styles.resendText}>
            {resending ? 'Sending…' : "Didn't get it? "}
            {!resending && <Text style={styles.resendBold}>Resend</Text>}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 24, paddingVertical: 32, flexGrow: 1 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 15, marginBottom: 32 },
  email: { color: colors.text, fontWeight: '600' },
  resend: { marginTop: 24, alignItems: 'center' },
  resendText: { color: colors.textMuted, fontSize: 14 },
  resendBold: { color: colors.accentLight, fontWeight: '700' },
});
