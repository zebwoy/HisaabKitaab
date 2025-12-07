import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Download,
  Eye,
  EyeOff,
  LogOut,
  Calendar,
  TrendingUp,
  TrendingDown,
  Moon,
  Sun,
  Palette,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import Select, { SingleValue } from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';

interface Transaction {
  id: number;
  date: string;
  category: 'Income' | 'Expense';
  subcategory: string;
  sender: string;
  receiver: string;
  remarks: string;
  amount: number;
  created_at?: string;
}

interface FormState {
  date: string;
  category: 'Income' | 'Expense';
  subcategory: string;
  amount: string;
  sender: string;
  receiver: string;
  remarks: string;
}

const getDefaultFormState = (): FormState => ({
    date: new Date().toISOString().split('T')[0],
    category: 'Income',
    subcategory: 'Donations',
    amount: '',
  sender: '',
  receiver: '',
  remarks: '',
});

interface CategoryOption {
  value: 'Income' | 'Expense';
  label: string;
}

interface SubcategoryOption {
  value: string;
  label: string;
}

interface ReceiverOption {
  value: string;
  label: string;
}

type ColorPalette = 'indigo' | 'blue' | 'purple' | 'emerald' | 'rose';
type ThemeMode = 'light' | 'dark';

interface Theme {
  mode: ThemeMode;
  palette: ColorPalette;
}

export default function AccountingSystem() {
  // Initialize login state from sessionStorage to persist across refreshes
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem('madrasah_logged_in') === 'true';
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState('');
  const [formData, setFormData] = useState<FormState>(getDefaultFormState());
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('add');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dataError, setDataError] = useState('');
  const [receiverFilter, setReceiverFilter] = useState<string>('');
  
  // Date range filter state
  const [dateRange, setDateRange] = useState({
    fromDate: '',
    toDate: ''
  });
  const [dateFilterMode, setDateFilterMode] = useState<'thisMonth' | 'thisQuarter' | 'thisFiscalYear' | 'allTime' | 'custom'>('thisMonth'); // 'custom', 'thisMonth', 'thisQuarter', 'thisFiscalYear', 'allTime'

  // Theme state
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('madrasah_theme');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { mode: 'light', palette: 'indigo' };
      }
    }
    return { mode: 'light', palette: 'indigo' };
  });
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // Apply theme to document
  useEffect(() => {
    localStorage.setItem('madrasah_theme', JSON.stringify(theme));
    const root = document.documentElement;
    root.classList.toggle('dark', theme.mode === 'dark');
    root.setAttribute('data-theme', theme.palette);
    
    // Set CSS variable for DatePicker selected color in light mode
    if (theme.mode === 'light') {
      const paletteColors = {
        indigo: '#4f46e5',
        blue: '#2563eb',
        purple: '#9333ea',
        emerald: '#059669',
        rose: '#e11d48',
      };
      root.style.setProperty('--selected-color', paletteColors[theme.palette]);
    } else {
      root.style.setProperty('--selected-color', '#1f2937');
    }
  }, [theme]);

  // Helper function to get primary button classes based on theme
  const getPrimaryButtonClasses = (isActive = true) => {
    if (!isActive) return 'bg-gray-100 dark:bg-gray-900 dark:border-gray-800 text-gray-700 dark:text-gray-300 border dark:border-gray-900';
    if (theme.mode === 'dark') {
      return 'bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white';
    }
    // Light mode - use palette
    const paletteMap = {
      indigo: 'bg-indigo-600 hover:bg-indigo-700',
      blue: 'bg-blue-600 hover:bg-blue-700',
      purple: 'bg-purple-600 hover:bg-purple-700',
      emerald: 'bg-emerald-600 hover:bg-emerald-700',
      rose: 'bg-rose-600 hover:bg-rose-700',
    };
    return paletteMap[theme.palette] + ' text-white';
  };

  // ---- MASTER DATA ----

  const incomeSubcategories = ['Donations', 'Student Fees', 'Grants', 'Other Income'];
  const expenseSubcategories = ['Salaries', 'Utilities', 'Books & Materials', 'Infrastructure', 'Other Expenses'];

  const categoryOptions: CategoryOption[] = [
    { value: 'Income', label: 'Income' },
    { value: 'Expense', label: 'Expense' },
  ];

  const getSubcategoryOptions = (): SubcategoryOption[] => {
    const list = formData.category === 'Income' ? incomeSubcategories : expenseSubcategories;
    return list.map((sub) => ({ value: sub, label: sub }));
  };
  const subcategoryOptions = getSubcategoryOptions();
  const receiverOptions: ReceiverOption[] = [
    { value: 'AbdurRauf', label: 'AbdurRauf' },
    { value: 'Rahib', label: 'Rahib' },
    { value: 'Ayman', label: 'Ayman' },
  ];
  const receiverFilterOptions: ReceiverOption[] = [
    { value: '', label: 'All Receivers' },
    ...receiverOptions,
  ];

  const fetchTransactions = useCallback(async () => {
    setIsLoadingData(true);
    setDataError('');
    try {
      const response = await fetch('/.netlify/functions/transactions');
      if (!response.ok) {
        throw new Error('Unable to load transactions from the server.');
      }
      const data: Transaction[] = await response.json();
      setTransactions(data);
    } catch (error) {
      setDataError((error as Error).message || 'Unable to load transactions.');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem('madrasah_logged_in') === 'true') {
      setIsLoggedIn(true);
    }

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setDateRange({
      fromDate: firstDay.toISOString().split('T')[0],
      toDate: lastDay.toISOString().split('T')[0]
    });
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Helper function to get date range based on filter mode
  const getDateRangeForMode = (mode: 'thisMonth' | 'thisQuarter' | 'thisFiscalYear' | 'allTime' | 'custom') => {
    const today = new Date();
    
    switch (mode) {
      case 'thisMonth': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          fromDate: firstDay.toISOString().split('T')[0],
          toDate: lastDay.toISOString().split('T')[0]
        };
      }
      case 'thisQuarter': {
        const quarter = Math.floor(today.getMonth() / 3);
        const firstDay = new Date(today.getFullYear(), quarter * 3, 1);
        const lastDay = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
        return {
          fromDate: firstDay.toISOString().split('T')[0],
          toDate: lastDay.toISOString().split('T')[0]
        };
      }
      case 'thisFiscalYear': {
        // India fiscal year: April 1 to March 31
        const fiscalYearStart = today.getMonth() >= 3 
          ? new Date(today.getFullYear(), 3, 1)  // April 1 of current year
          : new Date(today.getFullYear() - 1, 3, 1);  // April 1 of previous year
        const fiscalYearEnd = today.getMonth() >= 3
          ? new Date(today.getFullYear() + 1, 2, 31)  // March 31 of next year
          : new Date(today.getFullYear(), 2, 31);  // March 31 of current year
        return {
          fromDate: fiscalYearStart.toISOString().split('T')[0],
          toDate: fiscalYearEnd.toISOString().split('T')[0]
        };
      }
      case 'allTime':
        return { fromDate: '', toDate: '' };
      default:
        return dateRange;
    }
  };

  // Helper function to filter transactions by date range
  const getFilteredTransactions = (): Transaction[] => {
    let filtered = transactions;
    
    if (receiverFilter) {
      filtered = filtered.filter(t => t.receiver === receiverFilter);
    }

    if (dateFilterMode !== 'allTime') {
      const range = dateFilterMode === 'custom' ? dateRange : getDateRangeForMode(dateFilterMode);
    
    if (range.fromDate) {
      filtered = filtered.filter(t => t.date >= range.fromDate);
    }
    if (range.toDate) {
      filtered = filtered.filter(t => t.date <= range.toDate);
      }
    }
    
    return filtered;
  };

  // Helper function to get previous period for comparison
  const getPreviousPeriodRange = () => {
    let currentRange;
    
    if (dateFilterMode === 'custom') {
      currentRange = dateRange;
    } else {
      currentRange = getDateRangeForMode(dateFilterMode);
    }
    
    if (!currentRange.fromDate || !currentRange.toDate) {
      return null;
    }
    
    const fromDate = new Date(currentRange.fromDate);
    const toDate = new Date(currentRange.toDate);
    const diffMs = toDate.getTime() - fromDate.getTime();
    const daysDiff = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
    
    const prevFromDate = new Date(fromDate);
    prevFromDate.setFullYear(prevFromDate.getFullYear() - 1);
    
    const prevToDate = new Date(prevFromDate);
    prevToDate.setDate(prevToDate.getDate() + daysDiff - 1);
    
    return {
      fromDate: prevFromDate.toISOString().split('T')[0],
      toDate: prevToDate.toISOString().split('T')[0]
    };
  };

  // Get transactions for previous period
  const getPreviousPeriodTransactions = (): Transaction[] => {
    const prevRange = getPreviousPeriodRange();
    if (!prevRange) return [];
    
    return transactions.filter(t => 
      t.date >= prevRange.fromDate && t.date <= prevRange.toDate
    );
  };

  // Handle quick filter button clicks
  const handleQuickFilter = (mode: 'thisMonth' | 'thisQuarter' | 'thisFiscalYear' | 'allTime' | 'custom') => {
    setDateFilterMode(mode);
    if (mode !== 'custom' && mode !== 'allTime') {
      const range = getDateRangeForMode(mode);
      setDateRange(range);
    } else if (mode === 'allTime') {
      setDateRange({ fromDate: '', toDate: '' });
    }
  };

  const handleCategorySelect = (option: SingleValue<CategoryOption>) => {
    const value = option?.value ?? 'Income';
    setFormData({
      ...formData,
      category: value,
      subcategory: value === 'Income' ? 'Donations' : 'Salaries',
    });
  };

  const handleSubcategorySelect = (option: SingleValue<SubcategoryOption>) => {
    const value = option?.value ?? '';
    setFormData({ ...formData, subcategory: value });
  };

  const handleReceiverSelect = (option: SingleValue<ReceiverOption>) => {
    const value = option?.value ?? '';
    setFormData({ ...formData, receiver: value });
  };

  // ---- AUTH & VALIDATION ----

  const validateTransactionForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.date) {
      errors.date = 'Date is required';
    }
    if (!formData.category) {
      errors.category = 'Category is required';
    }
    if (!formData.subcategory) {
      errors.subcategory = 'Subcategory is required';
    }
    if (!formData.sender.trim()) {
      errors.sender = 'Sender is required';
    }
    if (!formData.receiver.trim()) {
      errors.receiver = 'Receiver is required';
    }
    if (formData.remarks.trim() && formData.remarks.trim().length < 3) {
      errors.remarks = 'Remarks should be at least 3 characters';
    }

    if (formData.amount === '') {
      errors.amount = 'Amount is required';
    } else {
      const num = Number(formData.amount);
      if (Number.isNaN(num)) {
        errors.amount = 'Amount must be a number';
      } else if (num <= 0) {
        errors.amount = 'Amount must be greater than zero';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    if (!loginPassword.trim()) {
      setAuthError('Enter the password');
      return;
    }

    setIsAuthenticating(true);
    setAuthError('');

    try {
      const response = await fetch('/.netlify/functions/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword }),
      });

      if (response.ok) {
      setIsLoggedIn(true);
      setLoginPassword('');
        sessionStorage.setItem('madrasah_logged_in', 'true');
    } else {
        const data = await response.json().catch(() => null);
        setAuthError(data?.message || 'Incorrect password. Please try again.');
      }
    } catch (error) {
      setAuthError('Unable to login right now. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoginPassword('');
    // Clear session on logout
    sessionStorage.removeItem('madrasah_logged_in');
  };

  const handleAddTransaction = async () => {
    if (!validateTransactionForm()) return;
    setIsSyncing(true);
    setDataError('');

    const payload = {
      ...formData,
      sender: formData.sender.trim(),
      receiver: formData.receiver.trim(),
      remarks: formData.remarks.trim(),
      amount: Number(formData.amount),
    };

    try {
      const response = await fetch('/.netlify/functions/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Unable to save the transaction. Please try again.');
      }

      const created: Transaction = await response.json();
      setTransactions((prev) => [created, ...prev]);
      setFormData(getDefaultFormState());
      setFormErrors({});
    } catch (error) {
      setDataError((error as Error).message || 'Unable to save the transaction.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!window.confirm('Delete this transaction?')) {
      return;
    }

    setIsSyncing(true);
    setDataError('');
    try {
      const response = await fetch(`/.netlify/functions/transactions?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok && response.status !== 204) {
        throw new Error('Unable to delete the transaction.');
      }

      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      setDataError((error as Error).message || 'Unable to delete the transaction.');
    } finally {
      setIsSyncing(false);
    }
  };

  const calculateStats = (trans: Transaction[]) => {
    const income = trans
      .filter(t => t.category === 'Income')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
    const expenses = trans
      .filter(t => t.category === 'Expense')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return { income, expenses, balance: income - expenses };
  };

  const exportToCSV = () => {
    const filteredTrans = getFilteredTransactions();
    const headers = ['Date', 'Category', 'Subcategory', 'Sender', 'Receiver', 'Amount', 'Remarks'];
    const rows = filteredTrans.map(t => [
      t.date,
      t.category,
      t.subcategory,
      t.sender,
      t.receiver,
      t.amount,
      t.remarks || ''
    ]);

    const dateRangeStr = dateFilterMode === 'custom' 
      ? `${dateRange.fromDate}_to_${dateRange.toDate}`
      : dateFilterMode;
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `madrasah_accounts_${dateRangeStr}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Get category-wise breakdown
  const getCategoryBreakdown = (transList: Transaction[], category: 'Income' | 'Expense') => {
    type BreakdownRow = { sub: string; total: number; count: number };
    return transList
      .filter((t: Transaction) => t.category === category)
      .reduce<BreakdownRow[]>((acc, t) => {
        const existing = acc.find((x) => x.sub === t.subcategory);
        if (existing) {
          existing.total += (Number(t.amount) || 0);
          existing.count += 1;
        } else {
          acc.push({ sub: t.subcategory, total: (Number(t.amount) || 0), count: 1 });
        }
        return acc;
      }, [])
      .sort((a, b) => b.total - a.total);
  };

  const getReceiverStats = (transList: Transaction[]) => {
    const map = new Map<string, { income: number; expenses: number }>();
    transList.forEach((t) => {
      const key = t.receiver || 'Unassigned';
      if (!map.has(key)) {
        map.set(key, { income: 0, expenses: 0 });
      }
      const entry = map.get(key)!;
      if (t.category === 'Income') entry.income += (Number(t.amount) || 0);
      else entry.expenses += (Number(t.amount) || 0);
    });
    return Array.from(map.entries()).map(([receiver, { income, expenses }]) => ({
      receiver,
      income,
      expenses,
      balance: income - expenses,
    }));
  };

  const filteredTransactions = getFilteredTransactions();
  const stats = calculateStats(filteredTransactions);
  const allTimeStats = calculateStats(transactions);
  const previousPeriodStats = calculateStats(getPreviousPeriodTransactions());
  const previousRange = getPreviousPeriodRange();

  const formatCurrency = (value: number) => {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  };

  const parseLocalDate = (dateString: string) => {
    if (!dateString) return null;
    // Parse YYYY-MM-DD as a local date to avoid UTC timezone shifts
    const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
    if (ymdMatch) {
      const [, y, m, d] = ymdMatch;
      return new Date(Number(y), Number(m) - 1, Number(d));
    }
    const fallback = new Date(dateString);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return '';
    const date = parseLocalDate(dateString);
    if (!date) return dateString;

    const day = date.getDate();
    const suffix =
      day === 1 || day === 21 || day === 31 ? 'st' :
        day === 2 || day === 22 ? 'nd' :
          day === 3 || day === 23 ? 'rd' :
            'th';

    const monthYear = date.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
    const weekday = date.toLocaleDateString('en-IN', { weekday: 'long' });

    return `${day}${suffix} ${monthYear} (${weekday})`;
  };

  const formatDisplayDateShort = (dateString: string) => {
    const date = parseLocalDate(dateString);
    if (!date) return dateString || '';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatPeriodLabel = () => {
    if (dateFilterMode === 'custom') {
      return `${formatDisplayDateShort(dateRange.fromDate)} to ${formatDisplayDateShort(dateRange.toDate)}`;
    }
    if (dateFilterMode === 'allTime') {
      return 'All time';
    }
    const today = new Date();
    if (dateFilterMode === 'thisMonth') {
      return today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }
    if (dateFilterMode === 'thisQuarter') {
      const q = Math.floor(today.getMonth() / 3);
      const year = today.getFullYear();
      const startMonth = new Date(year, q * 3, 1).toLocaleString('en-IN', { month: 'short' });
      const endMonth = new Date(year, q * 3 + 2, 1).toLocaleString('en-IN', { month: 'short' });
      return `Q${q + 1} ${year} (${startMonth} – ${endMonth})`;
    }
    if (dateFilterMode === 'thisFiscalYear') {
      const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      const fyEndYear = fyStartYear + 1;
      return `FY ${fyStartYear}-${fyEndYear}`;
    }
    return dateFilterMode;
  };

  const formatPreviousPeriodLabel = () => {
    if (!previousRange) return '';
    return `Same period last year: ${formatDisplayDateShort(previousRange.fromDate)} – ${formatDisplayDateShort(previousRange.toDate)}`;
  };

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
          <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 text-white p-10">
            <div>
              <p className="text-sm font-medium text-white/80">Madrasah-e-Millat Bhiwandi</p>
              <h1 className="text-3xl font-bold mt-2 leading-tight">Accounting & Reporting</h1>
              <p className="mt-4 text-white/80 text-sm leading-relaxed">
                Secure access to your finance workspace. All data stays protected;
                passwords are validated on the server and never stored in the browser.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/80">
              <span className="h-2 w-2 rounded-full bg-emerald-300"></span>
              Encrypted connection • Server-side auth
            </div>
          </div>

          <div className="bg-white text-slate-900 p-8 md:p-10">
            <div className="mb-8">
              <p className="text-sm font-semibold text-indigo-600 mb-2">Welcome back</p>
              <h2 className="text-2xl font-bold text-slate-900">Sign in to continue</h2>
              <p className="text-sm text-slate-500 mt-1">Use the admin password provided.</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLogin();
              }}
              className="space-y-4"
            >
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {authError && (
                <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthenticating}
                className={`w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-indigo-700 transition ${isAuthenticating ? 'opacity-80 cursor-not-allowed' : ''
                  }`}
              >
                {isAuthenticating ? 'Signing in...' : 'Sign in'}
              </button>

              <p className="text-xs text-slate-500 text-center">
                Password is verified securely on the server and never stored in the browser.
              </p>
            </form>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className={`${
        theme.mode === 'dark' 
          ? 'bg-black border-b border-gray-900' 
          : (theme.palette === 'indigo' ? 'bg-indigo-600' :
             theme.palette === 'blue' ? 'bg-blue-600' :
             theme.palette === 'purple' ? 'bg-purple-600' :
             theme.palette === 'emerald' ? 'bg-emerald-600' :
             'bg-rose-600')
      } text-white shadow-lg`}>
        <div className="max-w-6xl mx-auto px-4 py-4 md:py-6 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Madrasah-e-Millat Bhiwandi</h1>
            <p className={`text-xs md:text-sm ${theme.mode === 'dark' ? 'text-gray-300' : 'opacity-90'}`}>Accounts | Reporting | Reconciliation</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                  className="w-full md:w-auto justify-center bg-white/20 hover:bg-white/30 dark:bg-gray-900 dark:hover:bg-gray-800 px-4 py-2 rounded-lg flex items-center gap-2 text-sm md:text-base transition-colors"
                title="Theme Settings"
              >
                {theme.mode === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                <Palette size={16} />
              </button>
              
              {/* Theme Menu */}
              {showThemeMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowThemeMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-black dark:border dark:border-gray-900 rounded-lg shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-gray-200 z-50 p-4">
                    {/* Mode Toggle */}
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Mode</p>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Sun size={18} className={theme.mode === 'light' ? 'text-yellow-500' : 'text-gray-400'} />
                          <span className={`text-sm font-medium ${theme.mode === 'light' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>Light</span>
                        </div>
                        <button
                          onClick={() => setTheme({ ...theme, mode: theme.mode === 'light' ? 'dark' : 'light' })}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            theme.mode === 'dark'
                              ? 'bg-gray-900 focus:ring-gray-800'
                              : (theme.palette === 'indigo' ? 'bg-indigo-600 focus:ring-indigo-500' :
                                 theme.palette === 'blue' ? 'bg-blue-600 focus:ring-blue-500' :
                                 theme.palette === 'purple' ? 'bg-purple-600 focus:ring-purple-500' :
                                 theme.palette === 'emerald' ? 'bg-emerald-600 focus:ring-emerald-500' :
                                 'bg-rose-600 focus:ring-rose-500')
                          }`}
                          role="switch"
                          aria-checked={theme.mode === 'dark'}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                              theme.mode === 'dark' ? 'translate-x-8' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <div className="flex items-center gap-2">
                          <Moon size={18} className={theme.mode === 'dark' ? 'text-blue-400' : 'text-gray-400'} />
                          <span className={`text-sm font-medium ${theme.mode === 'dark' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>Dark</span>
                        </div>
                      </div>
                    </div>
                        
                    {/* Color Palette - Only show in light mode */}
                    {theme.mode === 'light' && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Color Palette</p>
                      <div className="grid grid-cols-5 gap-2">
                            {(['indigo', 'blue', 'purple', 'emerald', 'rose'] as ColorPalette[]).map((palette) => {
                              const isSelected = theme.palette === palette;
                              const baseClasses = isSelected 
                                ? 'ring-2 ring-offset-2 scale-110' 
                                : 'hover:scale-105';
                              const colorClasses = {
                                indigo: isSelected ? 'bg-indigo-600 ring-indigo-600' : 'bg-indigo-500 hover:bg-indigo-600',
                                blue: isSelected ? 'bg-blue-600 ring-blue-600' : 'bg-blue-500 hover:bg-blue-600',
                                purple: isSelected ? 'bg-purple-600 ring-purple-600' : 'bg-purple-500 hover:bg-purple-600',
                                emerald: isSelected ? 'bg-emerald-600 ring-emerald-600' : 'bg-emerald-500 hover:bg-emerald-600',
                                rose: isSelected ? 'bg-rose-600 ring-rose-600' : 'bg-rose-500 hover:bg-rose-600',
                              };
                              return (
                                <button
                                  key={palette}
                                  onClick={() => setTheme({ ...theme, palette })}
                                  className={`w-full h-10 rounded-lg transition-all ${baseClasses} ${colorClasses[palette]}`}
                                  title={palette.charAt(0).toUpperCase() + palette.slice(1)}
                                />
                              );
                            })}
                          </div>
                        </div>
                    )}
                      </div>
                    </>
                  )}
                </div>
                
          <button
            onClick={handleLogout}
                  className="w-full md:w-auto justify-center bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm md:text-base"
          >
            <LogOut size={18} /> Logout
          </button>
              </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Dashboard Stats - All Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:shadow-2xl dark:hover:shadow-[0_15px_40px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-y-1 p-4 md:p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Total Income (All Time)</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(allTimeStats.income)}</p>
          </div>
          <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:shadow-2xl dark:hover:shadow-[0_15px_40px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-y-1 p-4 md:p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Total Expenses (All Time)</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(allTimeStats.expenses)}</p>
          </div>
          <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:shadow-2xl dark:hover:shadow-[0_15px_40px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-y-1 p-4 md:p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Balance (All Time)</p>
            <p className={`text-2xl font-bold ${allTimeStats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
              {formatCurrency(allTimeStats.balance)}
            </p>
          </div>
          <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:shadow-2xl dark:hover:shadow-[0_15px_40px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-y-1 p-4 md:p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Current Filter Balance</p>
            <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
              {formatCurrency(stats.balance)}
            </p>
          </div>
        </div>

        {dataError && (
          <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {dataError}
          </div>
        )}
        {isSyncing && (
          <div             className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            theme.mode === 'dark'
              ? 'border-gray-900 bg-gray-900/50 text-gray-300'
              : (theme.palette === 'indigo' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' :
                 theme.palette === 'blue' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                 theme.palette === 'purple' ? 'border-purple-200 bg-purple-50 text-purple-700' :
                 theme.palette === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                 'border-rose-200 bg-rose-50 text-rose-700')
          }`}>
            Syncing with Netlify DB...
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTab('add')}
            className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${
              activeTab === 'add'
                ? (theme.mode === 'dark' 
                    ? 'bg-gray-900 border border-gray-800 text-white' 
                    : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                       theme.palette === 'blue' ? 'bg-blue-600' :
                       theme.palette === 'purple' ? 'bg-purple-600' :
                       theme.palette === 'emerald' ? 'bg-emerald-600' :
                       'bg-rose-600') + ' text-white')
                : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900'
            }`}
          >
            <Plus size={18} /> Add Transaction
          </button>
          <button
            onClick={() => setActiveTab('view')}
            className={`px-4 py-2 rounded-lg font-semibold ${
              activeTab === 'view'
                ? (theme.mode === 'dark' 
                    ? 'bg-gray-900 border border-gray-800 text-white' 
                    : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                       theme.palette === 'blue' ? 'bg-blue-600' :
                       theme.palette === 'purple' ? 'bg-purple-600' :
                       theme.palette === 'emerald' ? 'bg-emerald-600' :
                       'bg-rose-600') + ' text-white')
                : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900'
            }`}
          >
            View Transactions
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2 rounded-lg font-semibold ${
              activeTab === 'report'
                ? (theme.mode === 'dark' 
                    ? 'bg-gray-900 border border-gray-800 text-white' 
                    : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                       theme.palette === 'blue' ? 'bg-blue-600' :
                       theme.palette === 'purple' ? 'bg-purple-600' :
                       theme.palette === 'emerald' ? 'bg-emerald-600' :
                       'bg-rose-600') + ' text-white')
                : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900'
            }`}
          >
            Financial Reports
          </button>
        </div>

        {/* Add Transaction Tab */}
        {activeTab === 'add' && (
          <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Add New Transaction</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Date *</label>
                  <DatePicker
                    selected={formData.date ? new Date(formData.date) : null}
                    onChange={(date: Date | null) => {
                      setFormData({
                        ...formData,
                        date: date ? date.toISOString().split('T')[0] : '',
                      });
                    }}
                    dateFormat="yyyy-MM-dd"
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                      theme.mode === 'dark' 
                        ? 'focus:ring-gray-700' 
                        : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                           theme.palette === 'blue' ? 'focus:ring-blue-500' :
                           theme.palette === 'purple' ? 'focus:ring-purple-500' :
                           theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                           'focus:ring-rose-500')
                    } text-sm bg-white dark:bg-black text-gray-900 dark:text-gray-100`}
                    placeholderText="Select date"
                  />
                  {formErrors.date && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.date}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Category *</label>
                  <Select<CategoryOption>
                    options={categoryOptions}
                    value={categoryOptions.find((opt) => opt.value === formData.category)}
                    onChange={handleCategorySelect}
                    classNamePrefix="hk-select"
                    className="text-sm"
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: 8,
                        borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                        minHeight: '36px',
                        backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                        borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? (theme.mode === 'dark' 
                              ? '#1f2937' 
                              : (theme.palette === 'indigo' ? '#4f46e5' :
                                 theme.palette === 'blue' ? '#2563eb' :
                                 theme.palette === 'purple' ? '#9333ea' :
                                 theme.palette === 'emerald' ? '#059669' :
                                 '#e11d48'))
                          : state.isFocused
                          ? (theme.mode === 'dark' ? '#1f2937' : '#f3f4f6')
                          : 'transparent',
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      singleValue: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      input: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                    }}
                  />
                  {formErrors.category && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.category}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Subcategory *</label>
                  <Select<SubcategoryOption>
                    options={subcategoryOptions}
                    value={subcategoryOptions.find((opt) => opt.value === formData.subcategory)}
                    onChange={handleSubcategorySelect}
                    classNamePrefix="hk-select"
                    className="text-sm"
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: 8,
                        borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                        minHeight: '36px',
                        backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                      }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                        borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? (theme.mode === 'dark' 
                              ? '#1f2937' 
                              : (theme.palette === 'indigo' ? '#4f46e5' :
                                 theme.palette === 'blue' ? '#2563eb' :
                                 theme.palette === 'purple' ? '#9333ea' :
                                 theme.palette === 'emerald' ? '#059669' :
                                 '#e11d48'))
                          : state.isFocused
                          ? (theme.mode === 'dark' ? '#1f2937' : '#f3f4f6')
                          : 'transparent',
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      singleValue: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      input: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                    }}
                  />
                  {formErrors.subcategory && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.subcategory}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                      theme.mode === 'dark' 
                        ? 'focus:ring-gray-700' 
                        : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                           theme.palette === 'blue' ? 'focus:ring-blue-500' :
                           theme.palette === 'purple' ? 'focus:ring-purple-500' :
                           theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                           'focus:ring-rose-500')
                    } text-sm bg-white dark:bg-black dark:border-gray-900 text-gray-900 dark:text-gray-100`}
                  />
                  {formErrors.amount && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.amount}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    {formData.category === 'Income' ? 'Sender *' : 'Receiver *'}
                  </label>
                <input
                  type="text"
                    placeholder={
                      formData.category === 'Income'
                        ? 'Name or entity sending funds'
                        : 'Name or entity receiving funds'
                    }
                    value={formData.sender}
                    onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                    className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                      theme.mode === 'dark' 
                        ? 'focus:ring-gray-700' 
                        : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                           theme.palette === 'blue' ? 'focus:ring-blue-500' :
                           theme.palette === 'purple' ? 'focus:ring-purple-500' :
                           theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                           'focus:ring-rose-500')
                    } text-sm bg-white dark:bg-black dark:border-gray-900 text-gray-900 dark:text-gray-100`}
                  />
                  {formErrors.sender && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.sender}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    {formData.category === 'Income' ? 'Receiver *' : 'Sender *'}
                  </label>
                  <Select<ReceiverOption>
                    options={receiverOptions}
                    value={receiverOptions.find((opt) => opt.value === formData.receiver) ?? null}
                    onChange={handleReceiverSelect}
                    classNamePrefix="hk-select"
                    className="text-sm"
                    placeholder={formData.category === 'Income' ? 'Select Receiver' : 'Select Sender'}
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: 8,
                        borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                        minHeight: '36px',
                        backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                      }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                        borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? (theme.mode === 'dark' 
                              ? '#1f2937' 
                              : (theme.palette === 'indigo' ? '#4f46e5' :
                                 theme.palette === 'blue' ? '#2563eb' :
                                 theme.palette === 'purple' ? '#9333ea' :
                                 theme.palette === 'emerald' ? '#059669' :
                                 '#e11d48'))
                          : state.isFocused
                          ? (theme.mode === 'dark' ? '#1f2937' : '#f3f4f6')
                          : 'transparent',
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      singleValue: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      input: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      placeholder: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#9ca3af' : '#6b7280',
                      }),
                    }}
                  />
                  {formErrors.receiver && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.receiver}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Remarks (optional)</label>
                <textarea
                  placeholder="Brief context about this transaction"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  rows={3}
                  className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                    theme.mode === 'dark' 
                      ? 'focus:ring-gray-700' 
                      : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                         theme.palette === 'blue' ? 'focus:ring-blue-500' :
                         theme.palette === 'purple' ? 'focus:ring-purple-500' :
                         theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                         'focus:ring-rose-500')
                  } text-sm bg-white dark:bg-black text-gray-900 dark:text-gray-100`}
                />
                {formErrors.remarks && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.remarks}</p>
                )}
              </div>

              <button
                onClick={handleAddTransaction}
                disabled={isSyncing}
                className={`w-full ${getPrimaryButtonClasses()} py-2 rounded-lg font-semibold ${isSyncing ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isSyncing ? 'Saving...' : 'Add Transaction'}
              </button>
            </div>
          </div>
        )}

        {/* View Transactions Tab */}
        {activeTab === 'view' && (
          <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Transaction History</h2>
              <button
                onClick={exportToCSV}
                className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 dark:hover:bg-green-600"
              >
                <Download size={18} /> Export CSV ({filteredTransactions.length} transactions)
              </button>
            </div>

            {/* Date Filter for View Tab */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-lg dark:shadow-[0_10px_25px_rgba(0,0,0,0.7)]">
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => handleQuickFilter('thisMonth')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    dateFilterMode === 'thisMonth'
                        ? (theme.mode === 'dark' 
                            ? 'bg-gray-700 text-white' 
                            : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                               theme.palette === 'blue' ? 'bg-blue-600' :
                               theme.palette === 'purple' ? 'bg-purple-600' :
                               theme.palette === 'emerald' ? 'bg-emerald-600' :
                               'bg-rose-600') + ' text-white')
                        : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  This Month
                </button>
                <button
                  onClick={() => handleQuickFilter('thisQuarter')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    dateFilterMode === 'thisQuarter'
                        ? (theme.mode === 'dark' 
                            ? 'bg-gray-700 text-white' 
                            : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                               theme.palette === 'blue' ? 'bg-blue-600' :
                               theme.palette === 'purple' ? 'bg-purple-600' :
                               theme.palette === 'emerald' ? 'bg-emerald-600' :
                               'bg-rose-600') + ' text-white')
                        : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  This Quarter
                </button>
                <button
                  onClick={() => handleQuickFilter('thisFiscalYear')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    dateFilterMode === 'thisFiscalYear'
                        ? (theme.mode === 'dark' 
                            ? 'bg-gray-700 text-white' 
                            : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                               theme.palette === 'blue' ? 'bg-blue-600' :
                               theme.palette === 'purple' ? 'bg-purple-600' :
                               theme.palette === 'emerald' ? 'bg-emerald-600' :
                               'bg-rose-600') + ' text-white')
                        : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  This Fiscal Year
                </button>
                <button
                  onClick={() => handleQuickFilter('allTime')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    dateFilterMode === 'allTime'
                        ? (theme.mode === 'dark' 
                            ? 'bg-gray-700 text-white' 
                            : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                               theme.palette === 'blue' ? 'bg-blue-600' :
                               theme.palette === 'purple' ? 'bg-purple-600' :
                               theme.palette === 'emerald' ? 'bg-emerald-600' :
                               'bg-rose-600') + ' text-white')
                        : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  All Time
                </button>
                <button
                  onClick={() => {
                    if (dateFilterMode !== 'custom') {
                      // When switching to custom, preserve current range if available
                      if (dateFilterMode !== 'allTime') {
                        const currentRange = getDateRangeForMode(dateFilterMode);
                        setDateRange(currentRange);
                      }
                    }
                    setDateFilterMode('custom');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 ${
                    dateFilterMode === 'custom'
                        ? (theme.mode === 'dark' 
                            ? 'bg-gray-700 text-white' 
                            : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                               theme.palette === 'blue' ? 'bg-blue-600' :
                               theme.palette === 'purple' ? 'bg-purple-600' :
                               theme.palette === 'emerald' ? 'bg-emerald-600' :
                               'bg-rose-600') + ' text-white')
                        : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  <Calendar size={14} /> Custom Range
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Receiver Filter</label>
                  <Select
                    options={receiverFilterOptions}
                    value={receiverFilterOptions.find((opt) => opt.value === receiverFilter) ?? receiverFilterOptions[0]}
                    onChange={(option) => setReceiverFilter((option as ReceiverOption | null)?.value || '')}
                    classNamePrefix="hk-select"
                    className="text-sm"
                    placeholder="All Receivers"
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: 8,
                        borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                        minHeight: '36px',
                        backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                      }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
                        borderColor: theme.mode === 'dark' ? '#1f2937' : '#d1d5db',
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? (theme.mode === 'dark' 
                              ? '#1f2937' 
                              : (theme.palette === 'indigo' ? '#4f46e5' :
                                 theme.palette === 'blue' ? '#2563eb' :
                                 theme.palette === 'purple' ? '#9333ea' :
                                 theme.palette === 'emerald' ? '#059669' :
                                 '#e11d48'))
                          : state.isFocused
                          ? (theme.mode === 'dark' ? '#1f2937' : '#f3f4f6')
                          : 'transparent',
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      singleValue: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      input: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#f3f4f6' : '#111827',
                      }),
                      placeholder: (base) => ({
                        ...base,
                        color: theme.mode === 'dark' ? '#9ca3af' : '#6b7280',
                      }),
                    }}
                  />
                </div>
              </div>
              
              {dateFilterMode === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">From Date</label>
                    <div className="relative">
                    <input
                      type="date"
                      value={dateRange.fromDate}
                        onChange={(e) => setDateRange({ ...dateRange, fromDate: e.target.value })}
                        className={`w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                          theme.mode === 'dark' 
                            ? 'focus:ring-gray-700' 
                            : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                               theme.palette === 'blue' ? 'focus:ring-blue-500' :
                               theme.palette === 'purple' ? 'focus:ring-purple-500' :
                               theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                               'focus:ring-rose-500')
                        } text-sm bg-white dark:bg-black dark:border-gray-900 text-gray-900 dark:text-gray-100 [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                      />
                      <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">To Date</label>
                    <div className="relative">
                    <input
                      type="date"
                      value={dateRange.toDate}
                        onChange={(e) => setDateRange({ ...dateRange, toDate: e.target.value })}
                        className={`w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                          theme.mode === 'dark' 
                            ? 'focus:ring-gray-700' 
                            : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                               theme.palette === 'blue' ? 'focus:ring-blue-500' :
                               theme.palette === 'purple' ? 'focus:ring-purple-500' :
                               theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                               'focus:ring-rose-500')
                        } text-sm bg-white dark:bg-black dark:border-gray-900 text-gray-900 dark:text-gray-100 [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                      />
                      <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isLoadingData ? (
              <p className="text-gray-600 dark:text-gray-400 text-center py-8">Loading transactions...</p>
            ) : filteredTransactions.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-center py-8">No transactions found for the selected period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-black dark:border-b dark:border-gray-900">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Date</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Category</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Subcategory</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Sender</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Receiver</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Remarks</th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map(t => (
                      <tr key={t.id} className="border-t border-gray-200 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{formatDisplayDate(t.date)}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${t.category === 'Income' 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' 
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                          }`}>
                            {t.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{t.subcategory}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{t.sender}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{t.receiver}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">
                          <span className={t.category === 'Income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {t.category === 'Income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{t.remarks}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteTransaction(t.id)}
                            disabled={isSyncing}
                            className={`text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-semibold text-sm ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Monthly Report Tab */}
        {activeTab === 'report' && (
          <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Report</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Showing {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} 
                  {dateFilterMode !== 'allTime' ? ' for selected period' : ' (all time)'}
                </p>
              </div>
              <button
                onClick={exportToCSV}
                className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 dark:hover:bg-green-600"
              >
                <Download size={18} /> Export Report
              </button>
            </div>
            {isLoadingData && (
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">Refreshing data from the server...</p>
            )}

            {/* Date Range Filter */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-lg dark:shadow-[0_10px_25px_rgba(0,0,0,0.7)]">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Select Period</p>
              
              {/* Quick Filter Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => handleQuickFilter('thisMonth')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    dateFilterMode === 'thisMonth'
                      ? (theme.mode === 'dark' 
                          ? 'bg-gray-700 text-white' 
                          : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                             theme.palette === 'blue' ? 'bg-blue-600' :
                             theme.palette === 'purple' ? 'bg-purple-600' :
                             theme.palette === 'emerald' ? 'bg-emerald-600' :
                             'bg-rose-600') + ' text-white')
                      : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  This Month
                </button>
                <button
                  onClick={() => handleQuickFilter('thisQuarter')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    dateFilterMode === 'thisQuarter'
                      ? (theme.mode === 'dark' 
                          ? 'bg-gray-700 text-white' 
                          : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                             theme.palette === 'blue' ? 'bg-blue-600' :
                             theme.palette === 'purple' ? 'bg-purple-600' :
                             theme.palette === 'emerald' ? 'bg-emerald-600' :
                             'bg-rose-600') + ' text-white')
                      : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  This Quarter
                </button>
                <button
                  onClick={() => handleQuickFilter('thisFiscalYear')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    dateFilterMode === 'thisFiscalYear'
                      ? (theme.mode === 'dark' 
                          ? 'bg-gray-700 text-white' 
                          : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                             theme.palette === 'blue' ? 'bg-blue-600' :
                             theme.palette === 'purple' ? 'bg-purple-600' :
                             theme.palette === 'emerald' ? 'bg-emerald-600' :
                             'bg-rose-600') + ' text-white')
                      : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  This Fiscal Year
                </button>
                <button
                  onClick={() => handleQuickFilter('allTime')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    dateFilterMode === 'allTime'
                      ? (theme.mode === 'dark' 
                          ? 'bg-gray-700 text-white' 
                          : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                             theme.palette === 'blue' ? 'bg-blue-600' :
                             theme.palette === 'purple' ? 'bg-purple-600' :
                             theme.palette === 'emerald' ? 'bg-emerald-600' :
                             'bg-rose-600') + ' text-white')
                      : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  All Time
                </button>
                <button
                  onClick={() => {
                    if (dateFilterMode !== 'custom') {
                      // When switching to custom, preserve current range if available
                      if (dateFilterMode !== 'allTime') {
                        const currentRange = getDateRangeForMode(dateFilterMode);
                        setDateRange(currentRange);
                      }
                    }
                    setDateFilterMode('custom');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 ${
                    dateFilterMode === 'custom'
                      ? (theme.mode === 'dark' 
                          ? 'bg-gray-700 text-white' 
                          : (theme.palette === 'indigo' ? 'bg-indigo-600' :
                             theme.palette === 'blue' ? 'bg-blue-600' :
                             theme.palette === 'purple' ? 'bg-purple-600' :
                             theme.palette === 'emerald' ? 'bg-emerald-600' :
                             'bg-rose-600') + ' text-white')
                      : 'bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  <Calendar size={14} /> Custom Range
                </button>
              </div>
              
              {/* Custom Date Range Inputs */}
              {dateFilterMode === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">From Date</label>
                    <DatePicker
                      selected={dateRange.fromDate ? new Date(dateRange.fromDate) : null}
                      onChange={(date: Date | null) => {
                        setDateRange({
                          ...dateRange,
                          fromDate: date ? date.toISOString().split('T')[0] : '',
                        });
                      }}
                      dateFormat="yyyy-MM-dd"
                      className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                        theme.mode === 'dark' 
                          ? 'focus:ring-gray-700' 
                          : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                             theme.palette === 'blue' ? 'focus:ring-blue-500' :
                             theme.palette === 'purple' ? 'focus:ring-purple-500' :
                             theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                             'focus:ring-rose-500')
                      } text-sm bg-white dark:bg-black text-gray-900 dark:text-gray-100`}
                      placeholderText="Select from date"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">To Date</label>
                    <DatePicker
                      selected={dateRange.toDate ? new Date(dateRange.toDate) : null}
                      onChange={(date: Date | null) => {
                        setDateRange({
                          ...dateRange,
                          toDate: date ? date.toISOString().split('T')[0] : '',
                        });
                      }}
                      dateFormat="yyyy-MM-dd"
                      className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                        theme.mode === 'dark' 
                          ? 'focus:ring-gray-700' 
                          : (theme.palette === 'indigo' ? 'focus:ring-indigo-500' :
                             theme.palette === 'blue' ? 'focus:ring-blue-500' :
                             theme.palette === 'purple' ? 'focus:ring-purple-500' :
                             theme.palette === 'emerald' ? 'focus:ring-emerald-500' :
                             'focus:ring-rose-500')
                      } text-sm bg-white dark:bg-black text-gray-900 dark:text-gray-100`}
                      placeholderText="Select to date"
                    />
                  </div>
                </div>
              )}

              {/* Display Selected Period */}
              {dateFilterMode !== 'allTime' && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  Showing: {
                    dateFilterMode === 'custom' 
                      ? `${dateRange.fromDate} to ${dateRange.toDate}`
                      : dateFilterMode === 'thisMonth'
                      ? new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                      : dateFilterMode === 'thisQuarter'
                      ? `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`
                      : `FY ${new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1}-${new Date().getMonth() >= 3 ? new Date().getFullYear() + 1 : new Date().getFullYear()}`
                  }
                </p>
              )}
            </div>

            {/* Surplus/Deficit Badge */}
            <div className="mb-6 flex justify-center">
              <div className={`px-8 py-4 rounded-lg shadow-2xl dark:shadow-[0_15px_35px_rgba(0,0,0,0.9)] transition-all duration-300 hover:scale-105 ${stats.balance >= 0
                  ? 'bg-gradient-to-r from-green-500 to-green-600' 
                  : 'bg-gradient-to-r from-red-500 to-red-600'
              } text-white`}>
                <div className="flex items-center gap-3">
                  {stats.balance >= 0 ? (
                    <TrendingUp size={32} />
                  ) : (
                    <TrendingDown size={32} />
                  )}
                  <div>
                    <p className="text-lg font-semibold">
                      {stats.balance >= 0 ? 'SURPLUS' : 'DEFICIT'}
                    </p>
                    <p className="text-3xl font-bold">
                      ₹{Math.abs(stats.balance).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Inflow/Outflow Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border-l-4 border-green-600 dark:border-green-700 shadow-lg dark:shadow-[0_10px_25px_rgba(34,197,94,0.2)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(34,197,94,0.3)] transition-all duration-300 hover:-translate-y-1">
                <p className="text-gray-700 dark:text-gray-300 font-semibold mb-2">Total Inflow</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.income)}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Income for selected period</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border-l-4 border-red-600 dark:border-red-700 shadow-lg dark:shadow-[0_10px_25px_rgba(239,68,68,0.2)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(239,68,68,0.3)] transition-all duration-300 hover:-translate-y-1">
                <p className="text-gray-700 dark:text-gray-300 font-semibold mb-2">Total Outflow</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(stats.expenses)}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Expenses for selected period</p>
              </div>
              <div className={`${stats.balance >= 0 
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-700 shadow-lg dark:shadow-[0_10px_25px_rgba(37,99,235,0.2)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(37,99,235,0.3)]' 
                : 'bg-orange-50 dark:bg-orange-900/20 border-orange-600 dark:border-orange-700 shadow-lg dark:shadow-[0_10px_25px_rgba(249,115,22,0.2)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(249,115,22,0.3)]'
              } rounded-lg p-6 border-l-4 transition-all duration-300 hover:-translate-y-1`}>
                <p className="text-gray-700 dark:text-gray-300 font-semibold mb-2">Net Position</p>
                <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {formatCurrency(stats.balance)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Inflow - Outflow</p>
              </div>
            </div>

            {/* Period Comparison */}
            {previousRange && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 shadow-lg dark:shadow-[0_10px_25px_rgba(37,99,235,0.2)]">
                <h3 className="text-lg font-bold mb-4 text-blue-700 dark:text-blue-300">Period Comparison</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Current Period: {formatPeriodLabel()}
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Income:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(stats.income)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Expenses:</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(stats.expenses)}</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Balance:</span>
                        <span className={`font-bold ${stats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                          {formatCurrency(stats.balance)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {formatPreviousPeriodLabel()}
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Income:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(previousPeriodStats.income)}
                          {previousPeriodStats.income > 0 && (
                            <span className={`text-xs ml-2 ${stats.income > previousPeriodStats.income ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              ({stats.income > previousPeriodStats.income ? '+' : ''}
                              {((stats.income - previousPeriodStats.income) / previousPeriodStats.income * 100).toFixed(1)}%)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Expenses:</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(previousPeriodStats.expenses)}
                          {previousPeriodStats.expenses > 0 && (
                            <span className={`text-xs ml-2 ${stats.expenses < previousPeriodStats.expenses ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              ({stats.expenses < previousPeriodStats.expenses ? '' : '+'}
                              {((stats.expenses - previousPeriodStats.expenses) / previousPeriodStats.expenses * 100).toFixed(1)}%)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Balance:</span>
                        <span className={`font-bold ${previousPeriodStats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                          {formatCurrency(previousPeriodStats.balance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category-wise Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-bold mb-4 text-green-600 dark:text-green-400 flex items-center gap-2">
                  <TrendingUp size={20} /> Income Breakdown by Category
                </h3>
                {getCategoryBreakdown(filteredTransactions, 'Income').length > 0 ? (
                  <div className="space-y-2">
                    {getCategoryBreakdown(filteredTransactions, 'Income').map((item) => {
                      const percentage = stats.income > 0 ? (item.total / stats.income * 100).toFixed(1) : 0;
                      return (
                        <div key={item.sub} className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 shadow-md dark:shadow-[0_5px_15px_rgba(34,197,94,0.2)] hover:shadow-lg dark:hover:shadow-[0_8px_20px_rgba(34,197,94,0.3)] transition-all duration-300">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{item.sub}</span>
                            <span className="font-bold text-green-600 dark:text-green-400">₹{Math.abs(item.total).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2">
                            <div 
                              className="bg-green-600 dark:bg-green-500 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{percentage}% of total income – {item.count} transaction{item.count !== 1 ? 's' : ''}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 text-center py-4">No income transactions in selected period</p>
                )}
              </div>

              <div>
                 <h3 className="text-lg font-bold mb-4 text-red-600 dark:text-red-400 flex items-center gap-2">
                  <TrendingDown size={20} /> Expense Breakdown by Category
                </h3>
                {getCategoryBreakdown(filteredTransactions, 'Expense').length > 0 ? (
                  <div className="space-y-2">
                     {getCategoryBreakdown(filteredTransactions, 'Expense').map((item) => {
                      const percentage = stats.expenses > 0 ? (item.total / stats.expenses * 100).toFixed(1) : 0;
                        return (
                          <div key={item.sub} className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 shadow-md dark:shadow-[0_5px_15px_rgba(239,68,68,0.2)] hover:shadow-lg dark:hover:shadow-[0_8px_20px_rgba(239,68,68,0.3)] transition-all duration-300">
                          <div className="flex justify-between items-center mb-1">
                             <span className="font-semibold text-gray-700 dark:text-gray-300">{item.sub}</span>
                             <span className="font-bold text-red-600 dark:text-red-400">₹{Math.abs(item.total).toLocaleString('en-IN')}</span>
                          </div>
                           <div className="w-full bg-red-200 dark:bg-red-800 rounded-full h-2">
                            <div 
                               className="bg-red-600 dark:bg-red-500 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                           <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{percentage}% of total expenses – {item.count} transaction{item.count !== 1 ? 's' : ''}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                    <p className="text-gray-600 dark:text-gray-400 text-center py-4">No expense transactions in selected period</p>
                )}
              </div>
            </div>

            {/* Receiver-wise Funds */}
            <div className="mt-6">
              <h3 className="text-lg font-bold mb-3 text-indigo-700 dark:text-indigo-400">Receiver-wise Funds</h3>
              {getReceiverStats(filteredTransactions).length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">No receiver data for this period.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getReceiverStats(filteredTransactions).map((item) => (
                     <div
                       key={item.receiver}
                       className="rounded-lg border border-gray-200 dark:border-gray-900 bg-white dark:bg-black p-4 shadow-lg dark:shadow-[0_10px_25px_rgba(0,0,0,0.7)] hover:shadow-xl dark:hover:shadow-[0_15px_35px_rgba(0,0,0,0.8)] transition-all duration-300 hover:-translate-y-1"
                     >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Receiver</p>
                          <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{item.receiver}</p>
          </div>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full ${item.balance >= 0 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                            }`}
                        >
                          {item.balance >= 0 ? 'In Surplus' : 'Needs Reimbursement'}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Income</span>
                          <span className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(item.income)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Expenses</span>
                          <span className="font-semibold text-red-700 dark:text-red-400">{formatCurrency(item.expenses)}</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                          <span className="text-gray-700 dark:text-gray-300 font-semibold">Net</span>
                          <span className={`font-bold ${item.balance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>
                            {formatCurrency(item.balance)}
                          </span>
                        </div>
                      </div>
                      {item.balance < 0 && (
                        <p className="mt-2 text-xs text-orange-700 dark:text-orange-400">
                          Receiver has paid beyond available funds. Reimbursement advised.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
