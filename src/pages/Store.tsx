import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Coins, Ticket, Star, ShieldCheck, Gamepad2, ArrowRight, Zap, CreditCard, Sparkles, Crown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, increment, collection, addDoc } from 'firebase/firestore';
import { PaymentModal, COIN_PACKS } from '../components/PaymentModal';
import { CoinPack } from '../types';

export const Store: React.FC = () => {
  const { user } = useAuth();
  const [selectedPackId, setSelectedPackId] = useState<string>('pro');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedPack = COIN_PACKS.find(p => p.id === selectedPackId) || COIN_PACKS[1];

  const handleBuyNow = (packId: string) => {
    setSelectedPackId(packId);
    setIsPaymentOpen(true);
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim() || !user) return;
    setLoading(true);
    
    // Support codes like RED10, RED50, RED100, VBOOST50, PLAY100 etc.
    const match = redeemCode.trim().match(/^(RED|VBOOST|PLAY)(\d+)$/i);
    if (match) {
      const amount = parseInt(match[2], 10);
      if (amount >= 10 && amount <= 1000) {
        const coinsToAdd = amount * 10;
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            coins: increment(coinsToAdd)
          });
          await addDoc(collection(db, 'users', user.uid, 'transactions'), {
            userId: user.uid,
            amount: coinsToAdd,
            type: 'bonus',
            description: `Gift Code Redeemed (${redeemCode.toUpperCase()})`,
            redeemCode: redeemCode.toUpperCase(),
            createdAt: new Date().toISOString()
          });
          alert(`Successfully redeemed ₹${amount} worth of coins! (+${coinsToAdd.toLocaleString()} coins added)`);
          setRedeemCode('');
          setLoading(false);
          return;
        } catch (err) {
          console.error(err);
          alert("Failed to redeem code. Please try again.");
          setLoading(false);
          return;
        }
      }
    }
    
    alert("Invalid or expired redeem code. Example valid format: RED50, VBOOST100");
    setRedeemCode('');
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 rounded-3xl p-6 text-white shadow-xl overflow-hidden relative">
        <div className="relative z-10 max-w-[260px]">
          <span className="bg-white/20 backdrop-blur-sm text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-block mb-2">
            Secure Payment Gateway
          </span>
          <h2 className="text-2xl font-black mb-1">Get More Coins</h2>
          <p className="text-emerald-100 text-xs font-medium opacity-90 leading-relaxed">
            Boost video views faster. Instant UPI, GPay, Paytm & Card settlement.
          </p>
        </div>
        <Coins className="absolute -bottom-6 -right-6 w-32 h-32 text-white/10 rotate-12 pointer-events-none" />
        <ShieldCheck className="absolute top-4 right-4 w-10 h-10 text-white/10 pointer-events-none" />
      </div>

      {/* Package List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pl-1">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Coin Packages</h3>
          <span className="text-[10px] font-bold text-emerald-600">Tap to buy instantly</span>
        </div>

        <div className="grid gap-2.5">
          {COIN_PACKS.map((pack) => {
            const isSelected = selectedPackId === pack.id;
            const total = pack.coins + (pack.bonusCoins || 0);
            const isLakh = pack.id === 'lakh';

            return (
              <motion.div
                key={pack.id}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedPackId(pack.id)}
                className={cn(
                  "relative flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer",
                  isSelected 
                    ? "bg-emerald-50/80 border-emerald-500 shadow-sm" 
                    : isLakh
                      ? "bg-gradient-to-r from-amber-50/50 via-yellow-50/30 to-white border-amber-300 shadow-sm hover:border-amber-400"
                      : "bg-white border-slate-100 shadow-sm hover:border-emerald-200"
                )}
              >
                {pack.badge && (
                  <div className={cn(
                    "absolute -top-2 right-4 text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1",
                    pack.popular 
                      ? "bg-amber-500 text-white" 
                      : isLakh
                        ? "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 font-black shadow-amber-200"
                        : "bg-slate-800 text-white"
                  )}>
                    {isLakh && <Crown size={10} className="fill-slate-950" />}
                    <span>{pack.badge}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-3.5">
                  <div className={cn(
                    "p-3 rounded-2xl transition-colors",
                    isSelected 
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-200" 
                      : isLakh
                        ? "bg-amber-500 text-white shadow-md shadow-amber-200"
                        : "bg-slate-100 text-slate-500"
                  )}>
                    {isLakh ? <Crown className="w-5 h-5 fill-white" /> : <Coins className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-black text-slate-900 text-sm">{total.toLocaleString()} Coins</h4>
                      {pack.bonusCoins ? (
                        <span className={cn(
                          "text-[9px] font-black uppercase px-1.5 py-0.2 rounded font-bold",
                          isLakh ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"
                        )}>
                          +{pack.bonusCoins.toLocaleString()} FREE
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs font-bold text-slate-400">{pack.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-black text-emerald-700 text-base">{pack.priceFormatted}</div>
                    <div className="text-[9px] font-bold text-slate-400">One-time</div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuyNow(pack.id);
                    }}
                    className={cn(
                      "px-3.5 py-2 rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1",
                      isSelected
                        ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    )}
                  >
                    <span>Pay</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Selected Pack Action Button */}
        <button
          type="button"
          onClick={() => setIsPaymentOpen(true)}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] mt-2"
        >
          <CreditCard size={16} className="text-emerald-400" />
          <span>Pay with UPI / Cards for {selectedPack.name} ({selectedPack.priceFormatted})</span>
        </button>
      </div>

      {/* Google Play Redeem Option */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Ticket className="text-yellow-400" />
          </div>
          <div>
            <h3 className="font-black">Google Play Redeem</h3>
            <p className="text-xs font-bold text-slate-400">Unlock coins with your gift card codes.</p>
          </div>
        </div>

        <div className="relative group">
          <input 
            type="text" 
            placeholder="Enter Redeem Code..." 
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
            className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-600 text-white"
          />
          <button 
            onClick={handleRedeem}
            className="absolute right-2 top-2 bottom-2 bg-emerald-600 hover:bg-emerald-500 px-4 rounded-xl transition-colors flex items-center justify-center text-white"
          >
            <ArrowRight size={20} />
          </button>
        </div>
        
        <p className="mt-3 text-[10px] text-slate-500 text-center font-medium">
          Note: Redeem codes are typically 16 or 20 characters long.
        </p>
      </div>

      {/* Footer Info */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="text-emerald-600 shrink-0" size={22} />
        <div>
          <h4 className="text-xs font-black text-emerald-800">Bank-Grade Payment Security</h4>
          <p className="text-[10px] font-medium text-emerald-700 leading-relaxed">
            All purchases are processed through encrypted gateways compliant with RBI and NPCI standards. Coins are added to your balance in real-time.
          </p>
        </div>
      </div>

      {/* Payment Gateway Modal */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        initialPackId={selectedPackId}
      />
    </div>
  );
};

