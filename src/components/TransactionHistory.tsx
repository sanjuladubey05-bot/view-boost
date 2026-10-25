import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  ArrowLeft, 
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Gift, 
  Sparkles, 
  PlayCircle, 
  Gamepad2, 
  ClipboardList, 
  Lightbulb, 
  Ticket, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  Calendar, 
  ShoppingBag, 
  CreditCard,
  Loader2,
  RefreshCw,
  Clock,
  Smartphone,
  RotateCcw
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Transaction } from '../types';
import { cn } from '../lib/utils';

interface TransactionHistoryProps {
  onBack: () => void;
  onNavigateEarn?: () => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ onBack, onNavigateEarn }) => {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'earn' | 'redeem' | 'bonus'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const txRef = collection(db, 'users', user.uid, 'transactions');
    const q = query(txRef, orderBy('createdAt', 'desc'), limit(100));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const txList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Transaction));
        setTransactions(txList);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore Transaction Error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  // Helper to categorize transaction
  const getCategoryMeta = (tx: Transaction) => {
    const desc = (tx.description || '').toLowerCase();
    const type = (tx.type || '').toLowerCase();

    if (type === 'refund' || desc.includes('refund')) {
      return {
        label: 'Coins Refunded',
        icon: RotateCcw,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        iconBg: 'bg-emerald-100 text-emerald-700',
        isRedeem: false,
      };
    }

    if (desc.includes('upi') || (tx as any).method === 'upi' || (tx as any).upiId) {
      return {
        label: 'UPI Transfer',
        icon: Smartphone,
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
        iconBg: 'bg-purple-100 text-purple-700',
        isRedeem: true,
      };
    }
    if (tx.redeemCode || desc.includes('play') || desc.includes('code') || desc.includes('redeem') || type === 'spend') {
      return {
        label: 'Redeem Code',
        icon: Ticket,
        badgeClass: 'bg-rose-50 text-rose-600 border-rose-200',
        iconBg: 'bg-rose-100 text-rose-600',
        isRedeem: true,
      };
    }
    if (desc.includes('daily') || type === 'bonus') {
      return {
        label: 'Daily Reward',
        icon: Gift,
        badgeClass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        iconBg: 'bg-emerald-100 text-emerald-600',
        isRedeem: false,
      };
    }
    if (desc.includes('quiz') || desc.includes('answer')) {
      return {
        label: 'Answer & Earn',
        icon: Lightbulb,
        badgeClass: 'bg-blue-50 text-blue-600 border-blue-200',
        iconBg: 'bg-blue-100 text-blue-600',
        isRedeem: false,
      };
    }
    if (desc.includes('spin') || desc.includes('lucky')) {
      return {
        label: 'Lucky Spin',
        icon: Sparkles,
        badgeClass: 'bg-purple-50 text-purple-600 border-purple-200',
        iconBg: 'bg-purple-100 text-purple-600',
        isRedeem: false,
      };
    }
    if (desc.includes('video') || desc.includes('ad') || desc.includes('watch')) {
      return {
        label: 'Watch Video',
        icon: PlayCircle,
        badgeClass: 'bg-amber-50 text-amber-600 border-amber-200',
        iconBg: 'bg-amber-100 text-amber-600',
        isRedeem: false,
      };
    }
    if (desc.includes('app') || desc.includes('install')) {
      return {
        label: 'App Task',
        icon: Gamepad2,
        badgeClass: 'bg-indigo-50 text-indigo-600 border-indigo-200',
        iconBg: 'bg-indigo-100 text-indigo-600',
        isRedeem: false,
      };
    }
    if (desc.includes('survey')) {
      return {
        label: 'Survey',
        icon: ClipboardList,
        badgeClass: 'bg-teal-50 text-teal-600 border-teal-200',
        iconBg: 'bg-teal-100 text-teal-600',
        isRedeem: false,
      };
    }

    return {
      label: tx.amount > 0 ? 'Coin Earned' : 'Coin Spent',
      icon: tx.amount > 0 ? ArrowUpRight : ArrowDownLeft,
      badgeClass: tx.amount > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200',
      iconBg: tx.amount > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600',
      isRedeem: false,
    };
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return { date: 'Recently', time: '', relative: '' };
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { date: dateStr, time: '', relative: '' };

      const date = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const time = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      // Relative calculation
      const now = new Date().getTime();
      const diffMs = now - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let relative = '';
      if (diffMins < 1) relative = 'Just now';
      else if (diffMins < 60) relative = `${diffMins}m ago`;
      else if (diffHours < 24) relative = `${diffHours}h ago`;
      else if (diffDays === 1) relative = 'Yesterday';
      else if (diffDays < 7) relative = `${diffDays}d ago`;

      return { date, time, relative };
    } catch {
      return { date: dateStr, time: '', relative: '' };
    }
  };

  // Calculations
  const stats = useMemo(() => {
    let totalEarned = 0;
    let totalRedeemed = 0;
    let redeemCodeCount = 0;

    transactions.forEach((tx) => {
      if (tx.amount > 0) {
        totalEarned += tx.amount;
      } else {
        totalRedeemed += Math.abs(tx.amount);
      }
      if (tx.redeemCode || (tx.description && tx.description.toLowerCase().includes('redeem'))) {
        redeemCodeCount += 1;
      }
    });

    return {
      totalEarned,
      totalRedeemed,
      redeemCodeCount,
      totalCount: transactions.length
    };
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Type filtering
      if (filterType === 'earn' && tx.amount <= 0) return false;
      if (filterType === 'redeem' && tx.amount >= 0 && !tx.redeemCode) return false;
      if (filterType === 'bonus' && !((tx.type || '').includes('bonus') || (tx.description || '').toLowerCase().includes('bonus') || (tx.description || '').toLowerCase().includes('daily'))) return false;

      // Query filtering
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const descMatch = (tx.description || '').toLowerCase().includes(query);
        const codeMatch = (tx.redeemCode || '').toLowerCase().includes(query);
        const amountMatch = String(Math.abs(tx.amount)).includes(query);
        return descMatch || codeMatch || amountMatch;
      }

      return true;
    });
  }, [transactions, filterType, searchQuery]);

  return (
    <div className="space-y-6 pb-20">
      {/* Top Navigation & Header */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-slate-200 text-slate-700 font-black text-xs shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-100">
          <Coins size={14} className="text-emerald-600 fill-emerald-600" />
          <span className="text-xs font-black text-emerald-800 tabular-nums">
            {profile?.coins?.toLocaleString() || 0} Coins
          </span>
        </div>
      </div>

      {/* Main Banner */}
      <div className="bg-slate-900 rounded-[2.5rem] p-7 text-white shadow-2xl relative overflow-hidden border border-white/5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[90px]" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[90px]" />
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10 text-emerald-400">
              <History size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black italic tracking-tight">TRANSACTION HISTORY</h2>
              <p className="text-slate-400 text-xs font-bold">Track all your earnings & redeem codes</p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2.5 pt-2">
            <div className="bg-white/5 rounded-2xl p-3 border border-white/10 text-center">
              <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400 block mb-0.5">
                Total Earned
              </span>
              <span className="font-black text-sm text-white tabular-nums">
                +{stats.totalEarned.toLocaleString()}
              </span>
            </div>

            <div className="bg-white/5 rounded-2xl p-3 border border-white/10 text-center">
              <span className="text-[8px] font-black uppercase tracking-widest text-rose-400 block mb-0.5">
                Redeemed
              </span>
              <span className="font-black text-sm text-white tabular-nums">
                -{stats.totalRedeemed.toLocaleString()}
              </span>
            </div>

            <div className="bg-white/5 rounded-2xl p-3 border border-white/10 text-center">
              <span className="text-[8px] font-black uppercase tracking-widest text-blue-400 block mb-0.5">
                Activities
              </span>
              <span className="font-black text-sm text-white tabular-nums">
                {stats.totalCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="space-y-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setFilterType('all')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all border flex items-center gap-1.5",
              filterType === 'all'
                ? "bg-slate-900 border-slate-900 text-white shadow-md"
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
            )}
          >
            <span>All</span>
            <span className={cn(
              "text-[9px] px-1.5 py-0.2 rounded-full font-bold",
              filterType === 'all' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            )}>
              {transactions.length}
            </span>
          </button>

          <button
            onClick={() => setFilterType('earn')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all border flex items-center gap-1.5",
              filterType === 'earn'
                ? "bg-emerald-600 border-emerald-600 text-white shadow-md"
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
            )}
          >
            <ArrowUpRight size={14} />
            <span>Earnings</span>
          </button>

          <button
            onClick={() => setFilterType('redeem')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all border flex items-center gap-1.5",
              filterType === 'redeem'
                ? "bg-rose-600 border-rose-600 text-white shadow-md"
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
            )}
          >
            <Ticket size={14} />
            <span>Redeem Codes</span>
            {stats.redeemCodeCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-white/20 text-white">
                {stats.redeemCodeCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilterType('bonus')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all border flex items-center gap-1.5",
              filterType === 'bonus'
                ? "bg-purple-600 border-purple-600 text-white shadow-md"
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
            )}
          >
            <Gift size={14} />
            <span>Daily & Bonuses</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activities or redeem codes..."
            className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-emerald-500 animate-spin" />
            <p className="text-xs font-bold text-slate-400">Loading your transaction history...</p>
          </div>
        ) : filteredTransactions.length > 0 ? (
          filteredTransactions.map((tx) => {
            const meta = getCategoryMeta(tx);
            const { date, time, relative } = formatTimestamp(tx.createdAt);
            const isPositive = tx.amount > 0;
            const Icon = meta.icon;

            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "bg-white rounded-3xl p-5 border shadow-sm transition-all relative overflow-hidden",
                  meta.isRedeem ? "border-rose-100 hover:border-rose-300" : "border-slate-100 hover:border-slate-200"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner", meta.iconBg)}>
                      <Icon size={22} />
                    </div>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border tracking-wide",
                          meta.badgeClass
                        )}>
                          {meta.label}
                        </span>

                        {tx.status && (
                          <span className={cn(
                            "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                            tx.status === 'completed' || tx.status === 'fulfilled'
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-amber-50 text-amber-700"
                          )}>
                            {tx.status}
                          </span>
                        )}
                      </div>

                      <h4 className="font-black text-slate-800 text-sm leading-snug break-words">
                        {tx.description || (isPositive ? 'Coins Earned' : 'Coins Redeemed')}
                      </h4>

                      {/* Timestamps */}
                      <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold flex-wrap pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} className="text-slate-400" />
                          <span>{date}</span>
                        </span>
                        {time && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock size={11} className="text-slate-400" />
                              <span>{time}</span>
                            </span>
                          </>
                        )}
                        {relative && (
                          <span className="text-slate-400 bg-slate-50 px-1.5 py-0.2 rounded-md font-black text-[9px]">
                            {relative}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Coin Amount Badge */}
                  <div className="text-right shrink-0">
                    <div className={cn(
                      "flex items-center gap-1 font-black text-base tabular-nums",
                      isPositive ? "text-emerald-600" : "text-rose-600"
                    )}>
                      <span>{isPositive ? '+' : ''}{tx.amount.toLocaleString()}</span>
                      <Coins size={14} className={isPositive ? "fill-emerald-600" : "fill-rose-600"} />
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                      {isPositive ? 'Earned' : 'Spent'}
                    </span>
                  </div>
                </div>

                {/* Redeem Code Box if Present */}
                {tx.redeemCode && (
                  <div className="mt-4 pt-3 border-t border-dashed border-slate-100">
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">
                          Play Store Redeem Code
                        </span>
                        <div className="font-mono font-black text-slate-900 text-xs sm:text-sm tracking-wider select-all truncate">
                          {tx.redeemCode}
                        </div>
                      </div>

                      <button
                        onClick={() => handleCopyCode(tx.redeemCode!)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm shrink-0",
                          copiedCode === tx.redeemCode
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-900 text-white hover:bg-slate-800 active:scale-95"
                        )}
                      >
                        {copiedCode === tx.redeemCode ? (
                          <>
                            <Check size={13} />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* UPI Payout Details Box if Present */}
                {((tx as any).upiId || (tx as any).utrNumber) && (
                  <div className="mt-4 pt-3 border-t border-dashed border-slate-100">
                    <div className="bg-purple-50/70 rounded-2xl p-3 border border-purple-200/80 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[8px] font-black uppercase tracking-widest text-purple-700 block mb-0.5">
                          UPI Payout Info
                        </span>
                        <div className="font-bold text-slate-800 text-xs truncate">
                          {(tx as any).upiId ? `ID: ${(tx as any).upiId}` : ''}
                          {(tx as any).utrNumber ? ` • ${(tx as any).utrNumber}` : ''}
                        </div>
                      </div>

                      {(tx as any).utrNumber && (
                        <button
                          onClick={() => handleCopyCode((tx as any).utrNumber)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm shrink-0",
                            copiedCode === (tx as any).utrNumber
                              ? "bg-purple-700 text-white"
                              : "bg-purple-600 text-white hover:bg-purple-700 active:scale-95"
                          )}
                        >
                          {copiedCode === (tx as any).utrNumber ? (
                            <>
                              <Check size={12} />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>UTR</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })
        ) : (
          /* Empty State */
          <div className="bg-white rounded-3xl p-10 text-center border-2 border-dashed border-slate-200/80 space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto text-slate-400 shadow-inner">
              <History size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="font-black text-slate-800 text-base">No Transactions Found</h3>
              <p className="text-xs font-bold text-slate-400 max-w-xs mx-auto">
                {searchQuery
                  ? "No transactions match your search query."
                  : filterType === 'redeem'
                  ? "You haven't purchased or redeemed any codes yet."
                  : "Start playing games, taking surveys, or claiming daily bonuses to build your coin balance!"}
              </p>
            </div>

            {onNavigateEarn && (
              <button
                onClick={onNavigateEarn}
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all"
              >
                <Sparkles size={14} />
                <span>Earn Coins Now</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="text-center opacity-40 pt-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
          Real-time activity ledger • ViewBoost
        </p>
      </div>
    </div>
  );
};
