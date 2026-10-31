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

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
}

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const { toast, show: showToast, hide: hideToast } = useToast();

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = 'Name is required';
    else if (name.trim().length > 30) errs.name = 'Name must be ≤ 30 characters';

    if (!email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';

    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';

    if (!phone.trim()) errs.phone = 'Phone is required';
    else if (!/^01\d{9}$/.test(phone.trim()))
      errs.phone = 'Phone must be 11 digits starting with 01';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client': 'mobile',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Registration failed');

      await saveSession(
        data.access_token,
        data.refresh_token ?? '',
        { email: data.user.email, name: data.user.name, role: data.user.role }
      );

      // After register → go to shop setup
      router.replace('/(owner)/shop-setup');
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back to login</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>Create Account</Text>
          <Text style={styles.sub}>Start managing your invoices today</Text>

          <View style={styles.card}>
            <Input
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder="Your name (max 30 chars)"
              autoCapitalize="words"
              error={errors.name}
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="you@example.com"
              autoComplete="email"
              error={errors.email}
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              isPassword
              placeholder="Min 8 characters"
              error={errors.password}
            />
            <Input
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="01XXXXXXXXX (11 digits)"
              error={errors.phone}
            />

            <Button onPress={handleRegister} loading={loading} fullWidth size="lg">
              Create Account
            </Button>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.link}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dsBackground },
  scroll: { flexGrow: 1, padding: spacing[5] },
  backBtn: { marginBottom: spacing[5] },
  backText: { fontFamily: 'Inter-Medium', fontSize: fontSizes.sm, color: colors.dsPrimary },
  heading: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes['3xl'],
    color: colors.dsOnSurface,
    marginBottom: 4,
  },
  sub: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.base,
    color: colors.dsOutline,
    marginBottom: spacing[5],
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing[5] },
  footerText: { fontFamily: 'Inter-Regular', fontSize: fontSizes.base, color: colors.dsOutline },
  link: { fontFamily: 'Inter-SemiBold', fontSize: fontSizes.base, color: colors.dsPrimary },
});

