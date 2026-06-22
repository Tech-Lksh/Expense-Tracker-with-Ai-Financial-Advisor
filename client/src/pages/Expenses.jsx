import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Icons } from '../components/Icons';

export const Expenses = () => {
  const {
    user,
    categories,
    budgets,
    loadBudgets,
    loadAnalytics,
    loadTotals,
    addNotification,
    checkBudgetAlerts,
    loadingStates,
  } = useApp();

  // Page level filters
  const [filters, setFilters] = useState({
    category: '',
    from: '',
    to: '',
    search: '',
  });

  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Local state for split datasets
  const [incomeList, setIncomeList] = useState([]);
  const [expenseList, setExpenseList] = useState([]);
  const [incomePagination, setIncomePagination] = useState({ page: 1, limit: 6, total: 0, totalPages: 1 });
  const [expensePagination, setExpensePagination] = useState({ page: 1, limit: 6, total: 0, totalPages: 1 });
  
  const [currentIncomePage, setCurrentIncomePage] = useState(1);
  const [currentExpensePage, setCurrentExpensePage] = useState(1);

  // Form states (Add/Edit Modal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    categoryId: '',
    type: 'expense',
    note: '',
    date: new Date().toISOString().substring(0, 10),
    tags: [],
    location: null, // { name, formattedAddress, placeId, lat, lng }
    customCategory: '',
  });
  
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  // Location suggestions search states
  const [locationInput, setLocationInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const dropdownRef = useRef(null);
  const autocompleteTimeoutRef = useRef(null);
  const [deviceCoords, setDeviceCoords] = useState(null);

  // Clean up autocomplete timeout on unmount
  useEffect(() => {
    return () => {
      if (autocompleteTimeoutRef.current) {
        clearTimeout(autocompleteTimeoutRef.current);
      }
    };
  }, []);

  // Fetch device GPS coordinates on modal open to bias autocomplete results
  useEffect(() => {
    if (isModalOpen && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDeviceCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (err) => {
          console.warn('Autocomplete geolocation bias failed:', err.message);
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, [isModalOpen]);

  // Debounce search filter
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 400);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Fetch local transactions list
  const fetchTransactions = async () => {
    try {
      const [incRes, expRes] = await Promise.all([
        api.expenses.list({
          page: currentIncomePage,
          limit: 6,
          type: 'income',
          category: filters.category,
          from: filters.from,
          to: filters.to,
        }),
        api.expenses.list({
          page: currentExpensePage,
          limit: 6,
          type: 'expense',
          category: filters.category,
          from: filters.from,
          to: filters.to,
        })
      ]);

      setIncomeList(incRes.docs || []);
      setIncomePagination({
        page: incRes.page || 1,
        limit: incRes.limit || 6,
        total: incRes.totalDocs || 0,
        totalPages: incRes.totalPages || 1,
      });

      setExpenseList(expRes.docs || []);
      setExpensePagination({
        page: expRes.page || 1,
        limit: expRes.limit || 6,
        total: expRes.totalDocs || 0,
        totalPages: expRes.totalPages || 1,
      });
    } catch (err) {
      console.error('Failed to load local transactions:', err.message);
      addNotification('Failed to retrieve transactions: ' + err.message, 'error');
    }
  };

  // Reload transactions on filter/page changes
  useEffect(() => {
    fetchTransactions();
  }, [currentIncomePage, currentExpensePage, filters.category, filters.from, filters.to]);

  // Fetch budgets when entering page
  useEffect(() => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    loadBudgets(currentMonth, currentYear);
  }, []);

  // Close location dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle location autocomplete lookup
  const handleLocationSearchChange = (e) => {
    const val = e.target.value;
    setLocationInput(val);

    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current);
    }

    if (!val.trim()) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    setLocationError(false);

    autocompleteTimeoutRef.current = setTimeout(async () => {
      try {
        const coords = deviceCoords || (user?.homeLocation?.coordinates
          ? { lat: user.homeLocation.coordinates[1], lng: user.homeLocation.coordinates[0] }
          : null);
        const result = await api.locations.autocomplete(val, coords);
        setSuggestions(result || []);
      } catch (err) {
        console.warn('Google Places Autocomplete failed, fallback to manual entry:', err.message);
        setLocationError(true);
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 400);
  };

  // Select place suggestion
  const handleSelectSuggestion = async (suggestion) => {
    setLocationInput(suggestion.description);
    setSuggestions([]);
    try {
      const details = await api.locations.getDetails(suggestion.placeId);
      setFormData((prev) => ({
        ...prev,
        location: {
          placeId: suggestion.placeId,
          formattedAddress: details.formattedAddress,
          name: details.name,
          lat: details.lat,
          lng: details.lng,
        },
      }));
    } catch (err) {
      addNotification('Could not retrieve place geocoordinates: ' + err.message, 'warning');
      setFormData((prev) => ({
        ...prev,
        location: {
          name: suggestion.mainText || suggestion.description,
          formattedAddress: suggestion.description,
          placeId: null,
          lat: null,
          lng: null,
        },
      }));
    }
  };

  // Clear selected location
  const handleClearLocation = () => {
    setLocationInput('');
    setFormData((prev) => ({ ...prev, location: null }));
  };

  // Tag helper functions
  const handleAddTag = (e) => {
    e.preventDefault();
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tagToRemove) }));
  };

  // Modal actions
  const openAddModal = () => {
    setEditingExpenseId(null);
    setFormData({
      amount: '',
      categoryId: categories[0]?._id || '',
      type: 'expense',
      note: '',
      date: new Date().toISOString().substring(0, 10),
      tags: [],
      location: null,
      customCategory: '',
    });
    setLocationInput('');
    setIsModalOpen(true);
  };

  const openEditModal = (expense) => {
    setEditingExpenseId(expense._id);
    setFormData({
      amount: expense.amount,
      categoryId: expense.category?._id || expense.categoryId,
      type: expense.type || 'expense',
      note: expense.note || '',
      date: new Date(expense.date).toISOString().substring(0, 10),
      tags: expense.tags || [],
      location: expense.location
        ? {
            placeId: expense.location.placeId,
            formattedAddress: expense.location.formattedAddress,
            name: expense.location.name,
            lat: expense.location.coordinates ? expense.location.coordinates[1] : null,
            lng: expense.location.coordinates ? expense.location.coordinates[0] : null,
          }
        : null,
      customCategory: expense.customCategory || '',
    });
    setLocationInput(expense.location?.name || expense.location?.formattedAddress || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await api.expenses.delete(id);
      fetchTransactions();
      
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      loadBudgets(currentMonth, currentYear);
      loadAnalytics();
      loadTotals();
      
      addNotification('Transaction deleted.', 'success');
    } catch (err) {
      addNotification(err.message, 'error');
    }
  };

  // Form Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.categoryId) {
      addNotification('Please enter an amount and select a category.', 'error');
      return;
    }

    setSaving(true);
    try {
      const selectedCat = categories.find(c => c._id === formData.categoryId);
      const payload = {
        amount: parseFloat(formData.amount),
        categoryId: formData.categoryId,
        type: formData.type,
        note: formData.note,
        date: new Date(formData.date).toISOString(),
        tags: formData.tags,
        customCategory: (selectedCat && selectedCat.name.toLowerCase() === 'other') ? formData.customCategory : null,
      };

      if (formData.location) {
        if (formData.location.placeId) {
          payload.location = { placeId: formData.location.placeId };
        } else if (formData.location.lat != null && formData.location.lng != null) {
          payload.location = { lat: formData.location.lat, lng: formData.location.lng };
        } else {
          payload.note = `${payload.note} (Loc: ${formData.location.name || formData.location.formattedAddress})`.trim();
        }
      }

      if (editingExpenseId) {
        await api.expenses.update(editingExpenseId, payload);
        addNotification('Transaction updated successfully!', 'success');
      } else {
        const newExpense = await api.expenses.create(payload);
        checkBudgetAlerts(newExpense, budgets);
        addNotification('Transaction added successfully!', 'success');
      }

      setIsModalOpen(false);
      fetchTransactions();
      
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      loadBudgets(currentMonth, currentYear);
      loadAnalytics();
      loadTotals();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Local client side note search filtering
  const filteredIncomes = incomeList.filter((exp) => {
    if (!debouncedSearch) return true;
    const matchNote = exp.note && exp.note.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchTags = exp.tags && exp.tags.some((t) => t.toLowerCase().includes(debouncedSearch.toLowerCase()));
    return matchNote || matchTags;
  });

  const filteredExpenses = expenseList.filter((exp) => {
    if (!debouncedSearch) return true;
    const matchNote = exp.note && exp.note.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchTags = exp.tags && exp.tags.some((t) => t.toLowerCase().includes(debouncedSearch.toLowerCase()));
    return matchNote || matchTags;
  });

  const renderTable = (list, isExpense, currentPageState, paginationState, setCurrentPage) => {
    const filteredList = isExpense ? filteredExpenses : filteredIncomes;

    return (
      <div className={`bg-slate-900/60 border ${isExpense ? 'border-rose-900/20' : 'border-emerald-900/20'} rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl flex flex-col h-full`}>
        {/* Table Header */}
        <div className={`px-5 py-4 border-b ${isExpense ? 'border-rose-955/20 bg-rose-950/5' : 'border-emerald-955/20 bg-emerald-950/5'} flex justify-between items-center`}>
          <div className="flex items-center space-x-2">
            <span className={`p-1.5 rounded-lg ${isExpense ? 'bg-rose-500/10 text-rose-450' : 'bg-emerald-500/10 text-emerald-400'}`}>
              {isExpense ? <Icons.ArrowDown className="w-4 h-4" /> : <Icons.ArrowUp className="w-4 h-4" />}
            </span>
            <span className="font-bold text-sm text-slate-100">{isExpense ? 'Expense Outflows' : 'Income Inflows'}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            {paginationState.total} logs
          </span>
        </div>

        {filteredList.length === 0 ? (
          <div className="text-center py-20 flex-1 flex flex-col justify-center items-center">
            <Icons.Info className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-slate-500 font-bold text-xs">No {isExpense ? 'expenses' : 'incomes'} found.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-500 text-[10px] font-bold uppercase tracking-wider bg-slate-950/20">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/35">
                {filteredList.map((exp) => (
                  <tr key={exp._id} className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-3.5 px-4 text-xs text-slate-350 font-medium whitespace-nowrap">
                      {new Date(exp.date).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 max-w-[160px]">
                      <div className="flex items-center space-x-1.5 mb-1 flex-wrap gap-1">
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border"
                          style={{
                            backgroundColor: `${exp.category?.colorCode || (isExpense ? '#64748b' : '#10b981')}12`,
                            borderColor: `${exp.category?.colorCode || (isExpense ? '#64748b' : '#10b981')}30`,
                            color: exp.category?.colorCode || (isExpense ? '#64748b' : '#10b981'),
                          }}
                        >
                          {exp.customCategory ? `${exp.category?.name || 'Other'}: ${exp.customCategory}` : (exp.category?.name || 'Other')}
                        </span>
                        {exp.tags && exp.tags.slice(0, 2).map((t) => (
                          <span key={t} className="text-[8px] bg-slate-950/60 text-slate-550 px-1 py-0.5 rounded border border-slate-850">
                            #{t}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs font-semibold text-slate-200 truncate" title={exp.note}>{exp.note || '—'}</p>
                      {exp.location?.formattedAddress && (
                        <div className="flex items-center space-x-1 mt-1 text-[10px] text-slate-500 font-medium truncate max-w-[140px]" title={exp.location.formattedAddress}>
                          <Icons.MapPin className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                          <span>{exp.location.name || exp.location.formattedAddress}</span>
                        </div>
                      )}
                    </td>
                    <td className={`py-3.5 px-4 text-xs font-black ${isExpense ? 'text-slate-100' : 'text-emerald-450'} whitespace-nowrap`}>
                      {isExpense ? '-' : '+'}{exp.amount.toLocaleString()} <span className="text-[10px] font-medium text-slate-500">{exp.currency || 'INR'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => openEditModal(exp)}
                          className="p-1 text-slate-500 hover:text-indigo-400 rounded hover:bg-slate-850/60 transition"
                          title="Edit"
                        >
                          <Icons.Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(exp._id)}
                          className="p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-850/60 transition"
                          title="Delete"
                        >
                          <Icons.Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {paginationState.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-850 px-5 py-4 bg-slate-950/20 mt-auto">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Page {paginationState.page} of {paginationState.totalPages}
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={currentPageState === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition duration-150 border border-transparent hover:border-slate-750/50 disabled:opacity-20 disabled:pointer-events-none"
              >
                <Icons.ChevronLeft className="w-5 h-5" />
              </button>
              <button
                disabled={currentPageState >= paginationState.totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition duration-150 border border-transparent hover:border-slate-750/50 disabled:opacity-20 disabled:pointer-events-none"
              >
                <Icons.ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Control Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-xl">
        {/* Search Input */}
        <div className="relative max-w-xs w-full">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Icons.Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search notes or tags..."
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="block w-full pl-9 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm placeholder-slate-600 font-medium"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filters.category}
            onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
            className="py-2.5 px-3 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-300 text-sm font-medium"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
          </select>

          <div className="flex items-center space-x-1.5 bg-slate-950/60 border border-slate-800 rounded-xl px-2.5 py-1">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
              className="bg-transparent border-none text-slate-400 focus:outline-none text-xs font-semibold py-1.5"
            />
            <span className="text-slate-650 text-xs">to</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
              className="bg-transparent border-none text-slate-400 focus:outline-none text-xs font-semibold py-1.5"
            />
          </div>

          <button
            onClick={openAddModal}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-indigo-600/20 text-sm transition"
          >
            <Icons.Plus className="w-4 h-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Split Inflow vs Outflow Ledger View (Attractive Side-by-Side Tables) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Income Table Column */}
        {renderTable(incomeList, false, currentIncomePage, incomePagination, setCurrentIncomePage)}

        {/* Expense Table Column */}
        {renderTable(expenseList, true, currentExpensePage, expensePagination, setCurrentExpensePage)}
      </div>

      {/* Floating Add/Edit Slider Overlay Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/65 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800/80 p-6 overflow-y-auto flex flex-col shadow-2xl animate-slide-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/60 mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingExpenseId ? 'Edit Transaction' : 'Add Transaction'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="space-y-5 flex-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transaction Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, type: 'expense' }))}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all ${
                      formData.type === 'expense'
                        ? 'bg-rose-500/20 text-rose-455 border-rose-500/30 font-bold'
                        : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, type: 'income' }))}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all ${
                      formData.type === 'income'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold'
                        : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="amount" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</label>
                <input
                  id="amount"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  className="block w-full py-2.5 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="category" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</label>
                <select
                  id="category"
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, categoryId: e.target.value }))}
                  className="block w-full py-2.5 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm font-medium"
                >
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id} className="bg-slate-900">
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Category input for Other */}
              {(() => {
                const selectedCat = categories.find(c => c._id === formData.categoryId);
                if (selectedCat && selectedCat.name.toLowerCase() === 'other') {
                  return (
                    <div className="space-y-1.5 animate-slide-down">
                      <label htmlFor="customCategory" className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Custom Category Name</label>
                      <input
                        id="customCategory"
                        type="text"
                        required
                        placeholder="e.g. Gift, Salary Bonus, Rent..."
                        value={formData.customCategory || ''}
                        onChange={(e) => setFormData((prev) => ({ ...prev, customCategory: e.target.value }))}
                        className="block w-full py-2.5 px-3 bg-slate-950/40 border border-indigo-950/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm font-medium"
                      />
                    </div>
                  );
                }
                return null;
              })()}

              <div className="space-y-1.5">
                <label htmlFor="date" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</label>
                <input
                  id="date"
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  className="block w-full py-2.5 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="note" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Notes</label>
                <textarea
                  id="note"
                  rows="2"
                  placeholder="Details about this payment..."
                  value={formData.note}
                  onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                  className="block w-full py-2.5 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm placeholder-slate-700 font-medium"
                />
              </div>

              {/* Autocomplete Location Picker */}
              <div className="space-y-1.5 relative" ref={dropdownRef}>
                <label htmlFor="location" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Location Tag</label>
                
                {formData.location ? (
                  <div className="flex items-center justify-between bg-slate-950/60 border border-indigo-900/35 p-3 rounded-xl">
                    <div className="flex items-center space-x-2 text-sm text-indigo-300 font-semibold min-w-0">
                      <Icons.MapPin className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                      <span className="truncate">{formData.location.name || formData.location.formattedAddress}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearLocation}
                      className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200"
                    >
                      <Icons.Close className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Icons.MapPin className="w-4 h-4" />
                      </span>
                      <input
                        id="location"
                        type="text"
                        placeholder="Search address or shop..."
                        value={locationInput}
                        onChange={handleLocationSearchChange}
                        className="block w-full pl-9 pr-4 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm placeholder-slate-600 font-medium"
                      />
                      {loadingSuggestions && (
                        <span className="absolute right-3 top-2.5">
                          <Icons.Spinner className="w-4 h-4 text-indigo-500 animate-spin" />
                        </span>
                      )}
                    </div>

                    {locationError && (
                      <p className="text-[10px] text-amber-500 bg-amber-950/15 border border-amber-900/30 p-2 rounded-lg font-medium leading-relaxed">
                        ⚠️ Location autocomplete is currently unavailable. You can still type custom location description here; we will save it as part of your transaction notes.
                      </p>
                    )}

                    {suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 z-50 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-h-48 overflow-y-auto mt-1 divide-y divide-slate-900">
                        {suggestions.map((s) => (
                          <button
                            key={s.placeId}
                            type="button"
                            onClick={() => handleSelectSuggestion(s)}
                            className="flex flex-col text-left w-full px-4 py-2.5 hover:bg-slate-900 transition-colors"
                          >
                            <span className="text-sm font-semibold text-slate-200">{s.mainText}</span>
                            <span className="text-xs text-slate-500 truncate max-w-sm mt-0.5">{s.secondaryText || s.description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Custom Tags Selector */}
              <div className="space-y-1.5">
                <label htmlFor="tag-input" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tags</label>
                <div className="flex space-x-2">
                  <input
                    id="tag-input"
                    type="text"
                    placeholder="Press Add to save tag"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag(e);
                      }
                    }}
                    className="flex-1 py-2 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm placeholder-slate-700 font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold py-2 px-3.5 rounded-xl border border-slate-750 text-xs"
                  >
                    Add
                  </button>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-indigo-950/30 text-indigo-400 border border-indigo-900/40 text-xs font-semibold"
                      >
                        <span>#{t}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="hover:text-red-400 focus:outline-none"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl font-semibold text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md shadow-indigo-600/20 text-sm transition flex justify-center items-center"
                >
                  {saving ? (
                    <>
                      <Icons.Spinner className="w-5 h-5 mr-2 animate-spin text-white" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Transaction</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
