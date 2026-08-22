import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../hooks/useStore';
import {
  firebaseAuth,
  googleProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  type ConfirmationResult
} from '../config/firebase';
import {
  Phone,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Search,
  History,
  BarChart2,
  Briefcase,
  Play,
  ArrowRight,
  Zap,
  Layers,
  ChevronUp,
  ChevronDown,
  User
} from 'lucide-react';
import logoImg from '../assets/logo.png';

export const LoginView: React.FC = () => {
  const { 
    registerDirectUser,
    loginUser, 
    firebaseLogin,
    authError, 
    isAuthLoading, 
    checkAuthSession 
  } = useStore();

  const [view, setView] = useState<'landing' | 'auth'>('landing');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // FAQ section state in landing page
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Countdown timer for resending OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Clear errors when toggling modes
  useEffect(() => {
    setLocalError(null);
    setSuccessMessage(null);
    setOtp('');
    setPassword('');
    setOtpSent(false);
  }, [mode, loginMethod, view]);

  const formatPhoneNumber = (num: string) => {
    let clean = num.trim().replace(/[\s-]/g, '');
    if (!clean.startsWith('+')) {
      if (clean.length === 10) clean = '+91' + clean;
      else clean = '+' + clean;
    }
    return clean;
  };

  const validatePhone = (num: string) => {
    const formatted = formatPhoneNumber(num);
    return formatted.length >= 11;
  };

  // Google 1-Click Sign-In
  const handleGoogleSignIn = async () => {
    setIsFirebaseLoading(true);
    setLocalError(null);
    setSuccessMessage(null);
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const user = result.user;
      const idToken = await user.getIdToken();
      const success = await firebaseLogin({
        id_token: idToken,
        email: user.email || undefined,
        phone_number: user.phoneNumber || undefined,
        uid: user.uid,
        display_name: user.displayName || undefined
      });
      if (success) {
        setSuccessMessage("Signed in with Google successfully!");
        checkAuthSession();
      }
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      setLocalError(err.message || "Failed to sign in with Google. Please check your connection.");
    } finally {
      setIsFirebaseLoading(false);
    }
  };

  // Setup / Clean invisible Recaptcha Verifier for Firebase Phone Auth
  const setupRecaptcha = () => {
    try {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
      const verifier = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          setLocalError("reCAPTCHA expired. Please request OTP again.");
        }
      });
      recaptchaVerifierRef.current = verifier;
      return verifier;
    } catch (e) {
      console.warn("Recaptcha init notice:", e);
      return null;
    }
  };

  const handleRequestOtp = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!validatePhone(phone)) {
      setLocalError("Please enter a valid phone number (e.g. +91 98765 43210 or 10-digit number).");
      return;
    }

    const formattedPhone = formatPhoneNumber(phone);
    setPhone(formattedPhone);
    setLocalError(null);
    setSuccessMessage(null);
    setIsFirebaseLoading(true);
    
    try {
      const appVerifier = setupRecaptcha();
      if (!appVerifier) throw new Error("Failed to initialize verification system. Please refresh the page.");

      const confirmation = await signInWithPhoneNumber(firebaseAuth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setOtpSent(true);
      setCountdown(60);
      setSuccessMessage(`OTP sent via SMS to ${formattedPhone}! Enter the 6-digit code.`);
    } catch (firebaseErr: any) {
      console.error("Firebase Phone Auth error:", firebaseErr);
      setLocalError(firebaseErr.message || "Failed to send SMS OTP. Please check your phone number and try again.");
    } finally {
      setIsFirebaseLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    if (!validatePhone(phone)) {
      setLocalError("Please enter a valid phone number.");
      return;
    }

    const formattedPhone = formatPhoneNumber(phone);

    // 1. If Firebase Confirmation Result is active, verify through Firebase
    if (confirmationResult && otp) {
      setIsFirebaseLoading(true);
      try {
        const userCredential = await confirmationResult.confirm(otp);
        const fbUser = userCredential.user;
        const idToken = await fbUser.getIdToken();
        const success = await firebaseLogin({
          id_token: idToken,
          phone_number: fbUser.phoneNumber || formattedPhone,
          uid: fbUser.uid
        });
        if (success) {
          setSuccessMessage("Phone verified and logged in successfully!");
          checkAuthSession();
          return;
        }
      } catch (fbConfirmErr: any) {
        console.error("Firebase confirmation error:", fbConfirmErr);
        setLocalError(fbConfirmErr.message || "Invalid OTP code. Please check and try again.");
        setIsFirebaseLoading(false);
        return;
      } finally {
        setIsFirebaseLoading(false);
      }
    }

    // 2. Direct Register or Password Login fallback
    if (mode === 'register') {
      if (password.length < 6) {
        setLocalError("Password must be at least 6 characters long.");
        return;
      }

      const success = await registerDirectUser(formattedPhone, password, displayName);
      if (success) {
        setSuccessMessage("Account created successfully! Welcome to your 15-Day Pro Trial.");
        checkAuthSession();
      }
    } else {
      // Login mode
      if (loginMethod === 'password') {
        if (!password) {
          setLocalError("Please enter your password.");
          return;
        }
        const success = await loginUser(formattedPhone, password, undefined);
        if (success) {
          checkAuthSession();
        }
      } else {
        if (!otp) {
          setLocalError("Please enter the OTP.");
          return;
        }
        const success = await loginUser(formattedPhone, undefined, otp);
        if (success) {
          checkAuthSession();
        }
      }
    }
  };

  // Switch to auth view with specific mode
  const openAuth = (authMode: 'login' | 'register') => {
    setMode(authMode);
    setView('auth');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // RENDER LANDING PAGE VIEW
  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-darkBg text-gray-200 font-sans selection:bg-accentCyan selection:text-black">
        {/* Navigation Bar */}
        <header className="border-b border-borderClr/30 bg-gray-950/85 sticky top-0 z-40 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <img 
                src={logoImg} 
                className="w-9 h-9 rounded-lg object-cover bg-gray-900 border border-borderClr/60 shadow-lg shadow-accentBrand/10" 
                alt="OptionChief Logo" 
              />
              <div>
                <h1 className="text-sm font-extrabold text-white tracking-wider leading-none">optionchief.in</h1>
                <span className="text-[9px] text-accentCyan font-bold tracking-widest uppercase">F&O Analytics v2.0</span>
              </div>
            </div>

            {/* Menu Links */}
            <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-gray-400">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#mockup" className="hover:text-white transition-colors">Payoff Sandbox</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#faqs" className="hover:text-white transition-colors">FAQs</a>
            </nav>

            {/* CTAs */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => openAuth('login')}
                className="text-xs font-bold text-gray-400 hover:text-white transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => openAuth('register')}
                className="px-4 py-2 rounded-lg bg-accentBrand hover:bg-accentBrand/90 text-white text-xs font-extrabold shadow-md shadow-accentBrand/10 hover:shadow-accentBrand/20 transition-all flex items-center gap-1"
              >
                <span>Launch App</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accentBrand/5 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-accentCyan/5 rounded-full blur-[120px] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
            {/* Left Copy */}
            <div className="lg:col-span-6 flex flex-col items-start text-left gap-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accentCyan/10 border border-accentCyan/20 text-accentCyan text-[10px] font-extrabold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>Next-Gen Analytics For Active Option Traders</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white leading-tight uppercase tracking-tight">
                Project Payoffs.<br />
                Scan Greeks.<br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-accentCyan to-accentBrand">Execute Seamlessly.</span>
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed max-w-lg">
                Build multi-leg options strategies, track real-time simulated decay (Theta), calculate overall portfolio Greeks, and route orders directly to Dhan and Kotak Neo APIs.
              </p>

              {/* Actions */}
              <div className="flex flex-wrap gap-4 mt-2">
                <button
                  onClick={() => openAuth('register')}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-accentBrand to-accentBrand/90 hover:from-accentBrand/90 hover:to-accentBrand text-white text-xs font-black tracking-wider uppercase shadow-lg shadow-accentBrand/10 hover:shadow-accentBrand/25 transition-all flex items-center gap-1.5"
                >
                  <span>Start Free Paper Trading</span>
                  <ArrowRight className="w-4 h-4 stroke-[3px]" />
                </button>
                <a
                  href="#mockup"
                  className="px-5 py-3 rounded-xl bg-gray-950/80 hover:bg-gray-900 border border-borderClr/60 hover:border-gray-500 text-gray-300 hover:text-white text-xs font-extrabold transition-all flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>View Payoff Sandbox</span>
                </a>
              </div>

              {/* Mini Stats Banner */}
              <div className="grid grid-cols-3 gap-6 border-t border-borderClr/25 pt-6 w-full mt-4 text-xs">
                <div>
                  <strong className="text-lg font-black text-white block">60 FPS</strong>
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Sliders & pay-off curves</span>
                </div>
                <div>
                  <strong className="text-lg font-black text-greenBrand block">&lt; 1 Sec</strong>
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Multi-leg margin calculations</span>
                </div>
                <div>
                  <strong className="text-lg font-black text-accentCyan block">Live</strong>
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Background auto-scans</span>
                </div>
              </div>
            </div>

            {/* Right Side: Interactive Mockup Container */}
            <div className="lg:col-span-6" id="mockup">
              <div className="glass-panel rounded-2xl border border-borderClr/40 overflow-hidden bg-gray-950/40 p-4 shadow-2xl relative">
                {/* Simulated Header Tab bar */}
                <div className="flex items-center justify-between border-b border-borderClr/20 pb-3 mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500/80" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <span className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex gap-2 bg-gray-900/60 p-1 rounded-lg border border-borderClr/15 text-[9px] font-bold uppercase tracking-wider">
                    <span className="px-2 py-0.5 rounded text-gray-500">Option Chain</span>
                    <span className="px-2 py-0.5 rounded bg-accentCyan/10 text-accentCyan border border-accentCyan/20">Payoff Sandbox</span>
                    <span className="px-2 py-0.5 rounded text-gray-500">Scanner</span>
                  </div>
                </div>

                {/* Mock Payoff Curve Graphic */}
                <div className="h-56 bg-gray-950/60 rounded-xl relative p-4 border border-borderClr/10 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-white flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-accentCyan" />
                      NIFTY Iron CondorPayoff
                    </span>
                    <span className="text-greenBrand font-bold">Max Profit: +₹6,500</span>
                  </div>

                  {/* Draw Payoff Lines */}
                  <svg className="w-full h-32 overflow-visible" viewBox="0 0 100 50">
                    {/* Zero Line */}
                    <line x1="0" y1="35" x2="100" y2="35" stroke="#374151" strokeWidth="0.5" strokeDasharray="2 2" />
                    
                    {/* Expiry Curve (Purple) */}
                    <path d="M 0,48 Q 20,48 30,15 L 70,15 Q 80,48 100,48" fill="none" stroke="#a855f7" strokeWidth="1.5" />
                    
                    {/* T+0 Curve (Cyan) */}
                    <path d="M 0,45 Q 25,35 50,18 Q 75,35 100,45" fill="none" stroke="#06b6d4" strokeWidth="2.5" />

                    {/* Spot Marker */}
                    <line x1="50" y1="5" x2="50" y2="45" stroke="#10b981" strokeWidth="0.8" strokeDasharray="1 1" />
                    <circle cx="50" cy="18" r="2.5" fill="#10b981" />
                  </svg>

                  <div className="flex justify-between text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                    <span>19,500 Put</span>
                    <span>19,800 Spot (ATM)</span>
                    <span>20,100 Call</span>
                  </div>
                </div>

                {/* Mock Active Scanner Alert Feed Widget below chart */}
                <div className="mt-4 flex flex-col gap-2">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider text-left block">Ticking Scanner Matches:</span>
                  <div className="flex items-center justify-between bg-gray-950/70 p-2.5 rounded-xl border border-borderClr/20 text-[10px] text-left">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-white">NIFTY 23-JUN IRON CONDOR</span>
                      <span className="text-[9px] text-gray-500">Strikes: 22000P / 22200P / 22400C / 22600C</span>
                    </div>
                    <div className="text-right flex flex-col gap-0.5">
                      <span className="font-bold text-accentCyan">POP: 84%</span>
                      <span className="text-greenBrand text-[9px] font-bold">Theta: +₹320/day</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* Features Matrix Grid Section */}
        <section className="border-t border-borderClr/20 py-20 bg-gray-950/20" id="features">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col gap-12">
            
            <div className="text-center flex flex-col items-center gap-3">
              <span className="text-[10px] text-accentCyan font-black uppercase tracking-widest">Built For F&O Pros</span>
              <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
                Complete Options Suite
              </h3>
              <p className="text-xs text-gray-500 max-w-md">
                Tackle highly complex structural setups with simple visual controls and responsive analytical solvers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Feature 1 */}
              <div className="glass-panel border border-borderClr/30 rounded-2xl p-6 flex flex-col items-start text-left gap-4 bg-gray-950/20 hover:border-accentCyan transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-accentCyan/10 flex items-center justify-center text-accentCyan border border-accentCyan/20 group-hover:bg-accentCyan group-hover:text-black transition-colors">
                  <Layers className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white uppercase">60FPS Multi-Leg Sandbox</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Combine up to 6 custom option legs (Calls, Puts, Futures) and model your strategy. Adjust strikes, quantities, and implied volatility in real-time.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="glass-panel border border-borderClr/30 rounded-2xl p-6 flex flex-col items-start text-left gap-4 bg-gray-950/20 hover:border-accentCyan transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-accentCyan/10 flex items-center justify-center text-accentCyan border border-accentCyan/20 group-hover:bg-accentCyan group-hover:text-black transition-colors">
                  <Zap className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white uppercase">Real-Time Greeks Solver</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Evaluate individual and aggregated strategy Greeks. View portfolio Delta sensitivity, time-decay values (Theta), and Gamma volatility boundaries instantly.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="glass-panel border border-borderClr/30 rounded-2xl p-6 flex flex-col items-start text-left gap-4 bg-gray-950/20 hover:border-accentCyan transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-accentCyan/10 flex items-center justify-center text-accentCyan border border-accentCyan/20 group-hover:bg-accentCyan group-hover:text-black transition-colors">
                  <Search className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white uppercase">Dynamic Auto-Scanner</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Set target yield criteria, Greeks parameters, or margin caps. optionchief.in runs background checks on selected expiries, flashing desktop audio triggers on a match.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="glass-panel border border-borderClr/30 rounded-2xl p-6 flex flex-col items-start text-left gap-4 bg-gray-950/20 hover:border-accentCyan transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-accentCyan/10 flex items-center justify-center text-accentCyan border border-accentCyan/20 group-hover:bg-accentCyan group-hover:text-black transition-colors">
                  <Briefcase className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white uppercase">Paper Trading Book</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Test options theories completely risk-free. Place simulated orders on live feeds, calculate aggregate Greeks on open books, and review performance stats.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="glass-panel border border-borderClr/30 rounded-2xl p-6 flex flex-col items-start text-left gap-4 bg-gray-950/20 hover:border-accentCyan transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-accentCyan/10 flex items-center justify-center text-accentCyan border border-accentCyan/20 group-hover:bg-accentCyan group-hover:text-black transition-colors">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white uppercase">Volatility Cones</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Plot implied volatility against historical standard deviations. Spot overvalued options during earnings announcements or high-IV event cycles.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="glass-panel border border-borderClr/30 rounded-2xl p-6 flex flex-col items-start text-left gap-4 bg-gray-950/20 hover:border-accentCyan transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-accentCyan/10 flex items-center justify-center text-accentCyan border border-accentCyan/20 group-hover:bg-accentCyan group-hover:text-black transition-colors">
                  <History className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white uppercase">Historical Backtester</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Validate trading rules over years of options history. Assess how different expiration days and strike ranges perform in various market regimes.
                </p>
              </div>

            </div>

          </div>
        </section>

        {/* Pricing Plan section */}
        <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6" id="pricing">
          <div className="flex flex-col gap-12">
            
            <div className="text-center flex flex-col items-center gap-3">
              <span className="text-[10px] text-accentCyan font-black uppercase tracking-widest">Pricing & Integrations</span>
              <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
                Flexible Plans For Every Level
              </h3>
              <p className="text-xs text-gray-500 max-w-md">
                Get full analytical sandbox power free, or upgrade for automated live integrations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto w-full">
              
              {/* Plan 1 */}
              <div className="glass-panel border border-borderClr/30 rounded-2xl p-6 flex flex-col justify-between gap-6 bg-gray-950/10 text-left">
                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Free Tier</span>
                  <h4 className="text-lg font-black text-white uppercase">Paper Sandbox</h4>
                  <div className="text-2xl font-black text-white mt-1">₹0 <span className="text-xs text-gray-500 font-normal">/ forever</span></div>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                    Perfect for learning option dynamics and backtesting strategies risk-free.
                  </p>
                  
                  <ul className="space-y-2 mt-4 text-[11px] text-gray-400">
                    <li className="flex items-center gap-2">✓ Real-time Option Chain & Charts</li>
                    <li className="flex items-center gap-2">✓ Multi-leg sandbox simulations</li>
                    <li className="flex items-center gap-2">✓ Greeks calculations & IV offsets</li>
                    <li className="flex items-center gap-2">✓ Volatility cone analysis</li>
                    <li className="flex items-center gap-2">✓ Unlimited simulated paper positions</li>
                  </ul>
                </div>

                <button
                  onClick={() => openAuth('register')}
                  className="w-full py-2.5 rounded-lg bg-gray-900 border border-borderClr/60 hover:border-gray-500 text-white font-extrabold text-xs transition-all uppercase tracking-wider"
                >
                  Get Started Free
                </button>
              </div>

              {/* Plan 2 */}
              <div className="glass-panel border border-accentBrand/50 rounded-2xl p-6 flex flex-col justify-between gap-6 bg-accentBrand/5 text-left shadow-lg shadow-accentBrand/5 relative">
                <span className="absolute -top-3.5 right-6 bg-accentBrand text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-accentBrand/35 shadow-sm">
                  Recommended
                </span>

                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-bold text-accentCyan uppercase tracking-widest">Premium Tier</span>
                  <h4 className="text-lg font-black text-white uppercase">Live Execution Desk</h4>
                  <div className="text-2xl font-black text-white mt-1">₹999 <span className="text-xs text-gray-500 font-normal">/ month (or FREE via Partner Broker)</span></div>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                    For active traders requiring direct broker order executions and automated alarms.
                  </p>

                  <ul className="space-y-2 mt-4 text-[11px] text-gray-400">
                    <li className="flex items-center gap-2">✓ <strong>All Free Sandbox tools</strong></li>
                    <li className="flex items-center gap-2">✓ Direct order routing (Dhan & Kotak Neo)</li>
                    <li className="flex items-center gap-2">✓ Background scanner alerts (unlimited runs)</li>
                    <li className="flex items-center gap-2">✓ Webhook API triggers (Telegram/Discord)</li>
                    <li className="flex items-center gap-2">✓ Greeks limits alerts (Delta/Gamma/Theta)</li>
                  </ul>
                </div>

                <button
                  onClick={() => openAuth('register')}
                  className="w-full py-2.5 rounded-lg bg-accentBrand hover:bg-accentBrand/90 text-white font-black text-xs transition-all uppercase tracking-wider shadow-lg shadow-accentBrand/10"
                >
                  Upgrade to Live
                </button>
              </div>

            </div>

          </div>
        </section>

        {/* Accordion FAQs Section */}
        <section className="border-t border-borderClr/20 py-20 bg-gray-950/20" id="faqs">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-col gap-12">
            
            <div className="text-center flex flex-col items-center gap-3">
              <span className="text-[10px] text-accentCyan font-black uppercase tracking-widest">Got Questions?</span>
              <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
                Frequently Asked Questions
              </h3>
            </div>

            <div className="flex flex-col gap-4">
              {[
                {
                  q: "What is optionchief.in?",
                  a: "optionchief.in is an advanced multi-leg options analytics, scanning, and execution terminal. It allows you to visualize potential strategy payoff curves, calculate portfolio-wide Greeks (Delta, Gamma, Theta), and execute simulated or live trades instantly on ticking feeds."
                },
                {
                  q: "How does the Live Broker Integration work?",
                  a: "By upgrading to the Live Execution plan, you can securely link your Dhan or Kotak Neo accounts via their official API integrations. Alerts matched in the background scanner can be routed as basket orders directly to your broker terminal in one click."
                },
                {
                  q: "Can I use optionchief.in on mobile devices?",
                  a: "Yes. The platform is built using fully responsive CSS frameworks and designed to adapt perfectly to mobile screens, allowing you to track open positions and review alerts on the go."
                },
                {
                  q: "Is there support for commodity options (MCX)?",
                  a: "Yes. optionchief.in fully supports commodity continuous futures and options contracts for Gold, Silver, Crude Oil, and Natural Gas, automatically routing orders to commodity broker exchanges."
                }
              ].map((faq, index) => {
                const isExpanded = expandedFaq === index;
                return (
                  <div
                    key={index}
                    className="glass-panel border border-borderClr/30 rounded-xl overflow-hidden hover:border-gray-500/50 bg-gray-950/30 transition-all text-left"
                  >
                    <button
                      onClick={() => setExpandedFaq(isExpanded ? null : index)}
                      className="w-full px-5 py-4 flex items-center justify-between font-bold text-white text-xs"
                    >
                      <span>{faq.q}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-accentCyan" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-5 text-xs text-gray-400 leading-relaxed border-t border-borderClr/10 pt-3 bg-gray-950/20">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-borderClr/20 py-8 bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-gray-500">
            <div>
              © 2026 optionchief.in. A product of B.Networks F&O Hub.
            </div>
            <div className="flex gap-4">
              <a href="#features" className="hover:underline">Features</a>
              <a href="#pricing" className="hover:underline">Pricing</a>
              <a href="#faqs" className="hover:underline">FAQs</a>
              <span className="text-gray-700">|</span>
              <span className="text-gray-400 italic">Owner Admin registration active</span>
            </div>
          </div>
        </footer>

      </div>
    );
  }

  // RENDER ORIGINAL AUTH/PORTAL VIEW
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Abstract Glowing Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accentBrand/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-greenBrand/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Form container */}
      <div className="w-full max-w-md bg-cardBg/85 border border-borderClr/60 rounded-2xl p-8 backdrop-blur-md shadow-2xl relative z-10">
        
        {/* Back Link to Landing */}
        <button
          onClick={() => setView('landing')}
          className="text-gray-500 hover:text-white text-[11px] font-bold uppercase tracking-wider mb-6 flex items-center gap-1 transition-all"
        >
          <span>← Back to Homepage</span>
        </button>

        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-accentBrand/10 border border-accentBrand/20 text-accentBrand text-xs font-bold mb-4 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>optionchief.in Secure Portal</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">optionchief.in</h1>
          <p className="text-xs text-gray-400 mt-1">Real-time Options Analytics & Execution Desk</p>
        </div>

        {/* Google 1-Click Sign-In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isFirebaseLoading || isAuthLoading}
          className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-3 transition-all duration-200 shadow-md mb-6 border border-gray-300 disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span className="text-xs">{isFirebaseLoading ? "Connecting to Google..." : "Continue with Google (1-Click)"}</span>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-borderClr/30" />
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Or with Mobile Number</span>
          <div className="flex-1 h-px bg-borderClr/30" />
        </div>

        {/* Hidden reCAPTCHA container for Firebase Phone Auth */}
        <div id="recaptcha-container"></div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-gray-900/60 p-1 rounded-lg border border-borderClr/30 mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
              mode === 'login' 
                ? 'bg-accentBrand text-white shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Access Account
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
              mode === 'register' 
                ? 'bg-accentBrand text-white shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Login Method Sub-Tabs (only when in login mode) */}
        {mode === 'login' && (
          <div className="flex justify-center gap-6 mb-6 border-b border-borderClr/20 pb-3">
            <button
              onClick={() => setLoginMethod('otp')}
              className={`text-xs font-semibold pb-1 border-b-2 transition-all ${
                loginMethod === 'otp' 
                  ? 'border-accentBrand text-white' 
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              SMS OTP Login
            </button>
            <button
              onClick={() => setLoginMethod('password')}
              className={`text-xs font-semibold pb-1 border-b-2 transition-all ${
                loginMethod === 'password' 
                  ? 'border-accentBrand text-white' 
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Password Login
            </button>
          </div>
        )}

        {/* System & Local Feedback Messages */}
        {(authError || localError) && (
          <div className="mb-5 p-3 rounded-lg bg-redBrand/10 border border-redBrand/20 text-redBrand text-xs flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{localError || authError}</span>
          </div>
        )}

        {/* Success Messages */}
        {successMessage && (
          <div className="mb-5 p-3 rounded-lg bg-greenBrand/10 border border-greenBrand/20 text-greenBrand text-xs flex items-start gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Auth Forms */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Phone Number Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Phone Number</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                <Phone className="w-4 h-4" />
              </span>
              <input
                type="tel"
                placeholder="+919876543210 (include country code)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-gray-950/70 border border-borderClr hover:border-gray-700 focus:border-accentBrand rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none transition-all placeholder-gray-600"
                required
              />
            </div>
          </div>

          {/* Full Name (Only in Register mode) */}
          {mode === 'register' && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                Your Name <span className="text-gray-500 font-normal lowercase">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-gray-950/70 border border-borderClr hover:border-gray-700 focus:border-accentBrand rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none transition-all placeholder-gray-600"
                />
              </div>
            </div>
          )}

          {/* OTP fields (Only in Login via OTP mode) */}
          {mode === 'login' && loginMethod === 'otp' && (
            <div className="space-y-1.5 animate-fadeIn">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">SMS OTP Verification</label>
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={countdown > 0}
                  className={`text-xs font-semibold ${
                    countdown > 0 
                      ? 'text-gray-600 cursor-not-allowed' 
                      : 'text-accentBrand hover:text-accentBrand/80 hover:underline'
                  }`}
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : otpSent ? 'Resend OTP' : 'Send OTP'}
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full bg-gray-950/70 border border-borderClr hover:border-gray-700 focus:border-accentBrand rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none transition-all placeholder-gray-600"
                  maxLength={6}
                  required
                />
              </div>
            </div>
          )}

          {/* Password field (Register mode or Login via Password mode) */}
          {(mode === 'register' || (mode === 'login' && loginMethod === 'password')) && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                {mode === 'register' ? 'Set Login Password' : 'Login Password'}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'register' ? 'Minimum 6 characters' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-950/70 border border-borderClr hover:border-gray-700 focus:border-accentBrand rounded-lg py-2.5 pl-10 pr-10 text-sm text-white focus:outline-none transition-all placeholder-gray-600"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            type="submit"
            disabled={isAuthLoading}
            className="w-full bg-accentBrand hover:bg-accentBrand/95 text-white font-extrabold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 mt-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAuthLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {mode === 'register' 
                    ? '🚀 Create Account (Instant 15-Day Free Trial)' 
                    : 'Secure Sign In'}
                </span>
              </>
            )}
          </button>
        </form>

        {/* Security & Verification Notice */}
        <div className="mt-8 pt-6 border-t border-borderClr/20 text-center">
          <div className="p-3 bg-gray-950/50 rounded-lg border border-borderClr/20 inline-block w-full">
            <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest mb-1 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Direct Firebase SMS & Google Security
            </span>
            <p className="text-[11px] text-gray-400">
              Free 15-day Pro access with real-time OTP delivery to your mobile phone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
