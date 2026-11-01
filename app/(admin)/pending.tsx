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
import { authedGet, authedPut } from '../../src/api/client';
import { getFromCache, formatSavedAt } from '../../src/api/cache';
import { useNetwork } from '../../src/utils/useNetwork';

interface PendingSub {
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
  };
  paymentMethod: string;
  paymentReference: string;
  paymentAmount?: number;
  createdAt: string;
}

export default function AdminPendingScreen() {
  const { isOnline } = useNetwork();
  const { toast, show: showToast, hide: hideToast } = useToast();

  const [subscriptions, setSubscriptions] = useState<PendingSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  // Reject Modal
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const endpoint = '/subscription/admin/subscriptions?status=pending';
      const res: any = await authedGet(endpoint);
      setSubscriptions(res?.subscriptions || []);

      const cached = await getFromCache(endpoint);
      if (cached?.savedAt) {
        setLastUpdated(formatSavedAt(cached.savedAt));
      }
    } catch (err: any) {
      showToast(err.message ?? 'Failed to load pending requests', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleApprove(id: string) {
    if (!isOnline) {
      showToast('Internet required to approve subscriptions', 'warning');
      return;
    }

    Alert.alert('Approve Subscription', 'Are you sure you want to approve this subscription?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setActingId(id);
          try {
            const res: any = await authedPut('/subscription', `/admin/subscriptions/${id}`, {
              action: 'approve',
            });
            showToast(res.message || 'Subscription approved!', 'success');
            setSubscriptions((prev) => prev.filter((s) => s._id !== id));
          } catch (err: any) {
            showToast(err.message ?? 'Failed to approve', 'error');
          } finally {
            setActingId(null);
          }
        },
      },
    ]);
  }

  function openRejectModal(id: string) {
    if (!isOnline) {
      showToast('Internet required to reject subscriptions', 'warning');
      return;
    }
    setSelectedSubId(id);
    setRejectionReason('');
    setRejectModalVisible(true);
  }

  async function submitReject() {
    if (!selectedSubId) return;
    setSubmittingReject(true);
    try {
      const res: any = await authedPut(
        '/subscription',
        `/admin/subscriptions/${selectedSubId}`,
        {
          action: 'reject',
          rejectionReason: rejectionReason.trim() || undefined,
        }
      );
      showToast(res.message || 'Subscription rejected', 'success');
      setSubscriptions((prev) => prev.filter((s) => s._id !== selectedSubId));
      setRejectModalVisible(false);
    } catch (err: any) {
      showToast(err.message ?? 'Failed to reject', 'error');
    } finally {
      setSubmittingReject(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return subscriptions;
    const q = search.toLowerCase();
    return subscriptions.filter(
      (s) =>
        (s.userId?.name && s.userId.name.toLowerCase().includes(q)) ||
        (s.userId?.email && s.userId.email.toLowerCase().includes(q)) ||
        (s.paymentReference && s.paymentReference.toLowerCase().includes(q)) ||
        (s.shopName && s.shopName.toLowerCase().includes(q))
    );
  }, [subscriptions, search]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <OfflineBanner />
      <Toast {...toast} onHide={hideToast} />

      <Header title="Pending Subscriptions" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (isOnline) {
                setRefreshing(true);
                loadData();
              } else {
                showToast('Pull-to-refresh disabled while offline', 'info');
              }
            }}
          />
        }
      >
        <Input
          placeholder="Search by user, email, or Trx ID..."
          value={search}
          onChangeText={setSearch}
          leftIcon="search-outline"
        />

        {!isOnline && lastUpdated ? (
          <View style={styles.cacheIndicator}>
            <Ionicons name="time-outline" size={14} color={colors.dsOutline} />
            <Text style={styles.cacheText}>Last updated: {lastUpdated}</Text>
          </View>
        ) : null}

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={colors.dsPrimary} style={{ marginVertical: 32 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyView}>
            <Ionicons name="checkbox-outline" size={48} color={colors.dsOutline} />
            <Text style={styles.emptyTitle}>No pending requests</Text>
            <Text style={styles.emptySub}>
              {search ? 'Try adjusting your search criteria' : 'All subscriptions are reviewed.'}
            </Text>
          </View>
        ) : (
          filtered.map((sub) => (
            <Card key={sub._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{sub.userId?.name || 'Customer'}</Text>
                  <Text style={styles.userEmail}>{sub.userId?.email}</Text>
                  {sub.userId?.phone ? (
                    <Text style={styles.userPhone}>Phone: {sub.userId.phone}</Text>
                  ) : null}
                </View>
                <Badge label={sub.planId?.name || 'Plan'} variant="primary" />
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Shop</Text>
                  <Text style={styles.infoVal}>{sub.shopName || '—'}</Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Method</Text>
                  <Text style={[styles.infoVal, { textTransform: 'uppercase' }]}>
                    {sub.paymentMethod}
                  </Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Transaction ID</Text>
                  <Text style={styles.infoVal}>{sub.paymentReference}</Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Price</Text>
                  <Text style={[styles.infoVal, { color: colors.dsPrimary, fontWeight: '700' }]}>
                    ৳{sub.planId?.price ?? '—'}
                  </Text>
                </View>
              </View>

              <Text style={styles.dateText}>
                Requested: {new Date(sub.createdAt).toLocaleString()}
              </Text>

              <View style={styles.actionRow}>
                <Button
                  title="Reject"
                  variant="outline"
                  size="sm"
                  style={{ flex: 1, borderColor: colors.dsError }}
                  textStyle={{ color: colors.dsError }}
                  disabled={actingId === sub._id || !isOnline}
                  onPress={() => openRejectModal(sub._id)}
                />
                <Button
                  title="Approve"
                  size="sm"
                  style={{ flex: 1 }}
                  disabled={actingId === sub._id || !isOnline}
                  loading={actingId === sub._id}
                  onPress={() => handleApprove(sub._id)}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Reject Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeading}>Reject Subscription</Text>
            <Text style={styles.modalSubheading}>
              Provide an optional reason for rejecting this subscription request.
            </Text>

            <Input
              label="Rejection Reason"
              placeholder="e.g. Invalid Transaction ID, payment not received"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => setRejectModalVisible(false)}
              />
              <Button
                title={submittingReject ? 'Rejecting...' : 'Confirm Reject'}
                style={{ flex: 1, backgroundColor: colors.dsError }}
                disabled={submittingReject}
                onPress={submitReject}
              />
            </View>
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
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 48,
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
  card: {
    padding: spacing.md,
    gap: spacing.sm,
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
  userPhone: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.xs,
    color: colors.dsOnSurfaceVariant,
    marginTop: 2,
  },
  infoGrid: {
    flexDirection: 'row',
    backgroundColor: colors.dsSurfaceContainerLowest,
    padding: spacing.sm,
    borderRadius: radii.sm,
    justifyContent: 'space-around',
  },
  infoCol: {
    alignItems: 'center',
  },
  infoLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: colors.dsOutline,
    textTransform: 'uppercase',
  },
  infoVal: {
    fontFamily: 'Inter-SemiBold',
    fontSize: fontSizes.xs,
    color: colors.dsOnSurface,
    marginTop: 2,
  },
  dateText: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
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
