import React from 'react';
import { motion } from 'motion/react';
import { Home, PlusSquare, User, Coins, ShoppingBag, Gamepad2, Gift, BarChart2, ShieldCheck, Bell } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { cn } from '../lib/utils';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenPayment?: () => void;
  unreadNotifsCount?: number;
  onOpenNotifications?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  onOpenPayment,
  unreadNotifsCount = 0,
  onOpenNotifications
}) => {
  const { profile, user } = useAuth();
  const isAdmin = user?.email === 'sanjuladubey05@gmail.com';

  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'play', label: 'Play', icon: Gamepad2 },
    { id: 'earn', label: 'Rewards', icon: Gift },
    { id: 'redeem', label: 'Redeem', icon: Coins },
    { id: 'market', label: 'Market', icon: ShoppingBag },
    { id: 'profile', label: 'Profile', icon: User },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: ShieldCheck }] : []),
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 max-w-md mx-auto relative overflow-hidden shadow-2xl">
      {/* Top Bar */}
      <header className="bg-slate-950 px-5 py-5 flex items-center justify-between text-white shadow-xl z-20 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2.5 rounded-2xl rotate-3 shadow-[0_5px_15px_rgba(16,185,129,0.4)]">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col -gap-1">
            <span className="font-black text-2xl tracking-tighter leading-none font-display">BOOST</span>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400">Creator Studio</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Notification Bell Button */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative p-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all active:scale-90"
            title="View Push Notifications"
          >
            <Bell size={18} />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-slate-950 font-black text-[9px] rounded-full flex items-center justify-center animate-pulse">
                {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
              </span>
            )}
          </button>

          {/* Coin Balance Pill with plus button */}
          <div 
            onClick={() => onOpenPayment?.()}
            role="button"
            tabIndex={0}
            className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-2xl border border-white/10 hover:border-emerald-500/50 shadow-inner group transition-all hover:bg-white/10 cursor-pointer active:scale-95 select-none"
            title="Tap to buy coins (Admin Scanner & UPI)"
          >
            <div className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-emerald-400 fill-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="font-black text-xs sm:text-sm tabular-nums text-emerald-50">
                {profile?.coins?.toLocaleString() || 0}
              </span>
            </div>
            <div className="w-px h-3 bg-white/10 mx-0.5" />
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPayment?.();
              }} 
              className="p-1 bg-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-lg text-emerald-400 transition-all active:scale-90"
              title="Buy Coins (Admin Scanner & UPI)"
            >
               <PlusSquare size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-28 pt-6 px-6 scrollbar-hide bg-slate-50">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ type: "spring", damping: 20, stiffness: 100 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-4 left-4 right-4 max-w-[calc(448px-2rem)] mx-auto glass-dark rounded-[2rem] px-2 py-2 flex justify-between items-center z-30 shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/10">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300 relative px-1",
                isActive ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all duration-300",
                isActive ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] text-white" : ""
              )}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[7px] font-black uppercase tracking-tighter",
                isActive ? "opacity-100 scale-105 h-auto" : "opacity-0 scale-75 h-0 overflow-hidden"
              )}>
                {tab.label}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute -top-1.5 w-1 h-1 bg-emerald-400 rounded-full"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
