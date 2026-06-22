import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getAccessToken, setTokens } from '../services/api';

const AppContext = createContext(undefined);

export const AppContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [currentPath, setCurrentPath] = useState(window.location.hash || '#dashboard');
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expensesPagination, setExpensesPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [budgets, setBudgets] = useState([]);
  const [recurringRules, setRecurringRules] = useState([]);
  const [totals, setTotals] = useState({ totalIncome: 0, totalExpenses: 0, netSavings: 0 });
  const [notifications, setNotifications] = useState([]);
  const [analyticsData, setAnalyticsData] = useState({ breakdown: [], trend: [] });
  const [loadingStates, setLoadingStates] = useState({
    expenses: false,
    categories: false,
    budgets: false,
    recurring: false,
    analytics: false,
  });

  const addNotification = (message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => removeNotification(id), duration);
    }
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Synchronize hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const newHash = window.location.hash || '#dashboard';
      // If user not authenticated, direct to #login or #register
      if (!getAccessToken() && newHash !== '#register') {
        setCurrentPath('#login');
        window.location.hash = '#login';
      } else {
        setCurrentPath(newHash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user]);

  // Auth bootloader
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken();
      if (!token) {
        setLoadingUser(false);
        // Redirect to #login if not in #register
        if (window.location.hash !== '#register') {
          setCurrentPath('#login');
          window.location.hash = '#login';
        }
        return;
      }

      try {
        const userData = await api.auth.me();
        setUser(userData);
        // Load initial data
        loadCategories();
      } catch (err) {
        console.error('Boot authorization failed:', err.message);
        // Clear broken tokens
        setTokens(null, null);
        setUser(null);
        setCurrentPath('#login');
        window.location.hash = '#login';
      } finally {
        setLoadingUser(false);
      }
    };

    // Listen to token refresh expiry events
    const handleSessionExpiry = () => {
      setUser(null);
      addNotification('Your session has expired. Please log in again.', 'warning');
      setCurrentPath('#login');
      window.location.hash = '#login';
    };

    window.addEventListener('auth_session_expired', handleSessionExpiry);
    checkAuth();

    return () => {
      window.removeEventListener('auth_session_expired', handleSessionExpiry);
    };
  }, []);

  // Set initial hash route depending on login status
  useEffect(() => {
    if (!loadingUser) {
      if (user) {
        if (currentPath === '#login' || currentPath === '#register') {
          setCurrentPath('#dashboard');
          window.location.hash = '#dashboard';
        }
      } else {
        if (currentPath !== '#register') {
          setCurrentPath('#login');
          window.location.hash = '#login';
        }
      }
    }
  }, [user, loadingUser]);

  // Load Categories
  const loadCategories = async () => {
    setLoadingStates((prev) => ({ ...prev, categories: true }));
    try {
      const list = await api.categories.list();
      setCategories(list);
    } catch (err) {
      console.error('Failed to load categories:', err.message);
    } finally {
      setLoadingStates((prev) => ({ ...prev, categories: false }));
    }
  };

  // Load Expenses
  const loadExpenses = async (filters = {}) => {
    setLoadingStates((prev) => ({ ...prev, expenses: true }));
    try {
      const result = await api.expenses.list({
        page: expensesPagination.page,
        limit: expensesPagination.limit,
        ...filters,
      });
      // The API lists returns { docs, totalDocs, limit, page, totalPages }
      setExpenses(result.docs || []);
      setExpensesPagination({
        page: result.page || 1,
        limit: result.limit || 10,
        total: result.totalDocs || 0,
        totalPages: result.totalPages || 1,
      });
    } catch (err) {
      console.error('Failed to load expenses:', err.message);
      addNotification('Failed to retrieve expenses: ' + err.message, 'error');
    } finally {
      setLoadingStates((prev) => ({ ...prev, expenses: false }));
    }
  };

  // Load Budgets for a month/year
  const loadBudgets = async (month, year) => {
    setLoadingStates((prev) => ({ ...prev, budgets: true }));
    try {
      const list = await api.budgets.list(month, year);
      setBudgets(list);
    } catch (err) {
      console.error('Failed to load budgets:', err.message);
      addNotification('Failed to load budgets: ' + err.message, 'error');
    } finally {
      setLoadingStates((prev) => ({ ...prev, budgets: false }));
    }
  };

  // Load Recurring Rules
  const loadRecurringRules = async () => {
    setLoadingStates((prev) => ({ ...prev, recurring: true }));
    try {
      const list = await api.recurringRules.list();
      setRecurringRules(list);
    } catch (err) {
      console.error('Failed to load recurring rules:', err.message);
      addNotification('Failed to load recurring rules: ' + err.message, 'error');
    } finally {
      setLoadingStates((prev) => ({ ...prev, recurring: false }));
    }
  };

  // Load Analytics Data
  const loadAnalytics = async () => {
    setLoadingStates((prev) => ({ ...prev, analytics: true }));
    try {
      const [breakdown, trend] = await Promise.all([
        api.analytics.getCategoryBreakdown(),
        api.analytics.getMonthlyTrend()
      ]);
      setAnalyticsData({ breakdown: breakdown || [], trend: trend || [] });
    } catch (err) {
      console.error('Failed to load analytics:', err.message);
    } finally {
      setLoadingStates((prev) => ({ ...prev, analytics: false }));
    }
  };

  // Load Totals Summary (Income, Expenses, Savings)
  const loadTotals = async (filters = {}) => {
    try {
      const summary = await api.expenses.getSummary(filters.from, filters.to);
      setTotals(summary || { totalIncome: 0, totalExpenses: 0, netSavings: 0 });
    } catch (err) {
      console.error('Failed to load totals summary:', err.message);
    }
  };

  // Authentication Helpers
  const login = async (email, password) => {
    setLoadingUser(true);
    try {
      const data = await api.auth.login(email, password);
      setUser(data.user);
      addNotification('Successfully logged in!', 'success');
      // Load user details
      await loadCategories();
      setCurrentPath('#dashboard');
      window.location.hash = '#dashboard';
      return data.user;
    } catch (err) {
      addNotification(err.message, 'error');
      throw err;
    } finally {
      setLoadingUser(false);
    }
  };

  const register = async (name, email, password) => {
    setLoadingUser(true);
    try {
      const data = await api.auth.register(name, email, password);
      setUser(data.user);
      addNotification('Registration successful! Welcome to SpendWise.', 'success');
      await loadCategories();
      setCurrentPath('#dashboard');
      window.location.hash = '#dashboard';
      return data.user;
    } catch (err) {
      addNotification(err.message, 'error');
      throw err;
    } finally {
      setLoadingUser(false);
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
      setUser(null);
      setCategories([]);
      setExpenses([]);
      setBudgets([]);
      setRecurringRules([]);
      addNotification('Successfully logged out.', 'success');
      setCurrentPath('#login');
      window.location.hash = '#login';
    } catch (err) {
      // Direct cleanup anyway
      setTokens(null, null);
      setUser(null);
      setCurrentPath('#login');
      window.location.hash = '#login';
    }
  };

  // Check budget thresholds when adding an expense
  const checkBudgetAlerts = (newExpense, currentBudgets) => {
    if (!newExpense || newExpense.type !== 'expense') return;
    
    // Find matching budget (category, current month, current year)
    const expDate = new Date(newExpense.date || new Date());
    const expMonth = expDate.getMonth() + 1;
    const expYear = expDate.getFullYear();

    const matchingBudget = currentBudgets.find(b => 
      b.category === newExpense.categoryId && 
      b.month === expMonth && 
      b.year === expYear
    );

    if (matchingBudget) {
      const currentSpent = (matchingBudget.currentSpent || 0) + newExpense.amount;
      const limit = matchingBudget.limitAmount;
      const pct = (currentSpent / limit) * 100;
      const threshold = matchingBudget.alertThresholdPercent || 80;

      if (pct >= 100) {
        addNotification(`CRITICAL: Budget for ${matchingBudget.categoryName || 'Category'} has been breached! (${currentSpent}/${limit} INR)`, 'warning', 10000);
      } else if (pct >= threshold) {
        addNotification(`WARNING: Budget for ${matchingBudget.categoryName || 'Category'} is at ${pct.toFixed(1)}%! (${currentSpent}/${limit} INR)`, 'info', 7000);
      }
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      loadingUser,
      currentPath,
      setCurrentPath: (path) => {
        setCurrentPath(path);
        window.location.hash = path;
      },
      categories,
      expenses,
      expensesPagination,
      budgets,
      recurringRules,
      totals,
      notifications,
      analyticsData,
      loadingStates,
      addNotification,
      removeNotification,
      login,
      register,
      logout,
      loadCategories,
      loadExpenses,
      loadBudgets,
      loadRecurringRules,
      loadAnalytics,
      loadTotals,
      checkBudgetAlerts,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppContextProvider');
  }
  return context;
};
