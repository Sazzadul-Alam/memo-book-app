import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ThermalPrinter, {
  text,
  line,
  feed,
  cut,
  type Device,
} from 'react-native-thermal-printer-driver';
import { type ReceiptData, type PaperSize } from './receiptPrinter';

const SAVED_PRINTER_KEY = '@memobook_saved_pos_printer';
const SAVED_PRINTER_NAME_KEY = '@memobook_saved_pos_printer_name';
const SAVED_PAPER_SIZE_KEY = '@memobook_saved_paper_size';

export interface PrinterDevice {
  name: string;
  address: string;
  deviceType: 'bt' | 'ble' | 'dual' | 'unknown';
}

/**
 * Request runtime permissions for Bluetooth scanning and connecting on Android
 */
export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      const scanGranted =
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
      const connectGranted =
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;

      return scanGranted && connectGranted;
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission for Bluetooth',
          message: 'Bluetooth scanning requires location permission on your device.',
          buttonPositive: 'Allow',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (err) {
    console.warn('Bluetooth permission request failed:', err);
    return false;
  }
}

/**
 * Scan for paired and nearby Bluetooth POS printers with quick auto-stop
 * to avoid the default 15-second discovery delay.
 */
export async function scanPrinters(quickStopMs = 1200): Promise<{ paired: PrinterDevice[]; found: PrinterDevice[] }> {
  try {
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      throw new Error('Bluetooth permission not granted. Please allow Bluetooth permissions in App Settings.');
    }

    const scanPromise = ThermalPrinter.scan();

    // Auto-stop discovery early to return bonded & already-found devices rapidly
    let stopTimer: any = null;
    if (quickStopMs > 0) {
      stopTimer = setTimeout(() => {
        ThermalPrinter.stopScan().catch(() => {});
      }, quickStopMs);
    }

    try {
      const result = await scanPromise;
      if (stopTimer) clearTimeout(stopTimer);
      return {
        paired: result.paired || [],
        found: result.found || [],
      };
    } catch (scanErr: any) {
      if (stopTimer) clearTimeout(stopTimer);
      throw scanErr;
    }
  } catch (err: any) {
    console.error('Printer scan error:', err);
    throw new Error(err?.message || 'Failed to scan Bluetooth printers');
  }
}

/**
 * Connect to a Bluetooth printer using its address
 */
export async function connectPrinter(address: string, name?: string): Promise<boolean> {
  try {
    await requestBluetoothPermissions();

    const formattedAddress =
      address.startsWith('bt:') || address.startsWith('ble:') || address.startsWith('tcp:')
        ? address
        : `bt:${address}`;

    await ThermalPrinter.connect(formattedAddress, { timeout: 4000 });
    await AsyncStorage.setItem(SAVED_PRINTER_KEY, address);
    if (name) {
      await AsyncStorage.setItem(SAVED_PRINTER_NAME_KEY, name);
    }
    return true;
  } catch (err: any) {
    console.error('Printer connect error:', err);
    throw new Error(err?.message || 'Could not connect to printer');
  }
}

/**
 * Set and save the active printer
 */
export async function setActivePrinter(address: string, name?: string): Promise<void> {
  await AsyncStorage.setItem(SAVED_PRINTER_KEY, address);
  if (name) {
    await AsyncStorage.setItem(SAVED_PRINTER_NAME_KEY, name);
  }
}

/**
 * Set and get default paper size
 */
export async function setSavedPaperSize(size: PaperSize): Promise<void> {
  await AsyncStorage.setItem(SAVED_PAPER_SIZE_KEY, size);
}

export async function getSavedPaperSize(): Promise<PaperSize> {
  try {
    const size = await AsyncStorage.getItem(SAVED_PAPER_SIZE_KEY);
    return size === '80mm' ? '80mm' : '58mm';
  } catch {
    return '58mm';
  }
}

/**
 * Get the last saved printer address and name from AsyncStorage
 */
export async function getSavedPrinter(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SAVED_PRINTER_KEY);
  } catch {
    return null;
  }
}

export async function getSavedPrinterDetails(): Promise<{ address: string; name: string } | null> {
  try {
    const address = await AsyncStorage.getItem(SAVED_PRINTER_KEY);
    if (!address) return null;
    const name = (await AsyncStorage.getItem(SAVED_PRINTER_NAME_KEY)) || 'Bluetooth POS Printer';
    return { address, name };
  } catch {
    return null;
  }
}

/**
 * Remove saved printer address
 */
export async function clearSavedPrinter(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([SAVED_PRINTER_KEY, SAVED_PRINTER_NAME_KEY]);
  } catch {}
}

/**
 * Disconnect from printer
 */
export async function disconnectPrinter(address: string): Promise<void> {
  try {
    const formattedAddress =
      address.startsWith('bt:') || address.startsWith('ble:') || address.startsWith('tcp:')
        ? address
        : `bt:${address}`;
    await ThermalPrinter.disconnect(formattedAddress);
  } catch (err) {
    console.warn('Disconnect warning:', err);
  }
}

/**
 * Print a receipt directly over Bluetooth without any third-party app.
 * Optimized for lightning-fast printing:
 * 1. Uses saved printer address or paired device immediately.
 * 2. Uses fast-stop scan (~1.2s) if no printer address is cached.
 * 3. Keeps connection alive and connects with a fast timeout.
 */
export async function printReceiptBluetooth(
  data: ReceiptData,
  paperSize?: PaperSize,
  targetAddress?: string,
  onStatusUpdate?: (status: string) => void
): Promise<void> {
  const hasPermission = await requestBluetoothPermissions();
  if (!hasPermission) {
    throw new Error('Bluetooth permission not granted. Please allow Bluetooth permissions in App Settings.');
  }

  let address = targetAddress || (await getSavedPrinter());

  if (!address) {
    onStatusUpdate?.('Finding paired Bluetooth printer...');
    // Fast scan paired and available devices (stops after 1.2s instead of 15s)
    const { paired, found } = await scanPrinters(1200);
    const all = [...paired, ...found];
    if (all.length > 0) {
      address = all[0].address;
      // Persist for next instant print
      AsyncStorage.setItem(SAVED_PRINTER_KEY, address).catch(() => {});
      if (all[0].name) {
        AsyncStorage.setItem(SAVED_PRINTER_NAME_KEY, all[0].name).catch(() => {});
      }
    } else {
      throw new Error('NO_PRINTER_PAIRED');
    }
  }

  const effectivePaperSize = paperSize || (await getSavedPaperSize());

  const formattedAddress =
    address.startsWith('bt:') || address.startsWith('ble:') || address.startsWith('tcp:')
      ? address
      : `bt:${address}`;

  onStatusUpdate?.('Connecting to Bluetooth printer...');

  // Connect quickly (with 4s timeout)
  try {
    await ThermalPrinter.connect(formattedAddress, { timeout: 4000 });
    AsyncStorage.setItem(SAVED_PRINTER_KEY, address).catch(() => {});
  } catch (connectErr: any) {
    const msg = String(connectErr?.message || '');
    if (!msg.toLowerCase().includes('already connected')) {
      // If cached address failed, try clearing cache and discovering again once
      console.warn('Saved printer connect failed, clearing cache:', msg);
      await clearSavedPrinter();
      throw new Error(`Could not connect to printer (${msg}). Please verify Bluetooth printer is powered ON.`);
    }
  }

  onStatusUpdate?.('Sending print commands...');

  const paperWidthMm = effectivePaperSize === '80mm' ? 80 : 58;
  const is80 = effectivePaperSize === '80mm';

  // Build ESC/POS print nodes
  const nodes: any[] = [];

  // Shop Header
  nodes.push(text(data.shopName, { align: 'center', bold: true, size: 2 }));
  if (data.shopAddress) nodes.push(text(data.shopAddress, { align: 'center' }));
  if (data.shopPhone) nodes.push(text(`Phone: ${data.shopPhone}`, { align: 'center' }));

  nodes.push(line({ style: 'solid' }));
  nodes.push(text(`INVOICE: #${data.invoiceNumber}`, { bold: true }));
  nodes.push(text(`Date: ${data.date}`));

  // Customer Info
  if (data.customerName || data.customerPhone) {
    nodes.push(line({ style: 'dashed' }));
    if (data.customerName) nodes.push(text(`Customer: ${data.customerName}`));
    if (data.customerPhone) nodes.push(text(`Phone: ${data.customerPhone}`));
    if (data.customerAddress) nodes.push(text(`Address: ${data.customerAddress}`));
  }

  nodes.push(line({ style: 'solid' }));

  // Items Header & rows
  nodes.push(text(is80 ? 'ITEM                        QTY   PRICE    TOTAL' : 'ITEM               QTY  PRICE  TOTAL', { bold: true }));
  nodes.push(line({ style: 'dashed' }));

  data.items.forEach((item) => {
    const itemTotal = (item.quantity * item.unitPrice).toFixed(2);
    const row = `${item.name.substring(0, is80 ? 24 : 14)} x${item.quantity}  Tk${item.unitPrice}  Tk${itemTotal}`;
    nodes.push(text(row));
  });

  nodes.push(line({ style: 'solid' }));

  // Summary Totals
  nodes.push(text(`Subtotal: Tk ${data.subtotal.toFixed(2)}`, { align: 'right' }));
  if (data.discount && data.discount > 0) {
    nodes.push(text(`Discount: -Tk ${data.discount.toFixed(2)}`, { align: 'right' }));
  }
  if (data.deliveryCharge !== undefined && data.deliveryCharge > 0) {
    const delText = data.isDeliveryPaid ? 'PAID' : `+Tk ${data.deliveryCharge.toFixed(2)}`;
    nodes.push(text(`Delivery: ${delText}`, { align: 'right' }));
  }
  if (data.advanceAmount && data.advanceAmount > 0) {
    nodes.push(text(`Advance Paid: -Tk ${data.advanceAmount.toFixed(2)}`, { align: 'right' }));
  }

  nodes.push(line({ style: 'solid' }));
  nodes.push(text(`GRAND TOTAL: Tk ${data.grandTotal.toFixed(2)}`, { align: 'right', bold: true, size: 1 }));
  nodes.push(line({ style: 'dashed' }));

  if (data.notes) {
    nodes.push(text(`Note: ${data.notes}`));
  }

  // Footer
  nodes.push(feed(1));
  nodes.push(text(data.footerText || 'Thank you for your business!', { align: 'center', bold: true }));
  if (data.fbLink) nodes.push(text(`FB: ${data.fbLink}`, { align: 'center' }));
  if (data.igLink) nodes.push(text(`IG: ${data.igLink}`, { align: 'center' }));

  // Feed and cut
  nodes.push(feed(3));
  nodes.push(cut());

  await ThermalPrinter.print(formattedAddress, nodes, { paperWidthMm, timeout: 5000 });
  onStatusUpdate?.('Print complete!');
}
