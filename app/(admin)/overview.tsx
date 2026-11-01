import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Toast, useToast } from '../../src/components/Toast';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { colors, fontSizes, radii, spacing, shadows } from '../../src/theme/tokens';
import { authedGet, authedPut } from '../../src/api/client';
import { getFromCache, formatSavedAt } from '../../src/api/cache';
import { useNetwork } from '../../src/utils/useNetwork';

interface SubStats {
  pending: number;
  active: number;
  revenue: number;
}

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
  createdAt: string;
}

export default function AdminOverviewScreen() {
  const { isOnline } = useNetwork();
  const { toast, show: showToast, hide: hideToast } = useToast();

  const [stats, setStats] = useState<SubStats>({ pending: 0, active: 0, revenue: 0 });
  const [pendingSubs, setPendingSubs] = useState<PendingSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      // 1. Fetch Stats
      const statsRes: any = await authedGet('/subscription/admin/stats');
      if (statsRes?.stats) {
        setStats(statsRes.stats);
      }

      // 2. Fetch Recent Pending Subscriptions
      const pendingRes: any = await authedGet('/subscription/admin/subscriptions?status=pending&limit=5');
      setPendingSubs(pendingRes?.subscriptions || []);

      const cached = await getFromCache('/subscription/admin/stats');
      if (cached?.savedAt) {
        setLastUpdated(formatSavedAt(cached.savedAt));
      }
    } catch (err: any) {
      showToast(err.message ?? 'Failed to load admin stats', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAction(id: string, action: 'approve' | 'reject') {
    if (!isOnline) {
      showToast('Internet required to handle subscriptions', 'warning');
      return;
    }

    Alert.alert(
      action === 'approve' ? 'Approve Subscription' : 'Reject Subscription',
      `Are you sure you want to ${action} this subscription request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approve' ? 'Approve' : 'Reject',
          style: action === 'approve' ? 'default' : 'destructive',
          onPress: async () => {
            setActingId(id);
            try {
              const res: any = await authedPut('/subscription', `/admin/subscriptions/${id}`, {
                action,
              });
              showToast(res.message || `Subscription ${action}d successfully`, 'success');
              loadData();
            } catch (err: any) {
              showToast(err.message ?? `Failed to ${action} subscription`, 'error');
            } finally {
              setActingId(null);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <OfflineBanner />
      <Toast {...toast} onHide={hideToast} />

      <Header title="Admin Overview" />

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
        {/* Offline indicator */}
        {!isOnline && lastUpdated ? (
          <View style={styles.cacheIndicator}>
            <Ionicons name="time-outline" size={14} color={colors.dsOutline} />
            <Text style={styles.cacheText}>Last updated: {lastUpdated}</Text>
          </View>
        ) : null}

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={colors.dsPrimary} style={{ marginVertical: 32 }} />
        ) : (
          <>
            {/* Stat Cards Grid */}
            <View style={styles.statsGrid}>
              {/* Pending */}
              <TouchableOpacity
                style={[styles.statCard, { borderLeftColor: '#e8a735', borderLeftWidth: 4 }]}
                activeOpacity={0.8}
                onPress={() => router.push('/(admin)/pending')}
              >
                <View style={[styles.statIconBox, { backgroundColor: '#fef3c7' }]}>
                  <Ionicons name="time-outline" size={24} color="#d97706" />
                </View>
                <View>
                  <Text style={styles.statValue}>{stats.pending}</Text>
                  <Text style={styles.statTitle}>Pending Requests</Text>
                </View>
              </TouchableOpacity>

              {/* Active */}
              <TouchableOpacity
                style={[styles.statCard, { borderLeftColor: '#16a34a', borderLeftWidth: 4 }]}
                activeOpacity={0.8}
                onPress={() => router.push('/(admin)/subscriptions')}
              >
                <View style={[styles.statIconBox, { backgroundColor: '#dcfce7' }]}>
                  <Ionicons name="checkmark-circle-outline" size={24} color="#16a34a" />
                </View>
                <View>
                  <Text style={styles.statValue}>{stats.active}</Text>
                  <Text style={styles.statTitle}>Active Subscriptions</Text>
                </View>
              </TouchableOpacity>

              {/* Revenue */}
              <View
                style={[styles.statCard, { borderLeftColor: colors.dsPrimary, borderLeftWidth: 4 }]}
              >
                <View style={[styles.statIconBox, { backgroundColor: colors.dsPrimaryContainer }]}>
                  <Ionicons name="cash-outline" size={24} color={colors.dsPrimary} />
                </View>
                <View>
                  <Text style={styles.statValue}>৳{stats.revenue.toLocaleString()}</Text>
                  <Text style={styles.statTitle}>Total Revenue</Text>
                </View>
              </View>
            </View>

            {/* Recent Pending Requests */}
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionTitle}>Pending Approvals ({pendingSubs.length})</Text>
              {pendingSubs.length > 0 && (
                <TouchableOpacity onPress={() => router.push('/(admin)/pending')}>
                  <Text style={styles.seeAllText}>See all →</Text>
                </TouchableOpacity>
              )}
            </View>

            {pendingSubs.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="checkmark-done-circle-outline" size={44} color="#16a34a" />
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptySub}>No pending subscription requests at this time.</Text>
              </Card>
            ) : (
              pendingSubs.map((sub) => (
                <Card key={sub._id} style={styles.subCard}>
                  <View style={styles.subCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subUserName}>{sub.userId?.name || 'Customer'}</Text>
                      <Text style={styles.subUserEmail}>{sub.userId?.email}</Text>
                      {sub.userId?.phone ? (
                        <Text style={styles.subUserPhone}>📞 {sub.userId.phone}</Text>
                      ) : null}
                    </View>
                    <Badge label={sub.planId?.name || 'Plan'} variant="primary" />
                  </View>

                  <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Shop</Text>
                      <Text style={styles.detailVal}>{sub.shopName || '—'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Method</Text>
                      <Text style={[styles.detailVal, { textTransform: 'uppercase' }]}>
                        {sub.paymentMethod}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Trx ID</Text>
                      <Text style={styles.detailVal}>{sub.paymentReference}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Amount</Text>
                      <Text style={[styles.detailVal, { color: colors.dsPrimary, fontWeight: '700' }]}>
                        ৳{sub.planId?.price ?? '—'}
                      </Text>
                    </View>
                  </View>

                  {/* Approve / Reject Buttons */}
                  <View style={styles.cardActions}>
                    <Button
                      title="Reject"
                      variant="outline"
                      size="sm"
                      style={{ flex: 1, borderColor: colors.dsError }}
                      textStyle={{ color: colors.dsError }}
                      disabled={actingId === sub._id || !isOnline}
                      onPress={() => handleAction(sub._id, 'reject')}
                    />
                    <Button
                      title="Approve"
                      size="sm"
                      style={{ flex: 1 }}
                      disabled={actingId === sub._id || !isOnline}
                      loading={actingId === sub._id}
                      onPress={() => handleAction(sub._id, 'approve')}
                    />
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
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
  statsGrid: {
    gap: spacing.sm,
  },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
  },
  statIconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: fontSizes.xl,
    color: colors.dsOnSurface,
  },
  statTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
    marginTop: 2,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.md,
    color: colors.dsOnSurface,
  },
  seeAllText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: fontSizes.xs,
    color: colors.dsPrimary,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
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
    textAlign: 'center',
  },
  subCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  subCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  subUserName: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurface,
  },
  subUserEmail: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
    marginTop: 1,
  },
  subUserPhone: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.xs,
    color: colors.dsOnSurfaceVariant,
    marginTop: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    backgroundColor: colors.dsSurfaceContainerLowest,
    padding: spacing.xs,
    borderRadius: radii.sm,
    justifyContent: 'space-around',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: colors.dsOutline,
    textTransform: 'uppercase',
  },
  detailVal: {
    fontFamily: 'Inter-SemiBold',
    fontSize: fontSizes.xs,
    color: colors.dsOnSurface,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
