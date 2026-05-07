import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { colors } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authApi } from '../../services/auth.api';
import { useAuthStore } from '../../store/authStore';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    try {
      const res = await authApi.login(data);
      await setAuth(res.token, res.user);
    } catch (e: any) {
      Alert.alert('Sign In Failed', e?.response?.data?.error ?? 'Check your credentials');
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
      <View style={styles.container}>
        <Text style={styles.logo}>2Do</Text>
        <Text style={styles.tagline}>Stay accountable, get things done</Text>

        <View style={styles.form}>
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
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Password"
                value={value}
                onChangeText={onChange}
                secureTextEntry
                autoComplete="current-password"
                error={errors.password?.message}
              />
            )}
          />
          <Button title="Sign In" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
        </View>

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Sign Up</Text></Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', paddingBottom: 40 },
  logo: { fontSize: 56, fontWeight: '900', color: colors.accent, textAlign: 'center', marginBottom: 8 },
  tagline: { color: colors.textMuted, textAlign: 'center', fontSize: 15, marginBottom: 48 },
  form: { gap: 4 },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: colors.textMuted, fontSize: 15 },
  linkBold: { color: colors.accent, fontWeight: '700' },
});
