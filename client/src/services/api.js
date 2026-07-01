const BASE_URL = 'https://expense-tracker-with-ai-financial-advisor.onrender.com/api/v1';

let tokenStore = {
  accessToken: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
};

export const setTokens = (accessToken, refreshToken) => {
  tokenStore.accessToken = accessToken;
  if (accessToken) {
    localStorage.setItem('accessToken', accessToken);
  } else {
    localStorage.removeItem('accessToken');
  }

  if (refreshToken !== undefined) {
    tokenStore.refreshToken = refreshToken;
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }
  }
};

export const getAccessToken = () => tokenStore.accessToken;
export const getRefreshToken = () => tokenStore.refreshToken;

// Custom fetch wrapper with interceptor logic
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  // Set headers
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (tokenStore.accessToken) {
    headers['Authorization'] = `Bearer ${tokenStore.accessToken}`;
  }

  const fetchOptions = {
    ...options,
    headers,
    // credentials: 'include' enables cookies to be sent along for sameSite requests
    credentials: 'include',
  };

  let response = await fetch(url, fetchOptions);

  // If unauthorized, attempt to refresh token (except for login/register/forgot/reset endpoints)
  if (response.status === 401 && !options._retry && 
      !endpoint.startsWith('/auth/login') && 
      !endpoint.startsWith('/auth/register') && 
      !endpoint.startsWith('/auth/forgot-password') && 
      !endpoint.startsWith('/auth/reset-password')) {
    options._retry = true;
    try {
      const refreshed = await refreshSession();
      if (refreshed && refreshed.accessToken) {
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${refreshed.accessToken}`;
        return await fetch(url, fetchOptions);
      }
    } catch (refreshErr) {
      console.error('Session refresh failed, logging out:', refreshErr);
      // Clear tokens and trigger reload or auth state change
      setTokens(null, null);
      window.dispatchEvent(new Event('auth_session_expired'));
    }
  }

  return response;
}

// Handler for parsing API responses
async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.details && data.details.length > 0
      ? `${data.message}: ${data.details.join(', ')}`
      : data.message || data.error || 'Something went wrong';
    throw new Error(errorMsg);
  }
  return data.data; // Mapped to the APIResponse envelope { success, message, data }
}

// ---- Token refresh deduplication ----
// When the access token expires, multiple in-flight requests may all receive
// 401 and each try to refresh. Without deduplication the second refresh sends
// the *old* (already-rotated) refresh token, the backend detects hash mismatch,
// assumes token theft, and nukes the session → user gets logged out.
// Solution: hold a single shared promise; all concurrent callers await it.
let _refreshPromise = null;

// Refresh Session
export async function refreshSession() {
  // If a refresh is already in flight, piggy-back on it.
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const currentRefreshToken = getRefreshToken();
    const url = `${BASE_URL}/auth/refresh`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: currentRefreshToken }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Refresh failed');
    }

    const resData = await response.json();
    const { accessToken, refreshToken: newRefreshToken } = resData.data;

    // Always persist the rotated refresh token the server returns so the
    // next refresh cycle uses the correct (latest) token.
    setTokens(accessToken, newRefreshToken || currentRefreshToken);
    return { accessToken, refreshToken: newRefreshToken || currentRefreshToken };
  })();

  try {
    return await _refreshPromise;
  } finally {
    // Clear the gate so the *next* expiry cycle can fire a fresh refresh.
    _refreshPromise = null;
  }
}

export const api = {
  // Authentication
  auth: {
    register: async (name, email, password) => {
      const res = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.details && data.details.length > 0
          ? `${data.message}: ${data.details.join(', ')}`
          : data.message || 'Registration failed';
        throw new Error(errorMsg);
      }
      
      // The server returns { user, accessToken, refreshToken } in credentials/body
      setTokens(data.data.accessToken, data.data.refreshToken);
      return data.data;
    },

    login: async (email, password) => {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.details && data.details.length > 0
          ? `${data.message}: ${data.details.join(', ')}`
          : data.message || 'Login failed';
        throw new Error(errorMsg);
      }
      
      setTokens(data.data.accessToken, data.data.refreshToken);
      return data.data;
    },

    logout: async () => {
      try {
        const res = await request('/auth/logout', { method: 'POST' });
        await handleResponse(res);
      } finally {
        setTokens(null, null);
      }
    },

    me: async () => {
      const res = await request('/auth/me');
      return handleResponse(res);
    },

    forgotPassword: async (email) => {
      const res = await request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.details && data.details.length > 0
          ? `${data.message}: ${data.details.join(', ')}`
          : data.message || 'Forgot password request failed';
        throw new Error(errorMsg);
      }
      return data.data; // Mapped to { pin }
    },

    resetPassword: async (token, password) => {
      const res = await request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.details && data.details.length > 0
          ? `${data.message}: ${data.details.join(', ')}`
          : data.message || 'Password reset failed';
        throw new Error(errorMsg);
      }
      return data.data;
    },
  },

  // Categories
  categories: {
    list: async () => {
      const res = await request('/categories');
      return handleResponse(res);
    },
    create: async (data) => {
      const res = await request('/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    update: async (id, data) => {
      const res = await request(`/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id) => {
      const res = await request(`/categories/${id}`, { method: 'DELETE' });
      return handleResponse(res);
    },
  },

  // Expenses
  expenses: {
    list: async (filters = {}) => {
      // Build query string
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.category) params.append('category', filters.category);
      if (filters.type) params.append('type', filters.type);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await request(`/expenses${queryString}`);
      
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = body.details && body.details.length > 0
          ? `${body.message}: ${body.details.join(', ')}`
          : body.message || body.error || 'Something went wrong';
        throw new Error(errorMsg);
      }

      return {
        docs: body.data || [],
        totalDocs: body.meta?.total || 0,
        page: body.meta?.page || 1,
        limit: body.meta?.limit || 10,
        totalPages: body.meta?.totalPages || 1,
      };
    },
    create: async (data) => {
      const res = await request('/expenses', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    update: async (id, data) => {
      const res = await request(`/expenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id) => {
      const res = await request(`/expenses/${id}`, { method: 'DELETE' });
      return handleResponse(res);
    },
    getNearby: async (lat, lng, radiusKm = 5, limit = 50) => {
      const res = await request(`/expenses/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}&limit=${limit}`);
      return handleResponse(res);
    },
    getMapData: async (from, to) => {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await request(`/expenses/map-data${queryString}`);
      return handleResponse(res);
    },
    getSummary: async (from, to) => {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await request(`/expenses/summary${queryString}`);
      return handleResponse(res);
    },
  },

  // Budgets
  budgets: {
    list: async (month, year) => {
      const res = await request(`/budgets?month=${month}&year=${year}`);
      return handleResponse(res);
    },
    create: async (data) => {
      const res = await request('/budgets', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    update: async (id, data) => {
      const res = await request(`/budgets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id) => {
      const res = await request(`/budgets/${id}`, { method: 'DELETE' });
      return handleResponse(res);
    },
  },

  // Recurring Rules
  recurringRules: {
    list: async () => {
      const res = await request('/recurring-rules');
      return handleResponse(res);
    },
    create: async (data) => {
      const res = await request('/recurring-rules', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    update: async (id, data) => {
      const res = await request(`/recurring-rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id) => {
      const res = await request(`/recurring-rules/${id}`, { method: 'DELETE' });
      return handleResponse(res);
    },
  },

  // Locations (Google maps autocomplete proxies)
  locations: {
    autocomplete: async (input, coords = null) => {
      const params = new URLSearchParams({ input });
      if (coords && coords.lat && coords.lng) {
        params.append('lat', coords.lat);
        params.append('lng', coords.lng);
      }
      const res = await request(`/locations/autocomplete?${params.toString()}`);
      return handleResponse(res);
    },
    getDetails: async (placeId) => {
      const res = await request(`/locations/place-details?placeId=${placeId}`);
      return handleResponse(res);
    },
  },

  // Analytics
  analytics: {
    getCategoryBreakdown: async (from, to, type) => {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (type) params.append('type', type);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) params.append('timezone', tz);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await request(`/analytics/category-breakdown${queryString}`);
      return handleResponse(res);
    },
    getTrend: async (groupBy, from, to, type) => {
      const params = new URLSearchParams({ groupBy });
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (type) params.append('type', type);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) params.append('timezone', tz);
      const res = await request(`/analytics/trend?${params.toString()}`);
      return handleResponse(res);
    },
    getMonthlyTrend: async (monthsBack = 6) => {
      const res = await request(`/analytics/monthly-trend?monthsBack=${monthsBack}`);
      return handleResponse(res);
    },
  },

  // AI Financial Advisor
  aiAdvisor: {
    chat: async (message, history = []) => {
      const res = await request('/ai-advisor/chat', {
        method: 'POST',
        body: JSON.stringify({ message, history }),
      });
      return handleResponse(res);
    },
    getInsights: async () => {
      const res = await request('/ai-advisor/insights');
      return handleResponse(res);
    },
    getHistory: async () => {
      const res = await request('/ai-advisor/history');
      return handleResponse(res);
    },
    clearHistory: async () => {
      const res = await request('/ai-advisor/history', {
        method: 'DELETE',
      });
      return handleResponse(res);
    },
  },
};
