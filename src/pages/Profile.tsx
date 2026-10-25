import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, auth } from '../lib/firebase';
import { 
  Coins, 
  LogOut, 
  Share2, 
  Award, 
  History, 
  TrendingUp, 
  User as UserIcon, 
  Wand2,
  CheckCircle, 
  Copy, 
  Mail,
  ArrowRight,
  Gift,
  Ticket,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Clock
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { AIStudioOutput, Transaction } from '../types';
import { cn } from '../lib/utils';
import { TransactionHistory } from '../components/TransactionHistory';

interface ProfileProps {
  onNavigateTab?: (tab: string) => void;
}

export const Profile: React.FC<ProfileProps> = ({ onNavigateTab }) => {
  const { user, profile } = useAuth();
  const [currentView, setCurrentView] = useState<'profile' | 'history'>('profile');
  const [outputs, setOutputs] = useState<AIStudioOutput[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.email === 'sanjuladubey05@gmail.com';

  useEffect(() => {
    if (!user) return;
    
    // 1. Outputs
    const qOutputs = query(
      collection(db, 'users', user.uid, 'ai_outputs'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubscribeOutputs = onSnapshot(qOutputs, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AIStudioOutput));
      setOutputs(data);
      setLoading(false);
    });

    // 2. Recent Transactions for overview snippet
    const qTx = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setRecentTransactions(txData);
    });

    // 3. Admin redemptions
    let unsubscribeRedemptions: any = null;
    if (isAdmin) {
      const qRedemptions = query(
        collection(db, 'redemptions'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      unsubscribeRedemptions = onSnapshot(qRedemptions, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRedemptions(data);
      });
    }

    return () => {
      unsubscribeOutputs();
      unsubscribeTx();
      if (unsubscribeRedemptions) unsubscribeRedemptions();
    };
  }, [user, isAdmin]);

  const handleMarkFulfilled = async (id: string) => {
    try {
      await updateDoc(doc(db, 'redemptions', id), { status: 'fulfilled' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    auth.signOut();
  };

  const handleShare = () => {
    if (profile?.referralCode) {
      const shareUrl = `${window.location.origin}?ref=${profile.referralCode}`;
      navigator.share?.({
        title: 'Join ViewBoost',
        text: `Use my referral code ${profile.referralCode} to get free coins!`,
        url: shareUrl
      }).catch(() => {
        navigator.clipboard.writeText(shareUrl);
        alert("Referral link copied to clipboard!");
      });
    }
  };

  if (currentView === 'history') {
    return (
      <TransactionHistory 
        onBack={() => setCurrentView('profile')} 
        onNavigateEarn={() => onNavigateTab?.('play')}
      />
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Profile Card */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px]" />
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-[2rem] blur opacity-25 group-hover:opacity-100 transition duration-1000" />
            <div className="relative w-24 h-24 rounded-[2rem] overflow-hidden border-2 border-white/20 shadow-2xl">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center text-3xl font-black">
                  {profile?.displayName?.[0] || 'U'}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-1">
            <h2 className="text-2xl font-black italic tracking-tighter">{profile?.displayName || 'Creator'}</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{profile?.email}</p>
          </div>

          <div className="grid grid-cols-2 w-full gap-4 mt-8">
            {/* Clickable Balance Card to open History */}
            <div 
              onClick={() => setCurrentView('history')}
              className="bg-white/5 rounded-3xl p-4 border border-white/10 cursor-pointer hover:bg-white/10 active:scale-95 transition-all text-center group"
              title="Click to view full transaction history"
            >
              <div className="flex items-center justify-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                <span>Coin Balance</span>
                <ChevronRight size={10} className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-center justify-center gap-1.5 text-emerald-400">
                <Coins size={14} className="fill-emerald-400" />
                <span className="font-black text-xl tabular-nums">{profile?.coins?.toLocaleString() || 0}</span>
              </div>
              <span className="text-[7px] font-black text-emerald-400/80 uppercase tracking-widest block mt-0.5">
                View Ledger
              </span>
            </div>

            <div 
              className="bg-white/5 rounded-3xl p-4 border border-white/10 cursor-pointer hover:bg-white/10 active:scale-95 transition-transform" 
              onClick={() => {
                navigator.clipboard.writeText(profile?.referralCode || '');
                alert("Referral code copied to clipboard!");
              }}
            >
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Referral ID</p>
              <div className="text-white font-black text-xl tracking-widest flex items-center justify-center gap-2">
                {profile?.referralCode || '---'}
              </div>
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block text-center mt-0.5">
                Tap to copy
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Panel */}
      {isAdmin && (
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 px-2">
             <Award size={16} className="text-emerald-500" />
             Redemption Requests (Admin Only)
          </h3>
          <div className="space-y-2">
            {redemptions.map((req) => (
              <div key={req.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center justify-between group">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-800 text-sm">{req.productTitle}</span>
                    <span className={cn(
                      "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                      req.status === 'pending' ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"
                    )}>
                      {req.status}
                    </span>
                  </div>
                  {req.redeemCode && (
                    <div className="text-[10px] font-mono font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md inline-block">
                      Code: {req.redeemCode}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-400">
                    <Mail size={10} />
                    <span className="text-[10px] font-bold">{req.userEmail}</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(req.userEmail);
                        alert("Email copied!");
                      }}
                      className="text-emerald-600 hover:scale-110 transition-transform"
                    >
                      <Copy size={10} />
                    </button>
                  </div>
                  <p className="text-[8px] text-slate-400 tabular-nums">
                    {new Date(req.createdAt).toLocaleString()} • {req.amount} Coins
                  </p>
                </div>
                {req.status === 'pending' && (
                  <button 
                    onClick={() => handleMarkFulfilled(req.id)}
                    className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                    title="Mark as Fulfilled"
                  >
                    <CheckCircle size={18} />
                  </button>
                )}
              </div>
            ))}
            {redemptions.length === 0 && (
              <div className="py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 italic text-slate-400 text-xs">
                No requests found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={handleShare}
          className="bg-emerald-500 text-white p-5 rounded-[2rem] font-black text-xs flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 border-b-4 border-emerald-700 active:translate-y-1 active:border-b-0 uppercase tracking-widest transition-all"
        >
          <Share2 size={18} /> Invite
        </button>
        <button 
          onClick={() => setCurrentView('history')}
          className="bg-slate-900 text-white p-5 rounded-[2rem] font-black text-xs flex items-center justify-center gap-3 shadow-xl border-b-4 border-slate-950 active:translate-y-1 active:border-b-0 uppercase tracking-widest transition-all"
        >
          <History size={18} /> Ledger
        </button>
      </div>

      {/* Recent Activity Highlight Card */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-xl">
              <History size={16} />
            </div>
            <h3 className="font-black text-xs text-slate-800 uppercase tracking-wider">
              Recent Transactions
            </h3>
          </div>
          <button 
            onClick={() => setCurrentView('history')}
            className="text-[10px] font-black text-blue-600 hover:text-blue-800 flex items-center gap-1 uppercase tracking-wider"
          >
            <span>View All</span>
            <ChevronRight size={12} />
          </button>
        </div>

        {recentTransactions.length > 0 ? (
          <div className="space-y-2 pt-1">
            {recentTransactions.map((tx) => {
              const isPositive = tx.amount > 0;
              const isRedeem = tx.redeemCode || (tx.description && tx.description.toLowerCase().includes('redeem'));
              
              return (
                <div 
                  key={tx.id}
                  onClick={() => setCurrentView('history')}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 hover:bg-slate-100/80 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black",
                      isRedeem ? "bg-rose-100 text-rose-600" : (isPositive ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-600")
                    )}>
                      {isRedeem ? <Ticket size={14} /> : (isPositive ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">
                        {tx.description}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400">
                        {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {new Date(tx.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className={cn(
                    "text-right shrink-0 font-black text-xs tabular-nums flex items-center gap-1",
                    isPositive ? "text-emerald-600" : "text-rose-600"
                  )}>
                    <span>{isPositive ? '+' : ''}{tx.amount.toLocaleString()}</span>
                    <Coins size={10} className={isPositive ? "fill-emerald-600" : "fill-rose-600"} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-slate-400 text-xs font-bold">
            No transactions yet. Complete tasks or claim rewards to get coins!
          </div>
        )}
      </div>

      {/* Menu List */}
      <div className="bg-white rounded-3xl p-2 shadow-sm border border-slate-100">
        <button 
          onClick={() => setCurrentView('history')}
          className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors group"
        >
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
            <History size={20} />
          </div>
          <div className="flex-1 text-left">
            <span className="font-black text-sm text-slate-700 block">Transaction History</span>
            <span className="text-[10px] font-bold text-slate-400 block">Earnings, redeem codes & timestamps</span>
          </div>
          <ChevronRight size={18} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
        </button>

        <button 
          onClick={() => {
            alert(`Your referral code is ${profile?.referralCode || 'N/A'}. Share it to earn 50 bonus coins for every friend who joins!`);
          }}
          className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors group"
        >
          <div className="p-2 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
            <TrendingUp size={20} />
          </div>
          <div className="flex-1 text-left">
            <span className="font-black text-sm text-slate-700 block">Referral Network</span>
            <span className="text-[10px] font-bold text-slate-400 block">Earn bonuses for invites</span>
          </div>
          <ChevronRight size={18} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
        </button>

        {isAdmin && (
          <>
            <div className="h-px bg-slate-100 mx-4 my-1" />
            <button 
              onClick={() => onNavigateTab?.('admin')}
              className="w-full flex items-center gap-4 p-4 hover:bg-emerald-50 rounded-2xl transition-colors group text-emerald-800"
            >
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl group-hover:scale-110 transition-transform">
                <Award size={20} />
              </div>
              <div className="flex-1 text-left">
                <span className="font-black text-sm text-slate-800 block">Admin Cashout Panel</span>
                <span className="text-[10px] font-bold text-emerald-600 block">Review UPI cashouts & refund coins</span>
              </div>
              <ChevronRight size={18} className="text-emerald-500 group-hover:translate-x-1 transition-transform" />
            </button>
          </>
        )}

        <div className="h-px bg-slate-100 mx-4 my-1" />

        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-4 p-4 hover:bg-red-50 rounded-2xl transition-colors text-red-600 group"
        >
          <div className="p-2 bg-red-50 text-red-600 rounded-xl group-hover:scale-110 transition-transform">
            <LogOut size={20} />
          </div>
          <span className="font-black text-sm flex-1 text-left">Log Out</span>
        </button>
      </div>

      {/* AI Creations History */}
      <div className="space-y-4">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 px-2">
           <Wand2 size={16} className="text-purple-500" />
           Studio History
        </h3>
        <div className="grid grid-cols-2 gap-3">
           {outputs.map((out) => (
             <div key={out.id} className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm space-y-2 overflow-hidden">
                {out.type === 'script' ? (
                  <div className="text-[8px] font-medium text-slate-500 line-clamp-4 bg-slate-50 p-2 rounded-lg">
                    {out.result}
                  </div>
                ) : out.type === 'image' ? (
                  <img src={out.result} className="w-full h-20 object-cover rounded-lg" alt="Thumbnail" />
                ) : (
                  <div className="h-20 bg-slate-900 rounded-lg flex items-center justify-center text-white text-[8px] font-black uppercase">
                    Video Content
                  </div>
                )}
                <div className="flex items-center justify-between">
                   <span className="text-[7px] font-black uppercase text-slate-400">{out.type}</span>
                   <button 
                    onClick={() => {
                      if (out.type === 'script') navigator.clipboard.writeText(out.result);
                      else alert("Opening content...");
                    }}
                    className="text-[7px] font-black text-emerald-600 uppercase"
                   >
                     View
                   </button>
                </div>
             </div>
           ))}
           {outputs.length === 0 && !loading && (
             <div className="col-span-2 py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 opacity-50">
                <p className="text-[10px] font-black text-slate-400">No creations yet</p>
             </div>
           )}
        </div>
      </div>

      <div className="text-center opacity-30 pt-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ViewBoost v1.0.0</p>
      </div>
    </div>
  );
};
