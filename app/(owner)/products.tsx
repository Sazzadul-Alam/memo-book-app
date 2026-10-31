import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Header } from '../../src/components/Header';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Modal } from '../../src/components/Modal';
import { Toast, useToast } from '../../src/components/Toast';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { colors, fontSizes, radii, spacing, shadows } from '../../src/theme/tokens';
import { authedGet, authedPost, authedPut, authedDelete, authedFormPost } from '../../src/api/client';
import { getFromCache, formatSavedAt } from '../../src/api/cache';
import { useNetwork } from '../../src/utils/useNetwork';

interface ProductVariant {
  name: string;
  value: string;
  price?: number;
}

interface Product {
  _id: string;
  name: string;
  price: number;
  buyingPrice?: number;
  stock: number;
  description?: string;
  isDemo?: boolean;
  images?: { image: string }[];
  varient?: ProductVariant[];
}

interface PlanLimit {
  current: number;
  max: number;
  planName: string;
}

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [planLimit, setPlanLimit] = useState<PlanLimit>({ current: 0, max: 10, planName: 'Free' });
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const { isOnline } = useNetwork();
  const { toast, show: showToast, hide: hideToast } = useToast();

  // Modal State for Add / Edit
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [stock, setStock] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    try {
      // 1. Fetch Products
      const res: any = await authedGet('/product');
      const list = res?.products || res?.data || (Array.isArray(res) ? res : []);
      setProducts(list);

      // Check cache metadata
      const cached = await getFromCache('/product');
      if (cached?.savedAt) {
        setLastUpdated(formatSavedAt(cached.savedAt));
      }

      // 2. Fetch Subscription plan to get max products limit
      try {
        const subRes: any = await authedGet('/subscription/my');
        const plan = subRes?.subscription?.planId;
        const max = plan?.maxProductsPerShop ?? 15;
        const ownCount = list.filter((p: Product) => !p.isDemo).length;
        setPlanLimit({
          current: ownCount,
          max: max,
          planName: plan?.name ?? 'Free Plan',
        });
      } catch {
        // Fallback
      }
    } catch (err: any) {
      showToast(err.message ?? 'Failed to load products', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Image Picker & Compression with expo-image-manipulator
  async function pickAndCompressImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast('Permission to access photos is required', 'warning');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      const manipResult = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      setImageUri(manipResult.uri);
    }
  }

  function openAddModal() {
    if (!isOnline) {
      showToast('Internet required to add products', 'warning');
      return;
    }
    if (planLimit.current >= planLimit.max) {
      Alert.alert(
        'Product Limit Reached',
        `You have reached the maximum of ${planLimit.max} products on your ${planLimit.planName}. Please upgrade your plan in Buy Plan tab.`
      );
      return;
    }
    setEditingProduct(null);
    setName('');
    setPrice('');
    setBuyingPrice('');
    setStock('');
    setDescription('');
    setImageUri(null);
    setFormErrors({});
    setModalVisible(true);
  }

  function openEditModal(prod: Product) {
    if (!isOnline) {
      showToast('Internet required to edit products', 'warning');
      return;
    }
    if (prod.isDemo) {
      showToast('Demo products cannot be edited', 'info');
      return;
    }
    setEditingProduct(prod);
    setName(prod.name);
    setPrice(String(prod.price || ''));
    setBuyingPrice(String(prod.buyingPrice || ''));
    setStock(String(prod.stock || '0'));
    setDescription(prod.description || '');
    setImageUri(prod.images?.[0]?.image || null);
    setFormErrors({});
    setModalVisible(true);
  }

  async function handleSaveProduct() {
    if (!isOnline) {
      showToast('Internet required to save product', 'warning');
      return;
    }

    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Product name is required';
    if (!price.trim() || isNaN(Number(price))) errs.price = 'Enter a valid price';
    if (stock.trim() && isNaN(Number(stock))) errs.stock = 'Stock must be a number';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      if (editingProduct) {
        await authedPut('/product', `/${editingProduct._id}`, {
          name: name.trim(),
          price: Number(price),
          buyingPrice: buyingPrice ? Number(buyingPrice) : undefined,
          stock: Number(stock || 0),
          description: description.trim(),
        });
        showToast('Product updated successfully', 'success');
      } else {
        if (imageUri && !imageUri.startsWith('http')) {
          const formData = new FormData();
          formData.append('name', name.trim());
          formData.append('price', price.trim());
          if (buyingPrice) formData.append('buyingPrice', buyingPrice.trim());
          formData.append('stock', stock.trim() || '0');
          if (description) formData.append('description', description.trim());

          const filename = imageUri.split('/').pop() || 'photo.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;

          formData.append('image', {
            uri: imageUri,
            name: filename,
            type,
          } as any);

          await authedFormPost('/product', '/create', formData);
        } else {
          await authedPost('/product', '/create', {
            name: name.trim(),
            price: Number(price),
            buyingPrice: buyingPrice ? Number(buyingPrice) : undefined,
            stock: Number(stock || 0),
            description: description.trim(),
          });
        }
        showToast('Product added successfully', 'success');
      }

      setModalVisible(false);
      loadData();
    } catch (err: any) {
      showToast(err.message ?? 'Operation failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete(prod: Product) {
    if (!isOnline) {
      showToast('Internet required to delete products', 'warning');
      return;
    }
    if (prod.isDemo) {
      showToast('Demo products cannot be deleted', 'info');
      return;
    }
    Alert.alert('Delete Product', `Are you sure you want to delete "${prod.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await authedDelete('/product', `/${prod._id}`);
            showToast('Product deleted', 'success');
            loadData();
          } catch (err: any) {
            showToast(err.message ?? 'Failed to delete product', 'error');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Toast {...toast} onHide={hideToast} />
      <Header
        title="Products"
        right={
          <TouchableOpacity
            onPress={openAddModal}
            style={[styles.headerAddBtn, !isOnline && { opacity: 0.5 }]}
          >
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        }
      />

      {/* Persistent Offline Banner */}
      <OfflineBanner lastUpdated={lastUpdated} />

      {/* Plan limit warning banner */}
      <View style={styles.planBanner}>
        <View style={styles.planInfo}>
          <Text style={styles.planTitle}>{planLimit.planName}</Text>
          <Text style={styles.planSub}>
            {planLimit.current} of {planLimit.max} products used
          </Text>
        </View>
        <Badge
          variant={planLimit.current >= planLimit.max ? 'error' : 'primary'}
        >
          {planLimit.current >= planLimit.max ? 'Limit Reached' : `${planLimit.max - planLimit.current} Left`}
        </Badge>
      </View>

      {/* Product List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.dsPrimary} />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cube-outline" size={54} color={colors.dsOutline} />
          <Text style={styles.emptyTitle}>No products yet</Text>
          <Text style={styles.emptySub}>Add your first product to generate invoices</Text>
          <Button onPress={openAddModal} disabled={!isOnline} style={{ marginTop: spacing[4] }}>
            Add Product
          </Button>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
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
          renderItem={({ item }) => (
            <View style={[styles.productCard, shadows.sm]}>
              <View style={styles.prodImgWrapper}>
                {item.images?.[0]?.image ? (
                  <Image
                    source={{ uri: item.images[0].image }}
                    style={styles.prodImg}
                    contentFit="cover"
                    cachePolicy="disk"
                  />
                ) : (
                  <View style={styles.prodImgPlaceholder}>
                    <Ionicons name="image-outline" size={24} color={colors.dsOutline} />
                  </View>
                )}
              </View>

              <View style={styles.prodDetails}>
                <View style={styles.titleRow}>
                  <Text style={styles.prodName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.isDemo ? <Badge variant="demo">DEMO</Badge> : null}
                </View>

                <Text style={styles.prodPrice}>৳{item.price}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.prodStock}>Stock: {item.stock}</Text>
                  {item.varient && item.varient.length > 0 && (
                    <Text style={styles.variantBadge}>
                      {item.varient.length} variants
                    </Text>
                  )}
                </View>
              </View>

              {/* Action Buttons */}
              {!item.isDemo && (
                <View style={styles.actionCol}>
                  <TouchableOpacity
                    onPress={() => openEditModal(item)}
                    style={[styles.iconBtn, !isOnline && { opacity: 0.4 }]}
                  >
                    <Ionicons name="create-outline" size={19} color={colors.dsPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDelete(item)}
                    style={[styles.iconBtn, { marginTop: spacing[2] }, !isOnline && { opacity: 0.4 }]}
                  >
                    <Ionicons name="trash-outline" size={19} color={colors.dsError} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Add / Edit Product Modal */}
      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
      >
        <View style={styles.form}>
          {!editingProduct && (
            <TouchableOpacity onPress={pickAndCompressImage} style={styles.imagePickerBtn}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera-outline" size={28} color={colors.dsPrimary} />
                  <Text style={styles.uploadText}>Upload Image (Auto Compressed)</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <Input
            label="Product Name *"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Cotton T-Shirt"
            error={formErrors.name}
          />

          <View style={styles.row}>
            <Input
              label="Selling Price (৳) *"
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              keyboardType="numeric"
              containerStyle={{ flex: 1, marginRight: spacing[2] }}
              error={formErrors.price}
            />
            <Input
              label="Buying Price (৳)"
              value={buyingPrice}
              onChangeText={setBuyingPrice}
              placeholder="0.00"
              keyboardType="numeric"
              containerStyle={{ flex: 1 }}
            />
          </View>

          <Input
            label="Stock Quantity"
            value={stock}
            onChangeText={setStock}
            placeholder="Available units"
            keyboardType="numeric"
            error={formErrors.stock}
          />

          <Input
            label="Description (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Brief item details"
            multiline
            numberOfLines={3}
            containerStyle={{ minHeight: 80 }}
          />

          <Button
            onPress={handleSaveProduct}
            loading={submitting}
            fullWidth
            size="lg"
            style={{ marginTop: spacing[3], marginBottom: spacing[6] }}
          >
            {editingProduct ? 'Update Product' : 'Save Product'}
          </Button>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dsBackground },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.dsOutlineVariant,
  },
  planInfo: { flex: 1 },
  planTitle: { fontFamily: 'Inter-SemiBold', fontSize: fontSizes.sm, color: colors.dsOnSurface },
  planSub: { fontFamily: 'Inter-Regular', fontSize: fontSizes.xs, color: colors.dsOutline, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[5] },
  emptyTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: fontSizes.lg,
    color: colors.dsOnSurface,
    marginTop: spacing[3],
  },
  emptySub: {
    fontFamily: 'Inter-Regular',
    fontSize: fontSizes.sm,
    color: colors.dsOutline,
    textAlign: 'center',
    marginTop: 4,
  },
  list: { padding: spacing[4] },
  productCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing[3],
    marginBottom: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dsOutlineVariant,
  },
  prodImgWrapper: { marginRight: spacing[3] },
  prodImg: { width: 56, height: 56, borderRadius: radii.md },
  prodImgPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.dsSurfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prodDetails: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  prodName: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: fontSizes.base,
    color: colors.dsOnSurface,
  },
  prodPrice: {
    fontFamily: 'Manrope-Bold',
    fontSize: fontSizes.md,
    color: colors.dsPrimary,
    marginBottom: 4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prodStock: { fontFamily: 'Inter-Regular', fontSize: fontSizes.xs, color: colors.dsOutline },
  variantBadge: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.xs,
    color: colors.dsSecondary,
    backgroundColor: colors.dsSecondaryContainer,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  actionCol: { paddingLeft: spacing[2], alignItems: 'center' },
  iconBtn: { padding: 6 },
  form: { paddingBottom: spacing[4] },
  imagePickerBtn: {
    height: 110,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dsPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
    backgroundColor: colors.dsSurface,
    overflow: 'hidden',
  },
  imagePlaceholder: { alignItems: 'center' },
  uploadText: {
    fontFamily: 'Inter-Medium',
    fontSize: fontSizes.xs,
    color: colors.dsPrimary,
    marginTop: 6,
  },
  previewImage: { width: '100%', height: '100%' },
  row: { flexDirection: 'row' },
});
