import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Icons } from '../components/Icons';

export const Budgets = () => {
  const {
    categories,
    budgets,
    loadBudgets,
    addNotification,
    loadingStates,
  } = useApp();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Selection states
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Form states (Add/Edit Budget Modal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState(null);
  const [formData, setFormData] = useState({
    categoryId: '',
    limitAmount: '',
    alertThresholdPercent: 80,
  });

  const [saving, setSaving] = useState(false);

  // Years array for picker
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = [
    { val: 1, name: 'January' },
    { val: 2, name: 'February' },
    { val: 3, name: 'March' },
    { val: 4, name: 'April' },
    { val: 5, name: 'May' },
    { val: 6, name: 'June' },
    { val: 7, name: 'July' },
    { val: 8, name: 'August' },
    { val: 9, name: 'September' },
    { val: 10, name: 'October' },
    { val: 11, name: 'November' },
    { val: 12, name: 'December' },
  ];

  // Refresh budgets when month/year select changes
  useEffect(() => {
    loadBudgets(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  // Modal actions
  const openAddModal = () => {
    setEditingBudgetId(null);
    setFormData({
      categoryId: categories[0]?._id || '',
      limitAmount: '',
      alertThresholdPercent: 80,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (budget) => {
    setEditingBudgetId(budget._id);
    setFormData({
      categoryId: budget.category,
      limitAmount: budget.limitAmount,
      alertThresholdPercent: budget.alertThresholdPercent || 80,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category budget?')) return;
    try {
      await api.budgets.delete(id);
      loadBudgets(selectedMonth, selectedYear);
      addNotification('Budget limit removed.', 'success');
    } catch (err) {
      addNotification(err.message, 'error');
    }
  };

  // Form submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.limitAmount || !formData.categoryId) {
      addNotification('Please select a category and specify a limit amount.', 'error');
      return;
    }

    // Check if category budget already exists for this period (only when adding new)
    if (!editingBudgetId) {
      const alreadyExists = budgets.some((b) => b.category === formData.categoryId);
      if (alreadyExists) {
        addNotification('A budget limit already exists for this category in the selected period. Edit that limit instead.', 'warning');
        return;
      }
    }

    setSaving(true);
    try {
      if (editingBudgetId) {
        await api.budgets.update(editingBudgetId, {
          limitAmount: parseFloat(formData.limitAmount),
          alertThresholdPercent: parseInt(formData.alertThresholdPercent),
        });
        addNotification('Budget updated successfully!', 'success');
      } else {
        const payload = {
          categoryId: formData.categoryId,
          month: parseInt(selectedMonth),
          year: parseInt(selectedYear),
          limitAmount: parseFloat(formData.limitAmount),
          alertThresholdPercent: parseInt(formData.alertThresholdPercent),
        };
        await api.budgets.create(payload);
        addNotification('Budget limit set successfully!', 'success');
      }
      setIsModalOpen(false);
      loadBudgets(selectedMonth, selectedYear);
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Sum total budgets metrics
  const totalBudgetsLimit = budgets.reduce((acc, curr) => acc + curr.limitAmount, 0);
  const totalBudgetsSpent = budgets.reduce((acc, curr) => acc + (curr.currentSpent || 0), 0);
  const totalBudgetsPct = totalBudgetsLimit > 0 ? (totalBudgetsSpent / totalBudgetsLimit) * 100 : 0;

  return (
    <div className="space-y-6">
      
      {/* Selection Control Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-xl">
        <div className="flex items-center space-x-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="py-2.5 px-3.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-300 text-sm font-semibold"
          >
            {months.map((m) => (
              <option key={m.val} value={m.val}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="py-2.5 px-3.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-300 text-sm font-semibold"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-indigo-600/20 text-sm transition"
        >
          <Icons.Plus className="w-4 h-4" />
          <span>Set Budget Limit</span>
        </button>
      </div>

      {/* Global Month Summary Banner */}
      {budgets.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Overall Monthly Consumption</h3>
              <p className="text-2xl font-extrabold text-white mt-1">
                {totalBudgetsSpent.toLocaleString()} ₹ <span className="text-slate-500 text-base font-normal">spent of {totalBudgetsLimit.toLocaleString()} ₹ limit</span>
              </p>
            </div>
            <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${
              totalBudgetsPct >= 100 
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                : totalBudgetsPct >= 80 
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              {totalBudgetsPct.toFixed(0)}% Consumed
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
            <div
              className={`h-full transition-all duration-500 ${
                totalBudgetsPct >= 100 
                  ? 'bg-rose-500' 
                  : totalBudgetsPct >= 80 
                    ? 'bg-amber-500' 
                    : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(totalBudgetsPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Categories Budget Limits Grid */}
      {loadingStates.budgets ? (
        <div className="flex justify-center items-center py-20">
          <Icons.Spinner className="w-10 h-10 text-indigo-500" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl py-20 text-center backdrop-blur-xl">
          <Icons.Wallet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold text-base mb-1">No budgets set for this month.</p>
          <p className="text-xs text-slate-500">Configure category limits to get alert notifications when spending goes high.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {budgets.map((b) => {
            const spent = b.currentSpent || 0;
            const limit = b.limitAmount;
            const pct = (spent / limit) * 100;
            const threshold = b.alertThresholdPercent || 80;
            
            let statusColor = 'text-emerald-400';
            let progressColor = 'bg-emerald-500';
            let cardBorder = 'border-slate-800/85';

            if (pct >= 100) {
              statusColor = 'text-rose-400';
              progressColor = 'bg-rose-500';
              cardBorder = 'border-rose-900/35';
            } else if (pct >= threshold) {
              statusColor = 'text-amber-400';
              progressColor = 'bg-amber-500';
              cardBorder = 'border-amber-900/30';
            }

            return (
              <div key={b._id} className={`bg-slate-900/60 border rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between transition-transform duration-300 hover:scale-[1.01] ${cardBorder} shadow-lg`}>
                
                {/* Header info */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center border text-lg"
                      style={{
                        backgroundColor: `${b.categoryColorCode || '#cbd5e1'}22`,
                        borderColor: `${b.categoryColorCode || '#cbd5e1'}45`,
                        color: b.categoryColorCode || '#cbd5e1',
                      }}
                    >
                      {b.categoryIcon === 'utensils' && '🍴'}
                      {b.categoryIcon === 'car' && '🚗'}
                      {b.categoryIcon === 'shopping-bag' && '👜'}
                      {b.categoryIcon === 'file-text' && '📄'}
                      {b.categoryIcon === 'film' && '🎬'}
                      {b.categoryIcon === 'heart' && '❤️'}
                      {(!b.categoryIcon || b.categoryIcon === 'tag') && '🏷️'}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-100">{b.categoryName}</h4>
                      <span className="text-[10px] text-slate-500 font-medium">Alerts triggers at {threshold}%</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditModal(b)}
                      className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-850 rounded-xl transition"
                    >
                      <Icons.Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(b._id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-850 rounded-xl transition"
                    >
                      <Icons.Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-6 space-y-2">
                  <div className="flex items-end justify-between">
                    <span className="text-xs text-slate-400 font-semibold">Spending Progress</span>
                    <span className={`text-sm font-bold ${statusColor}`}>
                      {spent.toLocaleString()} ₹ <span className="text-slate-500 font-normal">/ {limit.toLocaleString()} ₹</span>
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                    <div
                      className={`h-full transition-all duration-300 ${progressColor}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-1">
                    <span>0%</span>
                    <span>{pct.toFixed(0)}% consumed</span>
                    <span>100%</span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Floating Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/60 mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingBudgetId ? 'Edit Budget Limit' : 'Set Category Budget'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="modal-category" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</label>
                <select
                  id="modal-category"
                  disabled={!!editingBudgetId} // Cannot change category when editing
                  value={formData.categoryId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, categoryId: e.target.value }))}
                  className="block w-full py-2.5 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm font-medium disabled:opacity-50"
                >
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id} className="bg-slate-900">
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="limitAmount" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Limit Amount (INR)</label>
                <input
                  id="limitAmount"
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 5000"
                  value={formData.limitAmount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, limitAmount: e.target.value }))}
                  className="block w-full py-2.5 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <label htmlFor="alertThreshold">Warning Threshold</label>
                  <span className="text-indigo-400 font-bold">{formData.alertThresholdPercent}%</span>
                </div>
                <input
                  id="alertThreshold"
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={formData.alertThresholdPercent}
                  onChange={(e) => setFormData((prev) => ({ ...prev, alertThresholdPercent: e.target.value }))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
                />
                <p className="text-[10px] text-slate-500 leading-normal">
                  You will get a warning toast notifications and progress bar color shifts once your expenditure in this category reaches {formData.alertThresholdPercent}% of your configured limit.
                </p>
              </div>

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
                    <span>Save Limit</span>
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
