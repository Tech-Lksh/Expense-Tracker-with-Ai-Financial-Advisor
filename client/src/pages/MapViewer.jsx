import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Icons } from '../components/Icons';

export const MapViewer = () => {
  const { user, addNotification } = useApp();
  const [mapData, setMapData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Nearby expenses states
  const [userCoords, setUserCoords] = useState(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [nearbyExpenses, setNearbyExpenses] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

  // Map references
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const userMarkerRef = useRef(null);
  const routesGroupRef = useRef(null);

  // Initial load: Fetch coordinates for map
  useEffect(() => {
    const fetchCoords = async () => {
      setLoading(true);
      try {
        const data = await api.expenses.getMapData();
        setMapData(data || []);
      } catch (err) {
        console.error('Failed to load map coordinates:', err.message);
        addNotification('Failed to load map transactions: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchCoords();
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (loading || !window.L || mapInstanceRef.current) return;

    // Create Leaflet map centered on India or default coords
    const map = window.L.map(mapContainerRef.current, {
      zoomControl: true,
      fadeAnimation: true,
    }).setView([22.9734, 78.6569], 5);

    // Premium detailed Google Maps Satellite Hybrid tile layer showing satellite view with streets and labels
    window.L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      attribution: '&copy; Google Maps',
      maxZoom: 20
    }).addTo(map);

    mapInstanceRef.current = map;
    // Create layer group for marker management
    markersGroupRef.current = window.L.layerGroup().addTo(map);
    routesGroupRef.current = window.L.layerGroup().addTo(map);

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading]);

  // Update Markers when mapData changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group || !window.L) return;

    // Clear existing markers
    group.clearLayers();

    if (mapData.length === 0) return;

    const bounds = [];

    mapData.forEach((exp) => {
      if (!exp.location || !exp.location.coordinates) return;

      const [lng, lat] = exp.location.coordinates;
      if (lat == null || lng == null) return;

      bounds.push([lat, lng]);

      // Define standard Leaflet marker with custom colored icon
      const color = exp.category?.colorCode || '#cbd5e1';
      
      // Creating custom colored dot marker using Leaflet divIcon
      const customIcon = window.L.divIcon({
        className: 'custom-map-marker',
        html: `<div style="background-color: ${color}; width: 14px; height: 14px; border: 2.5px solid #0f172a; border-radius: 50%; box-shadow: 0 0 10px ${color}88;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const popupContent = `
        <div style="font-family: 'Inter', sans-serif; padding: 4px; min-width: 160px;">
          <h4 style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #f8fafc;">
            ${exp.note || (exp.customCategory ? `${exp.category?.name || 'Other'}: ${exp.customCategory}` : (exp.category?.name || 'Expense'))}
          </h4>
          <p style="margin: 0 0 4px; font-size: 11px; color: #38bdf8; font-weight: 600; display: flex; align-items: center; gap: 4px;">
            📍 ${exp.location.name || exp.location.formattedAddress || 'Unknown Location'}
          </p>
          <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 500;">
            📅 ${new Date(exp.date).toLocaleDateString()}
          </p>
          <div style="margin-top: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="font-size: 10px; font-weight: 700; background-color: ${color}20; color: ${color}; border: 1px solid ${color}35; padding: 1.5px 5px; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px;">
              ${exp.customCategory ? `${exp.category?.name || 'Other'}: ${exp.customCategory}` : (exp.category?.name || 'Other')}
            </span>
            <strong style="font-size: 13px; font-weight: 800; color: #818cf8; white-space: nowrap;">
              ${exp.amount} ${exp.currency || 'INR'}
            </strong>
          </div>
        </div>
      `;

      window.L.marker([lat, lng], { icon: customIcon })
        .bindPopup(popupContent)
        .bindTooltip(
          `<div style="font-family: 'Inter', sans-serif; padding: 2px;">
             <div style="font-weight: 700; color: #f8fafc;">${exp.note || (exp.customCategory ? `${exp.category?.name || 'Other'}: ${exp.customCategory}` : (exp.category?.name || 'Expense'))}</div>
             <div style="font-size: 10px; color: #38bdf8; font-weight: 600; margin: 1px 0;">📍 ${exp.location.name || exp.location.formattedAddress || 'Location'}</div>
             <div style="font-size: 10px; font-weight: 800; color: #818cf8;">${exp.amount} ${exp.currency || 'INR'}</div>
           </div>`,
          { className: 'leaflet-tooltip-dark' }
        )
        .addTo(group);
    });

    // Fit map bounds to show all markers
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [mapData]);

  // Update Route Lines connecting user to all geotagged expenses
  useEffect(() => {
    const map = mapInstanceRef.current;
    const routesGroup = routesGroupRef.current;
    if (!map || !routesGroup || !window.L || !userCoords) return;

    // Clear existing route lines
    routesGroup.clearLayers();

    // Query and draw road routes asynchronously
    mapData.forEach(async (exp) => {
      if (!exp.location || !exp.location.coordinates) return;

      const [lng, lat] = exp.location.coordinates;
      if (lat == null || lng == null) return;

      const expenseLatLng = [lat, lng];
      const userLatLng = [userCoords.lat, userCoords.lng];
      const color = '#3b82f6';

      let routeLatLngs = [userLatLng, expenseLatLng]; // default straight line fallback
      let distanceText = '';

      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${userCoords.lng},${userCoords.lat};${lng},${lat}?overview=full&geometries=geojson`
        );
        const routeData = await response.json();
        
        if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
          const route = routeData.routes[0];
          routeLatLngs = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
          const distanceMeters = route.distance;
          distanceText = distanceMeters > 1000 
            ? `${(distanceMeters / 1000).toFixed(2)} km (by road)` 
            : `${Math.round(distanceMeters)} m (by road)`;
        }
      } catch (err) {
        console.warn('OSRM routing request failed, falling back to direct line:', err.message);
      }

      if (!distanceText) {
        const distance = map.distance(userLatLng, expenseLatLng);
        distanceText = distance > 1000 
          ? `${(distance / 1000).toFixed(2)} km (direct)` 
          : `${Math.round(distance)} m (direct)`;
      }

      // Draw custom dual-line for premium glowing road appearance
      const glowPolyline = window.L.polyline(routeLatLngs, {
        color: color,
        weight: 8,
        opacity: 0.25,
        lineJoin: 'round',
        lineCap: 'round'
      });

      const polyline = window.L.polyline(routeLatLngs, {
        color: color,
        weight: 4.5,
        opacity: 0.85,
        lineJoin: 'round',
        lineCap: 'round',
        className: 'pulse-route-line'
      });

      const tooltipContent = `
        <div style="font-family: 'Inter', sans-serif; padding: 2px;">
          <div style="font-weight: 800; color: ${color};">${exp.customCategory ? `${exp.category?.name || 'Other'}: ${exp.customCategory}` : (exp.category?.name || 'Other')}</div>
          <div style="font-size: 11px; color: #38bdf8; font-weight: 600; margin: 2px 0;">📍 ${exp.location.name || exp.location.formattedAddress || 'Location'}</div>
          <div style="font-size: 10px; color: #94a3b8;">Amt: <strong style="color: #fff;">${exp.amount} ${exp.currency || 'INR'}</strong> | Dist: <strong style="color: #fff;">${distanceText}</strong></div>
        </div>
      `;

      glowPolyline.bindTooltip(tooltipContent, { sticky: true, className: 'leaflet-tooltip-dark' });
      polyline.bindTooltip(tooltipContent, { sticky: true, className: 'leaflet-tooltip-dark' });

      glowPolyline.addTo(routesGroup);
      polyline.addTo(routesGroup);
    });
  }, [userCoords, mapData]);

  // Request browser Geolocation and trigger nearby API queries
  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      addNotification('Geolocation is not supported by your browser.', 'warning');
      return;
    }

    setLoadingNearby(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ lat: latitude, lng: longitude });

        const map = mapInstanceRef.current;
        if (map && window.L) {
          // Center map on user location with high zoom for detailed street view
          map.setView([latitude, longitude], 16);

          const userName = user?.name || 'User';
          const userChar = user?.name ? user.name.charAt(0).toUpperCase() : '👤';

          const userIcon = window.L.divIcon({
            className: 'user-location-marker-container',
            html: `
              <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 36px; height: 36px;">
                <!-- Floating Label Above -->
                <div style="position: absolute; bottom: 42px; background: #0f172a; border: 1.5px solid #3b82f6; color: #3b82f6; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 20px; white-space: nowrap; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.4); text-transform: uppercase; letter-spacing: 0.05em; z-index: 9999;">
                  👤 My Location (${userName})
                </div>
                <!-- Pulse Effect -->
                <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.4); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; z-index: -1;"></div>
                <!-- Marker Circle with Character -->
                <div style="background-color: #3b82f6; width: 32px; height: 32px; border: 3px solid #e0f2fe; border-radius: 50%; box-shadow: 0 0 15px rgba(59, 130, 246, 0.7); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; color: #ffffff; font-family: 'Inter', sans-serif;">
                  ${userChar}
                </div>
              </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });

          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([latitude, longitude]);
            userMarkerRef.current.setIcon(userIcon);
          } else {
            userMarkerRef.current = window.L.marker([latitude, longitude], { icon: userIcon })
              .bindPopup('<strong style="color: #60a5fa;">Your current location</strong>')
              .addTo(map);
          }
        }

        // Query nearby expenses from backend
        try {
          const results = await api.expenses.getNearby(latitude, longitude, radiusKm);
          setNearbyExpenses(results || []);
          addNotification(`Found ${results.length} expenses within ${radiusKm}km radius!`, 'success');
        } catch (err) {
          addNotification('Nearby expenses query failed: ' + err.message, 'error');
        } finally {
          setLoadingNearby(false);
        }
      },
      (err) => {
        console.error('Geolocation lookup failed:', err);
        addNotification('Could not resolve your location: ' + err.message, 'error');
        setLoadingNearby(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Automatically trigger geolocation to center map on user's current location on page load
  useEffect(() => {
    if (!loading && mapInstanceRef.current) {
      handleGeolocate();
    }
  }, [loading]);

  // Trigger geolocation rerun when radius slides
  const handleRadiusChange = (e) => {
    const val = parseInt(e.target.value);
    setRadiusKm(val);
    if (userCoords) {
      // Re-query nearby api with new radius
      const queryNearby = async () => {
        setLoadingNearby(true);
        try {
          const results = await api.expenses.getNearby(userCoords.lat, userCoords.lng, val);
          setNearbyExpenses(results || []);
        } catch (err) {
          addNotification('Nearby expenses query failed: ' + err.message, 'error');
        } finally {
          setLoadingNearby(false);
        }
      };
      queryNearby();
    }
  };

  // Pan map to clicked expense
  const handleFocusExpense = (exp) => {
    const map = mapInstanceRef.current;
    if (!map || !exp.location || !exp.location.coordinates) return;
    const [lng, lat] = exp.location.coordinates;
    map.setView([lat, lng], 15);
  };

  return (
    <div className="space-y-6">
      
      {/* Location control dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Hand: Map Panel Container */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl flex flex-col h-[520px]">
          {loading && (
            <div className="absolute inset-0 z-40 bg-slate-900/85 backdrop-blur-md flex items-center justify-center">
              <div className="text-center">
                <Icons.Spinner className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-semibold">Loading map interface...</p>
              </div>
            </div>
          )}
          {/* Map canvas */}
          <div ref={mapContainerRef} className="w-full flex-1 z-10" />
        </div>

        {/* Right Hand: Location Intelligence Side Bar */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between h-[520px]">
          <div>
            <h3 className="text-lg font-bold text-white mb-3">Location Intelligence</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Track exactly where your currency is spent. Press geolocate to search for transactions near your current GPS position.
            </p>

            {/* Geolocation Button Controls */}
            <div className="space-y-4">
              <button
                onClick={handleGeolocate}
                disabled={loadingNearby}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md shadow-indigo-600/20 text-sm transition disabled:opacity-50"
              >
                {loadingNearby ? (
                  <>
                    <Icons.Spinner className="w-5 h-5 mr-2 animate-spin text-white" />
                    <span>Resolving GPS Location...</span>
                  </>
                ) : (
                  <>
                    <Icons.MapPin className="w-5 h-5 text-indigo-200" />
                    <span>Scan Expenses Near Me</span>
                  </>
                )}
              </button>

              {userCoords && (
                <div className="space-y-2 bg-slate-950/40 p-4 rounded-xl border border-slate-850">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                    <span>Scanner Radius</span>
                    <span className="text-indigo-400 font-bold">{radiusKm} km</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={radiusKm}
                    onChange={handleRadiusChange}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Near Me list feed */}
          <div className="flex-1 overflow-y-auto mt-6 border-t border-slate-800/60 pt-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Nearby Expenditures</h4>
            
            {!userCoords ? (
              <div className="text-center py-12 text-slate-500 font-medium text-xs">
                <Icons.Info className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                <span>Geolocate to see nearby transactions</span>
              </div>
            ) : loadingNearby ? (
              <div className="flex justify-center items-center py-12">
                <Icons.Spinner className="w-6 h-6 text-indigo-500" />
              </div>
            ) : nearbyExpenses.length === 0 ? (
              <p className="text-center py-12 text-slate-500 font-medium text-xs">No expenses logged in this range.</p>
            ) : (
              <div className="space-y-3 pr-1">
                {nearbyExpenses.map((exp) => (
                  <button
                    key={exp._id}
                    onClick={() => handleFocusExpense(exp)}
                    className="w-full flex items-center justify-between p-3 bg-slate-950/40 hover:bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-xl transition text-left group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                        {exp.note || (exp.customCategory ? `${exp.category?.name || 'Other'}: ${exp.customCategory}` : (exp.category?.name || 'Expense'))}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        📍 {exp.location.name || exp.location.formattedAddress}
                      </p>
                      {exp.distanceMeters != null && (
                        <p className="text-[9px] text-indigo-400 font-bold mt-0.5 uppercase tracking-wide">
                          Distance: {(exp.distanceMeters / 1000).toFixed(2)} km away
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-extrabold text-slate-100 ml-3 flex-shrink-0">
                      {exp.amount} ₹
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
