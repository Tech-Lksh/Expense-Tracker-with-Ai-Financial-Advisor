const expenseRepository = require("../../data/repositories/expense.repository");

const parseDateBoundary = (input, setEnd = false, timezone = "UTC") => {
  if (!input) return null;
  
  let dateStr = "";
  if (input instanceof Date) {
    const y = input.getUTCFullYear();
    const m = String(input.getUTCMonth() + 1).padStart(2, '0');
    const d = String(input.getUTCDate()).padStart(2, '0');
    dateStr = `${y}-${m}-${d}`;
  } else if (typeof input === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      dateStr = input;
    } else {
      const parsed = new Date(input);
      if (isNaN(parsed.getTime())) return null;
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      dateStr = `${y}-${m}-${d}`;
    }
  } else {
    const parsed = new Date(input);
    if (isNaN(parsed.getTime())) return null;
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    dateStr = `${y}-${m}-${d}`;
  }

  const hours = setEnd ? 23 : 0;
  const minutes = setEnd ? 59 : 0;
  const seconds = setEnd ? 59 : 0;
  const ms = setEnd ? 999 : 0;

  const [year, month, day] = dateStr.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, ms));

  try {
    const tzFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
    });
    const utcFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
    });

    const tzParts = tzFormatter.formatToParts(utcDate);
    const utcParts = utcFormatter.formatToParts(utcDate);

    const getVal = (parts, type) => Number(parts.find(p => p.type === type).value);

    const tzLocalTime = Date.UTC(
      getVal(tzParts, 'year'),
      getVal(tzParts, 'month') - 1,
      getVal(tzParts, 'day'),
      getVal(tzParts, 'hour') === 24 ? 0 : getVal(tzParts, 'hour'),
      getVal(tzParts, 'minute'),
      getVal(tzParts, 'second')
    );

    const utcLocalTime = Date.UTC(
      getVal(utcParts, 'year'),
      getVal(utcParts, 'month') - 1,
      getVal(utcParts, 'day'),
      getVal(utcParts, 'hour') === 24 ? 0 : getVal(utcParts, 'hour'),
      getVal(utcParts, 'minute'),
      getVal(utcParts, 'second')
    );

    const offsetMs = tzLocalTime - utcLocalTime;
    return new Date(utcDate.getTime() - offsetMs);
  } catch (e) {
    return utcDate;
  }
};

class AnalyticsService {
  async categoryBreakdown(userId, { from, to, type = "expense", timezone = "UTC" }) {
    const start = parseDateBoundary(from, false, timezone) || new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1, 0, 0, 0, 0));
    const end = parseDateBoundary(to, true, timezone) || new Date();
    return expenseRepository.categoryBreakdown(userId, start, end, type);
  }

  async monthlyTrend(userId, monthsBack = 6) {
    const raw = await expenseRepository.monthlyTrend(userId, Number(monthsBack));
    return raw.map((r) => ({
      year: r._id.year,
      month: r._id.month,
      total: r.total,
    }));
  }

  async getTrend(userId, { groupBy = "month", from, to, type = "expense", timezone = "UTC" }) {
    const startDate = parseDateBoundary(from, false, timezone) || new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1, 0, 0, 0, 0));
    const endDate = parseDateBoundary(to, true, timezone) || new Date();

    const raw = await expenseRepository.getTrend(userId, { groupBy, from: startDate, to: endDate, type, timezone });

    if (groupBy === "hour") {
      const result = [];
      for (const item of raw) {
        const h = item.hour;
        const m = item.minute || 0;
        const s = item.second || 0;
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHour = h % 12 === 0 ? 12 : h % 12;
        const displayMinute = String(m).padStart(2, "0");
        const displaySecond = String(s).padStart(2, "0");
        result.push({
          hour: h,
          minute: m,
          second: s,
          label: `${String(displayHour).padStart(2, "0")}:${displayMinute}:${displaySecond} ${period}`,
          total: item.total,
          transactions: item.transactions,
        });
      }
      return result;
    }

    if (groupBy === "day") {
      const map = new Map(raw.map((item) => [item.dateString, item]));
      const result = [];
      const current = new Date(startDate.getTime());
      const safetyLimit = 366;
      let count = 0;

      const getLocalDayString = (date, tz) => {
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
          const parts = formatter.formatToParts(date);
          const getVal = (type) => parts.find(p => p.type === type).value;
          return `${getVal('year')}-${getVal('month')}-${getVal('day')}`;
        } catch (e) {
          return date.toISOString().substring(0, 10);
        }
      };

      while (current <= endDate && count < safetyLimit) {
        const dateString = getLocalDayString(current, timezone);
        const dayLabel = current.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: timezone });
        const item = map.get(dateString);
        result.push({
          date: dateString,
          label: dayLabel,
          year: Number(dateString.split("-")[0]),
          total: item ? item.total : 0,
          transactions: item ? item.transactions : [],
        });
        current.setUTCDate(current.getUTCDate() + 1);
        count++;
      }
      return result;
    }

    if (groupBy === "year") {
      const startYear = startDate.getUTCFullYear();
      const endYear = endDate.getUTCFullYear();
      const map = new Map(raw.map((item) => [item.year, item.total]));
      const result = [];
      for (let y = startYear; y <= endYear; y++) {
        result.push({
          year: y,
          label: String(y),
          total: map.get(y) || 0,
        });
      }
      return result;
    }

    // Default: month
    const map = new Map(raw.map((item) => [`${item.year}-${item.month}`, item.total]));
    const result = [];
    const current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1, 0, 0, 0, 0));
    const monthsList = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const safetyLimit = 60;
    let count = 0;
    while (current <= endDate && count < safetyLimit) {
      const y = current.getUTCFullYear();
      const m = current.getUTCMonth() + 1;
      result.push({
        year: y,
        month: m,
        label: `${monthsList[m - 1]} ${y}`,
        total: map.get(`${y}-${m}`) || 0,
      });
      current.setUTCMonth(current.getUTCMonth() + 1);
      count++;
    }
    return result;
  }
}

module.exports = new AnalyticsService();
