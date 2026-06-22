import React from 'react';
import { AppContextProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Expenses } from './pages/Expenses';
import { Budgets } from './pages/Budgets';
import { Recurring } from './pages/Recurring';
import { MapViewer } from './pages/MapViewer';
import { Analytics } from './pages/Analytics';
import { AiAdvisor } from './pages/AiAdvisor';
import { Icons } from './components/Icons';
import './App.css';

function MainAppContent() {
  const { user, loadingUser, currentPath } = useApp();

  if (loadingUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center space-y-4">
          <div className="inline-flex bg-indigo-600 p-3.5 rounded-2xl text-white shadow-xl shadow-indigo-600/20 mb-2 animate-bounce">
            <Icons.Wallet className="w-8 h-8" />
          </div>
          <div>
            <Icons.Spinner className="w-8 h-8 text-indigo-500 mx-auto animate-spin" />
            <p className="text-sm font-semibold text-slate-400 mt-3 uppercase tracking-widest">Loading SpendWise...</p>
          </div>
        </div>
      </div>
    );
  }

  // Hash-based routes routing switcher
  if (!user) {
    return <Auth />;
  }

  switch (currentPath) {
    case '#dashboard':
      return (
        <Layout>
          <Dashboard />
        </Layout>
      );
    case '#expenses':
      return (
        <Layout>
          <Expenses />
        </Layout>
      );
    case '#budgets':
      return (
        <Layout>
          <Budgets />
        </Layout>
      );
    case '#recurring':
      return (
        <Layout>
          <Recurring />
        </Layout>
      );
    case '#analytics':
      return (
        <Layout>
          <Analytics />
        </Layout>
      );
    case '#map':
      return (
        <Layout>
          <MapViewer />
        </Layout>
      );
    case '#ai-advisor':
      return (
        <Layout>
          <AiAdvisor />
        </Layout>
      );
    default:
      return (
        <Layout>
          <Dashboard />
        </Layout>
      );
  }
}

function App() {
  return (
    <AppContextProvider>
      <MainAppContent />
    </AppContextProvider>
  );
}

export default App;
