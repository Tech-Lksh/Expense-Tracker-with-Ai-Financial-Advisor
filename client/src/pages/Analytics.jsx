import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Icons } from '../components/Icons';
import { api } from '../services/api';

const toLocalYYYYMMDD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const Analytics = () => {
  const { addNotification } = useApp();
  const [loading, setLoading] = useState(true);

  // Date Presets & Selection
  const [datePreset, setDatePreset] = useState('this-month');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [toDate, setToDate] = useState(() => {
    return toLocalYYYYMMDD(new Date());
  });

  // Trend Grouping
  const [trendGroup, setTrendGroup] = useState('day'); // 'hour' | 'day' | 'month' | 'year'

  // Raw API Datasets for Expenses
  const [expenseBreakdown, setExpenseBreakdown] = useState([]);
  const [expenseTrend, setExpenseTrend] = useState([]);

  // Raw API Datasets for Income
  const [incomeBreakdown, setIncomeBreakdown] = useState([]);
  const [incomeTrend, setIncomeTrend] = useState([]);

  // Tab selections
  const [expenseTab, setExpenseTab] = useState('donut'); // 'donut' | 'bars'
  const [incomeTab, setIncomeTab] = useState('donut'); // 'donut' | 'bars'
  const [expenseTrendTab, setExpenseTrendTab] = useState('area'); // 'area' | 'bar'
  const [incomeTrendTab, setIncomeTrendTab] = useState('area'); // 'area' | 'bar'

  // Interactive Chart states
  const [hoveredExpenseSlice, setHoveredExpenseSlice] = useState(null);
  const [hoveredIncomeSlice, setHoveredIncomeSlice] = useState(null);
  const [activeTrendType, setActiveTrendType] = useState('expense'); // 'expense' | 'income'
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState(null);
  const [lockedTrendIndex, setLockedTrendIndex] = useState(null);

  // Sorting & Filtering Table states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('total'); // 'name' | 'count' | 'total' | 'avg'
  const [sortAsc, setSortAsc] = useState(false);
  const [activeTableTab, setActiveTableTab] = useState('expense'); // 'expense' | 'income'

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [expB, incB, expT, incT] = await Promise.all([
        api.analytics.getCategoryBreakdown(fromDate, toDate, 'expense'),
        api.analytics.getCategoryBreakdown(fromDate, toDate, 'income'),
        api.analytics.getTrend(trendGroup, fromDate, toDate, 'expense'),
        api.analytics.getTrend(trendGroup, fromDate, toDate, 'income')
      ]);
      setExpenseBreakdown(expB || []);
      setIncomeBreakdown(incB || []);
      setExpenseTrend(expT || []);
      setIncomeTrend(incT || []);
      setHoveredTrendIndex(null);
      setLockedTrendIndex(null);
    } catch (err) {
      console.error('Failed to load analytics data:', err.message);
      addNotification('Could not retrieve analytics: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fromDate, toDate, trendGroup]);

  // Adjust Date Presets
  const applyPreset = (preset) => {
    setDatePreset(preset);
    const today = new Date();

    if (preset === '1D') {
      const todayStr = toLocalYYYYMMDD(today);
      setFromDate(todayStr);
      setToDate(todayStr);
      setTrendGroup('hour');
    } else if (preset === '5D') {
      const start = new Date();
      start.setDate(today.getDate() - 5);
      setFromDate(toLocalYYYYMMDD(start));
      setToDate(toLocalYYYYMMDD(today));
      setTrendGroup('day');
    } else if (preset === '1M') {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      setFromDate(toLocalYYYYMMDD(start));
      setToDate(toLocalYYYYMMDD(today));
      setTrendGroup('day');
    } else if (preset === '6M') {
      const start = new Date();
      start.setMonth(today.getMonth() - 6);
      setFromDate(toLocalYYYYMMDD(start));
      setToDate(toLocalYYYYMMDD(today));
      setTrendGroup('day');
    } else if (preset === 'YTD') {
      const start = new Date(today.getFullYear(), 0, 1);
      setFromDate(toLocalYYYYMMDD(start));
      setToDate(toLocalYYYYMMDD(today));
      setTrendGroup('month');
    } else if (preset === '1Y') {
      const start = new Date();
      start.setFullYear(today.getFullYear() - 1);
      setFromDate(toLocalYYYYMMDD(start));
      setToDate(toLocalYYYYMMDD(today));
      setTrendGroup('month');
    } else if (preset === 'this-month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(toLocalYYYYMMDD(start));
      setToDate(toLocalYYYYMMDD(today));
      setTrendGroup('day');
    } else if (preset === 'last-30-days') {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      setFromDate(toLocalYYYYMMDD(start));
      setToDate(toLocalYYYYMMDD(today));
      setTrendGroup('day');
    } else if (preset === 'last-90-days') {
      const start = new Date();
      start.setDate(today.getDate() - 90);
      setFromDate(toLocalYYYYMMDD(start));
      setToDate(toLocalYYYYMMDD(today));
      setTrendGroup('day');
    } else if (preset === 'this-year') {
      const start = new Date(today.getFullYear(), 0, 1);
      setFromDate(toLocalYYYYMMDD(start));
      setToDate(toLocalYYYYMMDD(today));
      setTrendGroup('month');
    }
  };

  // ---- Advanced Metrics Calculations ----
  const totalSpent = expenseBreakdown.reduce((acc, curr) => acc + curr.total, 0);
  const totalIncome = incomeBreakdown.reduce((acc, curr) => acc + curr.total, 0);
  const netSavings = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  const daysDiff = (() => {
    const s = new Date(fromDate);
    const e = new Date(toDate);
    const diff = Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)) || 1;
    return diff;
  })();

  const dailyBurnRate = totalSpent / daysDiff;
  const dailyInflowRate = totalIncome / daysDiff;

  const topExpenseCategory = expenseBreakdown.length > 0
    ? [...expenseBreakdown].sort((a, b) => b.total - a.total)[0]
    : null;

  const topIncomeCategory = incomeBreakdown.length > 0
    ? [...incomeBreakdown].sort((a, b) => b.total - a.total)[0]
    : null;

  const getVolatilityStatus = (trendData) => {
    if (trendData.length < 2) return { status: 'Stable', pct: 0 };
    const values = trendData.map(t => t.total);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / values.length);
    const ratio = stdDev / (mean || 1);

    let status = 'Stable';
    if (ratio > 0.4) status = 'Volatile';
    else if (ratio > 0.15) status = 'Moderate';
    return { status, pct: Math.round(ratio * 100) };
  };

  const expenseVolatility = getVolatilityStatus(expenseTrend);
  const incomeVolatility = getVolatilityStatus(incomeTrend);

  // ---- Interactive Custom Donut rendering ----
  const renderDonut = (breakdown, total, isExpense, hoveredSlice, setHoveredSlice) => {
    if (breakdown.length === 0 || total === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-sm">
          <Icons.Info className="w-8 h-8 mb-2 text-slate-700" />
          <span>No {isExpense ? 'outflows' : 'inflows'} recorded for this timeframe</span>
        </div>
      );
    }

    let accumulatedPercentage = 0;
    const radius = 50;
    const circumference = 2 * Math.PI * radius;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
        {/* SVG Container */}
        <div className="relative w-44 h-44 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            {/* Background base circle */}
            <circle cx="60" cy="60" r={radius} fill="transparent" stroke="#0f172a" strokeWidth="12" />

            {breakdown.map((item, index) => {
              const percentage = (item.total / total) * 100;
              const strokeDashoffset = circumference - (percentage / 100) * circumference;
              const rotationOffset = (accumulatedPercentage / 100) * circumference;
              accumulatedPercentage += percentage;

              const isHovered = hoveredSlice === index;

              return (
                <circle
                  key={item.categoryId || index}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke={item.colorCode || (isExpense ? '#6366f1' : '#10b981')}
                  strokeWidth={isHovered ? 16 : 12}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  transform={`rotate(${(rotationOffset / circumference) * 360} 60 60)`}
                  onMouseEnter={() => setHoveredSlice(index)}
                  onMouseLeave={() => setHoveredSlice(null)}
                  className="transition-[stroke-width,stroke,stroke-dashoffset] duration-200 cursor-pointer"
                />
              );
            })}
          </svg>
          {/* Inner Text Overlay (Dynamic) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
            {hoveredSlice !== null && breakdown[hoveredSlice] ? (
              <>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate max-w-[110px]">
                  {breakdown[hoveredSlice].name}
                </span>
                <span className={`text-base font-black ${isExpense ? 'text-rose-400' : 'text-emerald-400'} mt-0.5`}>
                  {breakdown[hoveredSlice].total.toLocaleString()} ₹
                </span>
                <span className="text-[9px] text-slate-500 font-bold mt-0.5">
                  {((breakdown[hoveredSlice].total / total) * 100).toFixed(1)}%
                </span>
              </>
            ) : (
              <>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  {isExpense ? 'Total Spent' : 'Total Inflow'}
                </span>
                <span className="text-xl font-black text-white mt-0.5">
                  {total.toLocaleString()} ₹
                </span>
                <span className={`text-[9px] ${isExpense ? 'text-indigo-400' : 'text-emerald-400'} font-bold mt-0.5 uppercase tracking-wide`}>
                  Hover Slices
                </span>
              </>
            )}
          </div>
        </div>

        {/* Legend listing */}
        <div className="flex-1 w-full space-y-2 max-h-48 overflow-y-auto pr-1">
          {breakdown.map((item, idx) => {
            const pct = ((item.total / total) * 100).toFixed(1);
            const isHovered = hoveredSlice === idx;
            return (
              <div
                key={item.categoryId || idx}
                className={`space-y-1 transition-all duration-150 p-1.5 rounded-xl border ${isHovered
                    ? 'bg-slate-900 border-slate-700/80 translate-x-1 shadow-lg'
                    : 'bg-transparent border-transparent'
                  }`}
                onMouseEnter={() => setHoveredSlice(idx)}
                onMouseLeave={() => setHoveredSlice(null)}
              >
                <div className="flex justify-between text-xs font-semibold">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.colorCode || (isExpense ? '#cbd5e1' : '#10b981') }} />
                    <span className="text-slate-200 truncate">{item.name}</span>
                  </div>
                  <span className="text-slate-400 flex-shrink-0 ml-2">
                    <strong className="text-slate-100">{item.total.toLocaleString()} ₹</strong> ({pct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ backgroundColor: item.colorCode || (isExpense ? '#6366f1' : '#10b981'), width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ---- Interactive Sparkline Chart ----
  const renderTrendChart = (trend, isExpense, hoveredTrendIndex, setHoveredTrendIndex, lockedTrendIndex, setLockedTrendIndex) => {
    if (trend.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-sm">
          <Icons.Info className="w-8 h-8 mb-2 text-slate-700" />
          <span>No historical trend data found</span>
        </div>
      );
    }

    const maxVal = Math.max(...trend.map((t) => t.total)) || 1000;

    // SVG Config
    const width = 500;
    const height = 220;
    const paddingLeft = 65;
    const paddingRight = 25;
    const paddingTop = 35;
    const paddingBottom = 35;
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Map data points
    let points = [];
    if (trendGroup === 'hour') {
      const processedTrend = [...trend];
      if (processedTrend.length > 0 && (processedTrend[0].hour > 0 || processedTrend[0].minute > 0 || processedTrend[0].second > 0)) {
        processedTrend.unshift({
          hour: 0,
          minute: 0,
          second: 0,
          label: '12:00:00 AM',
          total: 0,
          transactions: []
        });
      }

      const todayStr = toLocalYYYYMMDD(new Date());
      const isToday = fromDate === todayStr && toDate === todayStr;
      let endHour = 23;
      let endMinute = 59;
      let endSecond = 59;
      let endLabel = '11:59:59 PM';

      if (isToday) {
        const now = new Date();
        endHour = now.getHours();
        endMinute = now.getMinutes();
        endSecond = now.getSeconds();
        const period = endHour >= 12 ? 'PM' : 'AM';
        const displayHour = endHour % 12 === 0 ? 12 : endHour % 12;
        endLabel = `${String(displayHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}:${String(endSecond).padStart(2, "0")} ${period}`;
      }

      if (processedTrend.length > 0) {
        const lastItem = processedTrend[processedTrend.length - 1];
        const lastItemSecs = lastItem.hour * 3600 + (lastItem.minute || 0) * 60 + (lastItem.second || 0);
        const endSecs = endHour * 3600 + endMinute * 60 + endSecond;
        if (lastItemSecs < endSecs) {
          processedTrend.push({
            hour: endHour,
            minute: endMinute,
            second: endSecond,
            label: endLabel,
            total: lastItem.total,
            transactions: []
          });
        }
      }

      const totalSeconds = endHour * 3600 + endMinute * 60 + endSecond || 86400;
      points = processedTrend.map((t) => {
        const itemSeconds = t.hour * 3600 + (t.minute || 0) * 60 + (t.second || 0);
        const ratio = totalSeconds > 0 ? itemSeconds / totalSeconds : 0;
        const x = paddingLeft + ratio * chartWidth;
        const y = paddingTop + chartHeight - (t.total / maxVal) * chartHeight;
        return {
          x,
          y,
          label: t.label || '',
          val: t.total,
          year: t.year,
          transactions: t.transactions || [],
          hour: t.hour,
          minute: t.minute,
          second: t.second
        };
      });
    } else {
      if (trend.length === 1) {
        const single = trend[0];
        const y = paddingTop + chartHeight - (single.total / maxVal) * chartHeight;
        points = [
          { x: paddingLeft, y, label: single.label || '', val: single.total, year: single.year, transactions: single.transactions || [] },
          { x: width - paddingRight, y, label: single.label || '', val: single.total, year: single.year, transactions: single.transactions || [] }
        ];
      } else {
        points = trend.map((t, idx) => {
          const x = paddingLeft + (idx / (trend.length - 1 || 1)) * chartWidth;
          const y = paddingTop + chartHeight - (t.total / maxVal) * chartHeight;
          return { x, y, label: t.label || '', val: t.total, year: t.year, transactions: t.transactions || [] };
        });
      }
    }

    const pathD = points.reduce((d, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${d} L ${p.x} ${p.y}`;
    }, '');

    const areaD = points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`
      : '';

    const gradId = isExpense ? "expenseGlowGrad" : "incomeGlowGrad";
    const strokeColor = isExpense ? "#818cf8" : "#34d399";
    const pointColor = isExpense ? "#4f46e5" : "#059669";

    const activeIndex = hoveredTrendIndex !== null
      ? hoveredTrendIndex
      : (lockedTrendIndex !== null ? lockedTrendIndex : points.length - 1);
    const activePoint = points[activeIndex];

    const selectionIndex = hoveredTrendIndex !== null ? hoveredTrendIndex : lockedTrendIndex;

    return (
      <div className="w-full h-full relative flex flex-col justify-between">

        <div className="flex-1 relative w-full h-full">
          <svg
            className="absolute inset-0 w-full h-full overflow-visible cursor-pointer"
            viewBox={`0 0 ${width} ${height}`}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const svgX = (x / rect.width) * width;

              let closestIdx = 0;
              let minDiff = Infinity;
              points.forEach((p, idx) => {
                const diff = Math.abs(p.x - svgX);
                if (diff < minDiff) {
                  minDiff = diff;
                  closestIdx = idx;
                }
              });
              setHoveredTrendIndex(closestIdx);
            }}
            onMouseLeave={() => setHoveredTrendIndex(null)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const svgX = (x / rect.width) * width;

              let closestIdx = 0;
              let minDiff = Infinity;
              points.forEach((p, idx) => {
                const diff = Math.abs(p.x - svgX);
                if (diff < minDiff) {
                  minDiff = diff;
                  closestIdx = idx;
                }
              });

              if (lockedTrendIndex === closestIdx) {
                setLockedTrendIndex(null);
              } else {
                setLockedTrendIndex(closestIdx);
              }
            }}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.45" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={paddingLeft} y1={paddingTop + chartHeight / 2} x2={width - paddingRight} y2={paddingTop + chartHeight / 2} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="#334155" strokeWidth="1.5" />

            {/* Vertical Grid lines */}
            {points.map((p, idx) => {
              let showGrid = false;
              if (points.length > 10) {
                const interval = Math.ceil(points.length / 6);
                showGrid = idx % interval === 0 || idx === points.length - 1;
              } else {
                showGrid = true;
              }
              if (!showGrid) return null;
              return (
                <line
                  key={`v-grid-${idx}`}
                  x1={p.x}
                  y1={paddingTop}
                  x2={p.x}
                  y2={height - paddingBottom}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              );
            })}

            {/* Glow Area */}
            {areaD && <path d={areaD} fill={`url(#${gradId})`} />}

            {/* Sparkline glow path */}
            {pathD && <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="6" strokeLinecap="round" opacity="0.18" className="transition-all duration-300" />}

            {/* Sparkline path */}
            {pathD && <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" className="transition-all duration-300" />}

            {/* Point nodes */}
            {points.map((p, idx) => {
              const isActive = selectionIndex === idx;
              return (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? "6.5" : "4.5"}
                  fill={isActive ? "#ffffff" : pointColor}
                  stroke={isActive ? strokeColor : "#cbd5e1"}
                  strokeWidth={isActive ? "2.5" : "1.5"}
                  className="transition-all duration-200 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (lockedTrendIndex === idx) {
                      setLockedTrendIndex(null);
                    } else {
                      setLockedTrendIndex(idx);
                    }
                  }}
                />
              );
            })}

            {/* Axis Labels */}
            {trendGroup === 'hour' ? (() => {
              const now = new Date();
              const todayStr = toLocalYYYYMMDD(now);
              const isToday = fromDate === todayStr && toDate === todayStr;
              const endHour = isToday ? now.getHours() : 23;
              const endMinute = isToday ? now.getMinutes() : 59;
              const endSecond = isToday ? now.getSeconds() : 59;
              const totalSeconds = endHour * 3600 + endMinute * 60 + endSecond || 86400;

              const labelsCount = 5;
              const labels = [];
              for (let i = 0; i < labelsCount; i++) {
                const targetSecs = Math.round((i / (labelsCount - 1)) * totalSeconds);
                const h = Math.floor(targetSecs / 3600);
                const m = Math.floor((targetSecs % 3600) / 60);
                const s = targetSecs % 60;
                const period = h >= 12 ? 'PM' : 'AM';
                const displayHour = h % 12 === 0 ? 12 : h % 12;
                const displayMinute = String(m).padStart(2, "0");
                const displaySecond = String(s).padStart(2, "0");
                const label = `${String(displayHour).padStart(2, "0")}:${displayMinute}:${displaySecond} ${period}`;
                const ratio = totalSeconds > 0 ? targetSecs / totalSeconds : 0;
                const x = paddingLeft + ratio * chartWidth;
                labels.push({ x, label });
              }

              return labels.map((l, idx) => (
                <text
                  key={`h-label-${idx}`}
                  x={l.x}
                  y={height - 12}
                  textAnchor="middle"
                  fill="#64748b"
                  className="text-[10px] font-bold"
                >
                  {l.label}
                </text>
              ));
            })() : (
              points.map((p, idx) => {
                let showLabel = true;
                if (points.length > 10) {
                  const interval = Math.ceil(points.length / 6);
                  showLabel = idx % interval === 0 || idx === points.length - 1;
                }
                if (!showLabel) return null;
                return (
                  <text
                    key={idx}
                    x={p.x}
                    y={height - 12}
                    textAnchor="middle"
                    fill="#64748b"
                    className="text-[10px] font-bold"
                  >
                    {p.label}
                  </text>
                );
              })
            )}

            {/* Interactive Hover Indicators / Crosshair lines */}
            {selectionIndex !== null && points[selectionIndex] && (
              <g>
                {/* Vertical Crosshair */}
                <line
                  x1={points[selectionIndex].x}
                  y1={paddingTop}
                  x2={points[selectionIndex].x}
                  y2={height - paddingBottom}
                  stroke={strokeColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity="0.7"
                />
                {/* Horizontal Crosshair */}
                <line
                  x1={paddingLeft}
                  y1={points[selectionIndex].y}
                  x2={width - paddingRight}
                  y2={points[selectionIndex].y}
                  stroke={strokeColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity="0.7"
                />

                {/* Pulsing crosshair intersection dot */}
                <circle
                  cx={points[selectionIndex].x}
                  cy={points[selectionIndex].y}
                  r="7"
                  fill={pointColor}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <circle
                  cx={points[selectionIndex].x}
                  cy={points[selectionIndex].y}
                  r="12"
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="1"
                  opacity="0.4"
                  className="animate-ping"
                />
              </g>
            )}

            {/* Axis Highlight Badges */}
            {selectionIndex !== null && points[selectionIndex] && (
              <g>
                {/* X Axis Highlight Badge */}
                <rect
                  x={points[selectionIndex].x - 35}
                  y={height - paddingBottom + 2}
                  width="70"
                  height="15"
                  rx="3"
                  fill="#0f172a"
                  stroke={strokeColor}
                  strokeWidth="1"
                />
                <text
                  x={points[selectionIndex].x}
                  y={height - paddingBottom + 12}
                  textAnchor="middle"
                  fill="#ffffff"
                  className="text-[8px] font-extrabold font-mono"
                >
                  {points[selectionIndex].label}
                </text>

                {/* Y Axis Highlight Badge */}
                <rect
                  x={paddingLeft - 61}
                  y={points[selectionIndex].y - 8}
                  width="58"
                  height="15"
                  rx="3"
                  fill="#0f172a"
                  stroke={strokeColor}
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 6}
                  y={points[selectionIndex].y + 3}
                  textAnchor="end"
                  fill="#ffffff"
                  className="text-[8px] font-extrabold font-mono"
                >
                  {Math.round(points[selectionIndex].val).toLocaleString()}
                </text>
              </g>
            )}
          </svg>

          {/* HTML Tooltip overlay */}
          {selectionIndex !== null && points[selectionIndex] && (() => {
            const point = points[selectionIndex];
            const txs = point.transactions || [];
            if (txs.length === 0) {
              return (
                <div
                  className="absolute bg-slate-950/95 border border-slate-800 text-white rounded-xl p-2 shadow-2xl backdrop-blur-md pointer-events-none text-xs font-bold transition-all duration-75 flex flex-col min-w-[100px]"
                  style={{
                    left: `${(point.x / width) * 100}%`,
                    top: `${(point.y / height) * 100 - 30}%`,
                    transform: 'translate(-50%, -100%)',
                  }}
                >
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                    {point.label}
                  </span>
                  <span className={`text-xs font-black ${isExpense ? 'text-indigo-400' : 'text-emerald-450'} mt-1`}>
                    {point.val.toLocaleString()} ₹
                  </span>
                </div>
              );
            }
            return (
              <div
                className="absolute bg-slate-950/95 border border-slate-800 text-white rounded-xl p-2.5 shadow-2xl backdrop-blur-md pointer-events-none text-xs font-bold transition-all duration-75 flex flex-col min-w-[120px]"
                style={{
                  left: `${(point.x / width) * 100}%`,
                  top: `${(point.y / height) * 100 - 30}%`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wide">
                  ⏰ {trendGroup === 'hour' ? 'Time: ' : 'Date: '}{point.label}
                </span>
                <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto pr-1">
                  {txs.map((tx, txIdx) => (
                    <div key={txIdx} className="flex justify-between items-center text-[10px] text-slate-350 gap-4 border-b border-slate-900/50 pb-0.5 last:border-0">
                      <span className="truncate max-w-[90px]">{tx.note || 'Transaction'}</span>
                      <span className={`font-black ${tx.type === 'expense' ? 'text-rose-400' : 'text-emerald-450'}`}>
                        {tx.amount.toLocaleString()} ₹
                      </span>
                    </div>
                  ))}
                  {txs.length > 1 && (
                    <div className="text-[9px] text-slate-500 font-extrabold text-right pt-1 mt-1 border-t border-slate-850">
                      Total: {point.val.toLocaleString()} ₹
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  // ---- Alternate Bar trend chart ----
  const renderTrendBarChart = (trend, isExpense, hoveredTrendIndex, setHoveredTrendIndex, lockedTrendIndex, setLockedTrendIndex) => {
    if (trend.length === 0) return null;
    const maxVal = Math.max(...trend.map((t) => t.total)) || 1000;

    const width = 500;
    const height = 220;
    const paddingLeft = 65;
    const paddingRight = 25;
    const paddingTop = 35;
    const paddingBottom = 35;
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const barWidth = Math.min((chartWidth / trend.length) * 0.45, 30);
    const spacing = trend.length > 1
      ? (chartWidth - barWidth * trend.length) / (trend.length - 1)
      : chartWidth;

    const gradId = isExpense ? "expenseBarGlowGrad" : "incomeBarGlowGrad";
    const stopColor1 = isExpense ? "#818cf8" : "#34d399";
    const stopColor2 = isExpense ? "#4f46e5" : "#059669";
    const hoverColor = isExpense ? "hover:fill-indigo-400" : "hover:fill-emerald-400";

    const selectionIndex = hoveredTrendIndex !== null ? hoveredTrendIndex : lockedTrendIndex;

    return (
      <div className="w-full h-full relative">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${width} ${height}`}
          onMouseLeave={() => setHoveredTrendIndex(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stopColor1} stopOpacity="0.9" />
              <stop offset="100%" stopColor={stopColor2} stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
          <line x1={paddingLeft} y1={paddingTop + chartHeight / 2} x2={width - paddingRight} y2={paddingTop + chartHeight / 2} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
          <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="#334155" strokeWidth="1.5" />

          {trend.map((t, idx) => {
            let x;
            if (trendGroup === 'hour') {
              const itemSeconds = t.hour * 3600 + (t.minute || 0) * 60 + (t.second || 0);
              const now = new Date();
              const todayStr = toLocalYYYYMMDD(now);
              const isToday = fromDate === todayStr && toDate === todayStr;
              const endHour = isToday ? now.getHours() : 23;
              const endMinute = isToday ? now.getMinutes() : 59;
              const endSecond = isToday ? now.getSeconds() : 59;
              const totalSeconds = endHour * 3600 + endMinute * 60 + endSecond || 86400;
              const ratio = totalSeconds > 0 ? itemSeconds / totalSeconds : 0;
              x = paddingLeft + ratio * chartWidth - barWidth / 2;
            } else {
              x = trend.length > 1
                ? paddingLeft + idx * (barWidth + spacing) + spacing / 2
                : paddingLeft + chartWidth / 2 - barWidth / 2;
            }
            const barHeight = (t.total / maxVal) * chartHeight;
            const y = height - paddingBottom - barHeight;

            const isCurrentSelected = selectionIndex === idx;

            return (
              <g
                key={idx}
                className="group cursor-pointer"
                onMouseEnter={() => setHoveredTrendIndex(idx)}
                onClick={() => {
                  if (lockedTrendIndex === idx) {
                    setLockedTrendIndex(null);
                  } else {
                    setLockedTrendIndex(idx);
                  }
                }}
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  fill={isCurrentSelected ? (isExpense ? "#818cf8" : "#34d399") : `url(#${gradId})`}
                  stroke={isCurrentSelected ? "#ffffff" : "none"}
                  strokeWidth={isCurrentSelected ? 1.5 : 0}
                  className={`transition-all duration-300 ${hoverColor}`}
                />
              </g>
            );
          })}

          {/* X Axis Labels */}
          {trendGroup === 'hour' ? (() => {
            const now = new Date();
            const todayStr = toLocalYYYYMMDD(now);
            const isToday = fromDate === todayStr && toDate === todayStr;
            const endHour = isToday ? now.getHours() : 23;
            const endMinute = isToday ? now.getMinutes() : 59;
            const endSecond = isToday ? now.getSeconds() : 59;
            const totalSeconds = endHour * 3600 + endMinute * 60 + endSecond || 86400;

            const labelsCount = 5;
            const labels = [];
            for (let i = 0; i < labelsCount; i++) {
              const targetSecs = Math.round((i / (labelsCount - 1)) * totalSeconds);
              const h = Math.floor(targetSecs / 3600);
              const m = Math.floor((targetSecs % 3600) / 60);
              const s = targetSecs % 60;
              const period = h >= 12 ? 'PM' : 'AM';
              const displayHour = h % 12 === 0 ? 12 : h % 12;
              const displayMinute = String(m).padStart(2, "0");
              const displaySecond = String(s).padStart(2, "0");
              const label = `${String(displayHour).padStart(2, "0")}:${displayMinute}:${displaySecond} ${period}`;
              const ratio = totalSeconds > 0 ? targetSecs / totalSeconds : 0;
              const x = paddingLeft + ratio * chartWidth;
              labels.push({ x, label });
            }

            return labels.map((l, idx) => (
              <text
                key={`h-bar-label-${idx}`}
                x={l.x}
                y={height - 12}
                textAnchor="middle"
                fill="#64748b"
                className="text-[10px] font-bold"
              >
                {l.label}
              </text>
            ));
          })() : (
            trend.map((t, idx) => {
              const x = trend.length > 1
                ? paddingLeft + idx * (barWidth + spacing) + spacing / 2 + barWidth / 2
                : paddingLeft + chartWidth / 2;
              let showLabel = true;
              if (trend.length > 10) {
                const interval = Math.ceil(trend.length / 6);
                showLabel = idx % interval === 0 || idx === trend.length - 1;
              }
              if (!showLabel) return null;

              return (
                <text
                  key={`bar-label-${idx}`}
                  x={x}
                  y={height - 12}
                  textAnchor="middle"
                  fill="#64748b"
                  className="text-[10px] font-bold"
                >
                  {t.label}
                </text>
              );
            })
          )}
        </svg>

        {/* HTML Tooltip overlay */}
        {selectionIndex !== null && trend[selectionIndex] && (() => {
          const hovered = trend[selectionIndex];
          let x;
          if (trendGroup === 'hour') {
            const itemSeconds = hovered.hour * 3600 + (hovered.minute || 0) * 60 + (hovered.second || 0);
            const now = new Date();
            const todayStr = toLocalYYYYMMDD(now);
            const isToday = fromDate === todayStr && toDate === todayStr;
            const endHour = isToday ? now.getHours() : 23;
            const endMinute = isToday ? now.getMinutes() : 59;
            const endSecond = isToday ? now.getSeconds() : 59;
            const totalSeconds = endHour * 3600 + endMinute * 60 + endSecond || 86400;
            const ratio = totalSeconds > 0 ? itemSeconds / totalSeconds : 0;
            x = paddingLeft + ratio * chartWidth;
          } else {
            x = trend.length > 1
              ? paddingLeft + selectionIndex * (barWidth + spacing) + spacing / 2 + barWidth / 2
              : paddingLeft + chartWidth / 2;
          }
          const barHeight = (hovered.total / maxVal) * chartHeight;
          const y = height - paddingBottom - barHeight;
          const txs = hovered.transactions || [];

          return (
            <div
              className="absolute bg-slate-950/95 border border-slate-800 text-white rounded-xl p-2.5 shadow-2xl backdrop-blur-md pointer-events-none text-xs font-bold transition-all duration-75 flex flex-col min-w-[120px]"
              style={{
                left: `${(x / width) * 100}%`,
                top: `${(y / height) * 100 - 15}%`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wide">
                ⏰ {trendGroup === 'hour' ? 'Time: ' : 'Date: '}{hovered.year ? `${hovered.year} ` : ''}{hovered.label}
              </span>
              {txs.length > 0 ? (
                <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto pr-1">
                  {txs.map((tx, txIdx) => (
                    <div key={txIdx} className="flex justify-between items-center text-[10px] text-slate-350 gap-4 border-b border-slate-900/50 pb-0.5 last:border-0">
                      <span className="truncate max-w-[90px]">{tx.note || 'Transaction'}</span>
                      <span className={`font-black ${tx.type === 'expense' ? 'text-rose-400' : 'text-emerald-450'}`}>
                        {tx.amount.toLocaleString()} ₹
                      </span>
                    </div>
                  ))}
                  {txs.length > 1 && (
                    <div className="text-[9px] text-slate-500 font-extrabold text-right pt-1 mt-1 border-t border-slate-850">
                      Total: {hovered.total.toLocaleString()} ₹
                    </div>
                  )}
                </div>
              ) : (
                <span className={`text-sm font-black ${isExpense ? 'text-rose-400' : 'text-emerald-450'} mt-0.5`}>
                  {hovered.total.toLocaleString()} ₹
                </span>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // ---- Table Sorting Logic ----
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getSortedBreakdown = (breakdownData) => {
    const filtered = breakdownData.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let valA, valB;
      if (sortField === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortField === 'count') {
        valA = a.count;
        valB = b.count;
      } else if (sortField === 'total') {
        valA = a.total;
        valB = b.total;
      } else if (sortField === 'avg') {
        valA = a.count > 0 ? a.total / a.count : 0;
        valB = b.count > 0 ? b.total / b.count : 0;
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  };

  const currentBreakdownDataset = activeTableTab === 'expense' ? expenseBreakdown : incomeBreakdown;
  const sortedBreakdown = getSortedBreakdown(currentBreakdownDataset);

  const activeTrendData = activeTrendType === 'expense' ? expenseTrend : incomeTrend;

  // Calculate key statistics
  const values = activeTrendData.map(t => t.total);
  const firstVal = values.length > 0 ? values[0] : 0;
  const lastVal = values.length > 0 ? values[values.length - 1] : 0;
  const highVal = values.length > 0 ? Math.max(...values) : 0;
  const lowVal = values.length > 0 ? Math.min(...values) : 0;
  const sumVal = values.reduce((a, b) => a + b, 0);
  const avgVal = values.length > 0 ? sumVal / values.length : 0;

  const selectionIndex = hoveredTrendIndex !== null ? hoveredTrendIndex : lockedTrendIndex;
  const activePointIndex = hoveredTrendIndex !== null
    ? hoveredTrendIndex
    : (lockedTrendIndex !== null ? lockedTrendIndex : activeTrendData.length - 1);
  const activePoint = activeTrendData[activePointIndex];

  const activeVal = activePoint ? activePoint.total : lastVal;
  const diffVal = activeVal - firstVal;
  const pctChange = firstVal > 0 ? (diffVal / firstVal) * 100 : 0;

  const isUp = diffVal >= 0;
  const isGood = activeTrendType === 'expense' ? !isUp : isUp;

  const badgeClass = diffVal === 0
    ? 'bg-slate-800 text-slate-400 border-slate-700'
    : (isGood ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20');

  const changeArrow = diffVal === 0 ? '' : (isUp ? '↑' : '↓');
  const changePrefix = diffVal === 0 ? '' : (diffVal > 0 ? '+' : '');
  const activeTimestamp = activePoint ? activePoint.label : '';

  return (
    <div className="space-y-6">

      {/* Dynamic Header & Time Filter Panel */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800/80 p-6 rounded-3xl backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full filter blur-[80px] pointer-events-none" />
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span className="p-2 bg-indigo-650/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
              <Icons.Chart className="w-5 h-5" />
            </span>
            <span>Financial Analytics Hub</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed">
            Real-time cashflow intelligence, dual inflow/outflow breakdown, statistical stability tracking, and savings projection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10">
          {/* Quick Date Presets Selector */}
          <div className="flex items-center space-x-1 bg-slate-950/60 p-1.5 border border-slate-850 rounded-2xl">
            {['this-month', 'last-30-days', 'last-90-days', 'this-year'].map((preset) => (
              <button
                key={preset}
                onClick={() => applyPreset(preset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${datePreset === preset ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {preset === 'this-month' && 'This Month'}
                {preset === 'last-30-days' && '30 Days'}
                {preset === 'last-90-days' && '90 Days'}
                {preset === 'this-year' && 'This Year'}
              </button>
            ))}
          </div>

          {/* Trend Grouping Selector */}
          <div className="flex items-center space-x-1 bg-slate-950/60 p-1.5 border border-slate-850 rounded-2xl">
            {['hour', 'day', 'month', 'year'].map((group) => (
              <button
                key={group}
                onClick={() => {
                  setTrendGroup(group);
                  if (group === 'hour') {
                    const todayStr = toLocalYYYYMMDD(new Date());
                    setFromDate(todayStr);
                    setToDate(todayStr);
                    setDatePreset('custom');
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all uppercase ${trendGroup === group ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {group}
              </button>
            ))}
          </div>

          {/* Date range picker inputs */}
          <div className="flex items-center space-x-2 bg-slate-950/60 border border-slate-800 rounded-2xl px-3.5 py-2.5">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setDatePreset('custom');
                setFromDate(e.target.value);
              }}
              className="bg-transparent border-none text-slate-300 focus:outline-none text-[11px] font-bold"
            />
            <span className="text-slate-600 text-xs font-bold">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setDatePreset('custom');
                setToDate(e.target.value);
              }}
              className="bg-transparent border-none text-slate-300 focus:outline-none text-[11px] font-bold"
            />
          </div>
        </div>
      </div>

      {/* Advanced Metrics Grid with glowing elements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Inflow */}
        <div className="bg-slate-900/60 border border-emerald-900/30 backdrop-blur-xl rounded-3xl p-6 relative overflow-hidden shadow-lg hover:border-emerald-700/40 transition duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full filter blur-2xl" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">Total Inflow</h3>
            <span className="bg-emerald-550/10 text-emerald-450 p-2.5 rounded-2xl border border-emerald-500/15">
              <Icons.ArrowUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">{totalIncome.toLocaleString('en-IN')} ₹</p>
          <p className="text-[10px] text-slate-500 font-bold mt-2.5 uppercase tracking-wider">
            {datePreset === 'custom' ? `Period of ${daysDiff} days` : datePreset.replace('-', ' ')}
          </p>
        </div>

        {/* Card 2: Total Outflow */}
        <div className="bg-slate-900/60 border border-rose-900/30 backdrop-blur-xl rounded-3xl p-6 relative overflow-hidden shadow-lg hover:border-rose-700/40 transition duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full filter blur-2xl" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">Total Outflow</h3>
            <span className="bg-rose-550/10 text-rose-455 p-2.5 rounded-2xl border border-rose-500/15">
              <Icons.ArrowDown className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">{totalSpent.toLocaleString('en-IN')} ₹</p>
          <p className="text-[10px] text-slate-500 font-bold mt-2.5 uppercase tracking-wider">
            Logged Outflows
          </p>
        </div>

        {/* Card 3: Net Savings */}
        <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-6 relative overflow-hidden shadow-lg hover:border-slate-700/85 transition duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full filter blur-2xl" />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">Net Savings</h3>
            <span className={`p-2.5 rounded-2xl border ${netSavings >= 0 ? 'bg-indigo-550/10 text-indigo-400 border-indigo-500/15' : 'bg-rose-550/10 text-rose-450 border-rose-500/15'}`}>
              <Icons.Wallet className="w-4 h-4" />
            </span>
          </div>
          <p className={`text-3xl font-extrabold tracking-tight ${netSavings >= 0 ? 'text-indigo-400' : 'text-rose-450'}`}>{netSavings.toLocaleString('en-IN')} ₹</p>
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
              <span>Savings Rate</span>
              <span className={netSavings >= 0 ? 'text-indigo-400' : 'text-rose-450'}>{savingsRate.toFixed(1)}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full mt-1 overflow-hidden border border-slate-900">
              <div
                className={`h-full rounded-full transition-all duration-300 ${netSavings >= 0 ? 'bg-indigo-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(Math.max(savingsRate, 0), 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Inflow vs Outflow rate */}
        <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-6 relative overflow-hidden shadow-lg hover:border-slate-700/85 transition duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full filter blur-2xl" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">Daily Averages</h3>
            <span className="bg-amber-550/10 text-amber-450 p-2.5 rounded-2xl border border-amber-500/15">
              <Icons.Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-500">Inflow:</span>
              <span className="text-emerald-400 font-black">{Math.round(dailyInflowRate).toLocaleString()} ₹/day</span>
            </div>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-500">Outflow:</span>
              <span className="text-rose-400 font-black">{Math.round(dailyBurnRate).toLocaleString()} ₹/day</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Analysis Chart blocks */}
      {loading ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl py-32 flex items-center justify-center">
          <Icons.Spinner className="w-10 h-10 text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-8">

          {/* SECTION 1: Google Finance Consolidated Trend Chart Card */}
          <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-6 shadow-2xl flex flex-col min-h-[520px]">
            {/* Header / Selector Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-850 pb-4 gap-4">
              <div className="flex items-center space-x-3">
                {/* Outflow / Inflow Toggles */}
                <div className="flex items-center bg-slate-950 p-1.5 rounded-2xl border border-slate-850 shadow-inner">
                  <button
                    onClick={() => {
                      setActiveTrendType('expense');
                      setHoveredTrendIndex(null);
                      setLockedTrendIndex(null);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center space-x-2 ${activeTrendType === 'expense'
                        ? 'bg-rose-500/20 text-rose-450 border border-rose-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${activeTrendType === 'expense' ? 'bg-rose-500 animate-pulse' : 'bg-slate-500'}`} />
                    <span>Outflow (Debit)</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTrendType('income');
                      setHoveredTrendIndex(null);
                      setLockedTrendIndex(null);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center space-x-2 ${activeTrendType === 'income'
                        ? 'bg-emerald-500/20 text-emerald-450 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${activeTrendType === 'income' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                    <span>Inflow (Credit)</span>
                  </button>
                </div>
              </div>

              {/* Right Side Options: Chart Style & Google Finance Date Presets */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Glow/Bar Style Selection */}
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-850">
                  <button
                    onClick={() => {
                      if (activeTrendType === 'expense') setExpenseTrendTab('area');
                      else setIncomeTrendTab('area');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${(activeTrendType === 'expense' ? expenseTrendTab : incomeTrendTab) === 'area'
                        ? 'bg-indigo-650 text-white font-black shadow'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Glow
                  </button>
                  <button
                    onClick={() => {
                      if (activeTrendType === 'expense') setExpenseTrendTab('bar');
                      else setIncomeTrendTab('bar');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${(activeTrendType === 'expense' ? expenseTrendTab : incomeTrendTab) === 'bar'
                        ? 'bg-indigo-650 text-white font-black shadow'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Bar
                  </button>
                </div>

                {/* Google Finance Date Presets */}
                <div className="flex items-center space-x-1 bg-slate-950 p-1 border border-slate-850 rounded-xl">
                  {['1D', '5D', '1M', '6M', 'YTD', '1Y'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => applyPreset(preset)}
                      className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black transition-all ${datePreset === preset ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Google Finance Style HUD Stats */}
            <div className="py-4 flex flex-col sm:flex-row justify-between sm:items-end gap-3 border-b border-slate-850/40">
              <div>
                <span className="text-[10px] text-slate-550 font-extrabold uppercase tracking-widest block">
                  {activeTrendType === 'expense' ? 'Debit Volatility' : 'Credit Volatility'}: {activeTrendType === 'expense' ? expenseVolatility.status : incomeVolatility.status} ({activeTrendType === 'expense' ? expenseVolatility.pct : incomeVolatility.pct}%)
                </span>
                <div className="flex items-baseline space-x-2 mt-1">
                  <span className="text-3xl font-black text-white tracking-tight">
                    {activeVal.toLocaleString('en-IN')} ₹
                  </span>
                  <div className={`flex items-center space-x-1.5 border rounded-xl px-2.5 py-1 text-[10px] font-black tracking-wide ${badgeClass}`}>
                    <span>{changeArrow} {Math.abs(pctChange).toFixed(2)}%</span>
                    <span className="opacity-80">({changePrefix}{diffVal.toLocaleString()} {trendGroup === 'hour' ? 'today' : 'in range'})</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-bold block mt-1 tracking-wide">
                  {activeTimestamp ? `⏰ selected: ${activeTimestamp}` : '📅 latest values shown'}
                </span>
              </div>
            </div>

            {/* SVG Plot Space */}
            <div className="flex-1 flex items-center justify-center mt-4">
              <div className="w-full h-72 flex items-center justify-center relative">
                {(activeTrendType === 'expense' ? expenseTrendTab : incomeTrendTab) === 'area'
                  ? renderTrendChart(
                    activeTrendData,
                    activeTrendType === 'expense',
                    hoveredTrendIndex,
                    setHoveredTrendIndex,
                    lockedTrendIndex,
                    setLockedTrendIndex
                  )
                  : renderTrendBarChart(
                    activeTrendData,
                    activeTrendType === 'expense',
                    hoveredTrendIndex,
                    setHoveredTrendIndex,
                    lockedTrendIndex,
                    setLockedTrendIndex
                  )
                }
              </div>
            </div>

            {/* Bottom Key Statistics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 border-t border-slate-850 pt-5 mt-4">
              <div className="bg-slate-950/20 border border-slate-900 rounded-2xl p-3 flex flex-col justify-between shadow-inner">
                <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">Open</span>
                <span className="text-xs font-black text-white mt-1">{firstVal.toLocaleString()} ₹</span>
              </div>
              <div className="bg-slate-950/20 border border-slate-900 rounded-2xl p-3 flex flex-col justify-between shadow-inner">
                <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">High</span>
                <span className="text-xs font-black text-white mt-1">{highVal.toLocaleString()} ₹</span>
              </div>
              <div className="bg-slate-950/20 border border-slate-900 rounded-2xl p-3 flex flex-col justify-between shadow-inner">
                <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">Low</span>
                <span className="text-xs font-black text-white mt-1">{lowVal.toLocaleString()} ₹</span>
              </div>
              <div className="bg-slate-950/20 border border-slate-900 rounded-2xl p-3 flex flex-col justify-between shadow-inner">
                <span className="text-[9px] text-slate-550 font-extrabold uppercase tracking-widest">Average</span>
                <span className="text-xs font-black text-white mt-1">{Math.round(avgVal).toLocaleString()} ₹</span>
              </div>
              <div className="bg-slate-950/20 border border-slate-900 rounded-2xl p-3 flex flex-col justify-between shadow-inner">
                <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">Current</span>
                <span className="text-xs font-black text-white mt-1">{(activePoint ? activePoint.total : lastVal).toLocaleString()} ₹</span>
              </div>
              <div className="bg-slate-950/20 border border-slate-900 rounded-2xl p-3 flex flex-col justify-between shadow-inner">
                <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">Volume</span>
                <span className="text-xs font-black text-white mt-1">{sumVal.toLocaleString()} ₹</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: Spend & Inflow Breakdown Grid (Side by side) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Spend Breakdown */}
            <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-6 shadow-2xl flex flex-col justify-between min-h-[380px]">
              <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                <div>
                  <h4 className="text-sm font-black text-white">Spend Breakdown</h4>
                  <p className="text-[10px] text-slate-550 mt-0.5">Category-wise outflows distribution.</p>
                </div>

                {/* Tab Selector */}
                <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-850">
                  <button
                    onClick={() => setExpenseTab('donut')}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${expenseTab === 'donut' ? 'bg-indigo-650 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Donut
                  </button>
                  <button
                    onClick={() => setExpenseTab('bars')}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${expenseTab === 'bars' ? 'bg-indigo-650 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    List
                  </button>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center mt-4">
                {expenseTab === 'donut' ? (
                  <div className="w-full">{renderDonut(expenseBreakdown, totalSpent, true, hoveredExpenseSlice, setHoveredExpenseSlice)}</div>
                ) : (
                  <div className="w-full max-h-60 overflow-y-auto space-y-3.5 pr-1">
                    {expenseBreakdown.map((item, idx) => {
                      const pct = ((item.total / totalSpent) * 100).toFixed(1);
                      return (
                        <div key={item.categoryId || idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <div className="flex items-center space-x-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.colorCode || '#6366f1' }} />
                              <span className="text-slate-200">{item.name}</span>
                              <span className="text-[9px] text-slate-550">({item.count} bills)</span>
                            </div>
                            <span className="text-slate-100 font-extrabold">{item.total.toLocaleString()} ₹ <span className="text-slate-500 font-medium text-[9px]">({pct}%)</span></span>
                          </div>
                          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ backgroundColor: item.colorCode || '#6366f1', width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Inflow Breakdown */}
            <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-6 shadow-2xl flex flex-col justify-between min-h-[380px]">
              <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                <div>
                  <h4 className="text-sm font-black text-white">Inflow Breakdown</h4>
                  <p className="text-[10px] text-slate-550 mt-0.5">Category-wise inflows distribution.</p>
                </div>

                {/* Tab Selector */}
                <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-850">
                  <button
                    onClick={() => setIncomeTab('donut')}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${incomeTab === 'donut' ? 'bg-emerald-650 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Donut
                  </button>
                  <button
                    onClick={() => setIncomeTab('bars')}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${incomeTab === 'bars' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    List
                  </button>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center mt-4">
                {incomeTab === 'donut' ? (
                  <div className="w-full">{renderDonut(incomeBreakdown, totalIncome, false, hoveredIncomeSlice, setHoveredIncomeSlice)}</div>
                ) : (
                  <div className="w-full max-h-60 overflow-y-auto space-y-3.5 pr-1">
                    {incomeBreakdown.map((item, idx) => {
                      const pct = ((item.total / totalIncome) * 100).toFixed(1);
                      return (
                        <div key={item.categoryId || idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <div className="flex items-center space-x-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.colorCode || '#10b981' }} />
                              <span className="text-slate-200">{item.name}</span>
                              <span className="text-[9px] text-slate-550">({item.count} deposits)</span>
                            </div>
                            <span className="text-slate-100 font-extrabold">{item.total.toLocaleString()} ₹ <span className="text-slate-500 font-medium text-[9px]">({pct}%)</span></span>
                          </div>
                          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ backgroundColor: item.colorCode || '#10b981', width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Interactive Smart Insights Engine */}
      {!loading && (expenseBreakdown.length > 0 || incomeBreakdown.length > 0) && (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-60 h-60 bg-indigo-500/5 rounded-full filter blur-[60px] pointer-events-none" />
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="p-1.5 bg-indigo-600/10 text-indigo-400 rounded-xl border border-indigo-500/15">
              <Icons.Info className="w-4 h-4" />
            </span>
            <span>Smart Financial Insights</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Insight 1: Cashflow Ratio */}
            <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl shadow-inner flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cashflow Index</span>
                <h4 className={`text-base font-extrabold mt-1.5 ${savingsRate >= 20 ? 'text-indigo-455' : savingsRate >= 0 ? 'text-amber-400' : 'text-rose-450'
                  }`}>
                  {savingsRate >= 20 ? 'Strong Surplus' : savingsRate >= 0 ? 'Tight Balance' : 'Cash Deficit'} ({savingsRate.toFixed(0)}% Rate)
                </h4>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 font-medium leading-relaxed">
                {savingsRate >= 20
                  ? 'Excellent job! You are saving a healthy percentage of your earnings. Consider auto-investing this surplus.'
                  : savingsRate >= 0
                    ? 'Your income barely covers your expenses. Review your non-essential categories to expand your margins.'
                    : 'Alert: Your outflow exceeds your inflow! You are running a deficit. Action is required to prune expenses.'}
              </p>
            </div>

            {/* Insight 2: Expense Concentration */}
            <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl shadow-inner flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Outflow Concentration</span>
                {topExpenseCategory ? (
                  <h4 className="text-base font-extrabold text-rose-450 mt-1.5">
                    {topExpenseCategory.name} Category
                  </h4>
                ) : (
                  <h4 className="text-base font-extrabold text-slate-400 mt-1.5">No Outflow Focus</h4>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 font-medium leading-relaxed">
                {topExpenseCategory && (topExpenseCategory.total / (totalSpent || 1)) > 0.3
                  ? `Warning: ${topExpenseCategory.name} consumes ${Math.round((topExpenseCategory.total / totalSpent) * 100)}% of your total outflows. Focus on trimming this area.`
                  : 'Great! Your spending is well-diversified across multiple categories without single-item dependency.'}
              </p>
            </div>

            {/* Insight 3: Inflow Focus */}
            <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl shadow-inner flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Inflow Source</span>
                {topIncomeCategory ? (
                  <h4 className="text-base font-extrabold text-emerald-400 mt-1.5">
                    {topIncomeCategory.name} Dominance
                  </h4>
                ) : (
                  <h4 className="text-base font-extrabold text-slate-400 mt-1.5">No Inflow Focus</h4>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 font-medium leading-relaxed">
                {topIncomeCategory && (topIncomeCategory.total / (totalIncome || 1)) > 0.5
                  ? `Your primary income comes from ${topIncomeCategory.name} (${Math.round((topIncomeCategory.total / totalIncome) * 100)}%). Developing secondary streams will improve security.`
                  : 'Well diversified! Your earnings flow from multiple streams, enhancing your financial security.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Details Table Log */}
      {!loading && (expenseBreakdown.length > 0 || incomeBreakdown.length > 0) && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
          <div className="px-6 py-5 border-b border-slate-850 bg-slate-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Breakdown Details Log</h3>
              <p className="text-[11px] text-slate-550 mt-0.5 font-bold">Sort columns or search for a specific category.</p>
            </div>

            {/* Tab and Search container */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Table Tab Selector */}
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-850">
                <button
                  onClick={() => {
                    setActiveTableTab('expense');
                    setSearchQuery('');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTableTab === 'expense' ? 'bg-rose-500/20 text-rose-450 border border-rose-550/25 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  Expenses
                </button>
                <button
                  onClick={() => {
                    setActiveTableTab('income');
                    setSearchQuery('');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTableTab === 'income' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-550/25 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  Income
                </button>
              </div>

              {/* Search Input */}
              <div className="relative max-w-xs w-full">
                <input
                  type="text"
                  placeholder="Search category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-350 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <Icons.Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-600" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-850 text-slate-500 text-[10px] font-black uppercase tracking-widest bg-slate-950/10">
                  <th
                    className="py-4 px-6 cursor-pointer hover:text-slate-300 transition-colors select-none"
                    onClick={() => handleSort('name')}
                  >
                    Category Name {sortField === 'name' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th
                    className="py-4 px-6 cursor-pointer hover:text-slate-300 transition-colors select-none"
                    onClick={() => handleSort('count')}
                  >
                    Transactions Count {sortField === 'count' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th
                    className="py-4 px-6 cursor-pointer hover:text-slate-300 transition-colors select-none"
                    onClick={() => handleSort('total')}
                  >
                    Total Amount {sortField === 'total' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th
                    className="py-4 px-6 cursor-pointer hover:text-slate-300 transition-colors select-none"
                    onClick={() => handleSort('avg')}
                  >
                    Avg Transaction Value {sortField === 'avg' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 text-xs font-semibold text-slate-300">
                {sortedBreakdown.map((item, idx) => {
                  const avg = item.count > 0 ? (item.total / item.count).toFixed(2) : 0;
                  return (
                    <tr key={item.categoryId || idx} className="hover:bg-slate-850/20 transition-all duration-150">
                      <td className="py-4 px-6 flex items-center space-x-3">
                        <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.colorCode || (activeTableTab === 'expense' ? '#6366f1' : '#10b981') }} />
                        <span className="text-slate-100 font-bold">{item.name}</span>
                      </td>
                      <td className="py-4 px-6 text-slate-450">{item.count} transactions</td>
                      <td className={`py-4 px-6 font-extrabold ${activeTableTab === 'expense' ? 'text-rose-400' : 'text-emerald-450'}`}>{item.total.toLocaleString()} ₹</td>
                      <td className="py-4 px-6 text-indigo-400 font-extrabold">{parseFloat(avg).toLocaleString()} ₹</td>
                    </tr>
                  );
                })}
                {sortedBreakdown.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-slate-550 font-bold text-xs">
                      No categories match your search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
