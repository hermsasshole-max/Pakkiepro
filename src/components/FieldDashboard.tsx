import React, { useMemo, useState } from 'react';
import {
  Camera,
  Receipt,
  Plus,
  ArrowRight,
  PieChart,
  ShieldCheck,
  Download,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Store,
  BadgePercent,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { formatMoney, formatCategoryLabel } from '../utils/currencyFormat';
import type { NavTab } from './Navigation';
import type { SavedReceipt } from '../types';
import {
  downloadTextFile,
  listReturnableSlips,
  monthPace,
  priceMemoryAlerts,
  receiptsToCsv,
  cheaperShopLeads,
  vatYearSnapshot,
  topMerchants,
} from '../utils/householdInsights';

interface FieldDashboardProps {
  onNavigate: (tab: NavTab) => void;
  onOpenReceiptScanModal: () => void;
  onOpenAddManual: () => void;
  onOpenBudgetModal: () => void;
}

function exampleSlips(today: Date): SavedReceipt[] {
  const iso = (offsetDays: number) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return { date: `${y}-${m}-${d}`, month: `${y}-${m}` };
  };
  const recent = iso(-4);
  const older = iso(-22);
  const hardware = iso(-6);
  const fuel = iso(-2);

  return [
    {
      id: 'rcpt_walkthrough_pnp',
      vendor_name: 'Pick n Pay',
      invoice_number: 'T-44821',
      invoice_date: recent.date,
      month_year: recent.month,
      category: 'Food & Groceries',
      currency: 'ZAR',
      line_items: [
        { description: 'Clover Full Cream Milk 2L', quantity: 2, unit_price: 36.99, total_price: 73.98 },
        { description: 'Albany Superior White Bread', quantity: 1, unit_price: 18.99, total_price: 18.99 },
      ],
      subtotal: 92.97,
      tax: 13.95,
      total_amount: 106.92,
      notes: 'Example slip',
      created_at: new Date().toISOString(),
    },
    {
      id: 'rcpt_walkthrough_pnp_prev',
      vendor_name: 'Pick n Pay',
      invoice_number: 'T-44102',
      invoice_date: older.date,
      month_year: older.month,
      category: 'Food & Groceries',
      currency: 'ZAR',
      line_items: [
        { description: 'Clover Full Cream Milk 2L', quantity: 1, unit_price: 32.99, total_price: 32.99 },
      ],
      subtotal: 32.99,
      tax: 4.95,
      total_amount: 37.94,
      notes: 'Example slip',
      created_at: new Date().toISOString(),
    },
    {
      id: 'rcpt_walkthrough_builders',
      vendor_name: 'Builders Warehouse',
      invoice_number: 'BW-19044',
      invoice_date: hardware.date,
      month_year: hardware.month,
      category: 'Home Maintenance',
      currency: 'ZAR',
      line_items: [
        { description: 'Patio exterior paint 5L', quantity: 1, unit_price: 429, total_price: 429 },
      ],
      subtotal: 429,
      tax: 64.35,
      total_amount: 493.35,
      notes: 'Example slip',
      created_at: new Date().toISOString(),
    },
    {
      id: 'rcpt_walkthrough_engen',
      vendor_name: 'Engen',
      invoice_number: 'F-8821',
      invoice_date: fuel.date,
      month_year: fuel.month,
      category: 'Transport',
      currency: 'ZAR',
      line_items: [{ description: 'Unleaded 95', quantity: 28.4, unit_price: 21.89, total_price: 621.68 }],
      subtotal: 621.68,
      tax: 0,
      total_amount: 621.68,
      notes: 'Example slip',
      created_at: new Date().toISOString(),
    },
    {
      id: 'rcpt_walkthrough_checkers',
      vendor_name: 'Checkers',
      invoice_number: 'C-22018',
      invoice_date: iso(-1).date,
      month_year: iso(-1).month,
      category: 'Food & Groceries',
      currency: 'ZAR',
      line_items: [
        { description: 'Clover Full Cream Milk 2L', quantity: 1, unit_price: 31.99, total_price: 31.99 },
      ],
      subtotal: 31.99,
      tax: 4.8,
      total_amount: 36.79,
      notes: 'Example slip',
      created_at: new Date().toISOString(),
    },
  ];
}

export const FieldDashboard: React.FC<FieldDashboardProps> = ({
  onNavigate,
  onOpenReceiptScanModal,
  onOpenAddManual,
  onOpenBudgetModal,
}) => {
  const { receipts, categoryBudgets, currencyCode } = useAppContext();
  const [showExample, setShowExample] = useState(false);
  const today = useMemo(() => new Date(), []);
  const usingExample = receipts.length === 0 && showExample;
  const source = usingExample ? exampleSlips(today) : receipts;

  const pace = monthPace(source, categoryBudgets, today);
  const returnable = listReturnableSlips(source, today).slice(0, 3);
  const priceAlerts = priceMemoryAlerts(source, 3);
  const shopLeads = cheaperShopLeads(source, 3);
  const vatYear = vatYearSnapshot(source, today);
  const merchants = topMerchants(source, pace.monthYear, 3);
  const recentSlips = [...source]
    .sort((a, b) => (b.invoice_date || '').localeCompare(a.invoice_date || ''))
    .slice(0, 5);

  const monthReceipts = source.filter((r) => r.month_year === pace.monthYear);
  const categoryTotals: Record<string, number> = {};
  monthReceipts.forEach((r) => {
    const cat = r.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(r.total_amount) || 0);
  });

  const monthLabel = today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const paceNote =
    pace.status === 'over'
      ? 'Over the monthly limits you set.'
      : pace.status === 'running_hot'
        ? 'Spending is ahead of the month so far.'
        : pace.status === 'on_track'
          ? 'Spending is in line with the month so far.'
          : 'Set category limits to see if you are on pace.';

  const exportMonth = () => {
    const csv = receiptsToCsv(monthReceipts.length ? monthReceipts : source);
    downloadTextFile(`parserpro-${pace.monthYear}.csv`, csv);
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-7 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {monthLabel}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              {formatMoney(pace.spent, currencyCode)}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Day {pace.dayOfMonth} of {pace.daysInMonth}
              {pace.receiptCount > 0
                ? ` · ${pace.receiptCount} slip${pace.receiptCount === 1 ? '' : 's'}`
                : ' · nothing filed yet'}
            </p>
          </div>
          <button
            type="button"
            onClick={exportMonth}
            disabled={source.length === 0}
            className="min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                pace.status === 'over' || pace.status === 'running_hot' ? 'bg-amber-500' : 'bg-emerald-600'
              }`}
              style={{ width: `${Math.min(100, pace.spentPercent ?? pace.timePercent)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            {pace.budgetTotal > 0
              ? `${pace.spentPercent}% of ${formatMoney(pace.budgetTotal, currencyCode)} in limits · ${paceNote}`
              : paceNote}
            {merchants[0] ? ` Most of it is at ${merchants[0].vendor}.` : ''}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onOpenReceiptScanModal}
            className="min-h-12 sm:col-span-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm inline-flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            Scan a slip
          </button>
          <button
            type="button"
            onClick={onOpenAddManual}
            className="min-h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold text-sm inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add manually
          </button>
          <button
            type="button"
            onClick={onOpenBudgetModal}
            className="min-h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold text-sm inline-flex items-center justify-center gap-2"
          >
            Set limits
          </button>
        </div>
      </section>

      {receipts.length === 0 && (
        <section className="rounded-3xl border border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 p-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Your slips stay on this phone</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Snap a till slip, check the shop and total, then watch prices and return windows from the slips you already have.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowExample((value) => !value)}
              className="min-h-11 px-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-sm font-semibold text-emerald-800 dark:text-emerald-300"
            >
              {usingExample ? 'Hide example month' : 'See an example month'}
            </button>
          </div>
          {usingExample && (
            <p className="text-xs text-slate-500 mt-3">
              Example only. These slips are not saved, and they disappear when you add your own.
            </p>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-emerald-600" />
              Still returnable
            </h2>
            <span className="text-xs text-slate-400">Shop guides, not promises</span>
          </div>
          {returnable.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              No grocery or hardware slips are still inside a usual return window.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {returnable.map((row) => (
                <li key={row.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{row.vendor}</p>
                    <p className="text-xs text-slate-500">
                      Bought {row.invoiceDate} · {row.policyLabel}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                    {row.daysLeft === 0 ? 'Last day' : `${row.daysLeft}d left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-400">
            Pick n Pay, Checkers and Builders use their usual slip window. A corner cafe falls back to a shorter grocery guide. Fuel and utility bills stay off this list.
          </p>
        </section>

        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Price memory
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1"
            >
              Insights
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {priceAlerts.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              Scan the same item twice and ParserPro will tell you if the price moved.
            </p>
          ) : (
            <ul className="space-y-3">
              {priceAlerts.map((alert) => (
                <li key={`${alert.item}-${alert.latestDate}`} className="flex items-start gap-3">
                  {alert.direction === 'up' ? (
                    <TrendingUp className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
                  ) : (
                    <TrendingDown className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{alert.item}</p>
                    <p className="text-xs text-slate-500">
                      {formatMoney(alert.previousPrice, currencyCode)} to {formatMoney(alert.latestPrice, currencyCode)} at {alert.latestVendor}
                      {' · '}
                      {alert.direction === 'up' ? 'up' : 'down'} {Math.abs(Math.round(alert.percent))}%
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 space-y-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-600" />
            Cheaper at another till
          </h2>
          {shopLeads.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              Buy the same item at two shops and this shows which till was cheaper.
            </p>
          ) : (
            <ul className="space-y-3">
              {shopLeads.map((lead) => (
                <li key={`${lead.item}-${lead.cheapVendor}`} className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{lead.item}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatMoney(lead.cheapPrice, currencyCode)} at {lead.cheapVendor}
                    {' · '}
                    {formatMoney(lead.dearPrice, currencyCode)} at {lead.dearVendor}
                    {' · save '}
                    {formatMoney(lead.saving, currencyCode)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BadgePercent className="w-4 h-4 text-emerald-600" />
              VAT year {vatYear.label}
            </h2>
            <span className="text-xs text-slate-400">15% check</span>
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {formatMoney(vatYear.inputVat, currencyCode)}
          </p>
          <p className="text-xs text-slate-500">
            Input VAT on {vatYear.taxableSlips} taxable slip{vatYear.taxableSlips === 1 ? '' : 's'} since {vatYear.start}. Fuel and prepaid power are left out when no VAT was charged. This is a household check, not a SARS return.
          </p>
          {vatYear.flags.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No slip in this tax year is more than a few cents off 15% of its subtotal.
            </p>
          ) : (
            <ul className="space-y-2">
              {vatYear.flags.slice(0, 3).map((flag) => (
                <li key={flag.id} className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-xl px-3 py-2">
                  <span className="font-semibold">{flag.vendor}</span>
                  {' · '}
                  tax {formatMoney(flag.tax, currencyCode)} vs {formatMoney(flag.expected, currencyCode)} expected
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              Recent slips
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1"
            >
              Ledger
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {source.length === 0 ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-slate-500">No slips yet.</p>
              <button
                type="button"
                onClick={onOpenReceiptScanModal}
                className="min-h-11 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
              >
                Scan your first slip
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentSlips.map((rcpt) => (
                <li key={rcpt.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate('expenses')}
                    className="w-full py-3 flex items-center justify-between gap-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-sm text-slate-900 dark:text-white truncate">
                        {rcpt.vendor_name}
                      </span>
                      <span className="block text-xs text-slate-500 truncate mt-0.5">
                        {rcpt.invoice_date} · {formatCategoryLabel(rcpt.category)}
                      </span>
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums shrink-0">
                      {formatMoney(rcpt.total_amount, currencyCode)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-600" />
              This month by category
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1"
            >
              Full view
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {Object.keys(categoryTotals).length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Nothing in {monthLabel} yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(categoryTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => {
                  const limit = categoryBudgets[cat as keyof typeof categoryBudgets] || 0;
                  const pct = limit > 0 ? Math.min(100, Math.round((amount / limit) * 100)) : 0;
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm gap-3">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {formatCategoryLabel(cat)}
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                          {formatMoney(amount, currencyCode)}
                          {limit > 0 ? (
                            <span className="text-slate-400 font-normal"> / {formatMoney(limit, currencyCode)}</span>
                          ) : null}
                        </span>
                      </div>
                      {limit > 0 && (
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
          <p className="text-xs text-slate-400 inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Saved on this device. Duplicate slips are blocked before they land in the ledger.
          </p>
        </section>
      </div>
    </div>
  );
};

export default FieldDashboard;
