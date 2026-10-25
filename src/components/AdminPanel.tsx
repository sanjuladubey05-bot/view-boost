import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Clock, 
  Smartphone, Ticket, Copy, Check, Search, RotateCcw, 
  DollarSign, Coins, ExternalLink, RefreshCw, Filter, ArrowUpRight,
  Diamond, QrCode, User, Table, LayoutGrid, Eye, CreditCard, Send,
  ArrowDownLeft, HelpCircle
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, query, orderBy, onSnapshot, doc, updateDoc, 
  increment, addDoc, runTransaction, setDoc 
} from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { RedemptionRecord, CoinPurchase } from '../types';
import { sendAppNotification } from '../lib/notifications';
import { cn } from '../lib/utils';

export const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  
  // Section Navigation: 'purchases' | 'cashouts'
  const [activeSection, setActiveSection] = useState<'purchases' | 'cashouts'>('cashouts');

  // Coin Purchases State
  const [purchases, setPurchases] = useState<CoinPurchase[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState(true);
  const [purchaseFilter, setPurchaseFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [purchaseApproving, setPurchaseApproving] = useState<string | null>(null);
  const [selectedPurchaseReject, setSelectedPurchaseReject] = useState<CoinPurchase | null>(null);
  const [purchaseRejectReason, setPurchaseRejectReason] = useState('Payment UTR not found in bank statement');

  // Cashout Requests State
  const [cashouts, setCashouts] = useState<RedemptionRecord[]>([]);
  const [cashoutLoading, setCashoutLoading] = useState(true);
  const [cashoutFilter, setCashoutFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('pending');
  const [cashoutMethodFilter, setCashoutMethodFilter] = useState<'all' | 'upi' | 'play_code'>('all');
  const [cashoutViewMode, setCashoutViewMode] = useState<'table' | 'cards'>('table');
  const [selectedCashoutReject, setSelectedCashoutReject] = useState<RedemptionRecord | null>(null);
  const [selectedCashoutApprove, setSelectedCashoutApprove] = useState<RedemptionRecord | null>(null);
  const [selectedCashoutDetails, setSelectedCashoutDetails] = useState<RedemptionRecord | null>(null);
  const [payoutUtrInput, setPayoutUtrInput] = useState<string>('');
  const [cashoutRejectReason, setCashoutRejectReason] = useState('Invalid UPI ID or beneficiary bank failed to accept payment');
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  const [cashoutApproving, setCashoutApproving] = useState<string | null>(null);

  // Common UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 1. Subscribe to Coin Purchases
  useEffect(() => {
    const q = query(collection(db, 'coin_purchases'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CoinPurchase[];
      setPurchases(items);
      setPurchaseLoading(false);
    }, (err) => {
      console.error("Failed to load coin purchases for admin:", err);
      setPurchaseLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Subscribe to Cashouts (Redemptions)
  useEffect(() => {
    const q = query(collection(db, 'redemptions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RedemptionRecord[];
      setCashouts(items);
      setCashoutLoading(false);
    }, (err) => {
      console.error("Failed to load redemptions for admin:", err);
      setCashoutLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- COIN PURCHASE ACTIONS ---
  const handleApprovePurchase = async (item: CoinPurchase) => {
    setPurchaseApproving(item.id);

    try {
      // 1. Mark purchase as approved
      await updateDoc(doc(db, 'coin_purchases', item.id), {
        status: 'approved',
        approvedAt: new Date().toISOString()
      });

      // 2. Credit coins to user account atomically
      await updateDoc(doc(db, 'users', item.userId), {
        coins: increment(item.coins)
      });

      // 3. Add ledger transaction
      await addDoc(collection(db, 'users', item.userId, 'transactions'), {
        userId: item.userId,
        amount: item.coins,
        type: 'purchase',
        description: `Admin Verified: ${item.packName} (₹${item.priceInr}) - UTR: ${item.utrNumber}`,
        status: 'completed',
        priceInr: item.priceInr,
        utrNumber: item.utrNumber,
        createdAt: new Date().toISOString()
      });

      // 4. Update leaderboard
      await setDoc(doc(db, 'leaderboard', item.userId), {
        uid: item.userId,
        displayName: item.userEmail ? item.userEmail.split('@')[0] : 'User',
        coins: increment(item.coins),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Send push notification
      await sendAppNotification({
        userId: item.userId,
        title: '🎉 Coin Purchase Approved!',
        body: `Deposit verified! ${item.coins.toLocaleString()} tokens for ${item.packName} have been added to your balance.`,
        type: 'purchase_status',
        referenceId: item.id
      });

      showNotification(`Approved! ${item.coins.toLocaleString()} coins credited to ${item.userEmail}.`);
    } catch (err: any) {
      console.error("Purchase approval failed:", err);
      showNotification(err.message || "Failed to approve purchase", 'error');
    } finally {
      setPurchaseApproving(null);
    }
  };

  const handleConfirmRejectPurchase = async () => {
    if (!selectedPurchaseReject) return;
    const item = selectedPurchaseReject;

    try {
      await updateDoc(doc(db, 'coin_purchases', item.id), {
        status: 'rejected',
        rejectionReason: purchaseRejectReason.trim() || 'Payment not verified by admin',
        rejectedAt: new Date().toISOString()
      });

      // Send push notification
      await sendAppNotification({
        userId: item.userId,
        title: '⚠️ Coin Deposit Rejected',
        body: `Your purchase request of ₹${item.priceInr} (UTR: ${item.utrNumber}) was rejected: ${purchaseRejectReason}`,
        type: 'purchase_status',
        referenceId: item.id
      });

      showNotification(`Purchase request from ${item.userEmail} marked as rejected.`);
      setSelectedPurchaseReject(null);
    } catch (err: any) {
      console.error("Purchase reject failed:", err);
      showNotification(err.message || "Failed to reject purchase", 'error');
    }
  };

  // --- CASHOUT ACTIONS ---
  const handleOpenApproveModal = (item: RedemptionRecord) => {
    setSelectedCashoutApprove(item);
    setPayoutUtrInput(item.utrNumber || `BANK${Math.floor(100000000000 + Math.random() * 900000000000)}`);
  };

  const handleConfirmApproveCashout = async () => {
    if (!selectedCashoutApprove) return;
    const item = selectedCashoutApprove;
    setCashoutApproving(item.id);

    try {
      const finalPayoutRef = payoutUtrInput.trim() || item.utrNumber || `PAYOUT${Date.now()}`;

      await updateDoc(doc(db, 'redemptions', item.id), {
        status: 'completed',
        approvedAt: new Date().toISOString(),
        payoutUtr: finalPayoutRef
      });

      // Send real-time push notification
      await sendAppNotification({
        userId: item.userId,
        title: '💰 Cashout Sent & Paid!',
        body: `Your cashout of ₹${item.amountInr} has been transferred to ${item.method === 'upi' ? item.upiId : 'Play Code'}. Payout Ref: ${finalPayoutRef}`,
        type: 'cashout_status',
        referenceId: item.id
      });

      showNotification(`Cashout of ₹${item.amountInr} marked as Paid & Completed! Ref: ${finalPayoutRef}`);
      setSelectedCashoutApprove(null);
    } catch (err: any) {
      console.error("Cashout approval error:", err);
      showNotification(err.message || "Failed to mark as approved", 'error');
    } finally {
      setCashoutApproving(null);
    }
  };

  // Reject Cashout with Real-Time Atomic Coin Refund
  const handleConfirmRejectCashout = async () => {
    if (!selectedCashoutReject) return;
    setIsRefunding(true);

    const item = selectedCashoutReject;
    const coinsToRefund = item.amount;
    const finalReason = cashoutRejectReason === 'custom' 
      ? (customRejectReason.trim() || 'Payment rejected by administrator')
      : cashoutRejectReason.trim();

    try {
      // 1. Update redemption record to rejected
      await updateDoc(doc(db, 'redemptions', item.id), {
        status: 'rejected',
        rejectionReason: finalReason,
        rejectedAt: new Date().toISOString(),
        refundedCoins: coinsToRefund
      });

      // 2. Real-time refund of coins back to user wallet
      await updateDoc(doc(db, 'users', item.userId), {
        coins: increment(coinsToRefund)
      });

      // 3. Update leaderboard so user coins reflect immediately
      await setDoc(doc(db, 'leaderboard', item.userId), {
        uid: item.userId,
        displayName: item.userEmail ? item.userEmail.split('@')[0] : 'User',
        coins: increment(coinsToRefund),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 4. Add refund entry into user's transaction ledger
      await addDoc(collection(db, 'users', item.userId, 'transactions'), {
        userId: item.userId,
        amount: coinsToRefund,
        type: 'refund',
        description: `Cashout Refund: ${item.method === 'upi' ? 'UPI Cashout' : 'Play Code'} rejected (₹${item.amountInr}). Reason: ${finalReason}`,
        method: item.method,
        upiId: item.upiId || '',
        amountInr: item.amountInr,
        utrNumber: item.utrNumber || '',
        status: 'completed',
        createdAt: new Date().toISOString()
      });

      // 5. Send real-time push notification
      await sendAppNotification({
        userId: item.userId,
        title: '❌ Cashout Cancelled & Coins Refunded',
        body: `Your cashout of ₹${item.amountInr} was cancelled: ${finalReason}. ${coinsToRefund.toLocaleString()} coins were refunded to your account balance.`,
        type: 'cashout_status',
        referenceId: item.id
      });

      showNotification(`Rejected! ₹${item.amountInr} cashout cancelled and ${coinsToRefund.toLocaleString()} coins refunded to ${item.userEmail}.`);
      setSelectedCashoutReject(null);
      setCustomRejectReason('');
    } catch (err: any) {
      console.error("Rejection refund error:", err);
      showNotification(err.message || "Failed to refund coins. Please try again.", 'error');
    } finally {
      setIsRefunding(false);
    }
  };

  // Filtered Lists
  const filteredPurchases = purchases.filter(p => {
    if (purchaseFilter !== 'all' && p.status !== purchaseFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.userEmail?.toLowerCase().includes(q) ||
        p.utrNumber?.toLowerCase().includes(q) ||
        p.packName?.toLowerCase().includes(q) ||
        p.userId?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredCashouts = cashouts.filter(r => {
    if (cashoutFilter !== 'all' && r.status !== cashoutFilter) return false;
    if (cashoutMethodFilter !== 'all' && r.method !== cashoutMethodFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.userEmail?.toLowerCase().includes(q) ||
        r.upiId?.toLowerCase().includes(q) ||
        r.userId?.toLowerCase().includes(q) ||
        r.utrNumber?.toLowerCase().includes(q) ||
        String(r.amountInr).includes(q)
      );
    }
    return true;
  });

  // KPI Calculations
  const pendingPurchasesCount = purchases.filter(p => p.status === 'pending').length;
  const pendingCashoutsCount = cashouts.filter(r => r.status === 'pending').length;
  const completedCashoutsCount = cashouts.filter(r => r.status === 'completed').length;
  const rejectedCashoutsCount = cashouts.filter(r => r.status === 'rejected').length;

  const totalPendingAmount = cashouts
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + (c.amountInr || 0), 0);

  const totalPaidAmount = cashouts
    .filter(c => c.status === 'completed')
    .reduce((sum, c) => sum + (c.amountInr || 0), 0);

  const totalRefundedCoins = cashouts
    .filter(c => c.status === 'rejected')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  return (
    <div className="space-y-6 pb-28 text-slate-900">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-[2.5rem] p-6 text-white shadow-2xl relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-[90px]" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight font-display">Super Admin Center</h1>
                <p className="text-[11px] font-semibold text-slate-400">Admin: sanjuladubey05@gmail.com</p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Live Gateway Hub
            </span>
          </div>

          {/* Master Tabs: Cashout Hub vs Coin Deposits */}
          <div className="grid grid-cols-2 gap-2 bg-white/10 p-1.5 rounded-2xl border border-white/10">
            <button
              onClick={() => {
                setActiveSection('cashouts');
                setSearchQuery('');
              }}
              className={cn(
                "py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
                activeSection === 'cashouts'
                  ? "bg-emerald-500 text-slate-950 shadow-md"
                  : "text-slate-300 hover:text-white"
              )}
            >
              <DollarSign size={16} />
              <span>Cashout Hub</span>
              {pendingCashoutsCount > 0 && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-black",
                  activeSection === 'cashouts' ? "bg-slate-950 text-white" : "bg-amber-400 text-slate-950"
                )}>
                  {pendingCashoutsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveSection('purchases');
                setSearchQuery('');
              }}
              className={cn(
                "py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
                activeSection === 'purchases'
                  ? "bg-emerald-500 text-slate-950 shadow-md"
                  : "text-slate-300 hover:text-white"
              )}
            >
              <QrCode size={16} />
              <span>Coin Deposits</span>
              {pendingPurchasesCount > 0 && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-black",
                  activeSection === 'purchases' ? "bg-slate-950 text-white" : "bg-emerald-500 text-slate-950"
                )}>
                  {pendingPurchasesCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "p-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-lg border",
              notification.type === 'success'
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-rose-50 text-rose-900 border-rose-200"
            )}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            )}
            <p className="flex-1">{notification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* SECTION 1: CASHOUT HUB (DETAILED TABLE & ACTIONS)        */}
      {/* ======================================================== */}
      {activeSection === 'cashouts' && (
        <div className="space-y-4">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white rounded-2xl p-3 border border-amber-200/80 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center gap-1.5 text-amber-700 text-[10px] font-black uppercase tracking-wider mb-1">
                <Clock size={12} />
                <span>Pending</span>
              </div>
              <div className="text-lg font-black text-slate-900">
                ₹{totalPendingAmount.toLocaleString()}
              </div>
              <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                {pendingCashoutsCount} requests
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3 border border-emerald-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-400/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center gap-1.5 text-emerald-700 text-[10px] font-black uppercase tracking-wider mb-1">
                <CheckCircle2 size={12} />
                <span>Paid Out</span>
              </div>
              <div className="text-lg font-black text-slate-900">
                ₹{totalPaidAmount.toLocaleString()}
              </div>
              <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                {completedCashoutsCount} fulfilled
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3 border border-rose-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-rose-400/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center gap-1.5 text-rose-700 text-[10px] font-black uppercase tracking-wider mb-1">
                <RotateCcw size={12} />
                <span>Refunded</span>
              </div>
              <div className="text-lg font-black text-slate-900 truncate" title={`${totalRefundedCoins.toLocaleString()} coins`}>
                {totalRefundedCoins.toLocaleString()}
              </div>
              <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                {rejectedCashoutsCount} returned
              </div>
            </div>
          </div>

          {/* Controls: Search, Status Tabs, Method Filter, View Toggle */}
          <div className="space-y-2.5">
            {/* Search Bar */}
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by user email, UPI ID, or UTR..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-emerald-500 shadow-sm"
              />
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Status Sub-Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto scrollbar-hide text-[11px]">
                {(['pending', 'all', 'completed', 'rejected'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCashoutFilter(tab)}
                    className={cn(
                      "px-3 py-1.5 font-black uppercase tracking-wider rounded-xl transition-all capitalize whitespace-nowrap",
                      cashoutFilter === tab 
                        ? "bg-white text-slate-950 shadow-sm" 
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    {tab} {tab === 'pending' && pendingCashoutsCount > 0 && `(${pendingCashoutsCount})`}
                  </button>
                ))}
              </div>

              {/* Method Filter & View Switcher */}
              <div className="flex items-center gap-1.5 ml-auto">
                <select
                  value={cashoutMethodFilter}
                  onChange={(e) => setCashoutMethodFilter(e.target.value as any)}
                  className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Methods</option>
                  <option value="upi">UPI Only</option>
                  <option value="play_code">Play Code</option>
                </select>

                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setCashoutViewMode('table')}
                    className={cn(
                      "p-1.5 rounded-lg text-xs transition-all",
                      cashoutViewMode === 'table' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-700"
                    )}
                    title="Detailed Table View"
                  >
                    <Table size={14} />
                  </button>
                  <button
                    onClick={() => setCashoutViewMode('cards')}
                    className={cn(
                      "p-1.5 rounded-lg text-xs transition-all",
                      cashoutViewMode === 'cards' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-700"
                    )}
                    title="Compact Cards View"
                  >
                    <LayoutGrid size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* MAIN CASHOUT DISPLAY: TABLE OR CARDS */}
          {cashoutLoading ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-slate-100">
              <RefreshCw size={24} className="animate-spin mx-auto text-emerald-500 mb-2" />
              <p className="text-xs font-bold text-slate-500">Loading cashout database records...</p>
            </div>
          ) : filteredCashouts.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-slate-100 p-6 space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-slate-300" />
              <p className="text-sm font-black text-slate-700">No {cashoutFilter} cashout requests found</p>
              <p className="text-xs text-slate-400">All withdrawal requests in this category are fully processed.</p>
            </div>
          ) : cashoutViewMode === 'table' ? (
            /* ======================================================== */
            /* DETAILED DATA TABLE                                      */
            /* ======================================================== */
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black uppercase text-[9px] tracking-wider border-b border-slate-800">
                      <th className="py-3 px-3.5 whitespace-nowrap">Beneficiary User</th>
                      <th className="py-3 px-3 whitespace-nowrap">Method</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">UPI ID / Payment Info</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Amount</th>
                      <th className="py-3 px-3 whitespace-nowrap">Reference / UTR</th>
                      <th className="py-3 px-3 whitespace-nowrap">Status</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCashouts.map((item) => {
                      const isPending = item.status === 'pending';
                      const isCompleted = item.status === 'completed';
                      const isRejected = item.status === 'rejected';

                      return (
                        <tr 
                          key={item.id}
                          className={cn(
                            "transition-colors hover:bg-slate-50/80 group",
                            isPending && "bg-amber-50/15"
                          )}
                        >
                          {/* 1. Beneficiary User */}
                          <td className="py-3 px-3.5 align-middle">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-700 text-[10px] shrink-0">
                                {item.userEmail ? item.userEmail.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div className="min-w-0 max-w-[140px]">
                                <p className="font-bold text-slate-900 truncate text-[11px]" title={item.userEmail}>
                                  {item.userEmail || `User: ${item.userId.substring(0, 8)}`}
                                </p>
                                <p className="text-[9px] text-slate-400 font-mono">
                                  {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* 2. Chosen Method */}
                          <td className="py-3 px-3 align-middle whitespace-nowrap">
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                              item.method === 'upi'
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-purple-50 text-purple-700 border-purple-200"
                            )}>
                              {item.method === 'upi' ? <Smartphone size={10} /> : <Ticket size={10} />}
                              <span>{item.method === 'upi' ? 'UPI' : 'Play Code'}</span>
                            </span>
                          </td>

                          {/* 3. UPI ID / Payment Info */}
                          <td className="py-3 px-3.5 align-middle">
                            {item.method === 'upi' ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-blue-600 select-all text-xs bg-blue-50/50 px-2 py-1 rounded-lg border border-blue-100 max-w-[170px] truncate" title={item.upiId}>
                                  {item.upiId || 'No UPI ID'}
                                </span>
                                {item.upiId && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleCopy(item.upiId!, item.id)}
                                      className="p-1 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-all active:scale-90"
                                      title="Copy UPI ID"
                                    >
                                      {copiedId === item.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                                    </button>
                                    <a
                                      href={`upi://pay?pa=${encodeURIComponent(item.upiId)}&pn=${encodeURIComponent(item.userEmail || 'User')}&am=${item.amountInr}&cu=INR`}
                                      className="p-1 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all active:scale-90"
                                      title="Pay via UPI App"
                                    >
                                      <Send size={11} />
                                    </a>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="font-mono text-purple-700 text-xs font-bold bg-purple-50 px-2 py-1 rounded-lg border border-purple-100">
                                {item.redeemCode || 'PLAY-CODE-AUTOGEN'}
                              </span>
                            )}
                          </td>

                          {/* 4. Cashout Amount */}
                          <td className="py-3 px-3.5 align-middle whitespace-nowrap">
                            <div>
                              <span className="text-xs font-black text-slate-900 block font-display">
                                ₹{item.amountInr}
                              </span>
                              <span className="text-[9px] font-bold text-amber-600 flex items-center gap-0.5">
                                <Coins size={9} />
                                {item.amount?.toLocaleString()} coins
                              </span>
                            </div>
                          </td>

                          {/* 5. Reference / UTR */}
                          <td className="py-3 px-3 align-middle whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[10px] text-slate-500 max-w-[90px] truncate" title={item.utrNumber}>
                                {item.utrNumber || '—'}
                              </span>
                              {item.utrNumber && (
                                <button
                                  onClick={() => handleCopy(item.utrNumber!, `utr-${item.id}`)}
                                  className="p-0.5 text-slate-400 hover:text-slate-600 transition-all"
                                  title="Copy UTR"
                                >
                                  {copiedId === `utr-${item.id}` ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 6. Status */}
                          <td className="py-3 px-3 align-middle whitespace-nowrap">
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                              isPending && "bg-amber-100 text-amber-800 border-amber-300",
                              isCompleted && "bg-emerald-100 text-emerald-800 border-emerald-300",
                              isRejected && "bg-rose-100 text-rose-800 border-rose-300"
                            )}>
                              {isPending && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                              {isCompleted && <CheckCircle2 size={10} />}
                              {isRejected && <RotateCcw size={10} />}
                              <span>{item.status}</span>
                            </span>
                            {item.rejectionReason && (
                              <p className="text-[8px] text-rose-600 font-medium truncate max-w-[110px] mt-0.5" title={item.rejectionReason}>
                                {item.rejectionReason}
                              </p>
                            )}
                          </td>

                          {/* 7. Action Buttons */}
                          <td className="py-3 px-3 align-middle text-center whitespace-nowrap">
                            {isPending ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenApproveModal(item)}
                                  disabled={cashoutApproving === item.id}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-[10px] font-black flex items-center gap-1 transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50"
                                  title="Approve and mark payout complete"
                                >
                                  {cashoutApproving === item.id ? (
                                    <RefreshCw size={11} className="animate-spin" />
                                  ) : (
                                    <CheckCircle2 size={11} />
                                  )}
                                  <span>Approve</span>
                                </button>

                                <button
                                  onClick={() => setSelectedCashoutReject(item)}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all"
                                  title="Reject request and refund coins to user"
                                >
                                  <RotateCcw size={11} />
                                  <span>Reject</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setSelectedCashoutDetails(item)}
                                className="px-2.5 py-1 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl text-[10px] font-bold transition-all"
                              >
                                View Details
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* COMPACT CARDS VIEW (ALTERNATIVE / MOBILE)                */
            /* ======================================================== */
            <div className="space-y-3">
              {filteredCashouts.map((item) => {
                const isPending = item.status === 'pending';
                const isCompleted = item.status === 'completed';
                const isRejected = item.status === 'rejected';

                return (
                  <div 
                    key={item.id}
                    className={cn(
                      "bg-white rounded-3xl p-5 border shadow-sm transition-all relative overflow-hidden",
                      isPending ? "border-amber-200/80 bg-gradient-to-br from-white to-amber-50/20" :
                      isCompleted ? "border-emerald-100" :
                      "border-rose-100 bg-rose-50/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0 left-0 right-0 h-1.5",
                      isPending ? "bg-amber-400" :
                      isCompleted ? "bg-emerald-500" :
                      "bg-rose-500"
                    )} />

                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                            item.method === 'upi' 
                              ? "bg-blue-50 text-blue-700 border-blue-200" 
                              : "bg-purple-50 text-purple-700 border-purple-200"
                          )}>
                            {item.method === 'upi' ? 'UPI Transfer' : 'Play Store Code'}
                          </span>
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                            isPending ? "bg-amber-100 text-amber-800 border-amber-300" :
                            isCompleted ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                            "bg-rose-100 text-rose-800 border-rose-300"
                          )}>
                            {item.status}
                          </span>
                        </div>

                        <p className="text-xs font-black text-slate-900 truncate max-w-[200px]" title={item.userEmail}>
                          {item.userEmail || `User: ${item.userId.substring(0, 8)}`}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xl font-black text-slate-900 block font-display">
                          ₹{item.amountInr}
                        </span>
                        <span className="text-[10px] font-bold text-amber-600 flex items-center justify-end gap-1">
                          <Coins size={10} />
                          {item.amount?.toLocaleString()} coins
                        </span>
                      </div>
                    </div>

                    {/* Method Details */}
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-2 mb-4">
                      {item.method === 'upi' ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Beneficiary UPI ID</span>
                            <span className="text-xs font-black text-blue-600 select-all font-mono">
                              {item.upiId || 'No UPI ID recorded'}
                            </span>
                          </div>
                          {item.upiId && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleCopy(item.upiId!, item.id)}
                                className="px-2.5 py-1 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                              >
                                {copiedId === item.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                              </button>
                              <a
                                href={`upi://pay?pa=${encodeURIComponent(item.upiId)}&pn=${encodeURIComponent(item.userEmail || 'User')}&am=${item.amountInr}&cu=INR`}
                                className="px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-[10px] font-bold flex items-center gap-1"
                              >
                                <Send size={11} />
                                <span>Pay</span>
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Redeem Code Generated</span>
                          <span className="text-xs font-black text-purple-700 font-mono">
                            {item.redeemCode || 'PLAY-CODE-AUTOGEN'}
                          </span>
                        </div>
                      )}

                      {item.rejectionReason && (
                        <div className="p-2 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-800 font-medium">
                          <span className="font-bold block text-rose-900">Rejection Reason:</span>
                          {item.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {isPending && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handleOpenApproveModal(item)}
                          disabled={cashoutApproving === item.id}
                          className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                        >
                          {cashoutApproving === item.id ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          Approve & Paid
                        </button>

                        <button
                          onClick={() => setSelectedCashoutReject(item)}
                          className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                        >
                          <RotateCcw size={14} />
                          Reject & Refund
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: COIN PURCHASES / DEPOSITS                     */}
      {/* ======================================================== */}
      {activeSection === 'purchases' && (
        <div className="space-y-4">
          {/* Filter Sub-Tabs */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl">
            {(['pending', 'all', 'approved', 'rejected'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setPurchaseFilter(tab)}
                className={cn(
                  "flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all capitalize",
                  purchaseFilter === tab 
                    ? "bg-white text-slate-950 shadow-sm" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {tab} {tab === 'pending' && pendingPurchasesCount > 0 && `(${pendingPurchasesCount})`}
              </button>
            ))}
          </div>

          {/* Purchase Requests List */}
          <div className="space-y-3">
            {purchaseLoading ? (
              <div className="py-16 text-center">
                <RefreshCw size={24} className="animate-spin mx-auto text-emerald-500 mb-2" />
                <p className="text-xs font-bold text-slate-500">Loading coin purchases...</p>
              </div>
            ) : filteredPurchases.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-slate-100 p-6 space-y-2">
                <CheckCircle2 size={36} className="mx-auto text-slate-300" />
                <p className="text-sm font-black text-slate-700">No {purchaseFilter} coin deposits</p>
                <p className="text-xs text-slate-400">All incoming scanner payments have been addressed.</p>
              </div>
            ) : (
              filteredPurchases.map((item) => {
                const isPending = item.status === 'pending';
                const isApproved = item.status === 'approved';
                const isRejected = item.status === 'rejected';

                return (
                  <div 
                    key={item.id}
                    className={cn(
                      "bg-white rounded-3xl p-5 border shadow-sm transition-all relative overflow-hidden",
                      isPending ? "border-amber-200/80 bg-gradient-to-br from-white to-amber-50/20" :
                      isApproved ? "border-emerald-100" :
                      "border-rose-100 bg-rose-50/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0 left-0 right-0 h-1.5",
                      isPending ? "bg-amber-400" :
                      isApproved ? "bg-emerald-500" :
                      "bg-rose-500"
                    )} />

                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                            isPending ? "bg-amber-100 text-amber-800 border-amber-300" :
                            isApproved ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                            "bg-rose-100 text-rose-800 border-rose-300"
                          )}>
                            {item.status}
                          </span>
                          <span className="text-[10px] font-black text-slate-700">
                            {item.packName}
                          </span>
                        </div>

                        <p className="text-xs font-black text-slate-900 truncate max-w-[200px]" title={item.userEmail}>
                          {item.userEmail}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xl font-black text-slate-900 block font-display">
                          ₹{item.priceInr}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center justify-end gap-1">
                          <Coins size={10} />
                          +{item.coins.toLocaleString()} tokens
                        </span>
                      </div>
                    </div>

                    {/* UTR Verification Block */}
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-2 mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Bank UTR Number</span>
                          <span className="text-xs font-black text-blue-600 select-all font-mono">
                            {item.utrNumber}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(item.utrNumber, item.id)}
                          className="px-2.5 py-1 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                        >
                          {copiedId === item.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      {item.rejectionReason && (
                        <div className="p-2 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-800 font-medium">
                          <span className="font-bold block text-rose-900">Rejection Reason:</span>
                          {item.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* Admin Approval & Rejection Actions */}
                    {isPending && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handleApprovePurchase(item)}
                          disabled={purchaseApproving === item.id}
                          className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                        >
                          {purchaseApproving === item.id ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={15} />
                          )}
                          Approve & Credit Coins
                        </button>

                        <button
                          onClick={() => setSelectedPurchaseReject(item)}
                          className="py-3 px-3 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                        >
                          <RotateCcw size={15} />
                          Reject Deposit
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: APPROVE CASHOUT & RECORD PAYOUT UTR             */}
      {/* ======================================================== */}
      <AnimatePresence>
        {selectedCashoutApprove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-600">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Approve & Confirm Payout</h3>
                  <p className="text-[11px] text-slate-500">Beneficiary will receive a push notification</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Beneficiary:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[170px]">{selectedCashoutApprove.userEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Payout Amount:</span>
                  <span className="font-black text-emerald-600 text-sm">₹{selectedCashoutApprove.amountInr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Method:</span>
                  <span className="font-bold text-slate-800 capitalize">
                    {selectedCashoutApprove.method === 'upi' ? 'UPI Direct Transfer' : 'Play Store Code'}
                  </span>
                </div>
                {selectedCashoutApprove.upiId && (
                  <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">UPI ID</span>
                      <span className="font-mono text-blue-600 font-bold text-xs">{selectedCashoutApprove.upiId}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(selectedCashoutApprove.upiId!, 'modal-upi')}
                      className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 flex items-center gap-1"
                    >
                      {copiedId === 'modal-upi' ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                      <span>Copy</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Bank / UPI Payout Reference UTR:
                </label>
                <input
                  type="text"
                  value={payoutUtrInput}
                  onChange={(e) => setPayoutUtrInput(e.target.value)}
                  placeholder="Enter Bank UTR (e.g., 402918291029)"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCashoutApprove(null)}
                  disabled={cashoutApproving === selectedCashoutApprove.id}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-black text-xs hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApproveCashout}
                  disabled={cashoutApproving === selectedCashoutApprove.id}
                  className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/30 disabled:opacity-50"
                >
                  {cashoutApproving === selectedCashoutApprove.id ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  Confirm & Mark Paid
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL 2: REJECT CASHOUT WITH REAL-TIME COIN REFUND       */}
      {/* ======================================================== */}
      <AnimatePresence>
        {selectedCashoutReject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-100 text-rose-600">
                  <RotateCcw size={22} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Reject & Refund Coins</h3>
                  <p className="text-[11px] text-slate-500">Coins will be returned immediately</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">User:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[170px]">{selectedCashoutReject.userEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Withdrawal Amount:</span>
                  <span className="font-bold text-slate-900">₹{selectedCashoutReject.amountInr}</span>
                </div>
                <div className="flex justify-between items-center bg-emerald-50/70 p-2 rounded-xl border border-emerald-200">
                  <span className="text-emerald-800 font-bold text-xs flex items-center gap-1">
                    <Coins size={12} className="text-emerald-600" />
                    Coins to Refund:
                  </span>
                  <span className="font-black text-emerald-700 text-xs">
                    +{selectedCashoutReject.amount.toLocaleString()} coins
                  </span>
                </div>
                {selectedCashoutReject.upiId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">UPI ID:</span>
                    <span className="font-mono text-blue-600 font-bold">{selectedCashoutReject.upiId}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Select Rejection Reason:
                </label>
                <select
                  value={cashoutRejectReason}
                  onChange={(e) => setCashoutRejectReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-rose-500"
                >
                  <option value="Invalid UPI ID or beneficiary bank failed to accept payment">
                    Invalid UPI ID / Bank rejected payment
                  </option>
                  <option value="Beneficiary name mismatch with bank account">
                    Beneficiary name mismatch with account
                  </option>
                  <option value="Incorrect payment details provided">
                    Incorrect payment details provided
                  </option>
                  <option value="Daily bank transfer limit exceeded">
                    Daily bank transfer limit exceeded
                  </option>
                  <option value="Suspicious activity / Policy violation">
                    Suspicious activity / Policy violation
                  </option>
                  <option value="custom">Other (Enter custom reason...)</option>
                </select>

                {cashoutRejectReason === 'custom' && (
                  <textarea
                    value={customRejectReason}
                    onChange={(e) => setCustomRejectReason(e.target.value)}
                    placeholder="Describe reason for rejecting this payout..."
                    rows={2}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-rose-500"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCashoutReject(null);
                    setCustomRejectReason('');
                  }}
                  disabled={isRefunding}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-black text-xs hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRejectCashout}
                  disabled={isRefunding}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-600/30 disabled:opacity-50"
                >
                  {isRefunding ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <RotateCcw size={14} />
                  )}
                  Confirm Refund
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL 3: REJECT PURCHASE CONFIRMATION                    */}
      {/* ======================================================== */}
      <AnimatePresence>
        {selectedPurchaseReject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-100 text-rose-600">
                  <XCircle size={22} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Reject Coin Deposit</h3>
                  <p className="text-[11px] text-slate-500">User will be notified via push alert</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">User:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[160px]">{selectedPurchaseReject.userEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Amount:</span>
                  <span className="font-bold text-slate-900">₹{selectedPurchaseReject.priceInr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">UTR:</span>
                  <span className="font-mono text-blue-600 font-bold">{selectedPurchaseReject.utrNumber}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Reason for rejection:
                </label>
                <select
                  value={purchaseRejectReason}
                  onChange={(e) => setPurchaseRejectReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-rose-500"
                >
                  <option value="Payment UTR not found in bank statement">
                    UTR not found in bank statement
                  </option>
                  <option value="Amount received does not match package price">
                    Incorrect amount transferred
                  </option>
                  <option value="Duplicate or already claimed UTR reference">
                    Duplicate / already used UTR
                  </option>
                  <option value="Payment reversed or cancelled by bank">
                    Payment reversed / cancelled by bank
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPurchaseReject(null)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-black text-xs hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRejectPurchase}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-600/30"
                >
                  Confirm Reject
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL 4: CASHOUT INSPECTION DETAILS                      */}
      {/* ======================================================== */}
      <AnimatePresence>
        {selectedCashoutDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-slate-100 text-slate-700">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">Cashout Record</h3>
                    <p className="text-[10px] text-slate-400 font-mono">ID: {selectedCashoutDetails.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCashoutDetails(null)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Beneficiary User:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[170px]">{selectedCashoutDetails.userEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">User ID:</span>
                  <span className="font-mono text-slate-700">{selectedCashoutDetails.userId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Method:</span>
                  <span className="font-bold text-slate-900 capitalize">
                    {selectedCashoutDetails.method === 'upi' ? 'UPI Transfer' : 'Google Play Code'}
                  </span>
                </div>
                {selectedCashoutDetails.upiId && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">UPI ID:</span>
                    <span className="font-mono font-bold text-blue-600">{selectedCashoutDetails.upiId}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Payout Amount:</span>
                  <span className="font-black text-slate-900">₹{selectedCashoutDetails.amountInr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Coins Deducted:</span>
                  <span className="font-bold text-amber-600">{selectedCashoutDetails.amount.toLocaleString()} coins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                    selectedCashoutDetails.status === 'pending' && "bg-amber-100 text-amber-800 border-amber-300",
                    selectedCashoutDetails.status === 'completed' && "bg-emerald-100 text-emerald-800 border-emerald-300",
                    selectedCashoutDetails.status === 'rejected' && "bg-rose-100 text-rose-800 border-rose-300"
                  )}>
                    {selectedCashoutDetails.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Requested:</span>
                  <span className="text-slate-700 font-mono text-[10px]">{new Date(selectedCashoutDetails.createdAt).toLocaleString()}</span>
                </div>
                {selectedCashoutDetails.approvedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Paid At:</span>
                    <span className="text-emerald-700 font-mono text-[10px]">{new Date(selectedCashoutDetails.approvedAt).toLocaleString()}</span>
                  </div>
                )}
                {selectedCashoutDetails.rejectedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Rejected At:</span>
                    <span className="text-rose-700 font-mono text-[10px]">{new Date(selectedCashoutDetails.rejectedAt).toLocaleString()}</span>
                  </div>
                )}
                {selectedCashoutDetails.rejectionReason && (
                  <div className="p-2 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 text-[11px]">
                    <span className="font-bold block">Rejection Note:</span>
                    {selectedCashoutDetails.rejectionReason}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedCashoutDetails(null)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-slate-800 transition-all"
              >
                Close Details
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
