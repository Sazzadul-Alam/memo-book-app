import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../src/components/Header';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Modal } from '../../src/components/Modal';
import { Toast, useToast } from '../../src/components/Toast';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { colors, fontSizes, radii, spacing, shadows } from '../../src/theme/tokens';
import { authedGet, authedPost } from '../../src/api/client';
import { getFromCache, formatSavedAt } from '../../src/api/cache';
import { useNetwork } from '../../src/utils/useNetwork';

interface Plan {
  _id: string;
  name: string;
  description?: string;
  price: number;
  billingCycle?: string;
  maxProductsPerShop: number;
  maxInvoicesPerMonth: number;
  features?: {
    exportPdf?: boolean;
    receiptCustomization?: boolean;
  };
  isActive?: boolean;
}

interface Subscription {
  _id: string;
  status: 'active' | 'pending' | 'expired';
  planId: Plan;
  startDate?: string;
  endDate?: string;
}

export default function PlansScreen() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const { isOnline } = useNetwork();
  const { toast, show: showToast, hide: hideToast } = useToast();

  // Purchase Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [paymentReference, setPaymentReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [referenceError, setReferenceError] = useState('');

  async function loadData() {
    try {
      // 1. Fetch available plans
      const plansRes: any = await authedGet('/subscription/plans');
      const planList = plansRes?.plans || (Array.isArray(plansRes) ? plansRes : []);
      setPlans(planList);

      // Check cache metadata
      const cached = await getFromCache('/subscription/plans');
      if (cached?.savedAt) {
        setLastUpdated(formatSavedAt(cached.savedAt));
      }

      // 2. Fetch current subscription
      const subRes: any = await authedGet('/subscription/my');
      if (subRes?.subscription) {
        setCurrentSub(subRes.subscription);
      }
    } catch (err: any) {
      showToast(err.message ?? 'Failed to load plans', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openPurchaseModal(plan: Plan) {
    if (!isOnline) {
      showToast('Internet required to purchase a plan', 'warning');
      return;
    }
    setSelectedPlan(plan);
    setPaymentReference('');
    setReferenceError('');
    setModalVisible(true);
  }

  async function handlePurchase() {
    if (!isOnline) {
      showToast('Internet required to submit payment', 'warning');
      return;
    }
    if (!paymentReference.trim()) {
      setReferenceError('Transaction ID / Reference is required');
      return;
    }
    setReferenceError('');
    setSubmitting(true);

    try {
      await authedPost('/subscription', '/purchase', {
        planId: selectedPlan?._id,
        paymentMethod,
        paymentReference: paymentReference.trim(),
      });

      showToast('Subscription request submitted for approval!', 'success');
      setModalVisible(false);
      loadData();
    } catch (err: any) {
      showToast(err.message ?? 'Purchase failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Toast {...toast} onHide={hideToast} />
      <Header title="Subscription Plans" />

      {/* Persistent Offline Banner */}
      <OfflineBanner lastUpdated={lastUpdated} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.dsPrimary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                if (!isOnline) {
                  showToast('Cannot refresh while offline', 'info');
                  return;
                }
                setRefreshing(true);
                loadData();
              }}
              colors={[colors.dsPrimary]}
            />
          }
        >
          {/* Current plan notice */}
          {currentSub && (
            <View style={[styles.activePlanCard, shadows.sm]}>
              <View style={styles.activeHeader}>
                <Ionicons name="shield-checkmark" size={24} color={colors.success} />
                <View style={{ marginLeft: spacing[2], flex: 1 }}>
                  <Text style={styles.activeLabel}>Current Subscription</Text>
                  <Text style={styles.activePlanName}>{currentSub.planId?.name ?? 'Active Plan'}</Text>
                </View>
                <Badge
                  variant={currentSub.status === 'active' ? 'success' : 'warning'}
                >
                  {currentSub.status.toUpperCase()}
                </Badge>
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>Available Upgrade Plans</Text>

          {/* Plans Cards */}
          {plans.map((p) => {
            const isCurrent = currentSub?.planId?._id === p._id;
            return (
              <View
                key={p._id}
                style={[
                  styles.planCard,
                  isCurrent && styles.planCardActive,
                  shadows.md,
                ]}
              >
                <View style={styles.planHead}>
                  <View>
                    <Text style={styles.planName}>{p.name}</Text>
                    {p.description ? <Text style={styles.planDesc}>{p.description}</Text> : null}
                  </View>
                  {isCurrent && <Badge variant="success">Current Plan</Badge>}
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.priceSymbol}>৳</Text>
                  <Text style={styles.priceValue}>{p.price}</Text>
                  <Text style={styles.priceCycle}> / month</Text>
                </View>

                {/* Features List */}
                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.dsPrimary} />
                    <Text style={styles.featureText}>
                      Up to {p.maxProductsPerShop} Products
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.dsPrimary} />
                    <Text style={styles.featureText}>
                      Up to {p.maxInvoicesPerMonth} Invoices / month
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons
                      name={p.features?.exportPdf ? 'checkmark-circle' : 'close-circle-outline'}
                      size={18}
                      color={p.features?.exportPdf ? colors.dsPrimary : colors.dsOutline}
                    />
                    <Text
                      style={[
                        styles.featureText,
                        !p.features?.exportPdf && styles.featureDisabled,
                      ]}
                    >
                      PDF & Thermal Print Receipt
                    </Text>
                  </View>
                </View>

                {/* Action button */}
                <Button
                  variant={isCurrent ? 'outline' : 'primary'}
                  disabled={isCurrent || !isOnline}
                  onPress={() => openPurchaseModal(p)}
                  fullWidth
                  style={{ marginTop: spacing[4], opacity: !isOnline ? 0.6 : 1 }}
                >
                  {isCurrent ? 'Current Active' : `Upgrade to ${p.name}`}
                </Button>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Purchase Modal */}
      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={`Purchase ${selectedPlan?.name || 'Plan'}`}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalSub}>
            Send ৳{selectedPlan?.price} to our Merchant Number:
          </Text>
          <View style={styles.merchantBox}>
            <Text style={styles.merchantPhone}>01700-000000</Text>
            <Text style={styles.merchantType}>Personal / Merchant</Text>
          </View>

          {/* Payment Method Selector */}
          <Text style={styles.inputLabel}>Select Payment Method</Text>
          <View style={styles.methodRow}>
            {(['bKash', 'Nagad', 'Rocket'] as const).map((method) => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.methodBtn,
                  paymentMethod === method && styles.methodBtnActive,
                ]}
                onPress={() => setPaymentMethod(method)}
              >
                <Text
                  style={[
                    styles.methodBtnText,
                    paymentMethod === method && styles.methodBtnTextActive,
                  ]}
                >
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Transaction ID (TrxID) / Reference *"
            value={paymentReference}
            onChangeText={setPaymentReference}
            placeholder="e.g. 9J28DA10K"
            autoCapitalize="characters"
            error={referenceError}
          />

          <Button
            onPress={handlePurchase}
            loading={submitting}
            fullWidth
            size="lg"
            style={{ marginTop: spacing[3], marginBottom: spacing[6] }}
          >
            Submit Payment Request
          </Button>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dsBackground },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: spacing[4], paddingBottom: spacing[8] },
  activePlanCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: radii.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  activeHeader: { flexDirection: 'row', alignItems: 'center' },
  activeLabel: { fontFamily: 'Inter-Regular', fontSize: fontSizes.xs, color: colors.dsOutline },
  activePlanName: { fontFamily: 'Manrope-Bold', fontSize: fontSizes.base, color: '#166534' },
  sectionTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.lg,
    color: colors.dsOnSurface,
    marginBottom: spacing[3],
  },
  planCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing[5],
    marginBottom: spacing[4],
    borderWidth: 1.5,
    borderColor: colors.dsOutlineVariant,
  },
  planCardActive: { borderColor: colors.dsPrimary, borderWidth: 2 },
  planHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  planName: { fontFamily: 'Manrope-Bold', fontSize: fontSizes.xl, color: colors.dsOnSurface },
  planDesc: { fontFamily: 'Inter-Regular', fontSize: fontSizes.xs, color: colors.dsOutline, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginVertical: spacing[3] },
  priceSymbol: { fontFamily: 'Manrope-Bold', fontSize: fontSizes.lg, color: colors.dsPrimary },
  priceValue: { fontFamily: 'Manrope-Bold', fontSize: fontSizes['4xl'], color: colors.dsPrimary },
  priceCycle: { fontFamily: 'Inter-Regular', fontSize: fontSizes.sm, color: colors.dsOutline },
  featuresList: { marginTop: spacing[2] },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2], gap: 8 },
  featureText: { fontFamily: 'Inter-Medium', fontSize: fontSizes.sm, color: colors.dsOnSurface },
  featureDisabled: { color: colors.dsOutline, textDecorationLine: 'line-through' },
  modalContent: { paddingBottom: spacing[4] },
  modalSub: { fontFamily: 'Inter-Regular', fontSize: fontSizes.sm, color: colors.dsOnSurface },
  merchantBox: {
    backgroundColor: colors.dsSecondaryContainer,
    borderRadius: radii.md,
    padding: spacing[3],
    marginVertical: spacing[3],
    alignItems: 'center',
  },
  merchantPhone: { fontFamily: 'Manrope-Bold', fontSize: fontSizes.xl, color: colors.dsPrimary },
  merchantType: { fontFamily: 'Inter-Regular', fontSize: fontSizes.xs, color: colors.dsOnSecondaryContainer },
  inputLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurfaceVariant,
    marginBottom: 6,
  },
  methodRow: { flexDirection: 'row', gap: 10, marginBottom: spacing[4] },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.dsOutlineVariant,
    alignItems: 'center',
  },
  methodBtnActive: { borderColor: colors.dsPrimary, backgroundColor: colors.dsSecondaryContainer },
  methodBtnText: { fontFamily: 'Inter-Medium', fontSize: fontSizes.sm, color: colors.dsOutline },
  methodBtnTextActive: { color: colors.dsPrimary, fontFamily: 'Inter-SemiBold' },
});
