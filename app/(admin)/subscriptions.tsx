import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Toast, useToast } from '../../src/components/Toast';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { colors, fontSizes, radii, spacing } from '../../src/theme/tokens';
import { authedGet, authedPost, authedPut } from '../../src/api/client';
import { getFromCache, formatSavedAt } from '../../src/api/cache';
import { useNetwork } from '../../src/utils/useNetwork';

interface SubscriptionItem {
  _id: string;
  userId?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  shopName?: string;
  planId?: {
    _id: string;
    name: string;
    price: number;
    billingCycle?: string;
  };
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  paymentReference?: string;
  rejectionReason?: string;
}

interface PlanItem {
  _id: string;
  name: string;
  price: number;
  description?: string;
  maxShops?: number;
  maxProductsPerShop?: number;
  maxInvoicesPerMonth?: number;
  isActive: boolean;
}

export default function AdminSubscriptionsScreen() {
  const { isOnline } = useNetwork();
  const { toast, show: showToast, hide: hideToast } = useToast();

  const [topTab, setTopTab] = useState<'subs' | 'plans'>('subs');

  // Subscriptions state
  const [subs, setSubs] = useState<SubscriptionItem[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [refreshingSubs, setRefreshingSubs] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  // Revoke state
  const [revokeModalVisible, setRevokeModalVisible] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [submittingRevoke, setSubmittingRevoke] = useState(false);

  // Plans state
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [createPlanModalVisible, setCreatePlanModalVisible] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState('');
  const [newPlanDesc, setNewPlanDesc] = useState('');
  const [newPlanMaxShops, setNewPlanMaxShops] = useState('1');
  const [newPlanMaxProducts, setNewPlanMaxProducts] = useState('20');
  const [newPlanMaxInvoices, setNewPlanMaxInvoices] = useState('50');
  const [creatingPlan, setCreatingPlan] = useState(false);

  const loadSubs = useCallback(async () => {
    setLoadingSubs(true);
    try {
      const endpoint = '/subscription/admin/subscriptions';
      const res: any = await authedGet(endpoint);
      setSubs(res?.subscriptions || []);

      const cached = await getFromCache(endpoint);
      if (cached?.savedAt) {
        setLastUpdated(formatSavedAt(cached.savedAt));
      }
    } catch (err: any) {
      showToast(err.message ?? 'Failed to load subscriptions', 'error');
    } finally {
      setLoadingSubs(false);
      setRefreshingSubs(false);
    }
  }, [showToast]);

  const loadPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const res: any = await authedGet('/subscription/plans');
      setPlans(res?.plans || []);
    } catch (err: any) {
      showToast(err.message ?? 'Failed to load plans', 'error');
    } finally {
      setLoadingPlans(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (topTab === 'subs') {
      loadSubs();
    } else {
      loadPlans();
    }
  }, [topTab, loadSubs, loadPlans]);

  // Handle Revoke
  function openRevokeModal(id: string) {
    if (!isOnline) {
      showToast('Internet required to revoke subscription', 'warning');
      return;
    }
    setRevokingId(id);
    setRevokeReason('');
    setRevokeModalVisible(true);
  }

  async function submitRevoke() {
    if (!revokingId) return;
    setSubmittingRevoke(true);
    try {
      const res: any = await authedPut(
        '/subscription',
        `/admin/subscriptions/revoke/${revokingId}`,
        {
          reason: revokeReason.trim() || undefined,
        }
      );
      showToast(res.message || 'Subscription revoked successfully', 'success');
      setSubs((prev) =>
        prev.map((s) => (s._id === revokingId ? { ...s, status: 'cancelled' } : s))
      );
      setRevokeModalVisible(false);
    } catch (err: any) {
      showToast(err.message ?? 'Failed to revoke', 'error');
    } finally {
      setSubmittingRevoke(false);
    }
  }

  // Handle Toggle Plan Status
  async function togglePlanActive(planId: string, currentActive: boolean) {
    if (!isOnline) {
      showToast('Internet required to update plan', 'warning');
      return;
    }
    try {
      await authedPut('/subscription', `/admin/plans/active-inactive/${planId}`, {
        isActive: !currentActive,
      });
      showToast(`Plan status updated`, 'success');
      setPlans((prev) =>
        prev.map((p) => (p._id === planId ? { ...p, isActive: !currentActive } : p))
      );
    } catch (err: any) {
      showToast(err.message ?? 'Failed to update plan status', 'error');
    }
  }

  // Handle Create Plan
  async function submitCreatePlan() {
    if (!isOnline) {
      showToast('Internet required to create plan', 'warning');
      return;
    }
    if (!newPlanName.trim()) {
      showToast('Plan name is required', 'error');
      return;
    }
    if (!newPlanPrice.trim() || isNaN(Number(newPlanPrice))) {
      showToast('Enter a valid price', 'error');
      return;
    }

    setCreatingPlan(true);
    try {
      const payload = {
        name: newPlanName.trim(),
        price: Number(newPlanPrice),
        description: newPlanDesc.trim() || undefined,
        maxShops: Number(newPlanMaxShops) || 1,
        maxProductsPerShop: Number(newPlanMaxProducts) || 20,
        maxInvoicesPerMonth: Number(newPlanMaxInvoices) || 50,
      };

      await authedPost('/subscription', '/admin/plans', payload);
      showToast('New plan created successfully!', 'success');
      setCreatePlanModalVisible(false);
      setNewPlanName('');
      setNewPlanPrice('');
      setNewPlanDesc('');
      loadPlans();
    } catch (err: any) {
      showToast(err.message ?? 'Failed to create plan', 'error');
    } finally {
      setCreatingPlan(false);
    }
  }

  const filteredSubs = useMemo(() => {
    return subs.filter((s) => {
      const matchStatus = filterStatus === 'all' || s.status === filterStatus;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery.trim() ||
        (s.userId?.name && s.userId.name.toLowerCase().includes(q)) ||
        (s.userId?.email && s.userId.email.toLowerCase().includes(q)) ||
        (s.shopName && s.shopName.toLowerCase().includes(q)) ||
        (s.planId?.name && s.planId.name.toLowerCase().includes(q));

      return matchStatus && matchSearch;
    });
  }, [subs, filterStatus, searchQuery]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <OfflineBanner />
      <Toast {...toast} onHide={hideToast} />

      <Header title="Manage Subscriptions & Plans" />

      {/* Top Segmented Controls */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, topTab === 'subs' && styles.tabButtonActive]}
          onPress={() => setTopTab('subs')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people-outline"
            size={18}
            color={topTab === 'subs' ? colors.dsPrimary : colors.dsOutline}
          />
          <Text style={[styles.tabButtonText, topTab === 'subs' && styles.tabButtonTextActive]}>
            Subscriptions ({subs.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, topTab === 'plans' && styles.tabButtonActive]}
          onPress={() => setTopTab('plans')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="layers-outline"
            size={18}
            color={topTab === 'plans' ? colors.dsPrimary : colors.dsOutline}
          />
          <Text style={[styles.tabButtonText, topTab === 'plans' && styles.tabButtonTextActive]}>
            Plans ({plans.length})
          </Text>
        </TouchableOpacity>
      </View>

      {topTab === 'subs' ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshingSubs}
              onRefresh={() => {
                if (isOnline) {
                  setRefreshingSubs(true);
                  loadSubs();
                } else {
                  showToast('Pull-to-refresh disabled while offline', 'info');
                }
              }}
            />
          }
        >
          <Input
            placeholder="Search subscriber, email, or plan..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon="search-outline"
          />

          {/* Status Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {['all', 'active', 'pending', 'expired', 'cancelled'].map((st) => (
              <TouchableOpacity
                key={st}
                style={[styles.statusChip, filterStatus === st && styles.statusChipActive]}
                onPress={() => setFilterStatus(st)}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    filterStatus === st && styles.statusChipTextActive,
                  ]}
                >
                  {st.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {!isOnline && lastUpdated ? (
            <View style={styles.cacheIndicator}>
              <Ionicons name="time-outline" size={14} color={colors.dsOutline} />
              <Text style={styles.cacheText}>Last updated: {lastUpdated}</Text>
            </View>
          ) : null}

          {loadingSubs && !refreshingSubs ? (
            <ActivityIndicator size="large" color={colors.dsPrimary} style={{ marginVertical: 32 }} />
          ) : filteredSubs.length === 0 ? (
            <View style={styles.emptyView}>
              <Ionicons name="file-tray-outline" size={48} color={colors.dsOutline} />
              <Text style={styles.emptyTitle}>No subscriptions found</Text>
              <Text style={styles.emptySub}>No records match your filter criteria.</Text>
            </View>
          ) : (
            filteredSubs.map((sub) => (
              <Card key={sub._id} style={styles.subCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{sub.userId?.name || 'Customer'}</Text>
                    <Text style={styles.userEmail}>{sub.userId?.email}</Text>
                    {sub.shopName && <Text style={styles.shopName}>🏪 {sub.shopName}</Text>}
                  </View>
                  <Badge
                    label={sub.status.toUpperCase()}
                    variant={
                      sub.status === 'active'
                        ? 'success'
                        : sub.status === 'pending'
                        ? 'neutral'
                        : 'error'
                    }
                  />
                </View>

                <View style={styles.planInfoRow}>
                  <Text style={styles.planNameText}>
                    {sub.planId?.name || 'Custom Plan'} (৳{sub.planId?.price ?? '0'})
                  </Text>
                  {sub.startDate && (
                    <Text style={styles.datesText}>
                      {new Date(sub.startDate).toLocaleDateString()} –{' '}
                      {sub.endDate ? new Date(sub.endDate).toLocaleDateString() : 'Lifetime'}
                    </Text>
                  )}
                </View>

                {sub.status === 'active' && isOnline ? (
                  <View style={{ marginTop: spacing.xs }}>
                    <Button
                      title="Revoke Access"
                      variant="outline"
                      size="sm"
                      style={{ borderColor: colors.dsError }}
                      textStyle={{ color: colors.dsError }}
                      onPress={() => openRevokeModal(sub._id)}
                    />
                  </View>
                ) : null}
              </Card>
            ))
          )}
        </ScrollView>
      ) : (
        /* ──────────────────────────────────────────────────────────────────────── */
        /* TAB: MANAGE PLANS                                                       */
        /* ──────────────────────────────────────────────────────────────────────── */
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Button
            title="+ Create New Plan"
            leftIcon="add-outline"
            onPress={() => setCreatePlanModalVisible(true)}
            disabled={!isOnline}
          />

          {loadingPlans ? (
            <ActivityIndicator size="large" color={colors.dsPrimary} style={{ marginVertical: 32 }} />
          ) : plans.length === 0 ? (
            <View style={styles.emptyView}>
              <Ionicons name="pricetags-outline" size={48} color={colors.dsOutline} />
              <Text style={styles.emptyTitle}>No plans found</Text>
            </View>
          ) : (
            plans.map((p) => (
              <Card key={p._id} style={styles.planCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{p.name}</Text>
                    <Text style={styles.planPrice}>৳{p.price}</Text>
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>{p.isActive ? 'Active' : 'Inactive'}</Text>
                    <Switch
                      value={p.isActive}
                      onValueChange={() => togglePlanActive(p._id, p.isActive)}
                      trackColor={{ false: colors.dsOutlineVariant, true: colors.dsPrimary }}
                      disabled={!isOnline}
                    />
                  </View>
                </View>

                {p.description ? <Text style={styles.planDesc}>{p.description}</Text> : null}

                <View style={styles.planSpecsRow}>
                  <Text style={styles.specPill}>Shops: {p.maxShops ?? 1}</Text>
                  <Text style={styles.specPill}>Products: {p.maxProductsPerShop ?? 'Unlimited'}</Text>
                  <Text style={styles.specPill}>Invoices/mo: {p.maxInvoicesPerMonth ?? 'Unlimited'}</Text>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* Revoke Modal */}
      <Modal
        visible={revokeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRevokeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeading}>Revoke Subscription</Text>
            <Text style={styles.modalSubheading}>
              Provide a reason for cancelling this user's active subscription.
            </Text>

            <Input
              label="Cancellation Reason"
              placeholder="e.g. Terms of Service violation"
              value={revokeReason}
              onChangeText={setRevokeReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => setRevokeModalVisible(false)}
              />
              <Button
                title={submittingRevoke ? 'Revoking...' : 'Confirm Revoke'}
                style={{ flex: 1, backgroundColor: colors.dsError }}
                disabled={submittingRevoke}
                onPress={submitRevoke}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Plan Modal */}
      <Modal
        visible={createPlanModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreatePlanModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalHeading}>Create Subscription Plan</Text>
              <Text style={styles.modalSubheading}>Add a new plan for merchants to purchase.</Text>

              <Input
                label="Plan Name"
                placeholder="e.g. Pro Merchant"
                value={newPlanName}
                onChangeText={setNewPlanName}
              />
              <Input
                label="Price (BDT ৳)"
                placeholder="e.g. 990"
                keyboardType="numeric"
                value={newPlanPrice}
                onChangeText={setNewPlanPrice}
              />
              <Input
                label="Max Shops"
                placeholder="1"
                keyboardType="numeric"
                value={newPlanMaxShops}
                onChangeText={setNewPlanMaxShops}
              />
              <Input
                label="Max Products"
                placeholder="20"
                keyboardType="numeric"
                value={newPlanMaxProducts}
                onChangeText={setNewPlanMaxProducts}
              />
              <Input
                label="Max Invoices / month"
                placeholder="50"
                keyboardType="numeric"
                value={newPlanMaxInvoices}
                onChangeText={setNewPlanMaxInvoices}
              />
              <Input
                label="Description"
                placeholder="Key benefits and features..."
                multiline
                numberOfLines={2}
                value={newPlanDesc}
                onChangeText={setNewPlanDesc}
              />

              <View style={[styles.modalButtons, { marginTop: spacing.md }]}>
                <Button
                  title="Cancel"
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() => setCreatePlanModalVisible(false)}
                />
                <Button
                  title={creatingPlan ? 'Creating...' : 'Create Plan'}
                  style={{ flex: 1 }}
                  disabled={creatingPlan}
                  onPress={submitCreatePlan}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dsBackground,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.dsOutlineVariant,
    gap: spacing.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.dsSurfaceContainerLowest,
  },
  tabButtonActive: {
    backgroundColor: colors.dsPrimaryContainer,
  },
  tabButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.sm,
    color: colors.dsOutline,
  },
  tabButtonTextActive: {
    fontFamily: 'Inter-SemiBold',
    color: colors.dsPrimary,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 48,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
    backgroundColor: colors.white,
    marginRight: 6,
  },
  statusChipActive: {
    backgroundColor: colors.dsPrimary,
    borderColor: colors.dsPrimary,
  },
  statusChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: colors.dsOutline,
  },
  statusChipTextActive: {
    color: colors.white,
    fontFamily: 'Inter-Bold',
  },
  cacheIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  cacheText: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
  },
  emptyView: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.md,
    color: colors.dsOnSurface,
  },
  emptySub: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
  },
  subCard: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userName: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurface,
  },
  userEmail: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
    marginTop: 1,
  },
  shopName: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.xs,
    color: colors.dsPrimary,
    marginTop: 2,
  },
  planInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.dsOutlineVariant,
  },
  planNameText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: fontSizes.xs,
    color: colors.dsOnSurface,
  },
  datesText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: colors.dsOutline,
  },
  planCard: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  planPrice: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: fontSizes.md,
    color: colors.dsPrimary,
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: colors.dsOutline,
  },
  planDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOnSurfaceVariant,
    marginVertical: 2,
  },
  planSpecsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs,
  },
  specPill: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    backgroundColor: colors.dsSurfaceContainerLowest,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    color: colors.dsOnSurface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalHeading: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.lg,
    color: colors.dsOnSurface,
  },
  modalSubheading: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.sm,
    color: colors.dsOutline,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
