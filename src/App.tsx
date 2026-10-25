import React, { useState } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { AppShell } from './components/AppShell';
import { Home } from './pages/Home';
import { Campaigns } from './pages/Campaigns';
import { Earn } from './pages/Earn';
import { Profile } from './pages/Profile';
import { Store } from './pages/Store';
import { Redeem } from './pages/Redeem';
import { Marketplace } from './pages/Marketplace';
import { signInWithPopup, googleProvider, auth } from './lib/firebase';
import { Coins, LogIn, Loader2, Youtube, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { PaymentModal } from './components/PaymentModal';

import { AdminPanel } from './components/AdminPanel';

// ... (LoginScreen component remains similar but let's update it for a more premium look)
const LoginScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // We could store the referralCode in sessionStorage here and process it in AuthProvider or a separate hook
      if (referralCode) {
        sessionStorage.setItem('pendingReferral', referralCode);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-8 max-w-md mx-auto relative overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-[120px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full flex flex-col items-center"
      >
        <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-[2.5rem] flex items-center justify-center shadow-[0_20px_50px_rgba(16,185,129,0.3)] rotate-6 mb-8 border-4 border-white/10">
          <Youtube size={44} className="text-white drop-shadow-lg" />
        </div>
        
        <div className="text-center space-y-3 mb-12">
          <h1 className="text-6xl font-black text-white tracking-tighter italic font-display">
            VIEW<span className="text-emerald-400">BOOST</span>
          </h1>
          <p className="text-slate-400 font-medium text-sm tracking-tight px-12 leading-relaxed">
            The elite ecosystem for creators. Boost your growth with AI-powered engagement.
          </p>
        </div>

        <div className="w-full space-y-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Referral Code (Optional)" 
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              className="w-full bg-slate-900 border-2 border-slate-800 text-white px-6 py-4 rounded-3xl text-sm font-bold focus:border-emerald-500 outline-none transition-colors placeholder:text-slate-600"
            />
          </div>

          <button 
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-emerald-500 text-white flex items-center justify-center gap-4 py-6 rounded-[2rem] font-black text-xl shadow-[0_15px_40px_rgba(16,185,129,0.2)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 border-b-4 border-emerald-700"
          >
            {loading ? <Loader2 className="animate-spin" /> : (
              <>
                 <LogIn size={24} />
                 <span>Get Started</span>
              </>
            )}
          </button>
          
          <div className="flex items-center justify-center gap-8 opacity-40">
             <div className="flex items-center gap-2 text-white">
               <ShieldCheck size={18} />
               <span className="text-[10px] font-bold uppercase tracking-widest">Secure</span>
             </div>
             <div className="flex items-center gap-2 text-white">
               <Coins size={18} />
               <span className="text-[10px] font-bold uppercase tracking-widest">Global</span>
             </div>
          </div>
        </div>

        <p className="mt-12 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-center">
          Trusted by 50k+ creators worldwide
        </p>
      </motion.div>
    </div>
  );
};

import { NotificationModal } from './components/NotificationModal';
import { useNotifications, requestPushPermission } from './lib/notifications';

const MainApp: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [isGlobalPaymentOpen, setIsGlobalPaymentOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(user?.uid);

  // Initialize push notifications / FCM device token for authenticated user
  React.useEffect(() => {
    if (user?.uid) {
      requestPushPermission(user.uid);
    }
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white gap-4">
        <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="w-full h-full bg-slate-900" 
          />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <Home />;
      case 'play': return <Earn mode="play" />;
      case 'earn': return <Earn mode="rewards" />;
      case 'redeem': return <Redeem onOpenPayment={() => setIsGlobalPaymentOpen(true)} onNavigateTab={setActiveTab} />;
      case 'market': return <Marketplace />;
      case 'profile': return <Profile onNavigateTab={setActiveTab} />;
      case 'admin': return <AdminPanel />;
      default: return <Home />;
    }
  };

  return (
    <>
      <AppShell 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onOpenPayment={() => setIsGlobalPaymentOpen(true)}
        unreadNotifsCount={unreadCount}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
      >
        {renderContent()}
      </AppShell>
      <PaymentModal
        isOpen={isGlobalPaymentOpen}
        onClose={() => setIsGlobalPaymentOpen(false)}
        initialPackId="pro"
      />
      <NotificationModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      />
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
