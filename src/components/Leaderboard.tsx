import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { LeaderboardUser } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Crown, Medal, Flame, Sparkles, TrendingUp, ChevronUp, RefreshCw, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

// Seed benchmark creators to make leaderboard full & exciting from day 1
const DEFAULT_TOP_CREATORS: LeaderboardUser[] = [
  {
    uid: 'seed_creator_1',
    displayName: 'Aarav "Apex" Sharma',
    photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    coins: 48500,
    badge: 'Legendary',
    level: 'Lvl 48'
  },
  {
    uid: 'seed_creator_2',
    displayName: 'TechGuru Aryan',
    photoURL: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
    coins: 36200,
    badge: 'Diamond',
    level: 'Lvl 41'
  },
  {
    uid: 'seed_creator_3',
    displayName: 'Priya Daily Vlogs',
    photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    coins: 29800,
    badge: 'Master',
    level: 'Lvl 36'
  },
  {
    uid: 'seed_creator_4',
    displayName: 'Kunal Studio India',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    coins: 24150,
    badge: 'Elite Booster',
    level: 'Lvl 32'
  },
  {
    uid: 'seed_creator_5',
    displayName: 'Ananya Beats & Tunes',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    coins: 19400,
    badge: 'Pro Creator',
    level: 'Lvl 28'
  },
  {
    uid: 'seed_creator_6',
    displayName: 'Rohan Tech & Gaming',
    photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    coins: 16800,
    badge: 'Rising Star',
    level: 'Lvl 24'
  },
  {
    uid: 'seed_creator_7',
    displayName: 'Siddharth Codes',
    photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
    coins: 14250,
    badge: 'Gold Achiever',
    level: 'Lvl 22'
  },
  {
    uid: 'seed_creator_8',
    displayName: 'Meera Cooks & Lifestyle',
    photoURL: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    coins: 11900,
    badge: 'Booster',
    level: 'Lvl 19'
  },
  {
    uid: 'seed_creator_9',
    displayName: 'Devika Motion Hub',
    photoURL: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    coins: 9750,
    badge: 'Booster',
    level: 'Lvl 16'
  },
  {
    uid: 'seed_creator_10',
    displayName: 'Vikram Viral Shorts',
    photoURL: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80',
    coins: 7800,
    badge: 'Apprentice',
    level: 'Lvl 14'
  }
];

interface LeaderboardProps {
  onOpenStore?: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ onOpenStore }) => {
  const { user, profile } = useAuth();
  const [firestoreUsers, setFirestoreUsers] = useState<LeaderboardUser[]>([]);
  const [timeframe, setTimeframe] = useState<'all' | 'weekly' | 'today'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sync current user's profile to public leaderboard doc
  useEffect(() => {
    if (!user || !profile) return;
    const syncCurrentUser = async () => {
      try {
        const userRef = doc(db, 'leaderboard', user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          displayName: profile.displayName || user.displayName || 'You (Creator)',
          photoURL: profile.photoURL || user.photoURL || '',
          coins: profile.coins || 0,
          level: `Lvl ${Math.max(1, Math.floor((profile.coins || 0) / 500) + 1)}`,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn("Could not sync profile to leaderboard:", err);
      }
    };
    syncCurrentUser();
  }, [user, profile?.coins, profile?.displayName]);

  // Listen to Firestore leaderboard
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'leaderboard'), orderBy('coins', 'desc'), limit(15));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: LeaderboardUser[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          uid: data.uid || d.id,
          displayName: data.displayName || 'Anonymous Creator',
          photoURL: data.photoURL || '',
          coins: Number(data.coins) || 0,
          level: data.level || 'Lvl 1'
        };
      });
      setFirestoreUsers(docs);
      setLoading(false);
    }, (err) => {
      console.warn("Firestore leaderboard snapshot error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Merge Firestore users with default benchmarks, sorted by coins descending
  const top10 = useMemo(() => {
    const map = new Map<string, LeaderboardUser>();

    // 1. Benchmark items
    DEFAULT_TOP_CREATORS.forEach(item => {
      // Apply slight timeframe coefficient for gamification realism
      let multiplier = 1;
      if (timeframe === 'weekly') multiplier = 0.38;
      if (timeframe === 'today') multiplier = 0.08;

      map.set(item.uid, {
        ...item,
        coins: Math.round(item.coins * multiplier)
      });
    });

    // 2. Real Firestore items override / add
    firestoreUsers.forEach(item => {
      let multiplier = 1;
      if (timeframe === 'weekly') multiplier = 0.5;
      if (timeframe === 'today') multiplier = 0.2;

      map.set(item.uid, {
        ...item,
        coins: Math.round(item.coins * multiplier)
      });
    });

    // 3. Ensure current user is present
    if (user && profile) {
      const myCoins = timeframe === 'weekly' 
        ? Math.round((profile.coins || 0) * 0.5) 
        : timeframe === 'today' 
          ? Math.round((profile.coins || 0) * 0.2) 
          : (profile.coins || 0);

      map.set(user.uid, {
        uid: user.uid,
        displayName: profile.displayName || user.displayName || 'You',
        photoURL: profile.photoURL || user.photoURL || '',
        coins: myCoins,
        level: `Lvl ${Math.max(1, Math.floor(myCoins / 500) + 1)}`,
        badge: 'My Profile',
        isCurrentUser: true
      });
    }

    // Sort descending by coins
    const allSorted = Array.from(map.values()).sort((a, b) => b.coins - a.coins);

    // Assign rank
    return allSorted.slice(0, 10).map((u, index) => ({
      ...u,
      rank: index + 1,
      isCurrentUser: u.uid === user?.uid
    }));
  }, [firestoreUsers, timeframe, user, profile]);

  // Current user rank & metrics
  const currentUserRankInfo = useMemo(() => {
    if (!user || !profile) return null;
    const existingInTop10 = top10.find(u => u.uid === user.uid);
    if (existingInTop10) {
      return {
        rank: existingInTop10.rank || 1,
        inTop10: true,
        coins: existingInTop10.coins,
        coinsToNext: top10[Math.max(0, (existingInTop10.rank || 1) - 2)]?.coins - existingInTop10.coins || 0
      };
    }

    // Not in top 10
    const myCoins = timeframe === 'weekly' 
      ? Math.round((profile.coins || 0) * 0.5) 
      : timeframe === 'today' 
        ? Math.round((profile.coins || 0) * 0.2) 
        : (profile.coins || 0);

    const tenthCoins = top10[top10.length - 1]?.coins || 1000;
    const diff = Math.max(0, tenthCoins - myCoins + 50);

    return {
      rank: 10 + Math.max(1, Math.floor((tenthCoins - myCoins) / 450) + 1),
      inTop10: false,
      coins: myCoins,
      coinsToNext: diff
    };
  }, [top10, user, profile, timeframe]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  };

  const firstPlace = top10[0];
  const secondPlace = top10[1];
  const thirdPlace = top10[2];
  const runnersUp = top10.slice(3);

  return (
    <div className="space-y-5">
      {/* Header & Gamified Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-sm">
            <Trophy size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Global Leaderboard</h2>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400">Top 10 highest coin earners worldwide</p>
          </div>
        </div>

        <button
          onClick={handleManualRefresh}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors shadow-sm"
          title="Refresh rankings"
        >
          <RefreshCw size={15} className={cn(refreshing && "animate-spin text-emerald-600")} />
        </button>
      </div>

      {/* Segmented Timeframe Control */}
      <div className="bg-slate-200/70 p-1 rounded-2xl flex text-xs font-black">
        <button
          onClick={() => setTimeframe('all')}
          className={cn(
            "flex-1 py-1.5 rounded-xl transition-all duration-200 text-center",
            timeframe === 'all' 
              ? "bg-white text-slate-900 shadow-sm" 
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          All Time
        </button>
        <button
          onClick={() => setTimeframe('weekly')}
          className={cn(
            "flex-1 py-1.5 rounded-xl transition-all duration-200 text-center",
            timeframe === 'weekly' 
              ? "bg-white text-slate-900 shadow-sm" 
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          This Week
        </button>
        <button
          onClick={() => setTimeframe('today')}
          className={cn(
            "flex-1 py-1.5 rounded-xl transition-all duration-200 text-center",
            timeframe === 'today' 
              ? "bg-white text-slate-900 shadow-sm" 
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          Today
        </button>
      </div>

      {/* Podium Display (Top 3) */}
      <div className="relative pt-6 pb-2 px-2 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-3xl text-white shadow-xl overflow-hidden border border-slate-800">
        {/* Ambient Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 bg-amber-500/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-emerald-500/10 blur-2xl rounded-full pointer-events-none" />

        <div className="relative z-10 flex items-end justify-center gap-2 sm:gap-3 mb-2">
          {/* #2 Silver (Left) */}
          {secondPlace && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex-1 flex flex-col items-center max-w-[105px]"
            >
              <div className="relative mb-2">
                <div className="w-14 h-14 rounded-2xl p-0.5 bg-gradient-to-tr from-slate-400 to-slate-200 shadow-lg relative">
                  <img 
                    src={secondPlace.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${secondPlace.displayName}`} 
                    alt={secondPlace.displayName}
                    className="w-full h-full object-cover rounded-[14px] bg-slate-800"
                  />
                  <div className="absolute -bottom-2 -right-1 bg-slate-300 text-slate-900 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow">
                    2
                  </div>
                </div>
              </div>
              <div className="text-center w-full px-1">
                <p className="text-[11px] font-black truncate text-slate-200">{secondPlace.displayName.split(' ')[0]}</p>
                <div className="inline-flex items-center gap-1 text-[10px] font-black text-slate-300 mt-0.5 bg-white/10 px-2 py-0.5 rounded-lg">
                  <Sparkles size={9} className="text-slate-300" />
                  <span>{secondPlace.coins.toLocaleString()}</span>
                </div>
              </div>
              <div className="w-full h-16 mt-2 bg-gradient-to-t from-slate-800/90 to-slate-700/60 rounded-t-2xl flex flex-col items-center justify-center border-t border-slate-600/50 shadow-inner">
                <Medal size={16} className="text-slate-300 mb-0.5" />
                <span className="text-[9px] font-black tracking-widest text-slate-300 uppercase">2nd</span>
              </div>
            </motion.div>
          )}

          {/* #1 Gold (Center, Elevated) */}
          {firstPlace && (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              className="flex-1 flex flex-col items-center max-w-[125px] -mt-5"
            >
              <div className="relative mb-2">
                {/* Crown */}
                <motion.div 
                  animate={{ y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="absolute -top-6 left-1/2 -translate-x-1/2 text-amber-400 filter drop-shadow-[0_2px_8px_rgba(251,191,36,0.8)]"
                >
                  <Crown size={24} className="fill-amber-400 stroke-amber-200" />
                </motion.div>
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-3xl p-1 bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.4)] relative">
                  <img 
                    src={firstPlace.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${firstPlace.displayName}`} 
                    alt={firstPlace.displayName}
                    className="w-full h-full object-cover rounded-[20px] bg-slate-800"
                  />
                  <div className="absolute -bottom-2 -right-1 bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 font-black text-xs w-6 h-6 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg">
                    1
                  </div>
                </div>
              </div>
              <div className="text-center w-full px-1">
                <p className="text-xs font-black truncate text-amber-200">{firstPlace.displayName}</p>
                <div className="inline-flex items-center gap-1 text-[11px] font-black text-amber-300 mt-0.5 bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-lg shadow-sm">
                  <Flame size={11} className="fill-amber-400 text-amber-400" />
                  <span>{firstPlace.coins.toLocaleString()}</span>
                </div>
              </div>
              <div className="w-full h-24 mt-2 bg-gradient-to-t from-amber-950/80 via-amber-900/50 to-amber-700/60 rounded-t-2xl flex flex-col items-center justify-center border-t border-amber-400/50 shadow-[0_-4px_15px_rgba(245,158,11,0.2)]">
                <Trophy size={20} className="text-amber-400 mb-0.5" />
                <span className="text-[10px] font-black tracking-widest text-amber-300 uppercase">Champion</span>
              </div>
            </motion.div>
          )}

          {/* #3 Bronze (Right) */}
          {thirdPlace && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex-1 flex flex-col items-center max-w-[105px]"
            >
              <div className="relative mb-2">
                <div className="w-14 h-14 rounded-2xl p-0.5 bg-gradient-to-tr from-amber-700 to-amber-500 shadow-lg relative">
                  <img 
                    src={thirdPlace.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${thirdPlace.displayName}`} 
                    alt={thirdPlace.displayName}
                    className="w-full h-full object-cover rounded-[14px] bg-slate-800"
                  />
                  <div className="absolute -bottom-2 -right-1 bg-amber-700 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow">
                    3
                  </div>
                </div>
              </div>
              <div className="text-center w-full px-1">
                <p className="text-[11px] font-black truncate text-slate-200">{thirdPlace.displayName.split(' ')[0]}</p>
                <div className="inline-flex items-center gap-1 text-[10px] font-black text-amber-400 mt-0.5 bg-white/10 px-2 py-0.5 rounded-lg">
                  <Sparkles size={9} className="text-amber-400" />
                  <span>{thirdPlace.coins.toLocaleString()}</span>
                </div>
              </div>
              <div className="w-full h-12 mt-2 bg-gradient-to-t from-slate-800/90 to-amber-950/40 rounded-t-2xl flex flex-col items-center justify-center border-t border-amber-800/50 shadow-inner">
                <Medal size={15} className="text-amber-600 mb-0.5" />
                <span className="text-[9px] font-black tracking-widest text-amber-500 uppercase">3rd</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Ranks 4 to 10 List */}
      <div className="bg-white rounded-3xl p-3 shadow-sm border border-slate-100 space-y-1.5">
        <div className="px-3 py-2 flex items-center justify-between text-[11px] font-black uppercase text-slate-400 tracking-wider">
          <span>Rank & Creator</span>
          <span>Earned Coins</span>
        </div>

        {runnersUp.map((creator) => {
          const isMe = creator.uid === user?.uid;
          return (
            <motion.div
              key={creator.uid}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex items-center justify-between p-3 rounded-2xl transition-all",
                isMe 
                  ? "bg-emerald-50 border-2 border-emerald-400 shadow-sm" 
                  : "bg-slate-50/70 hover:bg-slate-100/80 border border-slate-100"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Rank Number */}
                <div className={cn(
                  "w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shrink-0",
                  isMe ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                )}>
                  #{creator.rank}
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-200 shadow-sm">
                  <img 
                    src={creator.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${creator.displayName}`} 
                    alt={creator.displayName} 
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Name & Badge */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn(
                      "text-xs font-black truncate max-w-[130px] sm:max-w-[160px]",
                      isMe ? "text-emerald-950 font-extrabold" : "text-slate-800"
                    )}>
                      {creator.displayName}
                    </p>
                    {isMe && (
                      <span className="bg-emerald-600 text-white text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md tracking-tighter">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-0.5">
                    <span>{creator.level || 'Lvl 1'}</span>
                    <span>•</span>
                    <span className="text-slate-500 font-semibold">{creator.badge || 'Booster'}</span>
                  </div>
                </div>
              </div>

              {/* Coins Counter */}
              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-1.5 font-black text-sm text-slate-900">
                  <span className="tabular-nums">{creator.coins.toLocaleString()}</span>
                  <div className="w-5 h-5 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center">
                    <Flame size={12} className="fill-amber-500 text-amber-500" />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* "Your Rank" Sticky Gamification Banner */}
      {currentUserRankInfo && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-lg shadow-emerald-900/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex flex-col items-center justify-center">
              <span className="text-[9px] uppercase font-black text-emerald-200">Rank</span>
              <span className="text-sm font-black leading-none text-white">#{currentUserRankInfo.rank}</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-black text-white">
                  {currentUserRankInfo.inTop10 ? "You're in the Top 10!" : "Climb the Leaderboard"}
                </h4>
                <Zap size={12} className="fill-yellow-300 text-yellow-300" />
              </div>
              <p className="text-[10px] font-medium text-emerald-100">
                {currentUserRankInfo.inTop10 
                  ? `${currentUserRankInfo.coins.toLocaleString()} coins • Keep earning to defend your spot!`
                  : `${currentUserRankInfo.coinsToNext.toLocaleString()} coins needed to rank higher`}
              </p>
            </div>
          </div>

          {onOpenStore && (
            <button
              onClick={onOpenStore}
              className="bg-white text-emerald-800 text-[11px] font-black px-3.5 py-2 rounded-xl shadow-md hover:bg-emerald-50 active:scale-95 transition-all flex items-center gap-1 shrink-0"
            >
              <TrendingUp size={13} className="text-emerald-600" />
              <span>Boost Rank</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
