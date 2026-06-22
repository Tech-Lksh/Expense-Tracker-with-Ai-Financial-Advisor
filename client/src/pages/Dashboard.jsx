import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Icons } from '../components/Icons';

export const Dashboard = () => {
  const {
    user,
    categories,
    expenses,
    budgets,
    analyticsData,
    totals,
    loadingStates,
    loadExpenses,
    loadBudgets,
    loadAnalytics,
    loadTotals,
    addNotification,
    checkBudgetAlerts,
  } = useApp();

  const [quickExpense, setQuickExpense] = useState({
    amount: '',
    categoryId: '',
    note: '',
    type: 'expense',
    customCategory: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Initial data fetch
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    loadExpenses({ page: 1, limit: 5 });
    loadBudgets(currentMonth, currentYear);
    loadAnalytics();
    loadTotals();
  }, []);

  // Compute stats from global totals context
  const totalExpenses = totals.totalExpenses || 0;
  const totalIncome = totals.totalIncome || 0;
  const netSavings = totals.netSavings || 0;

  // Handle Quick Add Submit
  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!quickExpense.amount || !quickExpense.categoryId) {
      addNotification('Please enter an amount and select a category.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const selectedCat = categories.find(c => c._id === quickExpense.categoryId);
      const payload = {
        amount: parseFloat(quickExpense.amount),
        categoryId: quickExpense.categoryId,
        type: quickExpense.type,
        note: quickExpense.note,
        date: new Date().toISOString(),
        customCategory: (selectedCat && selectedCat.name.toLowerCase() === 'other') ? quickExpense.customCategory : null,
      };

      const newExpense = await api.expenses.create(payload);
      
      // Real-time budget alert warning checks
      checkBudgetAlerts(newExpense, budgets);

      // Refresh dashboard lists
      loadExpenses({ page: 1, limit: 5 });
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      loadBudgets(currentMonth, currentYear);
      loadAnalytics();
      loadTotals();

      addNotification('Expense added successfully!', 'success');
      setQuickExpense({ amount: '', categoryId: '', note: '', type: 'expense', customCategory: '' });
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Custom SVG Donut Chart Calculation
  const renderDonutChart = () => {
    const breakdown = analyticsData.breakdown || [];
    const totalSpent = breakdown.reduce((sum, item) => sum + item.total, 0);
    if (breakdown.length === 0 || totalSpent === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm font-medium">
          <Icons.Info className="w-8 h-8 mb-2 text-slate-600" />
          <span>No expense breakdown available</span>
        </div>
      );
    }
    
    // Draw SVG segments using stroke-dasharray
    let accumulatedPercentage = 0;
    const radius = 50;
    const circumference = 2 * Math.PI * radius;

    return (
      <div className="flex flex-col md:flex-row items-center justify-around space-y-6 md:space-y-0">
        {/* SVG Container */}
        <div className="relative w-44 h-44">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle cx="60" cy="60" r={radius} fill="transparent" stroke="#1e293b" strokeWidth="12" />
            
            {breakdown.map((item, index) => {
              const percentage = (item.total / totalSpent) * 100;
              const strokeDashoffset = circumference - (percentage / 100) * circumference;
              const rotationOffset = (accumulatedPercentage / 100) * circumference;
              accumulatedPercentage += percentage;

              return (
                <circle
                  key={item.categoryId || index}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke={item.colorCode || '#6366f1'}
                  strokeWidth="12"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  transform={`rotate(${(rotationOffset / circumference) * 360} 60 60)`}
                  className="transition-[stroke-width,stroke] duration-300 ease-out hover:stroke-[14px] cursor-pointer"
                />
              );
            })}
          </svg>
          {/* Inner Text overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Spent</span>
            <span className="text-lg font-bold text-white mt-0.5">{totalSpent.toLocaleString('en-IN')} ₹</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 max-w-xs space-y-2.5 px-4">
          {breakdown.slice(0, 5).map((item, index) => {
            const percentage = ((item.total / totalSpent) * 100).toFixed(1);
            return (
              <div key={item.categoryId || index} className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2.5">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.colorCode || '#cbd5e1' }} />
                  <span className="text-slate-300 font-medium truncate max-w-[120px]">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-100 font-semibold">{item.total} ₹</span>
                  <span className="text-xs text-slate-500 ml-1.5">({percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Custom SVG Line/Trend Chart
  const renderTrendChart = () => {
    const trend = analyticsData.trend || [];
    if (trend.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm font-medium">
          <Icons.Info className="w-8 h-8 mb-2 text-slate-600" />
          <span>No historical trend data found</span>
        </div>
      );
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const maxVal = Math.max(...trend.map(t => t.total)) || 1000;
    
    // SVG Dimensions
    const width = 500;
    const height = 200;
    const padding = 30;
    
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    // Map values to coordinates
    let points = [];
    if (trend.length === 1) {
      const single = trend[0];
      const y = padding + chartHeight - (single.total / maxVal) * chartHeight;
      points = [
        { x: padding, y, label: `${months[single.month - 1]}`, val: single.total },
        { x: width - padding, y, label: `${months[single.month - 1]}`, val: single.total }
      ];
    } else {
      points = trend.map((t, idx) => {
        const x = padding + (idx / (trend.length - 1)) * chartWidth;
        const y = padding + chartHeight - (t.total / maxVal) * chartHeight;
        return { x, y, label: `${months[t.month - 1]}`, val: t.total };
      });
    }

    const pathD = points.reduce((d, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${d} L ${p.x} ${p.y}`;
    }, '');

    const areaD = points.length > 0 
      ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
      : '';

    return (
      <div className="w-full h-full relative">
        <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`}>
          {/* Gradients definitions */}
          <defs>
            <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1={padding} y1={padding + chartHeight / 2} x2={width - padding} y2={padding + chartHeight / 2} stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#475569" strokeWidth="1" />

          {/* Filled Glow Area */}
          {areaD && <path d={areaD} fill="url(#chartGlow)" />}

          {/* Spark Line */}
          {pathD && <path d={pathD} fill="none" stroke="#818cf8" strokeWidth="3" strokeLinecap="round" className="transition-all duration-500 ease-in-out" />}

          {/* Interactivity dots */}
          {points.map((p, idx) => (
            <g key={idx} className="group cursor-pointer">
              <circle cx={p.x} cy={p.y} r="5" fill="#4f46e5" stroke="#e0e7ff" strokeWidth="1.5" className="transition-transform duration-200 group-hover:scale-150" />
              {/* Tooltip Overlay */}
              <text x={p.x} y={p.y - 12} textAnchor="middle" fill="#c7d2fe" className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none bg-slate-950">
                {p.val.toLocaleString()} ₹
              </text>
              {/* Axis label */}
              <text x={p.x} y={height - 10} textAnchor="middle" fill="#64748b" className="text-[11px] font-medium font-sans">
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  // Find Budgets currently in alerting state
  const warningBudgets = budgets.filter((b) => {
    const spent = b.currentSpent || 0;
    const limit = b.limitAmount;
    const pct = (spent / limit) * 100;
    const threshold = b.alertThresholdPercent || 80;
    return pct >= threshold;
  });

  return (
    <div className="space-y-6">
      
      {/* 3-Tier Financial Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 relative overflow-hidden shadow-lg shadow-indigo-950/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Total Income</h3>
            <span className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl border border-emerald-500/20">
              <Icons.ArrowUp className="w-5 h-5" />
            </span>
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">{totalIncome.toLocaleString('en-IN')} ₹</p>
          <p className="text-xs text-emerald-400 font-medium mt-2">Active cash inflow</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 relative overflow-hidden shadow-lg shadow-rose-950/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Total Expenses</h3>
            <span className="bg-red-500/10 text-red-400 p-2 rounded-xl border border-red-500/20">
              <Icons.ArrowDown className="w-5 h-5" />
            </span>
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">{totalExpenses.toLocaleString('en-IN')} ₹</p>
          <p className="text-xs text-red-400 font-medium mt-2">Logged payments this session</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Net Savings</h3>
            <span className="bg-indigo-500/10 text-indigo-400 p-2 rounded-xl border border-indigo-500/20">
              <Icons.Wallet className="w-5 h-5" />
            </span>
          </div>
          <p className={`text-3xl font-extrabold tracking-tight ${netSavings >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
            {netSavings.toLocaleString('en-IN')} ₹
          </p>
          <p className="text-xs text-indigo-400 font-medium mt-2">Current session balance</p>
        </div>
      </div>

      {/* Main Content Layout Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle Column (Charts & Alerts) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Budgets Alert Banner */}
          {warningBudgets.length > 0 && (
            <div className="bg-amber-950/30 border border-amber-900/50 backdrop-blur-md rounded-2xl p-5 flex items-start space-x-4">
              <Icons.Alert className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-amber-200">Alert: Active budget thresholds exceeded</h4>
                <div className="mt-2 space-y-1.5">
                  {warningBudgets.map((b) => {
                    const pct = ((b.currentSpent || 0) / b.limitAmount) * 100;
                    return (
                      <p key={b._id} className="text-xs text-amber-300 font-medium">
                        • {b.categoryName}: Spent <strong className="text-amber-200">{b.currentSpent} ₹</strong> of {b.limitAmount} ₹ ({pct.toFixed(0)}% consumption)
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Charts Card */}
          <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6">Financial Analytics</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Category Breakdown (Donut) */}
              <div>
                <h4 className="text-sm font-bold text-slate-400 mb-4 text-center md:text-left">Category Breakdown</h4>
                {renderDonutChart()}
              </div>

              {/* Monthly Trend (Line) */}
              <div>
                <h4 className="text-sm font-bold text-slate-400 mb-4 text-center md:text-left">Monthly Spending Trend</h4>
                <div className="h-48">
                  {renderTrendChart()}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Recent Transactions</h3>
              <a href="#expenses" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider">
                View All
              </a>
            </div>
            
            {loadingStates.expenses ? (
              <div className="flex items-center justify-center py-12">
                <Icons.Spinner className="w-8 h-8 text-indigo-500" />
              </div>
            ) : expenses.length === 0 ? (
              <p className="text-center py-8 text-slate-500 font-medium text-sm">No transactions logged yet.</p>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {expenses.map((exp) => (
                  <div key={exp._id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-800/80 text-lg flex-shrink-0"
                        style={{
                          backgroundColor: `${exp.category?.colorCode || '#64748b'}22`,
                          borderColor: `${exp.category?.colorCode || '#64748b'}55`,
                          color: exp.category?.colorCode || '#64748b',
                        }}
                      >
                        {/* Resolve simple icon character map */}
                        {exp.category?.icon === 'utensils' && '🍴'}
                        {exp.category?.icon === 'car' && '🚗'}
                        {exp.category?.icon === 'shopping-bag' && '👜'}
                        {exp.category?.icon === 'file-text' && '📄'}
                        {exp.category?.icon === 'film' && '🎬'}
                        {exp.category?.icon === 'heart' && '❤️'}
                        {(!exp.category?.icon || exp.category?.icon === 'tag') && '🏷️'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 mb-0.5">
                          <span
                            className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-bold border"
                            style={{
                              backgroundColor: `${exp.category?.colorCode || '#cbd5e1'}12`,
                              borderColor: `${exp.category?.colorCode || '#cbd5e1'}30`,
                              color: exp.category?.colorCode || '#cbd5e1',
                            }}
                          >
                            {exp.customCategory ? `${exp.category?.name || 'Other'}: ${exp.customCategory}` : (exp.category?.name || 'Other')}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-200 truncate">{exp.note || '—'}</p>
                        <div className="flex items-center space-x-2 mt-0.5 text-xs text-slate-500 font-medium">
                          <span>{new Date(exp.date).toLocaleDateString()}</span>
                          {exp.location?.formattedAddress && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[150px]"><Icons.MapPin className="inline w-3 h-3 -mt-0.5 mr-0.5" />{exp.location.name || exp.location.formattedAddress}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`text-sm font-bold flex-shrink-0 ${exp.type === 'income' ? 'text-emerald-400' : 'text-slate-100'}`}>
                      {exp.type === 'income' ? '+' : '-'}{exp.amount} {exp.currency || 'INR'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Quick Add Panel) */}
        <div>
          <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl sticky top-6">
            <h3 className="text-lg font-bold text-white mb-6">Quick Add Expense</h3>
            
            <form onSubmit={handleQuickAdd} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transaction Type</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setQuickExpense((prev) => ({ ...prev, type: 'expense' }))}
                    className={`py-2 px-3 rounded-xl border text-sm font-semibold transition-all ${
                      quickExpense.type === 'expense'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 font-bold'
                        : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickExpense((prev) => ({ ...prev, type: 'income' }))}
                    className={`py-2 px-3 rounded-xl border text-sm font-semibold transition-all ${
                      quickExpense.type === 'income'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold'
                        : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="quick-amount" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount (INR)</label>
                <div className="relative">
                  <input
                    id="quick-amount"
                    name="amount"
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="250.00"
                    value={quickExpense.amount}
                    onChange={(e) => setQuickExpense((prev) => ({ ...prev, amount: e.target.value }))}
                    className="block w-full py-2.5 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm placeholder-slate-600 font-medium"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">INR</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="quick-category" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</label>
                <select
                  id="quick-category"
                  name="categoryId"
                  required
                  value={quickExpense.categoryId}
                  onChange={(e) => setQuickExpense((prev) => ({ ...prev, categoryId: e.target.value }))}
                  className="block w-full py-2.5 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm font-medium"
                >
                  <option value="" disabled className="bg-slate-950 text-slate-600">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id} className="bg-slate-900 text-slate-200">
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Category Input for Other */}
              {(() => {
                const selectedCat = categories.find(c => c._id === quickExpense.categoryId);
                if (selectedCat && selectedCat.name.toLowerCase() === 'other') {
                  return (
                    <div className="space-y-1.5 animate-slide-down">
                      <label htmlFor="quick-custom-category" className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Custom Category Name</label>
                      <input
                        id="quick-custom-category"
                        type="text"
                        required
                        placeholder="e.g. Gift, Salary Bonus, Rent..."
                        value={quickExpense.customCategory || ''}
                        onChange={(e) => setQuickExpense((prev) => ({ ...prev, customCategory: e.target.value }))}
                        className="block w-full py-2.5 px-3 bg-slate-950/40 border border-indigo-950/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm font-medium"
                      />
                    </div>
                  );
                }
                return null;
              })()}

              <div className="space-y-1.5">
                <label htmlFor="quick-note" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Short Note</label>
                <input
                  id="quick-note"
                  name="note"
                  type="text"
                  placeholder="e.g. Office lunch"
                  value={quickExpense.note}
                  onChange={(e) => setQuickExpense((prev) => ({ ...prev, note: e.target.value }))}
                  className="block w-full py-2.5 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm placeholder-slate-600 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center items-center py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md shadow-indigo-600/20 focus:outline-none transition duration-150 text-sm disabled:opacity-50 mt-4"
              >
                {submitting ? (
                  <>
                    <Icons.Spinner className="w-5 h-5 mr-2 animate-spin text-white" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <span>Log Transaction</span>
                )}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};
