import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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

export function generateReceiptHtml(data: ReceiptData): string {
  const itemsRows = data.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px dashed #cccccc;">
        <td style="padding: 6px 2px; text-align: left; font-size: 12px; line-height: 1.3;">${item.name}</td>
        <td style="padding: 6px 2px; text-align: center; font-size: 12px;">${item.quantity}</td>
        <td style="padding: 6px 2px; text-align: right; font-size: 12px;">৳${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 6px 2px; text-align: right; font-size: 12px; font-weight: 600;">৳${(item.quantity * item.unitPrice).toFixed(2)}</td>
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
    @page { margin: 0; size: 80mm auto; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 16px;
      color: #1a1a1a;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      max-width: 360px;
      margin: 0 auto;
    }
    .header {
      background: #005C72;
      color: #ffffff;
      padding: 16px 8px;
      border-radius: 8px 8px 0 0;
      text-align: center;
    }
    .header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .header p {
      margin: 4px 0 0 0;
      font-size: 11px;
      opacity: 0.95;
    }
    .tag {
      text-align: center;
      padding: 6px 0;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      border-bottom: 1px dashed #000000;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 11px;
      border-bottom: 1px dashed #000000;
      padding-bottom: 6px;
    }
    .meta-table td {
      padding: 2px 0;
    }
    .customer-box {
      border-bottom: 1px dashed #000000;
      padding: 8px 0;
      font-size: 11px;
    }
    .customer-box h4 {
      margin: 0 0 4px 0;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #555;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    .items-table th {
      border-bottom: 1px dashed #000000;
      padding: 6px 2px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #333;
    }
    .totals-box {
      margin-top: 8px;
      border-top: 1px dashed #000000;
      padding-top: 8px;
      font-size: 12px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .grand-total {
      margin-top: 8px;
      border: 1px dashed #000000;
      padding: 8px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      font-weight: 800;
      background: #f8fafc;
      border-radius: 4px;
    }
    .notes-box {
      margin-top: 8px;
      padding: 6px;
      text-align: center;
      font-size: 11px;
      font-style: italic;
      color: #444;
      border-bottom: 1px dashed #cccccc;
    }
    .footer {
      margin-top: 12px;
      text-align: center;
      font-size: 10px;
      color: #666;
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
        ${data.customerName ? `<div><strong>Name:</strong> ${data.customerName}</div>` : ''}
        ${data.customerPhone ? `<div><strong>Phone:</strong> ${data.customerPhone}</div>` : ''}
        ${data.customerAddress ? `<div><strong>Address:</strong> ${data.customerAddress}</div>` : ''}
      </div>
    `
        : ''
    }

    <table class="items-table">
      <thead>
        <tr>
          <th style="text-align: left;">Item</th>
          <th style="text-align: center; width: 36px;">Qty</th>
          <th style="text-align: right; width: 60px;">Rate</th>
          <th style="text-align: right; width: 70px;">Total</th>
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
      <div class="totals-row" style="color: #ba1a1a;">
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
      <div class="totals-row" style="color: #0284c7;">
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
      <p>${data.footerText || 'Thank you for your business!'}</p>
      ${data.fbLink ? `<p>FB: ${data.fbLink}</p>` : ''}
      ${data.igLink ? `<p>IG: ${data.igLink}</p>` : ''}
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Print or export receipt as PDF
 */
export async function printReceipt(data: ReceiptData): Promise<void> {
  const html = generateReceiptHtml(data);
  await Print.printAsync({ html });
}

export async function shareReceiptPdf(data: ReceiptData): Promise<void> {
  const html = generateReceiptHtml(data);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `Share Invoice ${data.invoiceNumber}`,
    });
  }
}
