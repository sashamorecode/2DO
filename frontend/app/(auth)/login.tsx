import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { colors } from '../../constants/colors';
import { HalloweenArtwork } from '../../components/theme/HalloweenArtwork';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { KeyboardAwareScrollView } from '../../components/ui/KeyboardAwareScrollView';
import { authApi } from '../../services/auth.api';
import { useAuthStore } from '../../store/authStore';
import { signInWithGoogle } from '../../services/googleSignIn';

const emailSchema = z.object({ email: z.string().email() });
type EmailForm = z.infer<typeof emailSchema>;

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);

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
      const res = await authApi.startEmailOTP(data.email);
      router.push({
        pathname: '/(auth)/email-otp',
        params: { email: data.email, devCode: res.code ?? '' },
      });
    } catch (e: any) {
      Alert.alert('Could Not Send Code', e?.response?.data?.error ?? 'Try again in a moment');
    }
  }

  async function onDevLogin() {
    setDevLoading(true);
    try {
      const res = await authApi.devLogin();
      await setAuth(res.token, res.user);
    } catch (e: any) {
      Alert.alert('Dev Login Failed', e?.response?.data?.error ?? 'Is the backend running with DEV_MODE=true?');
    } finally {
      setDevLoading(false);
    }
  }

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.artHeader}>
          <Text style={styles.logo}>2Do</Text>
          <HalloweenArtwork style={styles.artwork} />
        </View>

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

        {__DEV__ && (
          <>
            <View style={styles.devDivider}>
              <View style={styles.devDividerLine} />
              <Text style={styles.devDividerText}>dev</Text>
              <View style={styles.devDividerLine} />
            </View>

            <TouchableOpacity onPress={onDevLogin} disabled={devLoading} style={styles.devBtn}>
              {devLoading ? (
                <ActivityIndicator color={colors.textMuted} size="small" />
              ) : (
                <Text style={styles.devBtnText}>Dev Login</Text>
              )}
            </TouchableOpacity>
          </>
        )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
    flexGrow: 1,
  },
  artHeader: { minHeight: 190, justifyContent: 'center', marginBottom: 20 },
  artwork: { position: 'absolute', right: -12, top: 0, width: 196, height: 183 },
  logo: {
    fontSize: 64,
    fontWeight: '900',
    color: colors.accentLight,
    marginBottom: 6,
    letterSpacing: -2,
  },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, marginHorizontal: 12, fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  devDivider: { flexDirection: 'row', alignItems: 'center', marginTop: 28, marginBottom: 12 },
  devDividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  devDividerText: { color: '#d4a574', marginHorizontal: 12, fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  devBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  devBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});
