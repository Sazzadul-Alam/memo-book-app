import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Toast, useToast } from '../../src/components/Toast';
import { colors, fontSizes, spacing, radii } from '../../src/theme/tokens';
import { API_BASE } from '../../src/api/client';
import { saveSession } from '../../src/utils/session';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { toast, show: showToast, hide: hideToast } = useToast();

  function validate() {
    const errs: typeof errors = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client': 'mobile',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Login failed');

      await saveSession(
        data.access_token,
        data.refresh_token ?? '',
        { email: data.user.email, name: data.user.name, role: data.user.role }
      );

      if (data.user.role === 'admin') {
        router.replace('/(admin)/overview');
      } else {
        router.replace('/(owner)/products');
      }
    } catch (err: any) {
      showToast(err.message ?? 'Something went wrong', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Toast {...toast} onHide={hideToast} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo area */}
          <View style={styles.logoArea}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>MB</Text>
            </View>
            <Text style={styles.appName}>{process.env.EXPO_PUBLIC_APP_NAME ?? 'Memo Book'}</Text>
            <Text style={styles.tagline}>Invoice Management</Text>
          </View>

          {/* Form card */}
          <View style={styles.card}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.sub}>Sign in to your account</Text>

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email}
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              isPassword
              placeholder="Your password"
              error={errors.password}
            />

            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              style={styles.forgotRow}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <Button onPress={handleLogin} loading={loading} fullWidth size="lg">
              Sign In
            </Button>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.link}>Register</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dsBackground },
  scroll: { flexGrow: 1, padding: spacing[5], justifyContent: 'center' },

  logoArea: { alignItems: 'center', marginBottom: spacing[8] },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.dsPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  logoText: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes['2xl'],
    color: colors.white,
  },
  appName: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes['3xl'],
    color: colors.dsOnBackground,
    marginBottom: 2,
  },
  tagline: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.base,
    color: colors.dsOutline,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
  },
  heading: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes['2xl'],
    color: colors.dsOnSurface,
    marginBottom: 4,
  },
  sub: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.base,
    color: colors.dsOutline,
    marginBottom: spacing[5],
  },
  forgotRow: { alignItems: 'flex-end', marginBottom: spacing[4], marginTop: -spacing[1] },
  forgotText: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.sm,
    color: colors.dsPrimary,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing[5],
  },
  footerText: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.base,
    color: colors.dsOutline,
  },
  link: {
    fontFamily: 'Inter-SemiBold',
    fontSize: fontSizes.base,
    color: colors.dsPrimary,
  },
});

