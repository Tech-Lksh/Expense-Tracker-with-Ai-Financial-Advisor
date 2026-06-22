import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Icons } from './Icons';

export const Layout = ({ children }) => {
  const { user, logout, currentPath, setCurrentPath, notifications, removeNotification } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '#dashboard', icon: <Icons.Dashboard /> },
    { name: 'Expenses', path: '#expenses', icon: <Icons.Receipt /> },
    { name: 'Budgets', path: '#budgets', icon: <Icons.Wallet /> },
    { name: 'Recurring', path: '#recurring', icon: <Icons.Calendar /> },
    { name: 'Analytics', path: '#analytics', icon: <Icons.Chart /> },
    { name: 'Map View', path: '#map', icon: <Icons.MapPin /> },
    { name: 'AI Advisor', path: '#ai-advisor', icon: <Icons.Sparkles /> },
  ];

  const getPageTitle = () => {
    const active = menuItems.find((item) => item.path === currentPath);
    return active ? active.name : 'SpendWise';
  };

  const handleNavClick = (path) => {
    setCurrentPath(path);
    setMobileOpen(false);
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden">

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900/60 backdrop-blur-xl border-r border-slate-800/80 p-5 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center space-x-3 mb-8 px-2 py-1">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/30">
            <Icons.Wallet className="w-6 h-6" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            SpendWise
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`flex items-center w-full space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group text-left ${isActive
                    ? 'bg-indigo-600/90 text-white font-medium shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                  }`}
              >
                <div className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'}`}>
                  {item.icon}
                </div>
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer User Info */}
        {user && (
          <div className="border-t border-slate-800/60 pt-4 mt-auto">
            <div className="flex items-center space-x-3 px-2 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 text-indigo-400 font-bold border border-slate-700/50 shadow-inner">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-200 truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center w-full space-x-3 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-xl transition-all duration-200 group"
            >
              <Icons.LogOut className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-1" />
              <span className="text-sm font-medium">Log Out</span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Top Header / Navigation Toggle */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        <header className="flex md:hidden items-center justify-between h-16 px-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/60 flex-shrink-0 z-30">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <Icons.Wallet className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              SpendWise
            </span>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-slate-400 hover:text-slate-100 focus:outline-none"
          >
            {mobileOpen ? <Icons.Close className="w-6 h-6" /> : <Icons.Dashboard className="w-6 h-6" />}
          </button>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="md:hidden absolute inset-0 top-16 bg-slate-950/95 backdrop-blur-md z-20 flex flex-col p-4 animate-fade-in">
            <nav className="flex-1 space-y-2 py-4">
              {menuItems.map((item) => {
                const isActive = currentPath === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavClick(item.path)}
                    className={`flex items-center w-full space-x-3 px-4 py-3 rounded-xl ${isActive ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>
            {user && (
              <div className="border-t border-slate-800 pt-4 pb-8 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 text-indigo-400 font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-red-400 hover:bg-red-950/30 rounded-lg"
                >
                  <Icons.LogOut className="w-6 h-6" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <main className={`flex-1 relative bg-slate-950 focus:outline-none ${currentPath === '#ai-advisor'
            ? 'overflow-hidden p-4 md:p-6 flex flex-col'
            : 'overflow-y-auto p-4 md:p-8'
          }`}>
          {/* Dashboard Page Header */}
          {currentPath !== '#ai-advisor' && (
            <div className="hidden md:flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none mb-1">
                  {getPageTitle()}
                </h1>
                <p className="text-sm text-slate-400 font-medium">
                  {user ? `Welcome back, ${user.name}!` : 'Manage your finances efficiently'}
                </p>
              </div>

              {/* Real-time date display */}
              <div className="flex items-center bg-slate-900/40 border border-slate-800/80 px-4 py-2 rounded-xl text-slate-400 text-sm font-medium backdrop-blur-sm">
                <Icons.Calendar className="w-4 h-4 mr-2 text-indigo-400" />
                <span>{new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          )}

          <div className={`w-full ${currentPath === '#ai-advisor' ? 'h-full min-h-0 flex flex-col' : ''}`}>
            {children}
          </div>
        </main>
      </div>

      {/* Floating Notifications Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col space-y-3 w-full max-w-sm pointer-events-none px-4 md:px-0">
        {notifications.map((toast) => {
          let typeClasses = 'bg-slate-900/90 text-slate-100 border-slate-700/60 shadow-indigo-950/30';
          let icon = <Icons.Info className="w-5 h-5 text-indigo-400 flex-shrink-0" />;

          if (toast.type === 'success') {
            typeClasses = 'bg-emerald-950/90 text-emerald-100 border-emerald-800/80 shadow-emerald-950/20';
            icon = <Icons.Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />;
          } else if (toast.type === 'error') {
            typeClasses = 'bg-red-950/90 text-red-100 border-red-800/80 shadow-red-950/20';
            icon = <Icons.Alert className="w-5 h-5 text-red-400 flex-shrink-0" />;
          } else if (toast.type === 'warning') {
            typeClasses = 'bg-amber-950/90 text-amber-100 border-amber-800/80 shadow-amber-950/20';
            icon = <Icons.Alert className="w-5 h-5 text-amber-400 flex-shrink-0" />;
          }

          return (
            <div
              key={toast.id}
              className={`flex items-start justify-between p-4 rounded-xl border backdrop-blur-md shadow-lg pointer-events-auto transition-all duration-300 transform translate-y-0 opacity-100 scale-100 animate-slide-in ${typeClasses}`}
            >
              <div className="flex space-x-3 items-center">
                {icon}
                <p className="text-sm font-medium leading-relaxed">{toast.message}</p>
              </div>
              <button
                onClick={() => removeNotification(toast.id)}
                className="text-slate-400 hover:text-slate-200 transition-colors ml-4 focus:outline-none flex-shrink-0"
              >
                <Icons.Close className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
