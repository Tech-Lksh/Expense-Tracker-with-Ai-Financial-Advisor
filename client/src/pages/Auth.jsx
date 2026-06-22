import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Icons } from '../components/Icons';

export const Auth = () => {
  const { login, register, currentPath, setCurrentPath, addNotification } = useApp();
  
  // Local state to handle: 'login' | 'register' | 'forgot' | 'reset'
  const [authState, setAuthState] = useState('login');
  
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '',
    pin: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devResetPin, setDevResetPin] = useState(''); // Holds generated PIN in UI for dev convenience

  // Sync initial hash route
  useEffect(() => {
    if (currentPath === '#register') {
      setAuthState('register');
    } else {
      setAuthState('login');
    }
  }, [currentPath]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleStateChange = (nextState) => {
    setError('');
    setDevResetPin('');
    setFormData({ name: '', email: '', password: '', pin: '' });
    setAuthState(nextState);
    if (nextState === 'register') {
      setCurrentPath('#register');
    } else {
      setCurrentPath('#login');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Field Validations
    if (authState === 'login') {
      if (!formData.email || !formData.password) {
        setError('Please enter your email and password.');
        return;
      }
    } else if (authState === 'register') {
      if (!formData.name || !formData.email || !formData.password) {
        setError('Please fill in all registration fields.');
        return;
      }
    } else if (authState === 'forgot') {
      if (!formData.email) {
        setError('Please enter your email address.');
        return;
      }
    } else if (authState === 'reset') {
      if (!formData.pin || !formData.password) {
        setError('Please enter the 6-digit code and your new password.');
        return;
      }
      if (formData.password.length < 8) {
        setError('New password must be at least 8 characters long.');
        return;
      }
    }

    setLoading(true);

    try {
      if (authState === 'login') {
        await login(formData.email, formData.password);
      } else if (authState === 'register') {
        await register(formData.name, formData.email, formData.password);
      } else if (authState === 'forgot') {
        const data = await api.auth.forgotPassword(formData.email);
        const code = data.pin;
        setDevResetPin(code);
        addNotification(`Reset PIN generated: ${code}. Fill details to update password.`, 'success', 15000);
        // Retain email and clear password, switch to reset state
        setAuthState('reset');
      } else if (authState === 'reset') {
        await api.auth.resetPassword(formData.pin, formData.password);
        addNotification('Password updated successfully! Please log in.', 'success');
        handleStateChange('login');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4 py-12 relative overflow-hidden">
      
      {/* Background soft glowing highlights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10 pointer-events-none animate-pulse delay-700"></div>

      {/* Main card wrapper */}
      <div className="w-full max-w-md bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
        
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex bg-indigo-600 p-3 rounded-2xl text-white shadow-xl shadow-indigo-600/30 mb-4 animate-bounce">
            <Icons.Wallet className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            {authState === 'login' && 'Welcome Back'}
            {authState === 'register' && 'Create Account'}
            {authState === 'forgot' && 'Reset Password'}
            {authState === 'reset' && 'Enter Verification Code'}
          </h2>
          <p className="text-sm text-slate-400 mt-2 font-medium">
            {authState === 'login' && 'Log in to manage your budget & geolocate spending'}
            {authState === 'register' && 'Sign up to start tracking your expenses intelligently'}
            {authState === 'forgot' && 'Enter your email address to generate a verification PIN'}
            {authState === 'reset' && 'Type the 6-digit code and select a new password'}
          </p>
        </div>

        {/* Info Box showing PIN in Development Mode */}
        {devResetPin && (
          <div className="mb-6 p-4 bg-indigo-950/40 border border-indigo-800/60 rounded-xl flex items-start space-x-3 text-indigo-200">
            <Icons.Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-bold">Development Helper PIN:</span>
              <p className="mt-1 font-mono text-lg tracking-widest text-indigo-300 font-bold bg-slate-950/80 px-3 py-1 rounded border border-indigo-900/40 inline-block">
                {devResetPin}
              </p>
            </div>
          </div>
        )}

        {/* Error Alert Box */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start space-x-3 text-red-200">
            <Icons.Alert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm font-medium leading-relaxed">{error}</span>
          </div>
        )}

        {/* Forms */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {authState === 'register' && (
            <div className="space-y-2">
              <label htmlFor="name" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Icons.User className="w-5 h-5" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="block w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-100 placeholder-slate-600 transition duration-150 text-sm font-medium"
                />
              </div>
            </div>
          )}

          {authState !== 'reset' && (
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Icons.Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="block w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-100 placeholder-slate-600 transition duration-150 text-sm font-medium"
                />
              </div>
            </div>
          )}

          {authState === 'reset' && (
            <div className="space-y-2">
              <label htmlFor="pin" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                6-Digit Reset PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Icons.User className="w-5 h-5" />
                </div>
                <input
                  id="pin"
                  name="pin"
                  type="text"
                  required
                  maxLength="6"
                  value={formData.pin}
                  onChange={handleChange}
                  placeholder="123456"
                  className="block w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-100 placeholder-slate-600 transition duration-150 text-sm font-medium tracking-widest font-mono text-center text-lg"
                />
              </div>
            </div>
          )}

          {(authState === 'login' || authState === 'register' || authState === 'reset') && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {authState === 'reset' ? 'New Password' : 'Password'}
                </label>
                {authState === 'login' && (
                  <button
                    type="button"
                    onClick={() => handleStateChange('forgot')}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 focus:outline-none hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Icons.Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="block w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-100 placeholder-slate-600 transition duration-150 text-sm font-medium"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition duration-150 text-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <Icons.Spinner className="w-5 h-5 mr-2 animate-spin text-white" />
                <span>Processing...</span>
              </>
            ) : (
              <span>
                {authState === 'login' && 'Log In'}
                {authState === 'register' && 'Sign Up'}
                {authState === 'forgot' && 'Send Reset Code'}
                {authState === 'reset' && 'Reset Password'}
              </span>
            )}
          </button>
        </form>

        {/* Dynamic Route Toggle */}
        <div className="mt-8 text-center border-t border-slate-800/80 pt-6">
          <p className="text-sm text-slate-400 font-medium">
            {authState === 'login' && (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => handleStateChange('register')}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold focus:outline-none hover:underline"
                >
                  Sign Up here
                </button>
              </>
            )}
            {authState === 'register' && (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => handleStateChange('login')}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold focus:outline-none hover:underline"
                >
                  Log In here
                </button>
              </>
            )}
            {(authState === 'forgot' || authState === 'reset') && (
              <button
                onClick={() => handleStateChange('login')}
                className="text-indigo-400 hover:text-indigo-300 font-semibold focus:outline-none hover:underline"
              >
                Back to Log In
              </button>
            )}
          </p>
        </div>

      </div>
    </div>
  );
};
