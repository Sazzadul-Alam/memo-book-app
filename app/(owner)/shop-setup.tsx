import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Toast, useToast } from '../../src/components/Toast';
import { colors, fontSizes, radii, spacing } from '../../src/theme/tokens';
import { authedGet, authedPost } from '../../src/api/client';
import { useNetwork } from '../../src/utils/useNetwork';
import { OfflineBanner } from '../../src/components/OfflineBanner';

const STEPS = [
  { label: 'Identity', icon: 'business-outline' as const },
  { label: 'Address', icon: 'location-outline' as const },
  { label: 'Social', icon: 'share-social-outline' as const },
];

export default function ShopSetupScreen() {
  const { isOnline } = useNetwork();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toast, show: showToast, hide: hideToast } = useToast();

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Bangladesh');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');

  // Per-field errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Check if shop already exists
    (async () => {
      try {
        const res: any = await authedGet('/shop/my');
        if (res?.shop || res?.data) {
          router.replace('/(owner)/products');
        }
      } catch {
        // Shop not created yet, stay here
      }
    })();
  }, []);

  function validateStep(curStep: number): boolean {
    const errs: Record<string, string> = {};
    if (curStep === 0) {
      if (!businessName.trim()) errs.businessName = 'Shop name is required';
      if (!contactNumber.trim()) errs.contactNumber = 'Contact number is required';
      else if (!/^01\d{9}$/.test(contactNumber.trim()))
        errs.contactNumber = 'Enter 11 digits (e.g. 01XXXXXXXXX)';
    } else if (curStep === 1) {
      if (!addressLine1.trim()) errs.addressLine1 = 'Address line 1 is required';
      if (!city.trim()) errs.city = 'City is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (validateStep(step)) {
      if (step < STEPS.length - 1) setStep(step + 1);
      else handleFinish();
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  async function handleFinish() {
    if (!isOnline) {
      showToast('Internet required to save shop profile', 'error');
      return;
    }
    setLoading(true);
    try {
      await authedPost('/shop', '/create', {
        name: businessName.trim(),
        contactNumber: contactNumber.trim(),
        address: {
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim(),
          city: city.trim(),
          state: state.trim(),
          postal_code: postalCode.trim(),
          country,
        },
        socialLinks: {
          facebook: facebook.trim(),
          instagram: instagram.trim(),
        },
      });

      showToast('Shop setup completed successfully!', 'success');
      setTimeout(() => router.replace('/(owner)/products'), 1000);
    } catch (err: any) {
      showToast(err.message ?? 'Failed to create shop', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <OfflineBanner />
      <Toast {...toast} onHide={hideToast} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Text style={styles.title}>Setup Your Shop</Text>
          <Text style={styles.subtitle}>Complete these quick 3 steps to start invoicing</Text>

          {/* Stepper Indicator */}
          <View style={styles.stepperContainer}>
            {STEPS.map((s, idx) => {
              const active = idx === step;
              const done = idx < step;
              return (
                <View key={s.label} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepIconBox,
                      active && styles.stepIconActive,
                      done && styles.stepIconDone,
                    ]}
                  >
                    <Ionicons
                      name={done ? 'checkmark' : s.icon}
                      size={18}
                      color={active || done ? colors.white : colors.dsOutline}
                    />
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      active && styles.stepLabelActive,
                      done && styles.stepLabelDone,
                    ]}
                  >
                    {s.label}
                  </Text>
                  {idx < STEPS.length - 1 && (
                    <View
                      style={[styles.stepLine, done && styles.stepLineDone]}
                    />
                  )}
                </View>
              );
            })}
          </View>

          {/* Step 1: Identity */}
          {step === 0 && (
            <View style={styles.card}>
              <Text style={styles.stepTitle}>Shop Identity</Text>
              <Input
                label="Shop / Business Name"
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="e.g. Dream Fashion Store"
                error={errors.businessName}
              />
              <Input
                label="Shop Contact Phone"
                value={contactNumber}
                onChangeText={setContactNumber}
                keyboardType="phone-pad"
                placeholder="01XXXXXXXXX"
                error={errors.contactNumber}
              />
            </View>
          )}

          {/* Step 2: Address */}
          {step === 1 && (
            <View style={styles.card}>
              <Text style={styles.stepTitle}>Shop Address</Text>
              <Input
                label="Address Line 1"
                value={addressLine1}
                onChangeText={setAddressLine1}
                placeholder="Street address, shop number"
                error={errors.addressLine1}
              />
              <Input
                label="Address Line 2 (Optional)"
                value={addressLine2}
                onChangeText={setAddressLine2}
                placeholder="Suite, floor, etc."
              />
              <View style={styles.row}>
                <Input
                  label="City"
                  value={city}
                  onChangeText={setCity}
                  placeholder="Dhaka"
                  containerStyle={{ flex: 1, marginRight: spacing[2] }}
                  error={errors.city}
                />
                <Input
                  label="State / Region"
                  value={state}
                  onChangeText={setState}
                  placeholder="Dhaka"
                  containerStyle={{ flex: 1 }}
                />
              </View>
              <View style={styles.row}>
                <Input
                  label="Postal Code"
                  value={postalCode}
                  onChangeText={setPostalCode}
                  placeholder="1200"
                  keyboardType="numeric"
                  containerStyle={{ flex: 1, marginRight: spacing[2] }}
                />
                <Input
                  label="Country"
                  value={country}
                  onChangeText={setCountry}
                  placeholder="Bangladesh"
                  containerStyle={{ flex: 1 }}
                />
              </View>
            </View>
          )}

          {/* Step 3: Social */}
          {step === 2 && (
            <View style={styles.card}>
              <Text style={styles.stepTitle}>Social Media (Optional)</Text>
              <Input
                label="Facebook Page / Link"
                value={facebook}
                onChangeText={setFacebook}
                placeholder="https://facebook.com/yourshop"
                autoCapitalize="none"
              />
              <Input
                label="Instagram Profile / Handle"
                value={instagram}
                onChangeText={setInstagram}
                placeholder="https://instagram.com/yourshop"
                autoCapitalize="none"
              />
            </View>
          )}

          {/* Navigation Controls */}
          <View style={styles.actionsRow}>
            {step > 0 ? (
              <Button
                variant="outline"
                onPress={handleBack}
                style={{ flex: 1, marginRight: spacing[2] }}
              >
                Back
              </Button>
            ) : null}
            <Button
              onPress={handleNext}
              loading={loading}
              style={{ flex: 2 }}
            >
              {step === STEPS.length - 1 ? 'Finish & Start' : 'Next Step'}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dsBackground },
  scroll: { padding: spacing[5], flexGrow: 1 },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes['2xl'],
    color: colors.dsOnSurface,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.sm,
    color: colors.dsOutline,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.dsSurfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconActive: {
    backgroundColor: colors.dsPrimary,
  },
  stepIconDone: {
    backgroundColor: colors.success,
  },
  stepLabel: {
    marginLeft: 6,
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
  },
  stepLabelActive: {
    color: colors.dsPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  stepLabelDone: {
    color: colors.success,
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: colors.dsOutlineVariant,
    marginHorizontal: 6,
  },
  stepLineDone: {
    backgroundColor: colors.success,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
    marginBottom: spacing[6],
  },
  stepTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: fontSizes.lg,
    color: colors.dsOnSurface,
    marginBottom: spacing[4],
  },
  row: {
    flexDirection: 'row',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2],
  },
});
