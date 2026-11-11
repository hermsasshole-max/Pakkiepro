import type { ReceiptCategory, SavedReceipt } from '../types';

/** Typical in-store return windows. Utilities and fuel are not returnable. */
export function returnWindowDays(category: ReceiptCategory | string): number | null {
  switch (category) {
    case 'Food & Groceries':
      return 14;
    case 'Home Maintenance':
      return 30;
    case 'Other':
      return 30;
    case 'Transport':
    case 'Electricity & Utilities':
    default:
      return null;
  }
}

export interface RetailerPolicy {
  name: string;
  /** Null means the shop does not take the goods back (fuel, utilities). */
  days: number | null;
  note: string;
}

interface RetailerRule {
  tokens: string[];
  policy: RetailerPolicy;
}

/** Public change-of-mind guides for common South African tills. Not a shop promise. */
const RETAILER_RULES: RetailerRule[] = [
  {
    tokens: ['engen', 'shell', 'sasol', 'caltex', 'astron', 'totalenergies', 'bp'],
    policy: { name: 'Fuel station', days: null, note: 'Fuel is not returnable.' },
  },
  {
    tokens: ['eskom', 'city power', 'citypower', 'municipality'],
    policy: { name: 'Utility', days: null, note: 'Utility bills are not returnable.' },
  },
  {
    tokens: ['woolworths'],
    policy: { name: 'Woolworths', days: 30, note: 'Often 30 days with the slip. Fresh food is a quality call.' },
  },
  {
    tokens: ['pick n pay', 'pnp'],
    policy: { name: 'Pick n Pay', days: 30, note: 'Often 30 days with the original slip, unused.' },
  },
  {
    tokens: ['checkers', 'shoprite', 'usave'],
    policy: { name: 'Shoprite group', days: 30, note: 'General merchandise is often 30 days. Perishables are not.' },
  },
  {
    tokens: ['spar'],
    policy: { name: 'Spar', days: 14, note: 'Spar windows vary by store. 14 days is the safe guide.' },
  },
  {
    tokens: ['builders warehouse', 'builders'],
    policy: { name: 'Builders', days: 30, note: 'Usually 30 days with the slip, unused and in original packaging.' },
  },
  {
    tokens: ['makro'],
    policy: { name: 'Makro', days: 30, note: 'Usually 30 days with the slip.' },
  },
  {
    tokens: ['game'],
    policy: { name: 'Game', days: 30, note: 'Usually 30 days with the slip.' },
  },
  {
    tokens: ['takealot'],
    policy: { name: 'Takealot', days: 30, note: 'Online returns are often 30 days from delivery.' },
  },
  {
    tokens: ['clicks'],
    policy: { name: 'Clicks', days: 30, note: 'Unopened goods are often 30 days with the slip.' },
  },
  {
    tokens: ['dis chem', 'dischem'],
    policy: { name: 'Dis-Chem', days: 30, note: 'Unopened goods are often 30 days with the slip.' },
  },
  {
    tokens: ['mr price', 'mrp'],
    policy: { name: 'Mr Price', days: 30, note: 'Usually 30 days with tags and the slip.' },
  },
  {
    tokens: ['ackermans', 'pep', 'edgars', 'truworths', 'sportscene'],
    policy: { name: 'Clothing chain', days: 30, note: 'Usually 30 days with tags and the slip.' },
  },
  {
    tokens: ['incredible connection', 'hifi corp', 'hi fi corp'],
    policy: { name: 'Electronics', days: 14, note: 'Electronics change-of-mind is often closer to 14 days.' },
  },
];

export function retailerPolicy(vendor: string): RetailerPolicy | null {
  const padded = ` ${vendor.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  if (padded === '  ') return null;
  for (const rule of RETAILER_RULES) {
    if (rule.tokens.some((token) => padded.includes(` ${token} `))) return rule.policy;
  }
  return null;
}

export function parseIsoDate(value: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export interface ReturnableSlip {
  id: string;
  vendor: string;
  invoiceDate: string;
  deadline: string;
  daysLeft: number;
  windowDays: number;
  total: number;
  category: ReceiptCategory;
  policyLabel: string;
}

export function listReturnableSlips(
  receipts: SavedReceipt[],
  today: Date = new Date()
): ReturnableSlip[] {
  const todayStart = startOfDay(today).getTime();
  const rows: ReturnableSlip[] = [];

  for (const receipt of receipts) {
    const policy = retailerPolicy(receipt.vendor_name || '');
    const windowDays = policy ? policy.days : returnWindowDays(receipt.category);
    const purchased = parseIsoDate(receipt.invoice_date);
    if (windowDays == null || !purchased) continue;

    const deadline = new Date(purchased);
    deadline.setDate(deadline.getDate() + windowDays);
    const daysLeft = Math.round((deadline.getTime() - todayStart) / 86_400_000);
    if (daysLeft < 0) continue;

    rows.push({
      id: receipt.id,
      vendor: receipt.vendor_name || 'Unknown shop',
      invoiceDate: receipt.invoice_date,
      deadline: formatIsoDate(deadline),
      daysLeft,
      windowDays,
      total: Number(receipt.total_amount) || 0,
      category: receipt.category,
      policyLabel: policy ? `${policy.name} guide` : 'Typical window',
    });
  }

  rows.sort((a, b) => a.daysLeft - b.daysLeft || b.total - a.total);
  return rows;
}

export function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\d+(?:[.,]\d+)?\s?(?:kg|g|mg|ml|l|ltr|litre|liter|pk|pack|x)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface PriceMemoryAlert {
  item: string;
  direction: 'up' | 'down';
  previousPrice: number;
  latestPrice: number;
  delta: number;
  percent: number;
  latestVendor: string;
  previousVendor: string;
  latestDate: string;
}

interface ItemSighting {
  name: string;
  key: string;
  unitPrice: number;
  date: string;
  vendor: string;
}

export function priceMemoryAlerts(receipts: SavedReceipt[], limit = 3): PriceMemoryAlert[] {
  const sightings: ItemSighting[] = [];

  for (const receipt of receipts) {
    const date = receipt.invoice_date || '';
    if (!parseIsoDate(date)) continue;
    for (const item of receipt.line_items || []) {
      const key = normalizeItemName(item.description || '');
      const unit = Number(item.unit_price);
      if (key.length < 4 || !Number.isFinite(unit) || unit <= 0) continue;
      sightings.push({
        name: item.description.trim(),
        key,
        unitPrice: unit,
        date,
        vendor: receipt.vendor_name || 'Unknown shop',
      });
    }
  }

  const grouped = new Map<string, ItemSighting[]>();
  for (const sighting of sightings) {
    const list = grouped.get(sighting.key) || [];
    list.push(sighting);
    grouped.set(sighting.key, list);
  }

  const alerts: PriceMemoryAlert[] = [];
  for (const list of grouped.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const latest = list[list.length - 1];
    const previous = [...list].reverse().find((row) => Math.abs(row.unitPrice - latest.unitPrice) > 0.009 && row.date <= latest.date && row !== latest);
    if (!previous) continue;

    const delta = latest.unitPrice - previous.unitPrice;
    const percent = (delta / previous.unitPrice) * 100;
    if (Math.abs(percent) < 5 || Math.abs(delta) < 0.5) continue;

    alerts.push({
      item: latest.name,
      direction: delta > 0 ? 'up' : 'down',
      previousPrice: previous.unitPrice,
      latestPrice: latest.unitPrice,
      delta,
      percent,
      latestVendor: latest.vendor,
      previousVendor: previous.vendor,
      latestDate: latest.date,
    });
  }

  alerts.sort((a, b) => Math.abs(b.percent) - Math.abs(a.percent));
  const increases = alerts.filter((a) => a.direction === 'up');
  const decreases = alerts.filter((a) => a.direction === 'down');
  return [...increases, ...decreases].slice(0, limit);
}

export interface MerchantSpend {
  vendor: string;
  total: number;
  count: number;
}

export function topMerchants(receipts: SavedReceipt[], monthYear: string, limit = 3): MerchantSpend[] {
  const totals = new Map<string, MerchantSpend>();
  for (const receipt of receipts) {
    if (receipt.month_year !== monthYear) continue;
    const vendor = (receipt.vendor_name || 'Unknown shop').trim();
    const key = vendor.toLowerCase();
    const current = totals.get(key) || { vendor, total: 0, count: 0 };
    current.total += Number(receipt.total_amount) || 0;
    current.count += 1;
    totals.set(key, current);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

export interface CheaperShopLead {
  item: string;
  cheapVendor: string;
  cheapPrice: number;
  cheapDate: string;
  dearVendor: string;
  dearPrice: number;
  saving: number;
}

/** Latest unit price of the same item at two shops, when one till was clearly cheaper. */
export function cheaperShopLeads(receipts: SavedReceipt[], limit = 3): CheaperShopLead[] {
  interface Sight {
    name: string;
    vendor: string;
    vendorKey: string;
    price: number;
    date: string;
  }

  const latestByShop = new Map<string, Sight>();
  for (const receipt of receipts) {
    const date = receipt.invoice_date || '';
    if (!parseIsoDate(date)) continue;
    const vendor = (receipt.vendor_name || 'Unknown shop').trim();
    const vendorKey = vendor.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    for (const item of receipt.line_items || []) {
      const itemKey = normalizeItemName(item.description || '');
      const price = Number(item.unit_price);
      if (itemKey.length < 4 || !vendorKey || !Number.isFinite(price) || price <= 0) continue;
      const slot = `${itemKey}@@${vendorKey}`;
      const current = latestByShop.get(slot);
      if (!current || date >= current.date) {
        latestByShop.set(slot, {
          name: item.description.trim(),
          vendor,
          vendorKey,
          price,
          date,
        });
      }
    }
  }

  const byItem = new Map<string, Sight[]>();
  for (const sight of latestByShop.values()) {
    const itemKey = normalizeItemName(sight.name);
    const list = byItem.get(itemKey) || [];
    list.push(sight);
    byItem.set(itemKey, list);
  }

  const leads: CheaperShopLead[] = [];
  for (const list of byItem.values()) {
    if (list.length < 2) continue;
    const ordered = [...list].sort((a, b) => a.price - b.price);
    const cheap = ordered[0];
    const dear = ordered[ordered.length - 1];
    const saving = dear.price - cheap.price;
    if (saving < 0.5 || saving / dear.price < 0.04) continue;
    leads.push({
      item: cheap.name,
      cheapVendor: cheap.vendor,
      cheapPrice: cheap.price,
      cheapDate: cheap.date,
      dearVendor: dear.vendor,
      dearPrice: dear.price,
      saving,
    });
  }

  leads.sort((a, b) => b.saving - a.saving);
  return leads.slice(0, limit);
}

export const SA_VAT_RATE = 0.15;

export interface VatFlag {
  id: string;
  vendor: string;
  invoiceDate: string;
  subtotal: number;
  tax: number;
  expected: number;
  difference: number;
}

export interface VatYearSnapshot {
  label: string;
  start: string;
  end: string;
  inputVat: number;
  taxableSlips: number;
  flags: VatFlag[];
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Individual tax year in South Africa runs 1 March to the end of February. */
export function saTaxYearBounds(today: Date = new Date()): { start: string; end: string; label: string } {
  const startYear = today.getMonth() >= 2 ? today.getFullYear() : today.getFullYear() - 1;
  const endYear = startYear + 1;
  const leap = (endYear % 4 === 0 && endYear % 100 !== 0) || endYear % 400 === 0;
  return {
    start: `${startYear}-03-01`,
    end: `${endYear}-02-${leap ? 29 : 28}`,
    label: `${startYear}/${String(endYear).slice(2)}`,
  };
}

export function vatYearSnapshot(receipts: SavedReceipt[], today: Date = new Date()): VatYearSnapshot {
  const bounds = saTaxYearBounds(today);
  const flags: VatFlag[] = [];
  let inputVat = 0;
  let taxableSlips = 0;

  for (const receipt of receipts) {
    const date = receipt.invoice_date || '';
    if (!parseIsoDate(date) || date < bounds.start || date > bounds.end) continue;

    const policy = retailerPolicy(receipt.vendor_name || '');
    const subtotal = Number(receipt.subtotal) || 0;
    const tax = Number(receipt.tax) || 0;
    const zeroRated =
      receipt.category === 'Transport' ||
      receipt.category === 'Electricity & Utilities' ||
      policy?.days === null;
    if (zeroRated && tax === 0) continue;
    if (subtotal <= 0 && tax <= 0) continue;

    taxableSlips += 1;
    inputVat += tax;
    if (subtotal <= 0) continue;

    const expected = roundMoney(subtotal * SA_VAT_RATE);
    const difference = roundMoney(tax - expected);
    const tolerance = Math.max(0.5, roundMoney(subtotal * 0.02));
    if (Math.abs(difference) > tolerance) {
      flags.push({
        id: receipt.id,
        vendor: receipt.vendor_name || 'Unknown shop',
        invoiceDate: date,
        subtotal,
        tax,
        expected,
        difference,
      });
    }
  }

  return {
    label: bounds.label,
    start: bounds.start,
    end: bounds.end,
    inputVat: roundMoney(inputVat),
    taxableSlips,
    flags,
  };
}

export interface MonthPace {
  monthYear: string;
  dayOfMonth: number;
  daysInMonth: number;
  timePercent: number;
  spent: number;
  receiptCount: number;
  budgetTotal: number;
  spentPercent: number | null;
  status: 'no_budget' | 'on_track' | 'running_hot' | 'over';
}

export function monthPace(
  receipts: SavedReceipt[],
  budgets: Record<string, number>,
  today: Date = new Date()
): MonthPace {
  const monthYear = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth = today.getDate();
  const monthReceipts = receipts.filter((r) => r.month_year === monthYear);
  const spent = monthReceipts.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
  const budgetTotal = Object.values(budgets).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const timePercent = Math.round((dayOfMonth / daysInMonth) * 100);
  const spentPercent = budgetTotal > 0 ? Math.round((spent / budgetTotal) * 100) : null;

  let status: MonthPace['status'] = 'no_budget';
  if (spentPercent != null) {
    if (spentPercent > 100) status = 'over';
    else if (spentPercent > timePercent + 12) status = 'running_hot';
    else status = 'on_track';
  }

  return {
    monthYear,
    dayOfMonth,
    daysInMonth,
    timePercent,
    spent,
    receiptCount: monthReceipts.length,
    budgetTotal,
    spentPercent,
    status,
  };
}

function csvCell(value: string | number): string {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function receiptsToCsv(receipts: SavedReceipt[]): string {
  const header = [
    'Date',
    'Shop',
    'Category',
    'Invoice',
    'Currency',
    'Subtotal',
    'Tax',
    'Total',
    'Items',
  ];
  const lines = [header.join(',')];
  const sorted = [...receipts].sort((a, b) => (b.invoice_date || '').localeCompare(a.invoice_date || ''));
  for (const receipt of sorted) {
    const items = (receipt.line_items || [])
      .map((item) => `${item.description} x${item.quantity} @ ${item.unit_price}`)
      .join('; ');
    lines.push(
      [
        receipt.invoice_date || '',
        receipt.vendor_name || '',
        receipt.category || '',
        receipt.invoice_number || '',
        receipt.currency || '',
        Number(receipt.subtotal) || 0,
        Number(receipt.tax) || 0,
        Number(receipt.total_amount) || 0,
        items,
      ]
        .map(csvCell)
        .join(',')
    );
  }
  return lines.join('\n');
}

export function downloadTextFile(filename: string, contents: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
