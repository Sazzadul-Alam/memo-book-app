import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  Platform,
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
import {
  getSavedPrinterDetails,
  scanPrinters,
  setActivePrinter,
  clearSavedPrinter,
  PrinterDevice,
  requestBluetoothPermissions,
  getSavedPaperSize,
  setSavedPaperSize,
} from '../../src/utils/bluetoothPrinter';
import { PaperSize } from '../../src/utils/receiptPrinter';

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

  // Bluetooth Printer states
  const [activePrinter, setActivePrinterState] = useState<{ address: string; name: string } | null>(null);
  const [paperSize, setPaperSizeState] = useState<PaperSize>('58mm');
  const [scanningPrinters, setScanningPrinters] = useState(false);
  const [pairedPrinters, setPairedPrinters] = useState<PrinterDevice[]>([]);
  const [pickerModalVisible, setPickerModalVisible] = useState(false);

  const { toast, show: showToast, hide: hideToast } = useToast();

  const loadProfileAndPrinter = useCallback(async () => {
    try {
      const [n, e, printer, savedSize] = await Promise.all([
        getUserName(),
        getUserEmail(),
        getSavedPrinterDetails(),
        getSavedPaperSize(),
      ]);
      setUserName(n);
      setUserEmail(e);
      setActivePrinterState(printer);
      setPaperSizeState(savedSize);

      // Fetch user shop details
      const shopRes: any = await authedGet('/shop');
      if (shopRes?.ownedShops && shopRes.ownedShops.length > 0) {
        setShop(shopRes.ownedShops[0]);
      } else if (shopRes?.shop) {
        setShop(shopRes.shop);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfileAndPrinter();
  }, [loadProfileAndPrinter]);

  async function handleScanAndPickPrinter() {
    try {
      const permGranted = await requestBluetoothPermissions();
      if (!permGranted) {
        Alert.alert(
          'Bluetooth Permission Needed',
          'Please allow Bluetooth permissions to discover and select your POS printer.'
        );
        return;
      }

      setScanningPrinters(true);
      setPickerModalVisible(true);
      const { paired, found } = await scanPrinters(1200);
      const all = [...paired, ...found];
      
      const uniqueDevices: PrinterDevice[] = [];
      const seen = new Set<string>();
      for (const d of all) {
        if (!seen.has(d.address)) {
          seen.add(d.address);
          uniqueDevices.push(d);
        }
      }

      setPairedPrinters(uniqueDevices);
    } catch (err: any) {
      showToast(err?.message || 'Could not scan for Bluetooth printers', 'error');
    } finally {
      setScanningPrinters(false);
    }
  }

  async function handleSelectPrinter(device: PrinterDevice) {
    try {
      await setActivePrinter(device.address, device.name);
      setActivePrinterState({ address: device.address, name: device.name });
      setPickerModalVisible(false);
      showToast(`Selected POS Printer: ${device.name || device.address}`, 'success');
    } catch (err: any) {
      showToast('Failed to select printer', 'error');
    }
  }

  async function handleForgetPrinter() {
    Alert.alert('Disconnect POS Printer', 'Remove this printer as the default printing device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await clearSavedPrinter();
          setActivePrinterState(null);
          showToast('Printer disconnected', 'info');
        },
      },
    ]);
  }

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
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* User Info Card */}
          <View style={[styles.card, shadows.sm]}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {userName ? userName.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
              {userName || 'User Name'}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {userEmail || 'user@example.com'}
            </Text>
            <Badge variant="primary" style={{ marginTop: spacing[2] }}>
              Shop Owner
            </Badge>
          </View>

          {/* Connected POS Machine Card */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Connected POS Machine</Text>
            <TouchableOpacity
              onPress={handleScanAndPickPrinter}
              style={styles.changePrinterBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={14} color={colors.dsPrimary} />
              <Text style={styles.changePrinterText}>
                {activePrinter ? 'Change / Switch' : 'Connect'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, shadows.sm]}>
            {activePrinter ? (
              <View>
                <View style={styles.printerCardContent}>
                  <View style={styles.printerIconWrap}>
                    <Ionicons name="print" size={24} color={colors.dsPrimary} />
                    <View style={styles.connectedDot} />
                  </View>

                  <View style={styles.printerInfo}>
                    <View style={styles.printerTitleRow}>
                      <Text style={styles.printerName} numberOfLines={1}>
                        {activePrinter.name || 'Bluetooth POS Printer'}
                      </Text>
                      <Badge variant="success" style={styles.statusBadge}>
                        Connected
                      </Badge>
                    </View>
                    <Text style={styles.printerAddress}>
                      MAC: {activePrinter.address}
                    </Text>
                    <Text style={styles.printerHint}>
                      Receipts will print directly without any extra prompts
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleForgetPrinter}
                    style={styles.disconnectBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                  </TouchableOpacity>
                </View>

                {/* Roll Size Settings */}
                <View style={styles.divider} />
                <View style={styles.paperSizeSettingsRow}>
                  <Text style={styles.paperSizeLabel}>Paper Roll Size:</Text>
                  <View style={styles.paperSizeButtons}>
                    <TouchableOpacity
                      style={[
                        styles.sizeChip,
                        paperSize === '58mm' && styles.sizeChipActive,
                      ]}
                      onPress={async () => {
                        setPaperSizeState('58mm');
                        await setSavedPaperSize('58mm');
                        showToast('Default roll set to 58mm', 'info');
                      }}
                    >
                      <Text
                        style={[
                          styles.sizeChipText,
                          paperSize === '58mm' && styles.sizeChipTextActive,
                        ]}
                      >
                        58mm
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.sizeChip,
                        paperSize === '80mm' && styles.sizeChipActive,
                      ]}
                      onPress={async () => {
                        setPaperSizeState('80mm');
                        await setSavedPaperSize('80mm');
                        showToast('Default roll set to 80mm', 'info');
                      }}
                    >
                      <Text
                        style={[
                          styles.sizeChipText,
                          paperSize === '80mm' && styles.sizeChipTextActive,
                        ]}
                      >
                        80mm
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.noPrinterContent}>
                <View style={styles.noPrinterIconWrap}>
                  <Ionicons name="bluetooth-outline" size={26} color={colors.dsOutline} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.noPrinterTitle}>No POS Printer Connected</Text>
                  <Text style={styles.noPrinterDesc}>
                    Tap Connect to select your Bluetooth POS machine once
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleScanAndPickPrinter}
                  style={styles.connectNowBtn}
                >
                  <Text style={styles.connectNowBtnText}>Connect</Text>
                </TouchableOpacity>
              </View>
            )}
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
          <View style={{ marginTop: spacing[3] }}>
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

      {/* POS Printer Picker Modal */}
      <Modal
        visible={pickerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select POS Printer</Text>
                <Text style={styles.modalSubtitle}>
                  Choose which POS machine to use for printing receipts:
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPickerModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.dsOutline} />
              </TouchableOpacity>
            </View>

            {scanningPrinters ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="small" color={colors.dsPrimary} />
                <Text style={styles.modalLoadingText}>Scanning Bluetooth devices...</Text>
              </View>
            ) : pairedPrinters.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons name="bluetooth" size={36} color={colors.dsOutline} />
                <Text style={styles.modalEmptyTitle}>No Bluetooth POS Found</Text>
                <Text style={styles.modalEmptyDesc}>
                  Make sure your POS printer is turned on and paired in your phone's Bluetooth settings.
                </Text>
                <TouchableOpacity
                  style={styles.modalRetryBtn}
                  onPress={handleScanAndPickPrinter}
                >
                  <Ionicons name="refresh" size={16} color={colors.dsPrimary} />
                  <Text style={styles.modalRetryBtnText}>Scan Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={styles.printerListScroll}>
                {pairedPrinters.map((item, idx) => {
                  const isCurrent = activePrinter?.address === item.address;
                  return (
                    <TouchableOpacity
                      key={item.address || idx}
                      style={[
                        styles.printerListItem,
                        isCurrent && styles.printerListItemActive,
                      ]}
                      onPress={() => handleSelectPrinter(item)}
                    >
                      <View
                        style={[
                          styles.printerItemIcon,
                          isCurrent && { backgroundColor: colors.dsPrimaryContainer },
                        ]}
                      >
                        <Ionicons
                          name="print-outline"
                          size={20}
                          color={isCurrent ? colors.dsPrimary : colors.dsOnSurface}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.printerItemTitle}>
                          {item.name || 'Bluetooth Printer'}
                        </Text>
                        <Text style={styles.printerItemSub}>{item.address}</Text>
                      </View>
                      {isCurrent ? (
                        <Ionicons name="checkmark-circle" size={22} color={colors.dsPrimary} />
                      ) : (
                        <Ionicons name="radio-button-off" size={20} color={colors.dsOutline} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <Button
              title="Close"
              variant="outline"
              fullWidth
              onPress={() => setPickerModalVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dsBackground },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: spacing[4], paddingBottom: spacing[8] },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.dsPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
    alignSelf: 'center',
  },
  avatarText: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes['2xl'],
    color: colors.white,
  },
  name: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.lg,
    color: colors.dsOnSurface,
    textAlign: 'center',
  },
  email: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurface,
  },
  changePrinterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    backgroundColor: '#E0F2F1',
  },
  changePrinterText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: colors.dsPrimary,
  },
  printerCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  printerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2F1',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  connectedDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  printerInfo: {
    flex: 1,
  },
  printerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  printerName: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurface,
    maxWidth: '70%',
  },
  statusBadge: {
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  printerAddress: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: colors.dsOutline,
    marginTop: 2,
  },
  printerHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: '#059669',
    marginTop: 2,
  },
  disconnectBtn: {
    padding: 6,
  },
  paperSizeSettingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[2],
  },
  paperSizeLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.xs,
    color: colors.dsOnSurface,
  },
  paperSizeButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  sizeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
    backgroundColor: colors.dsSurfaceContainerLowest,
  },
  sizeChipActive: {
    backgroundColor: colors.dsPrimary,
    borderColor: colors.dsPrimary,
  },
  sizeChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: colors.dsOutline,
  },
  sizeChipTextActive: {
    fontFamily: 'Inter-Bold',
    color: colors.white,
  },
  noPrinterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noPrinterIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.dsSurfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPrinterTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.xs,
    color: colors.dsOnSurface,
  },
  noPrinterDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: colors.dsOutline,
    marginTop: 2,
  },
  connectNowBtn: {
    backgroundColor: colors.dsPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  connectNowBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: colors.white,
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
    marginTop: spacing[4],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '80%',
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.dsOutlineVariant,
  },
  modalTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.base,
    color: colors.dsOnSurface,
  },
  modalSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
    marginTop: 2,
  },
  modalLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.xl,
  },
  modalLoadingText: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: 6,
  },
  modalEmptyTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurface,
    marginTop: 4,
  },
  modalEmptyDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
    textAlign: 'center',
    maxWidth: 260,
  },
  modalRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: '#E0F2F1',
  },
  modalRetryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: fontSizes.xs,
    color: colors.dsPrimary,
  },
  printerListScroll: {
    maxHeight: 280,
    marginVertical: spacing.sm,
  },
  printerListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.sm,
    backgroundColor: colors.dsSurfaceContainerLowest,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
    marginBottom: spacing.xs,
  },
  printerListItemActive: {
    borderColor: colors.dsPrimary,
    backgroundColor: '#F0FDFA',
  },
  printerItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.dsSurfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printerItemTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.xs,
    color: colors.dsOnSurface,
  },
  printerItemSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: colors.dsOutline,
    marginTop: 1,
  },
});
