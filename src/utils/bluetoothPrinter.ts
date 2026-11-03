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

export interface PrinterDevice {
  name: string;
  address: string;
  deviceType: 'bt' | 'ble' | 'dual' | 'unknown';
}

/**
 * Scan for paired and nearby Bluetooth POS printers
 */
export async function scanPrinters(): Promise<{ paired: PrinterDevice[]; found: PrinterDevice[] }> {
  try {
    const result = await ThermalPrinter.scan();
    return {
      paired: result.paired || [],
      found: result.found || [],
    };
  } catch (err: any) {
    console.error('Printer scan error:', err);
    throw new Error(err?.message || 'Failed to scan Bluetooth printers');
  }
}

/**
 * Connect to a Bluetooth printer using its address
 */
export async function connectPrinter(address: string): Promise<boolean> {
  try {
    // If the address doesn't specify transport prefix, prefix it with 'bt:' for Bluetooth Classic
    const formattedAddress =
      address.startsWith('bt:') || address.startsWith('ble:') || address.startsWith('tcp:')
        ? address
        : `bt:${address}`;

    await ThermalPrinter.connect(formattedAddress, { timeout: 10000 });
    await AsyncStorage.setItem(SAVED_PRINTER_KEY, address);
    return true;
  } catch (err: any) {
    console.error('Printer connect error:', err);
    throw new Error(err?.message || 'Could not connect to printer');
  }
}

/**
 * Get the last saved printer address from AsyncStorage
 */
export async function getSavedPrinter(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SAVED_PRINTER_KEY);
  } catch {
    return null;
  }
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
 * Print a receipt directly over Bluetooth without any third-party app
 */
export async function printReceiptBluetooth(
  data: ReceiptData,
  paperSize: PaperSize = '58mm',
  targetAddress?: string
): Promise<void> {
  let address = targetAddress || (await getSavedPrinter());

  if (!address) {
    // Attempt auto-discovery of paired devices
    const { paired } = await scanPrinters();
    if (paired.length > 0) {
      address = paired[0].address;
    } else {
      throw new Error('NO_PRINTER_PAIRED');
    }
  }

  const formattedAddress =
    address.startsWith('bt:') || address.startsWith('ble:') || address.startsWith('tcp:')
      ? address
      : `bt:${address}`;

  // Make sure we connect
  try {
    await ThermalPrinter.connect(formattedAddress, { timeout: 10000 });
  } catch (connectErr: any) {
    // If already connected, continuing is fine; otherwise throw
    const msg = String(connectErr?.message || '');
    if (!msg.toLowerCase().includes('already connected')) {
      console.warn('Connect check failed, attempting print anyway:', msg);
    }
  }

  const paperWidthMm = paperSize === '80mm' ? 80 : 58;
  const is80 = paperSize === '80mm';

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

  await ThermalPrinter.print(formattedAddress, nodes, { paperWidthMm });
}
