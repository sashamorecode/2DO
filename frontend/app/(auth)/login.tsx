import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { colors } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authApi } from '../../services/auth.api';
import { useAuthStore } from '../../store/authStore';
import { signInWithGoogle } from '../../services/googleSignIn';

const emailSchema = z.object({ email: z.string().email() });
type EmailForm = z.infer<typeof emailSchema>;

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
  });

  async function onGoogle() {
    setGoogleLoading(true);
    try {
      const idToken = await signInWithGoogle();
      if (!idToken) return; // user cancelled
      const res = await authApi.google(idToken);
      await setAuth(res.token, res.user);
    } catch (e: any) {
      Alert.alert('Sign In Failed', e?.response?.data?.error ?? e?.message ?? 'Could not sign in with Google');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function onEmail(data: EmailForm) {
    try {
      await authApi.startEmailOTP(data.email);
      router.push({ pathname: '/(auth)/email-otp', params: { email: data.email } });
    } catch (e: any) {
      Alert.alert('Could Not Send Code', e?.response?.data?.error ?? 'Try again in a moment');
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      style={styles.kav}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.logo}>2Do</Text>
        <Text style={styles.tagline}>Stay accountable, get things done</Text>

        <Button
          title="Continue with Google"
          onPress={onGoogle}
          loading={googleLoading}
          style={{ marginBottom: 24 }}
        />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Email"
              value={value}
              onChangeText={onChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email?.message}
            />
          )}
        />
        <Button title="Email me a code" onPress={handleSubmit(onEmail)} loading={isSubmitting} variant="secondary" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: colors.bg },
  container: {
    paddingHorizontal: 24,
    paddingTop: 96,
    paddingBottom: 32,
    flexGrow: 1,
  },
  logo: {
    fontSize: 64,
    fontWeight: '900',
    color: colors.accentLight,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -2,
  },
  tagline: { color: colors.textMuted, textAlign: 'center', fontSize: 15, marginBottom: 40 },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, marginHorizontal: 12, fontSize: 12, fontWeight: '600', letterSpacing: 1 },
});
