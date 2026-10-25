import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Coins, 
  Smartphone, 
  Ticket, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Loader2, 
  ShieldCheck, 
  HelpCircle, 
  Clock, 
  Sparkles, 
  CreditCard, 
  TrendingUp, 
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  runTransaction, 
  increment, 
  query, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { cn } from '../lib/utils';
import { Transaction } from '../types';
import { sendAppNotification } from '../lib/notifications';

interface RedeemProps {
  onOpenPayment?: () => void;
  onNavigateTab?: (tab: string) => void;
}

type RedeemMethod = 'upi' | 'play_code';

interface UpiOption {
  amountInr: number;
  coinCost: number;
  popular?: boolean;
}

interface PlayCodeOption {
  id: string;
  amountInr: number;
  coinCost: number;
  badge?: string;
}

const UPI_DENOMINATIONS: UpiOption[] = [
  { amountInr: 10, coinCost: 10000 },
  { amountInr: 25, coinCost: 25000 },
  { amountInr: 50, coinCost: 50000, popular: true },
  { amountInr: 100, coinCost: 100000 },
  { amountInr: 250, coinCost: 250000 },
  { amountInr: 500, coinCost: 500000 },
];

const PLAY_CODE_OPTIONS: PlayCodeOption[] = [
  { id: 'gp10', amountInr: 10, coinCost: 10000, badge: 'Starter' },
  { id: 'gp50', amountInr: 50, coinCost: 50000, badge: 'Popular' },
  { id: 'gp100', amountInr: 100, coinCost: 100000, badge: 'Best Value' },
  { id: 'gp250', amountInr: 250, coinCost: 250000 },
  { id: 'gp500', amountInr: 500, coinCost: 500000, badge: 'VIP' },
];

export const Redeem: React.FC<RedeemProps> = ({ onOpenPayment, onNavigateTab }) => {
  const { user, profile } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<RedeemMethod>('upi');

  // UPI Form State
  const [selectedUpiOption, setSelectedUpiOption] = useState<UpiOption>(UPI_DENOMINATIONS[0]);
  const [customCoins, setCustomCoins] = useState<string>('');
  const [isCustomUpi, setIsCustomUpi] = useState<boolean>(false);
  const [upiId, setUpiId] = useState<string>('');
  const [upiError, setUpiError] = useState<string>('');

  // Play Store State
  const [selectedPlayOption, setSelectedPlayOption] = useState<PlayCodeOption>(PLAY_CODE_OPTIONS[0]);

  // Processing & Feedback
  const [processing, setProcessing] = useState<boolean>(false);
  const [successData, setSuccessData] = useState<{
    type: 'upi' | 'play_code';
    amountInr: number;
    coinsDeducted: number;
    upiId?: string;
    utrNumber?: string;
    redeemCode?: string;
  } | null>(null);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedUtr, setCopiedUtr] = useState<boolean>(false);

  // Past redemptions history
  const [pastRedemptions, setPastRedemptions] = useState<Transaction[]>([]);

  const userCoins = profile?.coins || 0;
  // Conversion: 1,000 Coins = ₹1
  const cashEquivalent = (userCoins / 1000).toFixed(2);

  // Load user's recent redemptions
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Transaction))
        .filter(t => 
          t.type === 'redeem' || 
          t.redeemCode || 
          (t.description && t.description.toLowerCase().includes('redeem')) ||
          (t.description && t.description.toLowerCase().includes('upi'))
        );
      setPastRedemptions(items);
    });

    return () => unsubscribe();
  }, [user]);

  // Compute active UPI amount and coins
  const activeUpiAmount = isCustomUpi 
    ? (Number(customCoins) > 0 ? Math.floor(Number(customCoins) / 1000) : 0)
    : selectedUpiOption.amountInr;

  const activeUpiCoinCost = isCustomUpi
    ? (Number(customCoins) || 0)
    : selectedUpiOption.coinCost;

  // Validation
  const validateUpiId = (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return "Please enter your UPI ID";
    if (!trimmed.includes('@')) return "UPI ID must include an '@' symbol (e.g., name@okhdfcbank)";
    const parts = trimmed.split('@');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return "Invalid UPI format";
    return "";
  };

  const handleAppendHandle = (handle: string) => {
    const currentName = upiId.includes('@') ? upiId.split('@')[0] : upiId;
    setUpiId(currentName + handle);
    setUpiError('');
  };

  const handleCopy = (text: string, isUtr: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isUtr) {
      setCopiedUtr(true);
      setTimeout(() => setCopiedUtr(false), 2000);
    } else {
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  // Convert to UPI
  const handleUpiRedemption = async () => {
    if (!user) return;
    const err = validateUpiId(upiId);
    if (err) {
      setUpiError(err);
      return;
    }
    setUpiError('');

    if (activeUpiAmount <= 0) {
      alert("Minimum withdrawal is ₹10 (10,000 coins).");
      return;
    }

    if (userCoins < activeUpiCoinCost) {
      alert(`Insufficient coins. You have ${userCoins.toLocaleString()} coins, but need ${activeUpiCoinCost.toLocaleString()} coins.`);
      return;
    }

    setProcessing(true);
    const utr = `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const finalUpi = upiId.trim();

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) {
          throw new Error("User record not found");
        }

        const currentBalance = userSnap.data().coins || 0;
        if (currentBalance < activeUpiCoinCost) {
          throw new Error(`Insufficient coins. Available: ${currentBalance}`);
        }

        // 1. Deduct user coins
        transaction.update(userRef, {
          coins: increment(-activeUpiCoinCost)
        });

        // 2. Add to global redemptions collection
        const redemptionRef = doc(collection(db, 'redemptions'));
        transaction.set(redemptionRef, {
          userId: user.uid,
          userEmail: user.email || '',
          method: 'upi',
          productTitle: `₹${activeUpiAmount} UPI Cashout`,
          upiId: finalUpi,
          amountInr: activeUpiAmount,
          amount: activeUpiCoinCost,
          status: 'pending',
          utrNumber: utr,
          createdAt: new Date().toISOString()
        });

        // 3. Add to user's transaction ledger
        const txRef = doc(collection(db, 'users', user.uid, 'transactions'));
        transaction.set(txRef, {
          userId: user.uid,
          amount: -activeUpiCoinCost,
          type: 'redeem',
          description: `UPI Cashout (₹${activeUpiAmount}) to ${finalUpi}`,
          method: 'upi',
          upiId: finalUpi,
          amountInr: activeUpiAmount,
          status: 'processing',
          utrNumber: utr,
          createdAt: new Date().toISOString()
        });
      });

      setSuccessData({
        type: 'upi',
        amountInr: activeUpiAmount,
        coinsDeducted: activeUpiCoinCost,
        upiId: finalUpi,
        utrNumber: utr
      });

      sendAppNotification({
        userId: user.uid,
        title: 'UPI Cashout Request Submitted',
        body: `Your cashout of ₹${activeUpiAmount} (${activeUpiCoinCost.toLocaleString()} coins) to ${finalUpi} was sent to Admin for payout. Ref: ${utr}`,
        type: 'cashout_status'
      }).catch(console.error);
    } catch (err: any) {
      console.error("UPI Redemption Error:", err);
      alert(err.message || "Failed to process UPI redemption. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  // Convert to Google Play Redeem Code
  const handlePlayCodeRedemption = async () => {
    if (!user) return;

    if (userCoins < selectedPlayOption.coinCost) {
      alert(`Insufficient coins. You have ${userCoins.toLocaleString()} coins, but need ${selectedPlayOption.coinCost.toLocaleString()} coins.`);
      return;
    }

    setProcessing(true);

    // Format: PLAY-4X8L-9K2M-7P3Q
    const randPart = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    const generatedCode = `PLAY-${randPart()}-${randPart()}-${randPart()}`;

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) {
          throw new Error("User record not found");
        }

        const currentBalance = userSnap.data().coins || 0;
        if (currentBalance < selectedPlayOption.coinCost) {
          throw new Error(`Insufficient coins. Available: ${currentBalance}`);
        }

        // 1. Deduct user coins
        transaction.update(userRef, {
          coins: increment(-selectedPlayOption.coinCost)
        });

        // 2. Add to global redemptions collection
        const redemptionRef = doc(collection(db, 'redemptions'));
        transaction.set(redemptionRef, {
          userId: user.uid,
          userEmail: user.email || '',
          productId: selectedPlayOption.id,
          method: 'play_code',
          productTitle: `₹${selectedPlayOption.amountInr} Play Store Code`,
          amountInr: selectedPlayOption.amountInr,
          amount: selectedPlayOption.coinCost,
          redeemCode: generatedCode,
          status: 'pending',
          createdAt: new Date().toISOString()
        });

        // 3. Add to user transaction ledger
        const txRef = doc(collection(db, 'users', user.uid, 'transactions'));
        transaction.set(txRef, {
          userId: user.uid,
          amount: -selectedPlayOption.coinCost,
          type: 'redeem',
          description: `₹${selectedPlayOption.amountInr} Play Store Code`,
          method: 'play_code',
          redeemCode: generatedCode,
          amountInr: selectedPlayOption.amountInr,
          status: 'completed',
          createdAt: new Date().toISOString()
        });
      });

      setSuccessData({
        type: 'play_code',
        amountInr: selectedPlayOption.amountInr,
        coinsDeducted: selectedPlayOption.coinCost,
        redeemCode: generatedCode
      });

      sendAppNotification({
        userId: user.uid,
        title: 'Google Play Code Generated!',
        body: `Your ₹${selectedPlayOption.amountInr} Play Store gift code (${generatedCode}) has been generated and saved in your account.`,
        type: 'cashout_status'
      }).catch(console.error);
    } catch (err: any) {
      console.error("Play Code Redemption Error:", err);
      alert(err.message || "Failed to generate Google Play code. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Balance & Valuation Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 rounded-[2.5rem] p-7 text-white shadow-2xl relative overflow-hidden border border-white/5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[90px]" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[90px]" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Coin Cashout Hub
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Instant Settlement</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="text-xs font-bold text-slate-400 block mb-1">Available Coin Balance</span>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-emerald-400 fill-emerald-400" />
                </div>
                <span className="text-3xl sm:text-4xl font-black italic tracking-tight text-white tabular-nums">
                  {userCoins.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="text-right bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                Cash Value
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums">
                ₹{cashEquivalent}
              </span>
              <span className="text-[8px] font-bold text-slate-400 block mt-0.5">
                1,000 Coins = ₹1
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Conversion Method Chooser */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Select Conversion Method
          </h3>
          <span className="text-[10px] font-bold text-emerald-600">Choose where to cashout</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* METHOD 1: UPI ID */}
          <button
            type="button"
            onClick={() => setSelectedMethod('upi')}
            className={cn(
              "p-4 rounded-3xl border-2 text-left transition-all relative flex flex-col justify-between group",
              selectedMethod === 'upi'
                ? "bg-purple-50/80 border-purple-500 shadow-md ring-2 ring-purple-400/20"
                : "bg-white border-slate-100 shadow-sm hover:border-purple-200"
            )}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105",
                selectedMethod === 'upi' ? "bg-purple-600 text-white shadow-md shadow-purple-200" : "bg-purple-100 text-purple-600"
              )}>
                <Smartphone size={24} />
              </div>
              <span className={cn(
                "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                selectedMethod === 'upi' ? "bg-purple-600 text-white border-purple-600" : "bg-slate-100 text-slate-500 border-slate-200"
              )}>
                Instant UPI
              </span>
            </div>

            <div>
              <h4 className="font-black text-sm text-slate-900 leading-tight">UPI ID Transfer</h4>
              <p className="text-[10px] font-bold text-slate-500 mt-1">
                Direct bank transfer via GPay, PhonePe, Paytm or VPA
              </p>
            </div>
          </button>

          {/* METHOD 2: GOOGLE PLAY CODE */}
          <button
            type="button"
            onClick={() => setSelectedMethod('play_code')}
            className={cn(
              "p-4 rounded-3xl border-2 text-left transition-all relative flex flex-col justify-between group",
              selectedMethod === 'play_code'
                ? "bg-emerald-50/80 border-emerald-500 shadow-md ring-2 ring-emerald-400/20"
                : "bg-white border-slate-100 shadow-sm hover:border-emerald-200"
            )}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105",
                selectedMethod === 'play_code' ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" : "bg-emerald-100 text-emerald-600"
              )}>
                <Ticket size={24} />
              </div>
              <span className={cn(
                "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                selectedMethod === 'play_code' ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-100 text-slate-500 border-slate-200"
              )}>
                Digital Code
              </span>
            </div>

            <div>
              <h4 className="font-black text-sm text-slate-900 leading-tight">Google Play Code</h4>
              <p className="text-[10px] font-bold text-slate-500 mt-1">
                Instant digital voucher code for Google Play Store
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================== */}
      {/* OPTION 1: UPI ID CONVERSION FORM */}
      {/* ========================================================== */}
      {selectedMethod === 'upi' && (
        <motion.div
          key="upi-panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-xl space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <Smartphone size={20} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Convert Coins to UPI Cash</h3>
                <p className="text-[10px] font-bold text-slate-400">Withdraw directly to any UPI ID in India</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black text-purple-600 uppercase bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                0% Fee
              </span>
            </div>
          </div>

          {/* Preset Denominations */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              1. Select Payout Amount
            </label>
            <div className="grid grid-cols-3 gap-2">
              {UPI_DENOMINATIONS.map((opt) => {
                const isSelected = !isCustomUpi && selectedUpiOption.amountInr === opt.amountInr;
                const canAfford = userCoins >= opt.coinCost;

                return (
                  <button
                    key={opt.amountInr}
                    type="button"
                    onClick={() => {
                      setIsCustomUpi(false);
                      setSelectedUpiOption(opt);
                    }}
                    className={cn(
                      "p-3 rounded-2xl border-2 text-center transition-all relative flex flex-col items-center justify-center",
                      isSelected
                        ? "border-purple-600 bg-purple-50/80 text-purple-950 font-black shadow-sm"
                        : "border-slate-200 bg-white hover:border-purple-300 text-slate-800"
                    )}
                  >
                    {opt.popular && (
                      <span className="absolute -top-2 text-[7px] font-black uppercase bg-purple-600 text-white px-1.5 py-0.2 rounded-full">
                        POPULAR
                      </span>
                    )}
                    <span className="text-base font-black">₹{opt.amountInr}</span>
                    <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                      {opt.coinCost.toLocaleString()} Coins
                    </span>
                    {!canAfford && (
                      <span className="text-[7px] font-bold text-rose-500 mt-0.5">Need coins</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom Coins toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsCustomUpi(!isCustomUpi)}
                className="text-[11px] font-black text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                <span>{isCustomUpi ? "Use preset amounts" : "Or enter custom coin amount"}</span>
                <ChevronRight size={12} />
              </button>

              {isCustomUpi && (
                <div className="mt-2 space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>Coins to convert (Min. 10,000):</span>
                    <span className="font-black text-purple-700">₹{activeUpiAmount}</span>
                  </div>
                  <input
                    type="number"
                    step="1000"
                    min="10000"
                    placeholder="e.g. 20000"
                    value={customCoins}
                    onChange={(e) => setCustomCoins(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* UPI ID Input */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              2. Enter Destination UPI ID
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. username@okhdfcbank or 9876543210@paytm"
                value={upiId}
                onChange={(e) => {
                  setUpiId(e.target.value);
                  if (upiError) setUpiError('');
                }}
                className={cn(
                  "w-full bg-slate-50 border-2 rounded-2xl px-4 py-3.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors",
                  upiError ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-purple-600"
                )}
              />
            </div>
            {upiError && (
              <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                <AlertCircle size={12} />
                <span>{upiError}</span>
              </p>
            )}

            {/* Quick Handle Chips */}
            <div className="space-y-1 pt-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Popular Bank & UPI Suffixes:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {['@okaxis', '@okhdfcbank', '@oksbi', '@paytm', '@ybl', '@upi'].map(handle => (
                  <button
                    key={handle}
                    type="button"
                    onClick={() => handleAppendHandle(handle)}
                    className="text-[10px] font-black text-purple-700 bg-purple-50 border border-purple-200/80 px-2.5 py-1 rounded-xl hover:bg-purple-100 transition-colors"
                  >
                    {handle}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Strip */}
          <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-4 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600 font-bold">
              <span>Cost in Coins:</span>
              <span className="font-black text-slate-900 tabular-nums">
                {activeUpiCoinCost.toLocaleString()} Coins
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 font-bold">
              <span>Payout Amount:</span>
              <span className="font-black text-purple-700 text-sm tabular-nums">
                ₹{activeUpiAmount} INR
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 font-bold">
              <span>Transfer Speed:</span>
              <span className="font-black text-emerald-600 flex items-center gap-1">
                <Clock size={12} />
                <span>Instant (5-15 mins)</span>
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            disabled={processing || userCoins < activeUpiCoinCost || activeUpiAmount <= 0}
            onClick={handleUpiRedemption}
            className={cn(
              "w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg",
              userCoins >= activeUpiCoinCost && activeUpiAmount > 0
                ? "bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white shadow-purple-200"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            )}
          >
            {processing ? (
              <Loader2 className="animate-spin" size={18} />
            ) : userCoins < activeUpiCoinCost ? (
              <span>Need {(activeUpiCoinCost - userCoins).toLocaleString()} More Coins</span>
            ) : (
              <>
                <span>Transfer ₹{activeUpiAmount} to UPI ID</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </motion.div>
      )}

      {/* ========================================================== */}
      {/* OPTION 2: GOOGLE PLAY REDEEM CODE FORM */}
      {/* ========================================================== */}
      {selectedMethod === 'play_code' && (
        <motion.div
          key="play-code-panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-xl space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Ticket size={20} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Google Play Redeem Codes</h3>
                <p className="text-[10px] font-bold text-slate-400">Instant digital gift card for apps & subscriptions</p>
              </div>
            </div>
            <span className="text-[9px] font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Instant Code
            </span>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              Select Voucher Denomination
            </label>

            <div className="grid gap-2.5">
              {PLAY_CODE_OPTIONS.map((opt) => {
                const isSelected = selectedPlayOption.id === opt.id;
                const canAfford = userCoins >= opt.coinCost;
                const progress = Math.min((userCoins / opt.coinCost) * 100, 100);

                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedPlayOption(opt)}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all cursor-pointer relative",
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/80 shadow-sm ring-1 ring-emerald-500/20"
                        : "border-slate-200 bg-white hover:border-emerald-300"
                    )}
                  >
                    {opt.badge && (
                      <span className="absolute -top-2 right-4 text-[8px] font-black uppercase bg-emerald-600 text-white px-2 py-0.2 rounded-full shadow-sm">
                        {opt.badge}
                      </span>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm",
                          isSelected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
                        )}>
                          ₹{opt.amountInr}
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-sm">₹{opt.amountInr} Google Play Code</h4>
                          <p className="text-[10px] font-bold text-slate-400">Cost: {opt.coinCost.toLocaleString()} Coins</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={cn(
                          "text-xs font-black px-2.5 py-1 rounded-xl",
                          canAfford ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"
                        )}>
                          {canAfford ? 'Ready' : `${Math.floor(progress)}%`}
                        </span>
                      </div>
                    </div>

                    {!canAfford && (
                      <div className="mt-3">
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[8px] font-bold text-slate-400 mt-1">
                          <span>Progress</span>
                          <span>Need {(opt.coinCost - userCoins).toLocaleString()} more</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Instructions Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
            <h5 className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
              <Info size={14} className="text-emerald-600" />
              <span>How to Redeem in Google Play Store:</span>
            </h5>
            <ol className="text-[10px] font-medium text-slate-600 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Open Google Play Store on your Android phone or PC.</li>
              <li>Tap profile icon &gt; Payments & subscriptions &gt; Redeem code.</li>
              <li>Paste the code generated below to add ₹ balance immediately.</li>
            </ol>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            disabled={processing || userCoins < selectedPlayOption.coinCost}
            onClick={handlePlayCodeRedemption}
            className={cn(
              "w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg",
              userCoins >= selectedPlayOption.coinCost
                ? "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-emerald-200"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            )}
          >
            {processing ? (
              <Loader2 className="animate-spin" size={18} />
            ) : userCoins < selectedPlayOption.coinCost ? (
              <span>Need {(selectedPlayOption.coinCost - userCoins).toLocaleString()} More Coins</span>
            ) : (
              <>
                <span>Generate ₹{selectedPlayOption.amountInr} Play Store Code</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </motion.div>
      )}

      {/* Buy More Coins Banner */}
      {onOpenPayment && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-800 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden flex items-center justify-between">
          <div className="relative z-10 space-y-1">
            <span className="text-[9px] font-black uppercase bg-white/20 px-2 py-0.5 rounded-md inline-block">
              Need More Coins?
            </span>
            <h4 className="font-black text-sm text-white">Buy Token Packs via UPI / Cards</h4>
            <p className="text-[10px] text-emerald-100 font-medium">Starting from ₹40 with instant delivery</p>
          </div>
          <button
            type="button"
            onClick={onOpenPayment}
            className="relative z-10 bg-white text-emerald-800 text-xs font-black px-4 py-2.5 rounded-2xl shadow-md hover:bg-emerald-50 active:scale-95 transition-all flex items-center gap-1 shrink-0"
          >
            <CreditCard size={14} className="text-emerald-600" />
            <span>Buy Coins</span>
          </button>
          <Coins className="absolute -bottom-6 -right-6 w-28 h-28 text-white/10 rotate-12 pointer-events-none" />
        </div>
      )}

      {/* Past Redemptions & Generated Codes List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-slate-500" />
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">
              Recent Redemptions & Codes
            </h3>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('profile')}
              className="text-[10px] font-black text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5 uppercase tracking-wider"
            >
              <span>Full Ledger</span>
              <ChevronRight size={12} />
            </button>
          )}
        </div>

        {pastRedemptions.length > 0 ? (
          <div className="space-y-2">
            {pastRedemptions.slice(0, 5).map((item) => {
              const isUpi = item.method === 'upi' || (item.description && item.description.toLowerCase().includes('upi'));
              const isPlay = Boolean(item.redeemCode || (item.description && item.description.toLowerCase().includes('play')));

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        isUpi ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700"
                      )}>
                        {isUpi ? <Smartphone size={18} /> : <Ticket size={18} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs text-slate-900">
                            {item.description || (isUpi ? 'UPI Transfer' : 'Redeem Code')}
                          </span>
                          <span className={cn(
                            "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                            item.status === 'completed' || item.status === 'fulfilled'
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-amber-50 text-amber-700"
                          )}>
                            {item.status || 'processed'}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-rose-600 text-xs tabular-nums">
                        {item.amount?.toLocaleString()} Coins
                      </span>
                    </div>
                  </div>

                  {/* If Google Play Code is present */}
                  {item.redeemCode && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 mt-1">
                      <div className="min-w-0">
                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">
                          Play Store Code
                        </span>
                        <span className="font-mono font-black text-xs text-slate-900 tracking-wider truncate block">
                          {item.redeemCode}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(item.redeemCode!)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-black bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1 shrink-0"
                      >
                        {copiedCode === item.redeemCode ? (
                          <>
                            <Check size={12} className="text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 text-center border-2 border-dashed border-slate-100">
            <Coins className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-xs font-black text-slate-700">No Past Redemptions</h4>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
              Your UPI transfers and Play Store vouchers will appear here.
            </p>
          </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* SUCCESS POPUP MODAL */}
      {/* ========================================================== */}
      <AnimatePresence>
        {successData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-sm p-6 text-center space-y-5 shadow-2xl border border-slate-100"
            >
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border-4 border-emerald-300 shadow-md">
                <CheckCircle2 size={36} className="stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-200">
                  {successData.type === 'upi' ? 'UPI Transfer Initiated' : 'Redeem Code Ready'}
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  ₹{successData.amountInr} {successData.type === 'upi' ? 'Payout Created!' : 'Voucher Generated!'}
                </h3>
                <p className="text-xs font-medium text-slate-500">
                  {successData.type === 'upi'
                    ? `₹${successData.amountInr} is being processed to ${successData.upiId}.`
                    : `Your Google Play Redeem code is ready to use.`}
                </p>
              </div>

              {/* UPI Success Details */}
              {successData.type === 'upi' && successData.utrNumber && (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-left space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600 font-bold">
                    <span>Recipient UPI ID:</span>
                    <span className="font-black text-purple-900">{successData.upiId}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 font-bold">
                    <span>Coins Deducted:</span>
                    <span className="font-black text-rose-600">-{successData.coinsDeducted.toLocaleString()}</span>
                  </div>
                  <div className="pt-2 border-t border-purple-200 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                    <span className="truncate pr-1">Ref UTR: {successData.utrNumber}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(successData.utrNumber!, true)}
                      className="text-purple-700 font-bold flex items-center gap-1 shrink-0"
                    >
                      {copiedUtr ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedUtr ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Play Code Success Details */}
              {successData.type === 'play_code' && successData.redeemCode && (
                <div className="space-y-3">
                  <div className="bg-slate-900 rounded-2xl p-4 text-white text-center space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                      Your Google Play Code
                    </span>
                    <div className="font-mono font-black text-lg text-white tracking-widest select-all">
                      {successData.redeemCode}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(successData.redeemCode!)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                  >
                    {copiedCode === successData.redeemCode ? (
                      <>
                        <Check size={14} />
                        <span>Code Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy Redeem Code</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSuccessData(null)}
                className="w-full bg-slate-900 text-white py-3.5 rounded-2xl font-black text-xs hover:bg-slate-800 transition-all"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
