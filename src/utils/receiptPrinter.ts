import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Alert, Platform } from 'react-native';

export interface ReceiptData {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  fbLink?: string;
  igLink?: string;
  footerText?: string;
  invoiceNumber: string;
  date: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
  }[];
  subtotal: number;
  discount?: number;
  advanceAmount?: number;
  deliveryCharge?: number;
  isDeliveryPaid?: boolean;
  grandTotal: number;
  notes?: string;
}

export type PaperSize = '58mm' | '80mm';

/**
 * Pure TypeScript UTF-8 to Base64 encoder (reliable on React Native Hermes without btoa/Buffer dependencies)
 */
export function encodeBase64(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];

  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      i++;
      code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }

  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i++];
    const b2 = i < bytes.length ? bytes[i++] : NaN;
    const b3 = i < bytes.length ? bytes[i++] : NaN;

    const c1 = b1 >> 2;
    const c2 = ((b1 & 3) << 4) | (isNaN(b2) ? 0 : b2 >> 4);
    const c3 = isNaN(b2) ? 64 : ((b2 & 15) << 2) | (isNaN(b3) ? 0 : b3 >> 6);
    const c4 = isNaN(b3) ? 64 : b3 & 63;

    result +=
      chars.charAt(c1) +
      chars.charAt(c2) +
      (c3 === 64 ? '=' : chars.charAt(c3)) +
      (c4 === 64 ? '=' : chars.charAt(c4));
  }
  return result;
}

/**
 * Generate plain text receipt formatted specifically for 58mm (32 chars) or 80mm (48 chars) thermal printers
 * Uses standard ASCII characters ('Tk') so hardware ESC/POS printers without Unicode won't print gibberish.
 */
export function generateReceiptText(data: ReceiptData, paperSize: PaperSize = '58mm'): string {
  const width = paperSize === '58mm' ? 32 : 48;
  const divider = '-'.repeat(width);
  const doubleDivider = '='.repeat(width);

  const center = (str: string) => {
    if (str.length >= width) return str.slice(0, width);
    const left = Math.floor((width - str.length) / 2);
    return ' '.repeat(left) + str;
  };

  const line2Cols = (left: string, right: string) => {
    const space = width - left.length - right.length;
    if (space <= 0) return `${left}\n${' '.repeat(Math.max(0, width - right.length))}${right}`;
    return left + ' '.repeat(space) + right;
  };

  const lines: string[] = [];
  lines.push(doubleDivider);
  lines.push(center(data.shopName.toUpperCase()));
  if (data.shopAddress) lines.push(center(data.shopAddress));
  if (data.shopPhone) lines.push(center(`Phone: ${data.shopPhone}`));
  lines.push(divider);
  lines.push(center('POS INVOICE'));
  lines.push(divider);
  lines.push(line2Cols(`Invoice: ${data.invoiceNumber}`, `Date: ${data.date}`));
  if (data.customerName) lines.push(`Customer: ${data.customerName}`);
  if (data.customerPhone) lines.push(`Phone: ${data.customerPhone}`);
  if (data.customerAddress) lines.push(`Address: ${data.customerAddress}`);
  lines.push(divider);

  if (paperSize === '58mm') {
    // 32 chars: Item (15) + " " + Qty (3) + " " + Rate (5) + " " + Total (6) = 32
    lines.push('Item            Qty  Rate  Total');
    lines.push(divider);
    for (const item of data.items) {
      const name = item.name.length > 15 ? item.name.slice(0, 15) : item.name.padEnd(15);
      const qty = String(item.quantity).padStart(3);
      const rate = item.unitPrice.toFixed(0).padStart(5);
      const total = (item.quantity * item.unitPrice).toFixed(0).padStart(6);
      lines.push(`${name} ${qty} ${rate} ${total}`);
      if (item.name.length > 15) {
        lines.push(`  ${item.name.slice(15)}`);
      }
    }
  } else {
    // 48 chars: Item (25) + " " + Qty (4) + " " + Rate (8) + " " + Total (8)
    lines.push('Item                        Qty    Rate    Total');
    lines.push(divider);
    for (const item of data.items) {
      const name = item.name.length > 25 ? item.name.slice(0, 25) : item.name.padEnd(25);
      const qty = String(item.quantity).padStart(4);
      const rate = item.unitPrice.toFixed(2).padStart(8);
      const total = (item.quantity * item.unitPrice).toFixed(2).padStart(8);
      lines.push(`${name} ${qty} ${rate} ${total}`);
      if (item.name.length > 25) {
        lines.push(`  ${item.name.slice(25)}`);
      }
    }
  }

  lines.push(divider);
  lines.push(line2Cols('Subtotal:', `Tk ${data.subtotal.toFixed(2)}`));
  if (data.discount && data.discount > 0) {
    lines.push(line2Cols('Discount:', `-Tk ${data.discount.toFixed(2)}`));
  }
  if (data.deliveryCharge && data.deliveryCharge > 0) {
    lines.push(
      line2Cols('Delivery Charge:', data.isDeliveryPaid ? 'PAID' : `+Tk ${data.deliveryCharge.toFixed(2)}`)
    );
  }
  if (data.advanceAmount && data.advanceAmount > 0) {
    lines.push(line2Cols('Advance Paid:', `-Tk ${data.advanceAmount.toFixed(2)}`));
  }
  lines.push(doubleDivider);
  lines.push(line2Cols('GRAND TOTAL:', `Tk ${data.grandTotal.toFixed(2)}`));
  lines.push(doubleDivider);

  if (data.notes) {
    lines.push(center(`Note: ${data.notes}`));
    lines.push(divider);
  }

  lines.push(center(data.footerText || 'Thank you for your business!'));
  if (data.fbLink) lines.push(center(`FB: ${data.fbLink}`));
  if (data.igLink) lines.push(center(`IG: ${data.igLink}`));
  lines.push('\n\n\n'); // Line feeds for paper tear-off

  return lines.join('\n');
}

/**
 * Generate thermal-optimized HTML receipt (crisp monochrome, zero margins, no dark background blocks)
 */
export function generateReceiptHtml(data: ReceiptData, paperSize: PaperSize = '58mm'): string {
  const is58 = paperSize === '58mm';
  const maxWidth = is58 ? '260px' : '360px';
  const fontSize = is58 ? '11px' : '12px';

  const itemsRows = data.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px dashed #000000;">
        <td style="padding: 4px 1px; text-align: left; font-size: ${fontSize}; line-height: 1.2;">${item.name}</td>
        <td style="padding: 4px 1px; text-align: center; font-size: ${fontSize}; width: 28px;">${item.quantity}</td>
        <td style="padding: 4px 1px; text-align: right; font-size: ${fontSize}; width: 50px;">৳${item.unitPrice.toFixed(0)}</td>
        <td style="padding: 4px 1px; text-align: right; font-size: ${fontSize}; font-weight: 700; width: 55px;">৳${(item.quantity * item.unitPrice).toFixed(0)}</td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice #${data.invoiceNumber}</title>
  <style>
    @page {
      margin: 0;
      size: ${is58 ? '58mm auto' : '80mm auto'};
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      margin: 0;
      padding: ${is58 ? '4px' : '8px'};
      color: #000000;
      background: #ffffff;
      font-size: ${fontSize};
    }
    .receipt {
      max-width: ${maxWidth};
      margin: 0 auto;
      background: #ffffff;
    }
    .header {
      background: transparent;
      color: #000000;
      padding: 6px 0;
      border-bottom: 2px dashed #000000;
      text-align: center;
    }
    .header h2 {
      margin: 0;
      font-size: ${is58 ? '16px' : '18px'};
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #000000;
    }
    .header p {
      margin: 2px 0 0 0;
      font-size: 11px;
      color: #000000;
    }
    .tag {
      text-align: center;
      padding: 4px 0;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      border-bottom: 1px dashed #000000;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0;
      font-size: 11px;
      border-bottom: 1px dashed #000000;
      padding-bottom: 4px;
    }
    .meta-table td {
      padding: 2px 0;
    }
    .customer-box {
      border-bottom: 1px dashed #000000;
      padding: 6px 0;
      font-size: 11px;
    }
    .customer-box h4 {
      margin: 0 0 2px 0;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #000000;
      font-weight: 800;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
    }
    .items-table th {
      border-bottom: 1px dashed #000000;
      padding: 4px 1px;
      font-size: 10px;
      text-transform: uppercase;
      color: #000000;
      font-weight: 800;
    }
    .totals-box {
      margin-top: 6px;
      border-top: 1px dashed #000000;
      padding-top: 6px;
      font-size: 11px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
    }
    .grand-total {
      margin-top: 6px;
      border: 2px dashed #000000;
      padding: 6px 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: ${is58 ? '13px' : '15px'};
      font-weight: 800;
      background: #ffffff;
    }
    .notes-box {
      margin-top: 6px;
      padding: 4px;
      text-align: center;
      font-size: 10px;
      font-style: italic;
      color: #000000;
      border-bottom: 1px dashed #000000;
    }
    .footer {
      margin-top: 10px;
      text-align: center;
      font-size: 10px;
      color: #000000;
      padding-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h2>${data.shopName}</h2>
      ${data.shopAddress ? `<p>${data.shopAddress}</p>` : ''}
      ${data.shopPhone ? `<p>Phone: ${data.shopPhone}</p>` : ''}
    </div>

    <div class="tag">POS INVOICE</div>

    <table class="meta-table">
      <tr>
        <td><strong>Invoice:</strong> ${data.invoiceNumber}</td>
        <td style="text-align: right;"><strong>Date:</strong> ${data.date}</td>
      </tr>
    </table>

    ${
      data.customerName || data.customerPhone || data.customerAddress
        ? `
      <div class="customer-box">
        <h4>Billed To</h4>
        ${data.customerName ? `<div>Name: ${data.customerName}</div>` : ''}
        ${data.customerPhone ? `<div>Phone: ${data.customerPhone}</div>` : ''}
        ${data.customerAddress ? `<div>Address: ${data.customerAddress}</div>` : ''}
      </div>
    `
        : ''
    }

    <table class="items-table">
      <thead>
        <tr>
          <th style="text-align: left;">Item</th>
          <th style="text-align: center; width: 28px;">Qty</th>
          <th style="text-align: right; width: 50px;">Rate</th>
          <th style="text-align: right; width: 55px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="totals-box">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>৳${data.subtotal.toFixed(2)}</span>
      </div>
      ${
        data.discount && data.discount > 0
          ? `
      <div class="totals-row">
        <span>Discount</span>
        <span>-৳${data.discount.toFixed(2)}</span>
      </div>
      `
          : ''
      }
      ${
        data.deliveryCharge !== undefined && data.deliveryCharge > 0
          ? `
      <div class="totals-row">
        <span>Delivery Charge</span>
        <span>${data.isDeliveryPaid ? 'PAID' : `+৳${data.deliveryCharge.toFixed(2)}`}</span>
      </div>
      `
          : ''
      }
      ${
        data.advanceAmount && data.advanceAmount > 0
          ? `
      <div class="totals-row">
        <span>Advance Paid</span>
        <span>-৳${data.advanceAmount.toFixed(2)}</span>
      </div>
      `
          : ''
      }

      <div class="grand-total">
        <span>Grand Total</span>
        <span>৳${data.grandTotal.toFixed(2)}</span>
      </div>
    </div>

    ${data.notes ? `<div class="notes-box">Note: ${data.notes}</div>` : ''}

    <div class="footer">
      <p><strong>${data.footerText || 'Thank you for your business!'}</strong></p>
      ${data.fbLink ? `<p>FB: ${data.fbLink}</p>` : ''}
      ${data.igLink ? `<p>IG: ${data.igLink}</p>` : ''}
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Direct Print to Bluetooth POS Printer using RawBT URL scheme or Intent
 * This is the #1 standard for Android Bluetooth thermal receipt printers.
 */
export async function printViaBluetoothPos(data: ReceiptData, paperSize: PaperSize = '58mm'): Promise<boolean> {
  const textReceipt = generateReceiptText(data, paperSize);

  if (Platform.OS === 'android') {
    const base64Text = encodeBase64(textReceipt);
    const rawbtUrl = `rawbt:base64,${base64Text}`;
    const intentUrl = `intent:base64,${base64Text}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;

    try {
      const canOpen = await Linking.canOpenURL(rawbtUrl).catch(() => false);
      if (canOpen) {
        await Linking.openURL(rawbtUrl);
        return true;
      }

      // Try Android intent URL
      await Linking.openURL(intentUrl);
      return true;
    } catch {
      // RawBT not installed; prompt user
      Alert.alert(
        'Bluetooth Thermal Printer',
        'Direct Bluetooth POS printing works seamlessly with the free "RawBT Print Service" app or the Android System Print Spooler.\n\nChoose an option:',
        [
          {
            text: 'Android Print Dialog',
            onPress: () => printReceipt(data, paperSize),
          },
          {
            text: 'Get RawBT App (Play Store)',
            onPress: () =>
              Linking.openURL('https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter').catch(() => {}),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return false;
    }
  } else {
    // iOS / Fallback to system print
    await printReceipt(data, paperSize);
    return true;
  }
}

/**
 * Print via Android Print Spooler (PrintManager) with thermal roll dimensions
 */
export async function printReceipt(data: ReceiptData, paperSize: PaperSize = '58mm'): Promise<void> {
  const html = generateReceiptHtml(data, paperSize);
  // Width in points: 58mm = ~164pt, 80mm = ~226pt
  const width = paperSize === '58mm' ? 164 : 226;
  await Print.printAsync({
    html,
    width,
  });
}

/**
 * Export and share receipt as PDF
 */
export async function shareReceiptPdf(data: ReceiptData, paperSize: PaperSize = '58mm'): Promise<void> {
  const html = generateReceiptHtml(data, paperSize);
  const width = paperSize === '58mm' ? 164 : 226;
  const { uri } = await Print.printToFileAsync({
    html,
    width,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `Share Invoice #${data.invoiceNumber}`,
    });
  }
}

/**
 * Share plain text receipt directly (compatible with Bluetooth Share, WhatsApp, SMS)
 */
export async function shareReceiptText(data: ReceiptData, paperSize: PaperSize = '58mm'): Promise<void> {
  const text = generateReceiptText(data, paperSize);
  if (await Sharing.isAvailableAsync()) {
    const html = `<pre style="font-family: monospace; font-size: 12px; padding: 12px;">${text}</pre>`;
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `Invoice #${data.invoiceNumber}`,
    });
  }
}
