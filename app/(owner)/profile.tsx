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
import { Badge } from '../../src/components/Badge';
import { Toast, useToast } from '../../src/components/Toast';
import { colors, fontSizes, radii, spacing, shadows } from '../../src/theme/tokens';
import { clearSession, getUserName, getUserEmail } from '../../src/utils/session';
import { authedGet, authedPost } from '../../src/api/client';
import { clearUserCache } from '../../src/api/cache';
import { useNetwork } from '../../src/utils/useNetwork';
import { OfflineBanner } from '../../src/components/OfflineBanner';

interface ShopInfo {
  name: string;
  contactNumber?: string;
  address?: {
    address_line1?: string;
    city?: string;
  };
}

export default function OwnerProfileScreen() {
  const { isOnline } = useNetwork();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast, show: showToast, hide: hideToast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const [n, e] = await Promise.all([getUserName(), getUserEmail()]);
        setUserName(n);
        setUserEmail(e);

        // Fetch user shop details
        const shopRes: any = await authedGet('/shop/my');
        if (shopRes?.shop || shopRes?.data) {
          setShop(shopRes.shop || shopRes.data);
        }
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await authedPost('/user', '/logout', {});
          } catch {
            // Ignore error on logout endpoint
          }
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
      <Header title="My Profile" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.dsPrimary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* User Info Card */}
          <View style={[styles.card, shadows.sm]}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {userName ? userName.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <Text style={styles.name}>{userName || 'User Name'}</Text>
            <Text style={styles.email}>{userEmail || 'user@example.com'}</Text>
            <Badge variant="primary" style={{ marginTop: spacing[2] }}>
              Shop Owner
            </Badge>
          </View>

          {/* Shop Details Card */}
          <Text style={styles.sectionTitle}>Shop Information</Text>
          <View style={[styles.card, shadows.sm]}>
            <View style={styles.infoRow}>
              <Ionicons name="storefront-outline" size={20} color={colors.dsPrimary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Shop Name</Text>
                <Text style={styles.infoValue}>{shop?.name || 'Not set'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color={colors.dsPrimary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <Text style={styles.infoValue}>{shop?.contactNumber || 'Not set'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color={colors.dsPrimary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>
                  {shop?.address?.address_line1
                    ? `${shop.address.address_line1}, ${shop?.address?.city || ''}`
                    : 'Not set'}
                </Text>
              </View>
            </View>
          </View>

          {/* App Info & Logout */}
          <View style={{ marginTop: spacing[4] }}>
            <Button
              variant="outline"
              onPress={handleLogout}
              fullWidth
              textStyle={{ color: colors.destructive }}
              style={{ borderColor: colors.destructive }}
            >
              Sign Out
            </Button>
          </View>

          <Text style={styles.versionText}>
            Memo Book v1.0.0 • Powered by Invoice Managerium
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dsBackground },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: spacing[4] },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing[5],
    alignItems: 'center',
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.dsPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  avatarText: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes['3xl'],
    color: colors.white,
  },
  name: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.xl,
    color: colors.dsOnSurface,
  },
  email: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.sm,
    color: colors.dsOutline,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.base,
    color: colors.dsOnSurface,
    marginBottom: spacing[2],
    marginLeft: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing[2],
  },
  infoContent: {
    marginLeft: spacing[3],
    flex: 1,
  },
  infoLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
  },
  infoValue: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurface,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.dsSurfaceContainer,
    width: '100%',
    marginVertical: spacing[1],
  },
  versionText: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
    textAlign: 'center',
    marginTop: spacing[8],
  },
});
