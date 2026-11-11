import React from 'react';
import { LayoutDashboard, Receipt, BarChart3, Settings, Camera } from 'lucide-react';
import type { NavTab } from './Navigation';

interface MobileBottomNavProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  receiptCount: number;
  onScan: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  receiptCount,
  onScan,
}) => {
  const sideTabs: {
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    {
      id: 'expenses',
      label: receiptCount > 0 ? `Slips ${receiptCount}` : 'Slips',
      icon: Receipt,
    },
  ];

  const rightTabs: {
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'reports', label: 'Insights', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderTab = (tab: (typeof sideTabs)[number]) => {
    const Icon = tab.icon;
    const isActive =
      activeTab === tab.id ||
      (tab.id === 'expenses' && (activeTab === 'receipts' || activeTab === 'scanner'));
    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => setActiveTab(tab.id)}
        className={`min-h-12 min-w-11 flex flex-col items-center justify-center px-1 rounded-xl ${
          isActive
            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className="text-[10px] font-medium mt-0.5 truncate max-w-full">{tab.label}</span>
      </button>
    );
  };

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe"
    >
      <div className="grid grid-cols-5 items-center h-[4.5rem] px-2">
        {sideTabs.map(renderTab)}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onScan}
            aria-label="Scan a slip"
            className="h-12 w-12 rounded-full bg-emerald-600 text-white shadow-md flex items-center justify-center"
          >
            <Camera className="w-6 h-6" />
          </button>
        </div>
        {rightTabs.map(renderTab)}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
