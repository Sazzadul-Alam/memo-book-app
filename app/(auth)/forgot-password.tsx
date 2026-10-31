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

type Step = 'email' | 'otp' | 'reset';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast, show: showToast, hide: hideToast } = useToast();

  async function handleSendOtp() {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user/forget-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-client': 'mobile' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed');
      showToast('OTP sent to your email', 'success');
      setStep('otp');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim()) { setError('Enter OTP'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-client': 'mobile' },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Invalid OTP');
      setStep('reset');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-client': 'mobile' },
        body: JSON.stringify({ otp, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed');
      showToast('Password reset successfully!', 'success');
      setTimeout(() => router.replace('/(auth)/login'), 1500);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Toast {...toast} onHide={hideToast} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>
            {step === 'email' ? 'Forgot Password' : step === 'otp' ? 'Enter OTP' : 'Reset Password'}
          </Text>
          <Text style={styles.sub}>
            {step === 'email'
              ? 'Enter your email to receive a reset OTP'
              : step === 'otp'
              ? `We sent an OTP to ${email}`
              : 'Set your new password'}
          </Text>

          <View style={styles.card}>
            {step === 'email' && (
              <>
                <Input label="Email" value={email} onChangeText={setEmail}
                  keyboardType="email-address" placeholder="you@example.com" error={error} />
                <Button onPress={handleSendOtp} loading={loading} fullWidth size="lg">Send OTP</Button>
              </>
            )}
            {step === 'otp' && (
              <>
                <Input label="OTP Code" value={otp} onChangeText={setOtp}
                  keyboardType="number-pad" placeholder="6-digit code" error={error} />
                <Button onPress={handleVerifyOtp} loading={loading} fullWidth size="lg">Verify OTP</Button>
              </>
            )}
            {step === 'reset' && (
              <>
                <Input label="New Password" value={newPassword} onChangeText={setNewPassword}
                  isPassword placeholder="Min 8 characters" />
                <Input label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword}
                  isPassword placeholder="Repeat password" error={error} />
                <Button onPress={handleResetPassword} loading={loading} fullWidth size="lg">Reset Password</Button>
              </>
            )}
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
  heading: { fontFamily: 'Manrope-Bold', fontSize: fontSizes['3xl'], color: colors.dsOnSurface, marginBottom: 4 },
  sub: { fontFamily: 'Inter-Regular', fontSize: fontSizes.base, color: colors.dsOutline, marginBottom: spacing[5] },
  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[5], borderWidth: 1, borderColor: colors.dsOutlineVariant },
});

