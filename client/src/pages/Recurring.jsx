import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Icons } from '../components/Icons';

export const Recurring = () => {
  const {
    user,
    categories,
    recurringRules,
    loadRecurringRules,
    addNotification,
    loadingStates,
  } = useApp();

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    categoryId: '',
    amount: '',
    frequency: 'monthly',
    startDate: new Date().toISOString().substring(0, 10),
    note: '',
    location: null,
    customCategory: '',
  });

  const [saving, setSaving] = useState(false);

  // Location suggestions states
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

  // Load recurring rules when component mounts
  useEffect(() => {
    loadRecurringRules();
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

  // Toggle active state
  const handleToggleActive = async (rule) => {
    try {
      await api.recurringRules.update(rule._id, { isActive: !rule.isActive });
      loadRecurringRules();
      addNotification(`Rule marked as ${!rule.isActive ? 'active' : 'inactive'}.`, 'success');
    } catch (err) {
      addNotification(err.message, 'error');
    }
  };


  // Delete rule
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this recurring billing schedule?')) return;
    try {
      await api.recurringRules.delete(id);
      loadRecurringRules();
      addNotification('Recurring rule cancelled.', 'success');
    } catch (err) {
      addNotification(err.message, 'error');
    }
  };

  // Autocomplete Location Handlers
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
        // Call locations autocomplete with coordinates bias
        const result = await api.locations.autocomplete(val, coords);
        setSuggestions(result || []);
      } catch (err) {
        console.warn('Google Places Autocomplete failed:', err.message);
        setLocationError(true);
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 400);
  };

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
      addNotification('Could not resolve location points: ' + err.message, 'warning');
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

  const handleClearLocation = () => {
    setLocationInput('');
    setFormData((prev) => ({ ...prev, location: null }));
  };

  // Open modal
  const openAddModal = () => {
    setFormData({
      categoryId: categories[0]?._id || '',
      amount: '',
      frequency: 'monthly',
      startDate: new Date().toISOString().substring(0, 10),
      note: '',
      location: null,
      customCategory: '',
    });
    setLocationInput('');
    setIsModalOpen(true);
  };

  // Submit form
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
        categoryId: formData.categoryId,
        amount: parseFloat(formData.amount),
        frequency: formData.frequency,
        startDate: new Date(formData.startDate).toISOString(),
        note: formData.note,
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

      await api.recurringRules.create(payload);
      addNotification('Recurring billing rule established successfully!', 'success');
      setIsModalOpen(false);
      loadRecurringRules();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Page Header control bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-xl">
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Scheduled Subscriptions & Billings</h3>
          <p className="text-xs text-slate-500 mt-1">Configure automated expense generation scripts (runs automatically in background jobs).</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-indigo-600/20 text-sm transition"
        >
          <Icons.Plus className="w-4 h-4" />
          <span>Add Recurring Schedule</span>
        </button>
      </div>

      {/* Rules list */}
      {loadingStates.recurring ? (
        <div className="flex justify-center items-center py-20">
          <Icons.Spinner className="w-10 h-10 text-indigo-500" />
        </div>
      ) : recurringRules.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl py-20 text-center backdrop-blur-xl">
          <Icons.Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold text-base mb-1">No active recurring schedules configured.</p>
          <p className="text-xs text-slate-500">Add subscriptions like gym memberships, Netflix, or rent to track them automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {recurringRules.map((rule) => (
            <div
              key={rule._id}
              className={`bg-slate-900/60 border rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between transition ${rule.isActive ? 'border-slate-800' : 'border-slate-900 opacity-60'
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3.5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border text-lg"
                    style={{
                      backgroundColor: `${rule.categoryColorCode || '#cbd5e1'}22`,
                      borderColor: `${rule.categoryColorCode || '#cbd5e1'}45`,
                      color: rule.categoryColorCode || '#cbd5e1',
                    }}
                  >
                    {rule.categoryIcon === 'utensils' && '🍴'}
                    {rule.categoryIcon === 'car' && '🚗'}
                    {rule.categoryIcon === 'shopping-bag' && '👜'}
                    {rule.categoryIcon === 'file-text' && '📄'}
                    {rule.categoryIcon === 'film' && '🎬'}
                    {rule.categoryIcon === 'heart' && '❤️'}
                    {(!rule.categoryIcon || rule.categoryIcon === 'tag') && '🏷️'}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-100 truncate max-w-[180px]">
                      {rule.note || (rule.customCategory ? `${rule.categoryName || 'Other'}: ${rule.customCategory}` : (rule.categoryName || 'Subscription'))}
                    </h4>
                    <span className="inline-flex items-center text-[10px] text-slate-400 font-bold uppercase mt-1 bg-slate-950/40 px-2 py-0.5 rounded border border-slate-850">
                      📅 {rule.frequency}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Status Toggle Switch */}
                  <button
                    onClick={() => handleToggleActive(rule)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${rule.isActive ? 'bg-indigo-600' : 'bg-slate-850'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${rule.isActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                  <button
                    onClick={() => handleDelete(rule._id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-850 rounded-xl transition"
                    title="Delete schedule"
                  >
                    <Icons.Trash className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Billing Info details */}
              <div className="mt-6 flex items-center justify-between border-t border-slate-800/40 pt-4 text-sm font-medium">
                <div>
                  <span className="text-xs text-slate-500">Amount per cycle</span>
                  <p className="text-base font-extrabold text-slate-100 mt-0.5">{rule.amount} INR</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Next run schedule</span>
                  <p className="text-xs font-semibold text-indigo-400 mt-1">
                    {new Date(rule.nextRunDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {rule.location?.formattedAddress && (
                <div className="mt-3 flex items-center space-x-1 text-[10px] text-slate-500 bg-slate-950/20 px-2 py-1 rounded border border-slate-850/50">
                  <Icons.MapPin className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                  <span className="truncate">{rule.location.name || rule.location.formattedAddress}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Recurring Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/60 mb-6">
              <h3 className="text-xl font-bold text-white">Create Recurring Rule</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="rec-category" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</label>
                <select
                  id="rec-category"
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

              {/* Custom Category Input for Other */}
              {(() => {
                const selectedCat = categories.find(c => c._id === formData.categoryId);
                if (selectedCat && selectedCat.name.toLowerCase() === 'other') {
                  return (
                    <div className="space-y-1.5 animate-slide-down">
                      <label htmlFor="rec-custom-category" className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Custom Category Name</label>
                      <input
                        id="rec-custom-category"
                        type="text"
                        required
                        placeholder="e.g. Gift, Netflix, Gym..."
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
                <label htmlFor="rec-amount" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount (INR)</label>
                <input
                  id="rec-amount"
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
                <label htmlFor="rec-frequency" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Frequency</label>
                <select
                  id="rec-frequency"
                  required
                  value={formData.frequency}
                  onChange={(e) => setFormData((prev) => ({ ...prev, frequency: e.target.value }))}
                  className="block w-full py-2.5 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm font-medium"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="rec-start" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Start Date</label>
                <input
                  id="rec-start"
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="block w-full py-2.5 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="rec-note" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</label>
                <input
                  id="rec-note"
                  type="text"
                  placeholder="e.g. Gym Subscription"
                  value={formData.note}
                  onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                  className="block w-full py-2.5 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm placeholder-slate-700 font-medium"
                />
              </div>

              {/* Location Picker */}
              <div className="space-y-1.5 relative" ref={dropdownRef}>
                <label htmlFor="rec-location" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Establishment Location</label>
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
                        id="rec-location"
                        type="text"
                        placeholder="Search address or shop..."
                        value={locationInput}
                        onChange={handleLocationSearchChange}
                        className="block w-full pl-9 pr-4 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 text-sm placeholder-slate-650 font-medium"
                      />
                      {loadingSuggestions && (
                        <span className="absolute right-3 top-2.5">
                          <Icons.Spinner className="w-4 h-4 text-indigo-500 animate-spin" />
                        </span>
                      )}
                    </div>
                    {locationError && (
                      <p className="text-[10px] text-amber-500 bg-amber-950/15 border border-amber-900/30 p-2 rounded-lg font-medium">
                        ⚠️ Autocomplete unavailable. Type manually to log local details.
                      </p>
                    )}
                    {suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 z-50 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-h-48 overflow-y-auto mt-1">
                        {suggestions.map((s) => (
                          <button
                            key={s.placeId}
                            type="button"
                            onClick={() => handleSelectSuggestion(s)}
                            className="flex flex-col text-left w-full px-4 py-2.5 hover:bg-slate-900 border-b border-slate-900 last:border-b-0"
                          >
                            <span className="text-sm font-semibold text-slate-200">{s.mainText}</span>
                            <span className="text-xs text-slate-500 truncate max-w-sm">{s.secondaryText || s.description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
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
                    <span>Create Schedule</span>
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
