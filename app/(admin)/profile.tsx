import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { Toast, useToast } from '../../src/components/Toast';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { colors, fontSizes, radii, spacing } from '../../src/theme/tokens';
import { clearSession, getUserName, getUserEmail } from '../../src/utils/session';
import { clearUserCache } from '../../src/api/cache';
import { authedPost, API_BASE } from '../../src/api/client';
import { useNetwork } from '../../src/utils/useNetwork';

export default function AdminProfileScreen() {
  const { isOnline } = useNetwork();
  const { toast, show: showToast, hide: hideToast } = useToast();

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [n, e] = await Promise.all([getUserName(), getUserEmail()]);
        setUserName(n);
        setUserEmail(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleClearCache() {
    await clearUserCache();
    showToast('Offline cache cleared successfully', 'success');
  }

  function confirmLogout() {
    Alert.alert('Logout', 'Are you sure you want to log out from Administrator console?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            if (isOnline) {
              await authedPost('/user', '/logout', {});
            }
          } catch {}
          await clearUserCache();
          await clearSession();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <OfflineBanner />
      <Toast {...toast} onHide={hideToast} />

      <Header title="Admin Profile" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.dsPrimary} style={{ marginVertical: 32 }} />
        ) : (
          <>
            {/* Admin Info Card */}
            <Card style={styles.userCard}>
              <View style={styles.avatarCircle}>
                <Ionicons name="shield-checkmark" size={36} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameBadgeRow}>
                  <Text style={styles.userName}>{userName || 'Administrator'}</Text>
                  <Badge label="ADMIN" variant="primary" />
                </View>
                <Text style={styles.userEmail}>{userEmail}</Text>
                <Text style={styles.roleSub}>System Administrator</Text>
              </View>
            </Card>

            {/* System Info Card */}
            <Card style={styles.infoCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="server-outline" size={20} color={colors.dsPrimary} />
                <Text style={styles.sectionTitle}>System Environment</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Backend API</Text>
                <Text style={styles.infoVal}>{API_BASE}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>App Version</Text>
                <Text style={styles.infoVal}>1.0.0 (Expo SDK 58)</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Network Status</Text>
                <Text style={[styles.infoVal, { color: isOnline ? '#16a34a' : colors.dsError }]}>
                  {isOnline ? '● Online' : '● Offline'}
                </Text>
              </View>
            </Card>

            {/* Offline Cache & Actions Card */}
            <Card style={styles.infoCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="save-outline" size={20} color={colors.dsPrimary} />
                <Text style={styles.sectionTitle}>Storage & Maintenance</Text>
              </View>

              <TouchableOpacity style={styles.maintenanceItem} onPress={handleClearCache}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.maintenanceTitle}>Clear Offline Cache</Text>
                  <Text style={styles.maintenanceSub}>Removes cached queries and saved lists</Text>
                </View>
                <Ionicons name="trash-outline" size={20} color={colors.dsOutline} />
              </TouchableOpacity>
            </Card>

            {/* Logout Button */}
            <Button
              title="Log Out"
              variant="outline"
              leftIcon="log-out-outline"
              style={styles.logoutBtn}
              textStyle={{ color: colors.dsError }}
              onPress={confirmLogout}
            />
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
  userCard: {
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.dsPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.md,
    color: colors.dsOnSurface,
  },
  userEmail: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
    marginTop: 2,
  },
  roleSub: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.xs,
    color: colors.dsPrimary,
    marginTop: 4,
  },
  infoCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.md,
    color: colors.dsOnSurface,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.dsOutlineVariant,
  },
  infoLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
  },
  infoVal: {
    fontFamily: 'Inter-SemiBold',
    fontSize: fontSizes.xs,
    color: colors.dsOnSurface,
  },
  maintenanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  maintenanceTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurface,
  },
  maintenanceSub: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
    marginTop: 2,
  },
  logoutBtn: {
    borderColor: colors.dsError,
    marginTop: spacing.md,
  },
});
