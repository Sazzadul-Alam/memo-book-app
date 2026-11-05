import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { Toast, useToast } from '../../src/components/Toast';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { colors, fontSizes, radii, spacing } from '../../src/theme/tokens';
import { authedGet, authedPost, authedPatch, authedDelete } from '../../src/api/client';
import { getFromCache, formatSavedAt } from '../../src/api/cache';
import { useNetwork } from '../../src/utils/useNetwork';
import {
  shareReceiptPdf,
  printReceipt,
  printViaBluetoothPos,
  PaperSize,
  ReceiptData,
} from '../../src/utils/receiptPrinter';
import {
  scanPrinters,
  getSavedPrinterDetails,
  setActivePrinter,
  PrinterDevice,
} from '../../src/utils/bluetoothPrinter';

interface CartItem {
  cartItemId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  variety: string;
}

interface ProductItem {
  _id: string;
  name: string;
  price: number;
  stock?: number;
  isDemo?: boolean;
}

interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total?: number;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  discountType?: 'flat' | 'percentage';
  discount?: number;
  discountAmount?: number;
  deliveryCharge?: number;
  isDeliveryPaid?: boolean;
  advanceAmount?: number;
  grandTotal: number;
  notes?: string;
  status: 'draft' | 'issued' | 'paid' | 'printed' | 'void';
  createdAt: string;
}

interface ShopDetails {
  _id: string;
  name: string;
  contactNumber?: string;
  address?: {
    address_line1?: string;
    city?: string;
  };
  socialLinks?: {
    facebook?: string;
    instagram?: string;
  };
}

export default function InvoicesScreen() {
  const { isOnline } = useNetwork();
  const { toast, show: showToast, hide: hideToast } = useToast();

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [shop, setShop] = useState<ShopDetails | null>(null);
  const [userPlan, setUserPlan] = useState<any>(null);
  const [paperSize, setPaperSize] = useState<PaperSize>('58mm');

  // ── Create Invoice States ──────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  const todayStr = useMemo(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  }, []);
  const [invoiceDate, setInvoiceDate] = useState(todayStr);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('');
  const [isDeliveryPaid, setIsDeliveryPaid] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  // ── History States ────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState({ total: 0, paid: 0, issued: 0, revenue: 0 });

  // ── Preview Modal State ───────────────────────────────────────────────────
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

  // ── Printing State ────────────────────────────────────────────────────────
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState('Printing receipt...');
  const [printerSelectionModal, setPrinterSelectionModal] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<PrinterDevice[]>([]);
  const [scanningPrinters, setScanningPrinters] = useState(false);
  const [pendingPrintInvoice, setPendingPrintInvoice] = useState<{ inv: Invoice; size: PaperSize } | null>(null);

  // Load shop & plan on mount
  useEffect(() => {
    (async () => {
      try {
        const shopRes: any = await authedGet('/shop');
        const userShops = shopRes?.ownedShops || [];
        if (userShops.length > 0) {
          setShop(userShops[0]);
        }
      } catch {
        // Fallback
      }

      try {
        const subRes: any = await authedGet('/subscription/my');
        setUserPlan(subRes?.subscription?.planId);
      } catch {
        // Fallback
      }
    })();
  }, []);

  // Concurrency guard refs to prevent infinite loop or duplicate requests
  const isFetchingHistoryRef = useRef(false);
  const isFetchingProductsRef = useRef(false);

  // Load products for shop
  const loadProducts = useCallback(async () => {
    const shopId = shop?._id;
    if (!shopId || isFetchingProductsRef.current) return;
    isFetchingProductsRef.current = true;
    try {
      let combined: ProductItem[] = [];
      try {
        const res: any = await authedGet(`/product/all?shopId=${shopId}`);
        const list = res?.products || res?.data || (Array.isArray(res) ? res : []);
        combined = [...list];
      } catch {}

      try {
        const demoRes: any = await authedGet('/product/all?demoOnly=true');
        const demoList = demoRes?.products || demoRes?.data || (Array.isArray(demoRes) ? demoRes : []);
        const existingIds = new Set(combined.map((p) => p._id));
        for (const item of demoList) {
          if (!existingIds.has(item._id)) {
            combined.push(item);
          }
        }
      } catch {}

      setProducts(combined);
    } catch {
      // Products fetch fallback
    } finally {
      isFetchingProductsRef.current = false;
    }
  }, [shop?._id]);

  useEffect(() => {
    if (shop?._id) {
      loadProducts();
    }
  }, [shop?._id, loadProducts]);

  // Load invoices history
  const loadHistory = useCallback(
    async (force = false) => {
      const shopId = shop?._id;
      if (!shopId || (!force && isFetchingHistoryRef.current)) return;
      isFetchingHistoryRef.current = true;
      setLoadingHistory(true);
      try {
        const endpoint = `/invoice/shop/${shopId}`;
        const res: any = await authedGet(endpoint);
        const list = res?.invoices || [];
        setInvoices(list);

        // Check cache metadata
        const cached = await getFromCache(endpoint);
        if (cached?.savedAt) {
          setLastUpdated(formatSavedAt(cached.savedAt));
        }

        // Load stats
        try {
          const statsRes: any = await authedGet(`/invoice/shop/${shopId}/stats`);
          if (statsRes?.stats) {
            setStats(statsRes.stats);
          }
        } catch {}
      } catch (err: any) {
        showToast(err.message ?? 'Failed to load invoices', 'error');
      } finally {
        setLoadingHistory(false);
        setRefreshingHistory(false);
        isFetchingHistoryRef.current = false;
      }
    },
    [shop?._id, showToast]
  );

  useEffect(() => {
    if (activeTab === 'history' && shop?._id) {
      loadHistory();
    }
  }, [activeTab, shop?._id, loadHistory]);

  // Calculations for create invoice
  const subtotal = useMemo(() => {
    return cart.reduce((acc, it) => acc + it.price * it.quantity, 0);
  }, [cart]);

  const numDiscount = Number(discountValue) || 0;
  const discountAmount = useMemo(() => {
    if (discountType === 'percentage') {
      return (subtotal * numDiscount) / 100;
    }
    return numDiscount;
  }, [subtotal, discountType, numDiscount]);

  const numDelivery = Number(deliveryCharge) || 0;
  const numAdvance = Number(advanceAmount) || 0;
  const effectiveDelivery = isDeliveryPaid ? 0 : numDelivery;
  const grandTotal = Math.max(0, subtotal - discountAmount + effectiveDelivery - numAdvance);

  // Cart operations
  function addToCart(p: ProductItem) {
    const newItem: CartItem = {
      cartItemId: Math.random().toString(36).substring(2, 9),
      productId: p._id,
      name: p.name,
      price: p.price,
      quantity: 1,
      variety: '',
    };
    setCart((prev) => [...prev, newItem]);
    setSearchProductQuery('');
  }

  function updateQuantity(cartItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const newQ = item.quantity + delta;
            return newQ > 0 ? { ...item, quantity: newQ } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  }

  function updateVariety(cartItemId: string, val: string) {
    setCart((prev) =>
      prev.map((item) => (item.cartItemId === cartItemId ? { ...item, variety: val } : item))
    );
  }

  function resetCreateForm() {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setCustomerAddress('');
    setInvoiceDate(todayStr);
    setCart([]);
    setDiscountValue('');
    setDeliveryCharge('');
    setIsDeliveryPaid(false);
    setAdvanceAmount('');
    setNotes('');
  }

  async function handleSaveInvoice(triggerPrint = false) {
    if (!isOnline) {
      showToast('Internet required to create invoice', 'warning');
      return;
    }
    if (!shop?._id) {
      showToast('No active shop found. Please complete shop setup.', 'error');
      return;
    }
    if (cart.length === 0) {
      showToast('Please add at least one item to the invoice', 'error');
      return;
    }

    setSubmittingInvoice(true);
    try {
      const itemsPayload = cart.map((c) => {
        let name = c.name;
        if (c.variety.trim()) {
          name += ` (${c.variety.trim()})`;
        }
        return {
          name,
          quantity: c.quantity,
          unitPrice: c.price,
        };
      });

      const payload = {
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        items: itemsPayload,
        discountType,
        discount: numDiscount,
        deliveryCharge: numDelivery,
        isDeliveryPaid,
        advanceAmount: numAdvance,
        notes: notes.trim() || undefined,
        status: triggerPrint ? 'printed' : 'issued',
        date: invoiceDate,
      };

      const res: any = await authedPost('/invoice', `/shop/${shop._id}`, payload);
      const created = res.invoice;

      showToast(`Invoice #${created.invoiceNumber} created!`, 'success');
      resetCreateForm();

      if (triggerPrint) {
        promptPrintOptions(created);
      }

      // Switch to history
      setActiveTab('history');
      loadHistory();
    } catch (err: any) {
      showToast(err.message ?? 'Failed to create invoice', 'error');
    } finally {
      setSubmittingInvoice(false);
    }
  }

  function buildReceiptData(inv: Invoice): ReceiptData {
    return {
      shopName: shop?.name || 'Memo Book',
      shopAddress: shop?.address?.address_line1 || 'Dhaka, Bangladesh',
      shopPhone: shop?.contactNumber || '',
      fbLink: shop?.socialLinks?.facebook,
      igLink: shop?.socialLinks?.instagram,
      invoiceNumber: inv.invoiceNumber,
      date: new Date(inv.createdAt).toLocaleDateString(),
      customerName: inv.customerName,
      customerPhone: inv.customerPhone,
      customerEmail: inv.customerEmail,
      customerAddress: inv.customerAddress,
      items: inv.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      subtotal: inv.subtotal,
      discount: inv.discountAmount ?? inv.discount,
      advanceAmount: inv.advanceAmount,
      deliveryCharge: inv.deliveryCharge,
      isDeliveryPaid: inv.isDeliveryPaid,
      grandTotal: inv.grandTotal,
      notes: inv.notes,
    };
  }

  async function handlePrintOrShare(
    inv: Invoice,
    action: 'bluetooth' | 'system' | 'share',
    size: PaperSize = paperSize,
    targetPrinterAddress?: string
  ) {
    // Check Free Plan limit
    const exportPdfAllowed = userPlan?.features?.exportPdf !== false;
    if (userPlan?.name?.toLowerCase().includes('free') && !exportPdfAllowed) {
      Alert.alert(
        'Upgrade Required',
        'PDF Export and Thermal Printing is locked on the Free Plan. Please upgrade your subscription from the Buy Plan tab.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsPrinting(true);
    setPrintStatus(
      action === 'bluetooth'
        ? 'Connecting to Bluetooth POS...'
        : action === 'system'
        ? 'Opening System Print...'
        : 'Generating PDF...'
    );

    try {
      const data = buildReceiptData(inv);
      if (action === 'bluetooth') {
        await printViaBluetoothPos(data, size, (status) => setPrintStatus(status), targetPrinterAddress);
      } else if (action === 'system') {
        await printReceipt(data, size);
      } else {
        await shareReceiptPdf(data, size);
      }

      // Mark as printed if not already
      if (inv.status !== 'printed' && isOnline && shop?._id) {
        try {
          await authedPatch('/invoice', `/shop/${shop._id}/${inv._id}`, { status: 'printed' });
          setInvoices((prev) =>
            prev.map((i) => (i._id === inv._id ? { ...i, status: 'printed' } : i))
          );
        } catch {}
      }
    } catch (err: any) {
      showToast(err.message ?? 'Failed to print/export receipt', 'error');
    } finally {
      setIsPrinting(false);
    }
  }

  async function startBluetoothPrintFlow(inv: Invoice, size: PaperSize) {
    try {
      // Check if we have multiple paired devices or if user wants to select
      setScanningPrinters(true);
      const { paired, found } = await scanPrinters(1200);
      const devices = [...paired, ...found];
      
      // Deduplicate devices by address
      const uniqueDevices: PrinterDevice[] = [];
      const seen = new Set<string>();
      for (const d of devices) {
        if (!seen.has(d.address)) {
          seen.add(d.address);
          uniqueDevices.push(d);
        }
      }

      if (uniqueDevices.length > 1) {
        // Multiple printers found! Open picker modal so user can choose which printer
        setAvailablePrinters(uniqueDevices);
        setPendingPrintInvoice({ inv, size });
        setPrinterSelectionModal(true);
      } else if (uniqueDevices.length === 1) {
        // Only 1 printer found, print immediately
        await setActivePrinter(uniqueDevices[0].address, uniqueDevices[0].name);
        await handlePrintOrShare(inv, 'bluetooth', size, uniqueDevices[0].address);
      } else {
        // Fallback to standard print which handles NO_PRINTER_PAIRED error gracefully
        await handlePrintOrShare(inv, 'bluetooth', size);
      }
    } catch (err: any) {
      // Fallback
      await handlePrintOrShare(inv, 'bluetooth', size);
    } finally {
      setScanningPrinters(false);
    }
  }

  function promptPrintOptions(inv: Invoice) {
    Alert.alert(
      `Print Invoice #${inv.invoiceNumber}`,
      'Select thermal printing method for your Bluetooth POS machine or printer:',
      [
        {
          text: '🖨️ Bluetooth POS (58mm Roll)',
          onPress: () => startBluetoothPrintFlow(inv, '58mm'),
        },
        {
          text: '🖨️ Bluetooth POS (80mm Roll)',
          onPress: () => startBluetoothPrintFlow(inv, '80mm'),
        },
        {
          text: '📄 Android System Spooler',
          onPress: () => handlePrintOrShare(inv, 'system', paperSize),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  async function handleMarkPaid(inv: Invoice) {
    if (!isOnline) {
      showToast('Internet required to update invoice status', 'warning');
      return;
    }
    if (!shop?._id) return;

    try {
      await authedPatch('/invoice', `/shop/${shop._id}/${inv._id}`, { status: 'paid' });
      showToast(`Invoice #${inv.invoiceNumber} marked as Paid!`, 'success');
      setInvoices((prev) =>
        prev.map((i) => (i._id === inv._id ? { ...i, status: 'paid' } : i))
      );
    } catch (err: any) {
      showToast(err.message ?? 'Failed to update status', 'error');
    }
  }

  function confirmDelete(inv: Invoice) {
    if (!isOnline) {
      showToast('Internet required to delete invoice', 'warning');
      return;
    }
    Alert.alert(
      'Delete Invoice',
      `Are you sure you want to delete invoice #${inv.invoiceNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!shop?._id) return;
            try {
              await authedDelete('/invoice', `/shop/${shop._id}/${inv._id}`);
              showToast('Invoice deleted', 'success');
              setInvoices((prev) => prev.filter((i) => i._id !== inv._id));
            } catch (err: any) {
              showToast(err.message ?? 'Failed to delete invoice', 'error');
            }
          },
        },
      ]
    );
  }

  // Filtered invoices in History
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchSearch =
        !historySearch ||
        inv.invoiceNumber.toLowerCase().includes(historySearch.toLowerCase()) ||
        (inv.customerName && inv.customerName.toLowerCase().includes(historySearch.toLowerCase())) ||
        (inv.customerPhone && inv.customerPhone.includes(historySearch));

      const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, historySearch, statusFilter]);

  // Filtered products for search dropdown in Create tab
  const matchingProducts = useMemo(() => {
    if (!searchProductQuery.trim()) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(searchProductQuery.toLowerCase()))
      .slice(0, 6);
  }, [products, searchProductQuery]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <OfflineBanner />
      <Toast {...toast} onHide={hideToast} />

      {/* Header */}
      <Header title="Invoices" />

      {/* Segmented Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'create' && styles.tabButtonActive]}
          onPress={() => setActiveTab('create')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color={activeTab === 'create' ? colors.white : colors.dsOutline}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'create' && styles.tabButtonTextActive]}
          >
            Create Invoice
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
          onPress={() => setActiveTab('history')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="list-outline"
            size={18}
            color={activeTab === 'history' ? colors.white : colors.dsOutline}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'history' && styles.tabButtonTextActive]}
          >
            Invoice History ({invoices.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: CREATE INVOICE                                                   */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'create' ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Customer Details Card */}
            <Card style={styles.cardSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="person-circle-outline" size={20} color={colors.dsPrimary} />
                <Text style={styles.sectionTitle}>Customer Information</Text>
              </View>

              <Input
                label="Customer Name"
                placeholder="e.g. Rahim Ahmed"
                value={customerName}
                onChangeText={setCustomerName}
              />
              <Input
                label="Phone Number"
                placeholder="e.g. 01700000000"
                keyboardType="phone-pad"
                value={customerPhone}
                onChangeText={setCustomerPhone}
              />
              <Input
                label="Delivery Address"
                placeholder="e.g. House 12, Road 4, Dhanmondi, Dhaka"
                multiline
                numberOfLines={2}
                value={customerAddress}
                onChangeText={setCustomerAddress}
              />
              <Input
                label="Invoice Date (YYYY-MM-DD)"
                value={invoiceDate}
                onChangeText={setInvoiceDate}
              />
            </Card>

            {/* Product Search & Add */}
            <Card style={styles.cardSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="cube-outline" size={20} color={colors.dsPrimary} />
                <Text style={styles.sectionTitle}>Add Products</Text>
              </View>

              <Input
                placeholder="Search products by name..."
                value={searchProductQuery}
                onChangeText={setSearchProductQuery}
                leftIcon="search-outline"
              />

              {matchingProducts.length > 0 && (
                <View style={styles.searchDropdown}>
                  {matchingProducts.map((p) => (
                    <TouchableOpacity
                      key={p._id}
                      style={styles.searchResultItem}
                      onPress={() => addToCart(p)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.productResultName}>{p.name}</Text>
                        <Text style={styles.productResultPrice}>৳{p.price.toFixed(2)}</Text>
                      </View>
                      <View style={styles.addBtnCircle}>
                        <Ionicons name="add" size={18} color={colors.white} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Card>

            {/* Cart Items Table */}
            <Card style={styles.cardSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="cart-outline" size={20} color={colors.dsPrimary} />
                <Text style={styles.sectionTitle}>Invoice Items ({cart.length})</Text>
              </View>

              {cart.length === 0 ? (
                <View style={styles.emptyCartBox}>
                  <Ionicons name="receipt-outline" size={36} color={colors.dsOutline} />
                  <Text style={styles.emptyCartText}>No products added to invoice yet</Text>
                  <Text style={styles.emptyCartSub}>Search and add items from above</Text>
                </View>
              ) : (
                <View style={styles.cartList}>
                  {cart.map((item) => (
                    <View key={item.cartItemId} style={styles.cartItemRow}>
                      <View style={{ flex: 1, paddingRight: spacing.sm }}>
                        <Text style={styles.cartItemName}>{item.name}</Text>
                        <TextInput
                          style={styles.varietyInput}
                          placeholder="+ Add variant / note (bold red label)"
                          placeholderTextColor={colors.dsOutline}
                          value={item.variety}
                          onChangeText={(v) => updateVariety(item.cartItemId, v)}
                        />
                        <Text style={styles.cartItemRate}>৳{item.price.toFixed(2)} / unit</Text>
                      </View>

                      {/* Qty Stepper */}
                      <View style={styles.stepperWrap}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => updateQuantity(item.cartItemId, -1)}
                        >
                          <Ionicons
                            name={item.quantity > 1 ? 'remove' : 'trash-outline'}
                            size={16}
                            color={item.quantity > 1 ? colors.dsOnSurface : colors.dsError}
                          />
                        </TouchableOpacity>
                        <Text style={styles.stepQty}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => updateQuantity(item.cartItemId, 1)}
                        >
                          <Ionicons name="add" size={16} color={colors.dsOnSurface} />
                        </TouchableOpacity>
                      </View>

                      {/* Line Total */}
                      <Text style={styles.cartLineTotal}>
                        ৳{(item.price * item.quantity).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* Calculations & Adjustments */}
            <Card style={styles.cardSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calculator-outline" size={20} color={colors.dsPrimary} />
                <Text style={styles.sectionTitle}>Bill Breakdown</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>৳{subtotal.toFixed(2)}</Text>
              </View>

              {/* Discount Row */}
              <View style={styles.adjustmentRow}>
                <Text style={styles.adjustLabel}>Discount</Text>
                <View style={styles.discountControls}>
                  <View style={styles.discountTypeToggle}>
                    <TouchableOpacity
                      style={[styles.togglePill, discountType === 'flat' && styles.togglePillActive]}
                      onPress={() => setDiscountType('flat')}
                    >
                      <Text
                        style={[
                          styles.togglePillText,
                          discountType === 'flat' && styles.togglePillTextActive,
                        ]}
                      >
                        ৳ Flat
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.togglePill,
                        discountType === 'percentage' && styles.togglePillActive,
                      ]}
                      onPress={() => setDiscountType('percentage')}
                    >
                      <Text
                        style={[
                          styles.togglePillText,
                          discountType === 'percentage' && styles.togglePillTextActive,
                        ]}
                      >
                        %
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.miniInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={discountValue}
                    onChangeText={setDiscountValue}
                  />
                </View>
              </View>

              {/* Delivery Charge */}
              <View style={styles.adjustmentRow}>
                <Text style={styles.adjustLabel}>Delivery Charge</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.checkPaidBtn, isDeliveryPaid && styles.checkPaidBtnActive]}
                    onPress={() => setIsDeliveryPaid(!isDeliveryPaid)}
                  >
                    <Ionicons
                      name={isDeliveryPaid ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={isDeliveryPaid ? colors.dsPrimary : colors.dsOutline}
                    />
                    <Text
                      style={[
                        styles.checkPaidText,
                        isDeliveryPaid && { color: colors.dsPrimary, fontWeight: '700' },
                      ]}
                    >
                      Paid
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.miniInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={deliveryCharge}
                    onChangeText={setDeliveryCharge}
                  />
                </View>
              </View>

              {/* Advance Payment */}
              <View style={styles.adjustmentRow}>
                <Text style={styles.adjustLabel}>Advance Paid</Text>
                <TextInput
                  style={styles.miniInput}
                  placeholder="0"
                  keyboardType="numeric"
                  value={advanceAmount}
                  onChangeText={setAdvanceAmount}
                />
              </View>

              {/* Notes field */}
              <Input
                label="Invoice Notes (appears above footer)"
                placeholder="e.g. Fragile parcel, delivery before 5 PM"
                value={notes}
                onChangeText={setNotes}
              />

              {/* Grand Total Bar */}
              <View style={styles.grandTotalBanner}>
                <Text style={styles.grandTotalLabel}>Grand Total</Text>
                <Text style={styles.grandTotalAmount}>৳{grandTotal.toFixed(2)}</Text>
              </View>
            </Card>

            {/* Action Buttons */}
            <View style={styles.btnRow}>
              <Button
                title={submittingInvoice ? 'Saving...' : 'Save Invoice'}
                onPress={() => handleSaveInvoice(false)}
                disabled={submittingInvoice || !isOnline}
                style={{ flex: 1 }}
              />
              <Button
                title="Save & Print"
                variant="outline"
                leftIcon="print-outline"
                onPress={() => handleSaveInvoice(true)}
                disabled={submittingInvoice || !isOnline}
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        /* ──────────────────────────────────────────────────────────────────────── */
        /* TAB 2: INVOICE HISTORY                                                  */
        /* ──────────────────────────────────────────────────────────────────────── */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshingHistory}
              onRefresh={() => {
                if (isOnline) {
                  setRefreshingHistory(true);
                  loadHistory(true);
                } else {
                  showToast('Pull-to-refresh disabled while offline', 'info');
                }
              }}
            />
          }
        >
          {/* Stats Bar */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.dsPrimary }]}>{stats.issued}</Text>
              <Text style={styles.statLabel}>Issued</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: '#16a34a' }]}>{stats.paid}</Text>
              <Text style={styles.statLabel}>Paid</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.dsSecondary }]}>
                ৳{stats.revenue.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Revenue</Text>
            </View>
          </View>

          {/* Search & Filters */}
          <Input
            placeholder="Search invoice number or customer..."
            value={historySearch}
            onChangeText={setHistorySearch}
            leftIcon="search-outline"
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {['all', 'issued', 'paid', 'printed', 'draft'].map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.statusChip, statusFilter === s && styles.statusChipActive]}
                onPress={() => setStatusFilter(s)}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    statusFilter === s && styles.statusChipTextActive,
                  ]}
                >
                  {s.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Offline cache timestamp indicator */}
          {!isOnline && lastUpdated ? (
            <View style={styles.cacheIndicator}>
              <Ionicons name="time-outline" size={14} color={colors.dsOutline} />
              <Text style={styles.cacheText}>Last updated: {lastUpdated}</Text>
            </View>
          ) : null}

          {/* Loading or Invoices List */}
          {loadingHistory && !refreshingHistory ? (
            <ActivityIndicator size="large" color={colors.dsPrimary} style={{ marginVertical: 32 }} />
          ) : filteredInvoices.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="documents-outline" size={48} color={colors.dsOutline} />
              <Text style={styles.emptyHistoryTitle}>No invoices found</Text>
              <Text style={styles.emptyHistorySub}>
                {historySearch ? 'Try a different search query' : 'Create your first invoice above'}
              </Text>
            </View>
          ) : (
            filteredInvoices.map((inv) => (
              <Card key={inv._id} style={styles.invoiceCard}>
                <View style={styles.invCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invNumber}>#{inv.invoiceNumber}</Text>
                    <Text style={styles.invDate}>
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Badge
                    label={inv.status.toUpperCase()}
                    variant={
                      inv.status === 'paid'
                        ? 'success'
                        : inv.status === 'printed'
                        ? 'neutral'
                        : inv.status === 'issued'
                        ? 'primary'
                        : 'error'
                    }
                  />
                </View>

                {inv.customerName || inv.customerPhone ? (
                  <View style={styles.invCustomerInfo}>
                    <Ionicons name="person-outline" size={14} color={colors.dsOutline} />
                    <Text style={styles.invCustomerText}>
                      {inv.customerName || 'Customer'}
                      {inv.customerPhone ? ` • ${inv.customerPhone}` : ''}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.invItemsPreview}>
                  <Text style={styles.invItemsCount}>{inv.items?.length ?? 0} item(s)</Text>
                  <Text style={styles.invTotalAmount}>৳{inv.grandTotal.toFixed(2)}</Text>
                </View>

                {/* Card Action Buttons */}
                <View style={styles.invActionsRow}>
                  <TouchableOpacity
                    style={styles.actionBtnPill}
                    onPress={() => {
                      setPreviewInvoice(inv);
                      setPreviewModalVisible(true);
                    }}
                  >
                    <Ionicons name="eye-outline" size={16} color={colors.dsPrimary} />
                    <Text style={styles.actionBtnPillText}>Preview</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionBtnPill,
                      { borderColor: colors.dsPrimary, backgroundColor: '#E0F2FE' },
                    ]}
                    onPress={() => promptPrintOptions(inv)}
                  >
                    <Ionicons name="print-outline" size={16} color={colors.dsPrimary} />
                    <Text style={[styles.actionBtnPillText, { color: colors.dsPrimary, fontWeight: '700' }]}>
                      Print
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnPill}
                    onPress={() => handlePrintOrShare(inv, 'share')}
                  >
                    <Ionicons name="share-social-outline" size={16} color={colors.dsOutline} />
                    <Text style={styles.actionBtnPillText}>Share</Text>
                  </TouchableOpacity>

                  {inv.status !== 'paid' && isOnline ? (
                    <TouchableOpacity
                      style={[styles.actionBtnPill, { borderColor: '#16a34a' }]}
                      onPress={() => handleMarkPaid(inv)}
                    >
                      <Ionicons name="checkmark-done" size={16} color="#16a34a" />
                      <Text style={[styles.actionBtnPillText, { color: '#16a34a' }]}>Mark Paid</Text>
                    </TouchableOpacity>
                  ) : null}

                  {isOnline ? (
                    <TouchableOpacity
                      style={[styles.actionBtnPill, { borderColor: colors.dsError }]}
                      onPress={() => confirmDelete(inv)}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.dsError} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* INVOICE PREVIEW MODAL                                                    */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <Modal
        visible={previewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receipt Preview</Text>
              <TouchableOpacity onPress={() => setPreviewModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.dsOnSurface} />
              </TouchableOpacity>
            </View>

            {/* Thermal Roll Selector */}
            <View style={styles.paperSelectorRow}>
              <Text style={styles.paperSelectorLabel}>Roll Size:</Text>
              <TouchableOpacity
                style={[styles.paperChip, paperSize === '58mm' && styles.paperChipActive]}
                onPress={() => setPaperSize('58mm')}
              >
                <Text
                  style={[
                    styles.paperChipText,
                    paperSize === '58mm' && styles.paperChipTextActive,
                  ]}
                >
                  58mm (Standard POS)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paperChip, paperSize === '80mm' && styles.paperChipActive]}
                onPress={() => setPaperSize('80mm')}
              >
                <Text
                  style={[
                    styles.paperChipText,
                    paperSize === '80mm' && styles.paperChipTextActive,
                  ]}
                >
                  80mm (Wide POS)
                </Text>
              </TouchableOpacity>
            </View>

            {previewInvoice && (
              <ScrollView style={styles.receiptScroll}>
                {/* Visual POS Receipt Wrapper */}
                <View
                  style={[
                    styles.posReceipt,
                    { maxWidth: paperSize === '58mm' ? 280 : 360, alignSelf: 'center', width: '100%' },
                  ]}
                >
                  {/* Shop Branding Header */}
                  <View style={styles.posHeader}>
                    <Text style={styles.posShopName}>{shop?.name || 'Memo Book'}</Text>
                    {shop?.address?.address_line1 ? (
                      <Text style={styles.posShopAddr}>{shop.address.address_line1}</Text>
                    ) : null}
                    {shop?.contactNumber ? (
                      <Text style={styles.posShopPhone}>Phone: {shop.contactNumber}</Text>
                    ) : null}
                  </View>

                  <View style={styles.posTag}>
                    <Text style={styles.posTagText}>POS INVOICE</Text>
                  </View>

                  {/* Metadata */}
                  <View style={styles.posMeta}>
                    <Text style={styles.posMetaText}>
                      Invoice: {previewInvoice.invoiceNumber}
                    </Text>
                    <Text style={styles.posMetaText}>
                      Date: {new Date(previewInvoice.createdAt).toLocaleDateString()}
                    </Text>
                  </View>

                  {/* Customer details */}
                  {previewInvoice.customerName || previewInvoice.customerPhone ? (
                    <View style={styles.posCustomer}>
                      <Text style={styles.posBilledLabel}>BILLED TO</Text>
                      {previewInvoice.customerName ? (
                        <Text style={styles.posCustomerText}>
                          Name: {previewInvoice.customerName}
                        </Text>
                      ) : null}
                      {previewInvoice.customerPhone ? (
                        <Text style={styles.posCustomerText}>
                          Phone: {previewInvoice.customerPhone}
                        </Text>
                      ) : null}
                      {previewInvoice.customerAddress ? (
                        <Text style={styles.posCustomerText}>
                          Address: {previewInvoice.customerAddress}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Items list */}
                  <View style={styles.posItemsHeader}>
                    <Text style={[styles.posColHead, { flex: 1 }]}>Item</Text>
                    <Text style={[styles.posColHead, { width: 36, textAlign: 'center' }]}>
                      Qty
                    </Text>
                    <Text style={[styles.posColHead, { width: 60, textAlign: 'right' }]}>
                      Rate
                    </Text>
                    <Text style={[styles.posColHead, { width: 70, textAlign: 'right' }]}>
                      Total
                    </Text>
                  </View>

                  {previewInvoice.items?.map((it, idx) => (
                    <View key={idx} style={styles.posItemRow}>
                      <Text style={[styles.posItemText, { flex: 1 }]}>{it.name}</Text>
                      <Text style={[styles.posItemText, { width: 36, textAlign: 'center' }]}>
                        {it.quantity}
                      </Text>
                      <Text style={[styles.posItemText, { width: 60, textAlign: 'right' }]}>
                        ৳{it.unitPrice.toFixed(2)}
                      </Text>
                      <Text
                        style={[
                          styles.posItemText,
                          { width: 70, textAlign: 'right', fontWeight: '700' },
                        ]}
                      >
                        ৳{(it.quantity * it.unitPrice).toFixed(2)}
                      </Text>
                    </View>
                  ))}

                  {/* Breakdown */}
                  <View style={styles.posBreakdown}>
                    <View style={styles.posRow}>
                      <Text style={styles.posRowLabel}>Subtotal</Text>
                      <Text style={styles.posRowVal}>৳{previewInvoice.subtotal.toFixed(2)}</Text>
                    </View>

                    {previewInvoice.discountAmount && previewInvoice.discountAmount > 0 ? (
                      <View style={styles.posRow}>
                        <Text style={[styles.posRowLabel, { color: colors.dsError }]}>
                          Discount
                        </Text>
                        <Text style={[styles.posRowVal, { color: colors.dsError }]}>
                          -৳{previewInvoice.discountAmount.toFixed(2)}
                        </Text>
                      </View>
                    ) : null}

                    {previewInvoice.deliveryCharge ? (
                      <View style={styles.posRow}>
                        <Text style={styles.posRowLabel}>Delivery Charge</Text>
                        <Text style={styles.posRowVal}>
                          {previewInvoice.isDeliveryPaid
                            ? 'PAID'
                            : `+৳${previewInvoice.deliveryCharge.toFixed(2)}`}
                        </Text>
                      </View>
                    ) : null}

                    {previewInvoice.advanceAmount && previewInvoice.advanceAmount > 0 ? (
                      <View style={styles.posRow}>
                        <Text style={styles.posRowLabel}>Advance Payment</Text>
                        <Text style={styles.posRowVal}>
                          -৳{previewInvoice.advanceAmount.toFixed(2)}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.posGrandTotal}>
                      <Text style={styles.posGrandLabel}>Grand Total</Text>
                      <Text style={styles.posGrandAmount}>
                        ৳{previewInvoice.grandTotal.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {previewInvoice.notes ? (
                    <Text style={styles.posNote}>Note: {previewInvoice.notes}</Text>
                  ) : null}

                  <Text style={styles.posFooter}>Thank you for your purchase!</Text>
                </View>
              </ScrollView>
            )}

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Button
                title={`Bluetooth POS (${paperSize})`}
                leftIcon="bluetooth-outline"
                style={{ flex: 1.3 }}
                onPress={() =>
                  previewInvoice && startBluetoothPrintFlow(previewInvoice, paperSize)
                }
              />
              <Button
                title="System Print"
                variant="outline"
                leftIcon="print-outline"
                style={{ flex: 1 }}
                onPress={() => previewInvoice && handlePrintOrShare(previewInvoice, 'system', paperSize)}
              />
              <Button
                title="PDF"
                variant="outline"
                leftIcon="share-social-outline"
                style={{ flex: 0.6 }}
                onPress={() => previewInvoice && handlePrintOrShare(previewInvoice, 'share', paperSize)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Printing Loading Overlay Modal */}
      <Modal visible={isPrinting} transparent animationType="fade">
        <View style={styles.printLoadingOverlay}>
          <View style={styles.printLoadingCard}>
            <ActivityIndicator size="large" color={colors.dsPrimary} />
            <Text style={styles.printLoadingTitle}>Printing in progress</Text>
            <Text style={styles.printLoadingSub}>{printStatus}</Text>
          </View>
        </View>
      </Modal>

      {/* Select POS Printer Modal (when multiple Bluetooth devices found) */}
      <Modal
        visible={printerSelectionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setPrinterSelectionModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.printerModalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Choose POS Printer</Text>
                <Text style={styles.printerModalSub}>Multiple Bluetooth printers found. Select one to print:</Text>
              </View>
              <TouchableOpacity
                onPress={() => setPrinterSelectionModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.dsOutline} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300, marginVertical: spacing.sm }}>
              {availablePrinters.map((printer, idx) => (
                <TouchableOpacity
                  key={printer.address || idx}
                  style={styles.printerOptionItem}
                  onPress={async () => {
                    setPrinterSelectionModal(false);
                    if (pendingPrintInvoice) {
                      await setActivePrinter(printer.address, printer.name);
                      await handlePrintOrShare(
                        pendingPrintInvoice.inv,
                        'bluetooth',
                        pendingPrintInvoice.size,
                        printer.address
                      );
                    }
                  }}
                >
                  <View style={styles.printerIconCircle}>
                    <Ionicons name="print-outline" size={20} color={colors.dsPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.printerItemName}>{printer.name || 'Unknown POS Printer'}</Text>
                    <Text style={styles.printerItemAddr}>{printer.address}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.dsOutline} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Button
              title="Cancel"
              variant="outline"
              fullWidth
              onPress={() => setPrinterSelectionModal(false)}
            />
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
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: '#F1F5F9',
  },
  tabButtonActive: {
    backgroundColor: colors.dsPrimary,
  },
  tabButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.sm,
    color: colors.dsOutline,
  },
  tabButtonTextActive: {
    fontFamily: 'Inter-Bold',
    color: colors.white,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 48,
    gap: spacing.md,
  },
  cardSection: {
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
  searchDropdown: {
    backgroundColor: colors.dsSurfaceContainerLowest,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.dsOutlineVariant,
  },
  productResultName: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurface,
  },
  productResultPrice: {
    fontFamily: 'Inter-SemiBold',
    fontSize: fontSizes.xs,
    color: colors.dsPrimary,
    marginTop: 2,
  },
  addBtnCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.dsPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCartBox: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  emptyCartText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurface,
  },
  emptyCartSub: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
  },
  cartList: {
    gap: spacing.sm,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.dsOutlineVariant,
  },
  cartItemName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurface,
  },
  varietyInput: {
    fontFamily: 'Inter-SemiBold',
    fontSize: fontSizes.xs,
    color: '#ba1a1a', // bold red variety label
    paddingVertical: 2,
  },
  cartItemRate: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dsSurfaceContainerLowest,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
  },
  stepBtn: {
    padding: 6,
  },
  stepQty: {
    fontFamily: 'Inter-SemiBold',
    fontSize: fontSizes.xs,
    paddingHorizontal: 8,
  },
  cartLineTotal: {
    width: 72,
    textAlign: 'right',
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurface,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.sm,
    color: colors.dsOutline,
  },
  summaryValue: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurface,
  },
  adjustmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  adjustLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurface,
  },
  discountControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discountTypeToggle: {
    flexDirection: 'row',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
    overflow: 'hidden',
  },
  togglePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.dsSurfaceContainerLowest,
  },
  togglePillActive: {
    backgroundColor: colors.dsPrimary,
  },
  togglePillText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: colors.dsOutline,
  },
  togglePillTextActive: {
    color: colors.white,
    fontFamily: 'Inter-Bold',
  },
  miniInput: {
    width: 76,
    height: 36,
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.sm,
    textAlign: 'right',
    backgroundColor: colors.white,
  },
  checkPaidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
  },
  checkPaidBtnActive: {
    borderColor: colors.dsPrimary,
    backgroundColor: colors.dsPrimaryContainer,
  },
  checkPaidText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: colors.dsOutline,
  },
  grandTotalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.dsPrimaryContainer,
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  grandTotalLabel: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.md,
    color: colors.dsOnPrimaryContainer,
  },
  grandTotalAmount: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: fontSizes.xl,
    color: colors.dsOnPrimaryContainer,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
    alignItems: 'center',
  },
  statNum: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: fontSizes.md,
    color: colors.dsOnSurface,
  },
  statLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: colors.dsOutline,
    marginTop: 2,
    textTransform: 'uppercase',
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
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: spacing.xs,
  },
  emptyHistoryTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.md,
    color: colors.dsOnSurface,
  },
  emptyHistorySub: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
  },
  invoiceCard: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  invCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invNumber: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.md,
    color: colors.dsOnSurface,
  },
  invDate: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
    marginTop: 1,
  },
  invCustomerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  invCustomerText: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.xs,
    color: colors.dsOnSurfaceVariant,
  },
  invItemsPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.dsOutlineVariant,
    marginVertical: 4,
  },
  invItemsCount: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
  },
  invTotalAmount: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.md,
    color: colors.dsPrimary,
  },
  invActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  actionBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
    backgroundColor: colors.dsSurfaceContainerLowest,
  },
  actionBtnPillText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: colors.dsPrimary,
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
    maxHeight: '90%',
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
    fontSize: fontSizes.lg,
    color: colors.dsOnSurface,
  },
  paperSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    marginTop: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: radii.md,
  },
  paperSelectorLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: colors.dsOnSurface,
  },
  paperChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
  },
  paperChipActive: {
    backgroundColor: colors.dsPrimary,
    borderColor: colors.dsPrimary,
  },
  paperChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: colors.dsOnSurface,
  },
  paperChipTextActive: {
    fontFamily: 'Inter-Bold',
    color: colors.white,
  },
  receiptScroll: {
    maxHeight: 460,
    marginVertical: spacing.sm,
  },
  posReceipt: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  posHeader: {
    backgroundColor: colors.white,
    padding: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderStyle: 'dashed',
  },
  posShopName: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.md,
    color: '#000000',
    letterSpacing: 0.5,
  },
  posShopAddr: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: '#333333',
    marginTop: 2,
  },
  posShopPhone: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: '#333333',
    marginTop: 2,
  },
  posTag: {
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderStyle: 'dashed',
  },
  posTagText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#000',
  },
  posMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderStyle: 'dashed',
  },
  posMetaText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: '#000',
  },
  posCustomer: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderStyle: 'dashed',
  },
  posBilledLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: '#555',
    marginBottom: 2,
  },
  posCustomerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: '#000',
  },
  posItemsHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderStyle: 'dashed',
  },
  posColHead: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#000',
  },
  posItemRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  posItemText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: '#000',
  },
  posBreakdown: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#000',
    borderStyle: 'dashed',
  },
  posRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  posRowLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: '#000',
  },
  posRowVal: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: '#000',
  },
  posGrandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: '#000',
    borderStyle: 'dashed',
    marginTop: 6,
    backgroundColor: '#f8fafc',
  },
  posGrandLabel: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.sm,
    color: '#000',
  },
  posGrandAmount: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: fontSizes.md,
    color: '#000',
  },
  posNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 6,
    color: '#555',
  },
  posFooter: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    textAlign: 'center',
    padding: 8,
    color: '#666',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  printLoadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  printLoadingCard: {
    backgroundColor: colors.white,
    paddingVertical: 24,
    paddingHorizontal: 28,
    borderRadius: radii.xl,
    alignItems: 'center',
    minWidth: 230,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  printLoadingTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.md,
    color: colors.dsOnSurface,
    marginTop: 14,
  },
  printLoadingSub: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
    marginTop: 6,
    textAlign: 'center',
  },
  printerModalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '80%',
    padding: spacing.md,
  },
  printerModalSub: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
    marginTop: 2,
  },
  printerOptionItem: {
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
  printerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  printerItemName: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.sm,
    color: colors.dsOnSurface,
  },
  printerItemAddr: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.xs,
    color: colors.dsOutline,
    marginTop: 1,
  },
});
