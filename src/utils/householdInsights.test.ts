import assert from 'node:assert/strict';
import test from 'node:test';
import type { SavedReceipt } from '../types.ts';
import {
  cheaperShopLeads,
  listReturnableSlips,
  monthPace,
  priceMemoryAlerts,
  receiptsToCsv,
  retailerPolicy,
  returnWindowDays,
  saTaxYearBounds,
  vatYearSnapshot,
} from './householdInsights.ts';

function slip(partial: Partial<SavedReceipt> & Pick<SavedReceipt, 'id'>): SavedReceipt {
  return {
    vendor_name: 'Pick n Pay',
    invoice_date: '2026-11-02',
    month_year: '2026-11',
    category: 'Food & Groceries',
    currency: 'ZAR',
    line_items: [],
    subtotal: 100,
    tax: 15,
    total_amount: 115,
    notes: '',
    created_at: '2026-11-02T10:00:00.000Z',
    ...partial,
  };
}

test('utilities and fuel have no return window', () => {
  assert.equal(returnWindowDays('Electricity & Utilities'), null);
  assert.equal(returnWindowDays('Transport'), null);
  assert.equal(returnWindowDays('Food & Groceries'), 14);
  assert.equal(returnWindowDays('Home Maintenance'), 30);
});

test('known shops use their own return guide, unknown groceries stay short', () => {
  assert.equal(retailerPolicy('Pick n Pay Sandton')?.days, 30);
  assert.equal(retailerPolicy('Engen Lynnwood')?.days, null);
  assert.equal(retailerPolicy('Corner Cafe') , null);

  const today = new Date(2026, 10, 9);
  const rows = listReturnableSlips(
    [
      slip({ id: 'open', invoice_date: '2026-11-02', category: 'Food & Groceries' }),
      slip({ id: 'old', invoice_date: '2026-10-01', month_year: '2026-10', category: 'Food & Groceries' }),
      slip({
        id: 'power',
        vendor_name: 'Eskom',
        category: 'Electricity & Utilities',
        invoice_date: '2026-11-01',
      }),
      slip({
        id: 'hardware',
        vendor_name: 'Builders',
        category: 'Home Maintenance',
        invoice_date: '2026-10-20',
        month_year: '2026-10',
      }),
      slip({
        id: 'cafe',
        vendor_name: 'Corner Cafe',
        invoice_date: '2026-11-02',
        category: 'Food & Groceries',
      }),
    ],
    today
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ['cafe', 'hardware', 'open']
  );
  assert.equal(rows[0].daysLeft, 7);
  assert.equal(rows[0].policyLabel, 'Typical window');
  assert.equal(rows[2].policyLabel, 'Pick n Pay guide');
  assert.equal(rows[2].daysLeft, 23);
});

test('cheaper till compares the latest price at each shop', () => {
  const leads = cheaperShopLeads([
    slip({
      id: 'pnp',
      vendor_name: 'Pick n Pay',
      invoice_date: '2026-11-05',
      line_items: [
        { description: 'Clover Full Cream Milk 2L', quantity: 1, unit_price: 36.99, total_price: 36.99 },
      ],
    }),
    slip({
      id: 'checkers',
      vendor_name: 'Checkers',
      invoice_date: '2026-11-08',
      line_items: [
        { description: 'Clover Full Cream Milk 2L', quantity: 1, unit_price: 31.99, total_price: 31.99 },
      ],
    }),
  ]);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].cheapVendor, 'Checkers');
  assert.equal(leads[0].dearVendor, 'Pick n Pay');
  assert.equal(Math.round(leads[0].saving * 100), 500);
});

test('vat year sums 15% and flags a slip that does not match', () => {
  const bounds = saTaxYearBounds(new Date(2026, 10, 9));
  assert.equal(bounds.start, '2026-03-01');
  assert.equal(bounds.label, '2026/27');

  const snapshot = vatYearSnapshot(
    [
      slip({ id: 'ok', invoice_date: '2026-11-02', subtotal: 100, tax: 15, total_amount: 115 }),
      slip({
        id: 'off',
        vendor_name: 'Corner Cafe',
        invoice_date: '2026-11-03',
        subtotal: 100,
        tax: 5,
        total_amount: 105,
      }),
      slip({
        id: 'fuel',
        vendor_name: 'Engen',
        category: 'Transport',
        invoice_date: '2026-11-04',
        subtotal: 600,
        tax: 0,
        total_amount: 600,
      }),
      slip({
        id: 'before',
        invoice_date: '2026-02-01',
        month_year: '2026-02',
        subtotal: 200,
        tax: 30,
        total_amount: 230,
      }),
    ],
    new Date(2026, 10, 9)
  );
  assert.equal(snapshot.taxableSlips, 2);
  assert.equal(snapshot.inputVat, 20);
  assert.equal(snapshot.flags.length, 1);
  assert.equal(snapshot.flags[0].id, 'off');
  assert.equal(snapshot.flags[0].expected, 15);
});

test('price memory flags a repeated item that jumped', () => {
  const alerts = priceMemoryAlerts([
    slip({
      id: 'a',
      invoice_date: '2026-10-18',
      month_year: '2026-10',
      line_items: [
        { description: 'Clover Full Cream Milk 2L', quantity: 1, unit_price: 32.99, total_price: 32.99 },
      ],
    }),
    slip({
      id: 'b',
      invoice_date: '2026-11-02',
      line_items: [
        { description: 'Clover Full Cream Milk 2L', quantity: 2, unit_price: 36.99, total_price: 73.98 },
      ],
    }),
  ]);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].direction, 'up');
  assert.equal(alerts[0].latestPrice, 36.99);
  assert.ok(alerts[0].percent > 5);
});

test('month pace compares spend with how much of the month has passed', () => {
  const pace = monthPace(
    [slip({ id: 'now', total_amount: 800 })],
    { 'Food & Groceries': 1000, Transport: 0, 'Electricity & Utilities': 0, 'Home Maintenance': 0, Other: 0 },
    new Date(2026, 10, 9)
  );
  assert.equal(pace.dayOfMonth, 9);
  assert.equal(pace.daysInMonth, 30);
  assert.equal(pace.spent, 800);
  assert.equal(pace.budgetTotal, 1000);
  assert.equal(pace.spentPercent, 80);
  assert.equal(pace.status, 'running_hot');
});

test('csv escapes commas and quotes in shop names', () => {
  const csv = receiptsToCsv([
    slip({ id: 'q', vendor_name: 'Pick n Pay, "Sandton"', invoice_number: 'T-19' }),
  ]);
  assert.match(csv, /Date,Shop,Category/);
  assert.match(csv, /"Pick n Pay, ""Sandton"""/);
  assert.match(csv, /T-19/);
});
