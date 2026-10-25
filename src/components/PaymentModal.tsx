import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ShieldCheck, CheckCircle2, AlertCircle, Loader2, ArrowRight, 
  Smartphone, QrCode, Coins, Sparkles, Lock, Copy, Check, Crown, Diamond
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { CoinPack } from '../types';
import { cn } from '../lib/utils';
import { sendAppNotification } from '../lib/notifications';

export const ADMIN_UPI_ID = 'sanjuladubey05@okaxis';
export const ADMIN_NAME = 'Sanjula Dubey (ViewBoost Admin)';

export const COIN_PACKS: CoinPack[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    coins: 500,
    priceInr: 40,
    priceFormatted: '₹40',
    badge: 'Quick Boost',
    popular: false,
    color: 'from-blue-600 to-indigo-700'
  },
  {
    id: 'pro',
    name: 'Pro Pack',
    coins: 1500,
    bonusCoins: 150,
    priceInr: 95,
    priceFormatted: '₹95',
    badge: 'Most Popular',
    popular: true,
    color: 'from-emerald-600 to-teal-700'
  },
  {
    id: 'mega',
    name: 'Mega Pack',
    coins: 5000,
    bonusCoins: 750,
    priceInr: 280,
    priceFormatted: '₹280',
    badge: 'Best Value',
    popular: false,
    color: 'from-purple-600 to-indigo-800'
  },
  {
    id: 'ultra',
    name: 'Ultra Creator Pack',
    coins: 12000,
    bonusCoins: 2400,
    priceInr: 599,
    priceFormatted: '₹599',
    badge: '20% Extra',
    popular: false,
    color: 'from-amber-600 to-orange-700'
  },
  {
    id: 'legend',
    name: 'Legend Whale Pack',
    coins: 30000,
    bonusCoins: 7500,
    priceInr: 1299,
    priceFormatted: '₹1,299',
    badge: '25% Extra',
    popular: false,
    color: 'from-rose-600 to-red-800'
  },
  {
    id: 'lakh',
    name: '1 Lakh VIP Empire Pack',
    coins: 100000,
    bonusCoins: 35000,
    priceInr: 3499,
    priceFormatted: '₹3,499',
    badge: '1 Lakh Special • 35% Bonus',
    popular: false,
    color: 'from-amber-500 via-yellow-500 to-amber-700'
  },
  {
    id: 'ten_crore',
    name: '10 Crore Sovereign Emperor Pack',
    coins: 100000000, // 10 Crore = 100,000,000
    bonusCoins: 25000000, // 2.5 Crore Bonus (25,000,000)
    priceInr: 9999,
    priceFormatted: '₹9,999',
    badge: '10 CRORE VIP • 25% BONUS',
    popular: false,
    color: 'from-yellow-400 via-amber-500 to-yellow-600'
  }
];

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPackId?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  initialPackId = 'pro'
}) => {
  const { user, profile } = useAuth();
  const [selectedPack, setSelectedPack] = useState<CoinPack>(
    COIN_PACKS.find(p => p.id === initialPackId) || COIN_PACKS[1]
  );
  
  // Payment step: 'select_pack' | 'admin_scanner' | 'submitting' | 'submitted'
  const [step, setStep] = useState<'select_pack' | 'admin_scanner' | 'submitting' | 'submitted'>('select_pack');
  
  // UTR submission state
  const [utrNumber, setUtrNumber] = useState('');
  const [utrError, setUtrError] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [submittedRef, setSubmittedRef] = useState('');

  // Sync initialPackId if provided
  useEffect(() => {
    if (initialPackId) {
      const found = COIN_PACKS.find(p => p.id === initialPackId);
      if (found) setSelectedPack(found);
    }
  }, [initialPackId]);

  if (!isOpen) return null;

  const totalCoins = selectedPack.coins + (selectedPack.bonusCoins || 0);

  const copyUpiId = () => {
    navigator.clipboard.writeText(ADMIN_UPI_ID);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Generate UPI Intent URL with Admin UPI ID
  const upiIntentUrl = `upi://pay?pa=${ADMIN_UPI_ID}&pn=${encodeURIComponent(ADMIN_NAME)}&am=${selectedPack.priceInr}&cu=INR&tn=${encodeURIComponent(`Buy ${selectedPack.name} (${totalCoins} coins)`)}`;

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedUtr = utrNumber.trim();
    if (!trimmedUtr) {
      setUtrError('Please enter your 12-digit UPI Reference / UTR Number.');
      return;
    }
    if (trimmedUtr.length < 6) {
      setUtrError('Please enter a valid Bank UTR / Reference ID.');
      return;
    }

    setUtrError('');
    setStep('submitting');

    try {
      // 1. Submit purchase request to `coin_purchases` collection
      const purchaseDoc = await addDoc(collection(db, 'coin_purchases'), {
        userId: user.uid,
        userEmail: user.email || 'Anonymous',
        userName: profile?.displayName || user.displayName || 'Creator',
        packId: selectedPack.id,
        packName: selectedPack.name,
        coins: totalCoins,
        baseCoins: selectedPack.coins,
        bonusCoins: selectedPack.bonusCoins || 0,
        priceInr: selectedPack.priceInr,
        utrNumber: trimmedUtr,
        adminUpiId: ADMIN_UPI_ID,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      // 2. Add local in-app notification
      await sendAppNotification({
        userId: user.uid,
        title: 'Payment Submitted for Admin Verification',
        body: `Deposit of ${selectedPack.priceFormatted} for ${totalCoins.toLocaleString()} tokens submitted (UTR: ${trimmedUtr}). Admin will verify and credit tokens.`,
        type: 'purchase_status',
        referenceId: purchaseDoc.id
      });

      setSubmittedRef(purchaseDoc.id);
      setStep('submitted');
    } catch (err: any) {
      console.error("Failed to submit deposit:", err);
      setUtrError(err.message || "Failed to submit. Please try again.");
      setStep('admin_scanner');
    }
  };

  const handleResetAndClose = () => {
    setStep('select_pack');
    setUtrNumber('');
    setUtrError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Top Header */}
        <div className="bg-slate-950 text-white px-5 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Lock size={16} />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight text-white flex items-center gap-1.5">
                <span>Admin Scanner & Real UPI Checkout</span>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded-md">
                  Verified
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">Pay to Admin &gt; Admin Verifies &gt; Coins Credited</p>
            </div>
          </div>

          <button
            onClick={handleResetAndClose}
            disabled={step === 'submitting'}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide">
          {/* STEP 1: SELECT COIN PACK */}
          {step === 'select_pack' && (
            <>
              {/* Pack Selector Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-black text-slate-500 uppercase tracking-wider px-1">
                  <span>Select Token Package</span>
                  <span className="text-emerald-600 font-bold">Best Value Offers</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {COIN_PACKS.map(pack => {
                    const isSelected = selectedPack.id === pack.id;
                    const isTenCrore = pack.id === 'ten_crore';
                    const isLakh = pack.id === 'lakh';

                    return (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => setSelectedPack(pack)}
                        className={cn(
                          "p-3 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between group",
                          isSelected 
                            ? "border-emerald-500 bg-emerald-50/70 shadow-md ring-2 ring-emerald-400/20" 
                            : isTenCrore
                              ? "border-amber-400 bg-gradient-to-br from-amber-100/60 via-yellow-50/50 to-white hover:border-amber-500 shadow-sm"
                              : isLakh
                                ? "border-amber-300 bg-gradient-to-br from-amber-50/60 to-white hover:border-amber-400 shadow-sm"
                                : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        {pack.badge && (
                          <span className={cn(
                            "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md absolute -top-2.5 right-2 flex items-center gap-1 shadow-sm",
                            isTenCrore
                              ? "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-slate-950 font-black ring-1 ring-amber-400"
                              : pack.popular 
                                ? "bg-amber-500 text-white" 
                                : isLakh
                                  ? "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 font-black"
                                  : "bg-slate-800 text-white"
                          )}>
                            {isTenCrore ? <Diamond size={10} className="fill-slate-950" /> : 
                             isLakh ? <Crown size={9} className="fill-slate-950" /> : null}
                            <span>{pack.badge}</span>
                          </span>
                        )}

                        <div>
                          <div className="flex items-center gap-1.5">
                            {isTenCrore ? (
                              <Diamond size={15} className="text-amber-600 fill-amber-500 shrink-0" />
                            ) : isLakh ? (
                              <Crown size={14} className="text-amber-500 fill-amber-500 shrink-0" />
                            ) : (
                              <Coins size={14} className="text-amber-500 fill-amber-500 shrink-0" />
                            )}
                            <span className="font-black text-xs sm:text-sm text-slate-900 leading-tight">
                              {(pack.coins + (pack.bonusCoins || 0)).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-[10px] font-bold text-slate-500 truncate mt-1">{pack.name}</p>
                          {pack.bonusCoins ? (
                            <span className="text-[9px] font-black text-emerald-600 block mt-0.5">
                              +{pack.bonusCoins.toLocaleString()} FREE
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-1.5">
                          <span className="font-black text-xs text-slate-900">{pack.priceFormatted}</span>
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            isSelected ? "bg-emerald-500" : "bg-slate-200"
                          )} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Order Summary Strip */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-950 rounded-2xl p-4 text-white shadow-sm flex items-center justify-between border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    {selectedPack.id === 'ten_crore' ? (
                      <Diamond size={22} className="text-amber-400 fill-amber-400" />
                    ) : (
                      <Coins size={22} className="text-emerald-400 fill-emerald-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base text-white">{totalCoins.toLocaleString()} Coins</span>
                      {selectedPack.bonusCoins ? (
                        <span className="text-[9px] font-black uppercase bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded-md">
                          +{selectedPack.bonusCoins.toLocaleString()} Bonus
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] font-medium text-slate-400 truncate max-w-[200px]">{selectedPack.name}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-slate-400">Total Due</div>
                  <div className="text-xl font-black text-emerald-400">{selectedPack.priceFormatted}</div>
                </div>
              </div>

              {/* How it works Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-black text-slate-800">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span>Real Money Admin Scanner Flow</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 font-medium pl-1">
                  <li>Proceed to scan the <strong>Official Admin UPI Scanner</strong>.</li>
                  <li>Transfer <strong>{selectedPack.priceFormatted}</strong> via Google Pay, PhonePe, Paytm, or CRED.</li>
                  <li>Copy and paste your 12-digit <strong>Bank UTR / Ref Number</strong>.</li>
                  <li>Admin (<strong>sanjuladubey05@gmail.com</strong>) verifies receipt & atomically credits <strong>{totalCoins.toLocaleString()} coins</strong> to your account!</li>
                </ol>
              </div>

              <button
                type="button"
                onClick={() => setStep('admin_scanner')}
                className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all"
              >
                <span>Proceed to Admin Scanner ({selectedPack.priceFormatted})</span>
                <ArrowRight size={18} />
              </button>
            </>
          )}

          {/* STEP 2: ADMIN SCANNER & UTR SUBMISSION */}
          {step === 'admin_scanner' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep('select_pack')}
                  className="text-xs font-black text-slate-500 hover:text-slate-900 flex items-center gap-1"
                >
                  &larr; Change Package
                </button>
                <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  Amount: {selectedPack.priceFormatted}
                </span>
              </div>

              {/* Admin Scanner Box */}
              <div className="bg-gradient-to-b from-slate-50 to-white rounded-3xl p-5 border-2 border-emerald-500/30 shadow-lg text-center space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100/80 text-emerald-800 rounded-full text-[10px] font-black uppercase tracking-wider">
                  <ShieldCheck size={13} />
                  <span>Official Admin UPI Scanner</span>
                </div>

                {/* QR Code Container */}
                <div className="mx-auto w-52 h-52 bg-white rounded-2xl p-3 border-2 border-slate-200 shadow-inner flex flex-col items-center justify-center relative">
                  <svg className="w-full h-full text-slate-900" viewBox="0 0 100 100" fill="currentColor">
                    {/* Corner positioning boxes */}
                    <rect x="5" y="5" width="28" height="28" rx="4" fill="#0f172a" />
                    <rect x="10" y="10" width="18" height="18" rx="2" fill="white" />
                    <rect x="14" y="14" width="10" height="10" rx="1" fill="#10b981" />

                    <rect x="67" y="5" width="28" height="28" rx="4" fill="#0f172a" />
                    <rect x="72" y="10" width="18" height="18" rx="2" fill="white" />
                    <rect x="76" y="14" width="10" height="10" rx="1" fill="#10b981" />

                    <rect x="5" y="67" width="28" height="28" rx="4" fill="#0f172a" />
                    <rect x="10" y="72" width="18" height="18" rx="2" fill="white" />
                    <rect x="14" y="76" width="10" height="10" rx="1" fill="#10b981" />

                    {/* Data patterns */}
                    <rect x="40" y="8" width="6" height="6" rx="1" fill="#0f172a" />
                    <rect x="52" y="8" width="6" height="6" rx="1" fill="#0f172a" />
                    <rect x="46" y="20" width="6" height="6" rx="1" fill="#10b981" />

                    <rect x="40" y="40" width="20" height="20" rx="4" fill="#0f172a" />
                    <circle cx="50" cy="50" r="5" fill="#10b981" />

                    <rect x="15" y="42" width="6" height="6" rx="1" fill="#0f172a" />
                    <rect x="25" y="50" width="6" height="6" rx="1" fill="#0f172a" />
                    <rect x="72" y="40" width="6" height="6" rx="1" fill="#0f172a" />
                    <rect x="82" y="48" width="6" height="6" rx="1" fill="#10b981" />

                    <rect x="40" y="70" width="6" height="6" rx="1" fill="#0f172a" />
                    <rect x="52" y="76" width="6" height="6" rx="1" fill="#0f172a" />
                    <rect x="70" y="70" width="6" height="6" rx="1" fill="#0f172a" />
                    <rect x="80" y="78" width="10" height="10" rx="2" fill="#0f172a" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="bg-white/95 text-[9px] font-black text-slate-800 px-2 py-0.5 rounded shadow border border-slate-200">
                      ₹{selectedPack.priceInr}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="font-black text-sm text-slate-900">{ADMIN_NAME}</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 select-all">
                      {ADMIN_UPI_ID}
                    </span>
                    <button
                      type="button"
                      onClick={copyUpiId}
                      className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-slate-800 transition-all active:scale-95"
                    >
                      {copiedUpi ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Direct UPI App launcher link */}
                <a
                  href={upiIntentUrl}
                  className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all border border-emerald-200 active:scale-95"
                >
                  <Smartphone size={14} />
                  <span>Open directly in UPI App (GPay / PhonePe / Paytm)</span>
                </a>
              </div>

              {/* UTR Input Form */}
              <form onSubmit={handleSubmitDeposit} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                    Submit 12-Digit Bank UTR / Reference ID
                  </label>
                  <p className="text-[11px] text-slate-500 font-medium">
                    After completing the transfer to the Admin UPI, enter the 12-digit UTR found on your payment receipt.
                  </p>
                  <input
                    type="text"
                    required
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value.replace(/\s+/g, ''))}
                    placeholder="e.g. 412356789012 or UPI Ref No"
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-2xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                  />
                </div>

                {utrError && (
                  <div className="p-3 bg-rose-50 text-rose-800 text-xs font-bold rounded-xl border border-rose-200 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-rose-600" />
                    <span>{utrError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all"
                >
                  <span>Submit Deposit for Admin Approval</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            </div>
          )}

          {/* STEP 3: SUBMITTING */}
          {step === 'submitting' && (
            <div className="py-14 flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 size={36} className="text-emerald-500 animate-spin" />
              <div className="space-y-1">
                <h4 className="font-black text-base text-slate-900">Submitting to Admin</h4>
                <p className="text-xs font-medium text-slate-500 max-w-xs">
                  Recording your UTR receipt in the administrator verification queue...
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: SUBMITTED SUCCESS */}
          {step === 'submitted' && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="py-4 flex flex-col items-center text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 border-4 border-emerald-400 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200/50">
                <CheckCircle2 size={38} className="stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Payment Submitted for Verification
                </span>
                <h3 className="text-xl font-black text-slate-900">Request Pending Admin Approval</h3>
                <p className="text-xs font-medium text-slate-500 max-w-xs mx-auto">
                  Your deposit has been sent to the Admin Panel. As soon as Admin confirms receipt, <strong>+{totalCoins.toLocaleString()} coins</strong> will be added to your account!
                </p>
              </div>

              {/* Receipt Summary Card */}
              <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-500 font-bold">
                  <span>Package:</span>
                  <span className="font-black text-slate-900">{selectedPack.name}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 font-bold">
                  <span>Amount Paid:</span>
                  <span className="font-black text-slate-900">{selectedPack.priceFormatted}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 font-bold">
                  <span>Coins to Credit:</span>
                  <span className="font-black text-emerald-600">+{totalCoins.toLocaleString()} coins</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 font-bold">
                  <span>Admin UPI:</span>
                  <span className="font-mono font-bold text-slate-800">{ADMIN_UPI_ID}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 font-bold">
                  <span>Submitted UTR:</span>
                  <span className="font-mono font-black text-blue-600">{utrNumber}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 font-bold">
                  <span>Status:</span>
                  <span className="font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Pending Admin Approval
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 font-medium">
                You will receive a push notification the moment Admin approves your deposit.
              </p>

              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white py-3.5 rounded-2xl font-black text-sm shadow-md transition-all"
              >
                Done & Return to App
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
