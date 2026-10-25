import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, addDoc, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Campaign, CampaignStatus } from '../types';
import { VideoCard } from '../components/VideoCard';
import { AdBanner } from '../components/AdBanner';
import { Leaderboard } from '../components/Leaderboard';
import { PaymentModal } from '../components/PaymentModal';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { CreateCampaignModal } from '../components/CreateCampaignModal';
import { 
  ShieldCheck, Loader2, PlayCircle, Clock, CheckCircle2, 
  Coins, Trophy, Sparkles, CreditCard, Flame, ChevronRight, Plus, ExternalLink, X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { sendAppNotification } from '../lib/notifications';

export const Home: React.FC = () => {
  const { profile, user } = useAuth();
  const [homeView, setHomeView] = useState<'watch' | 'leaderboard'>('watch');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Campaign | null>(null);
  const [timer, setTimer] = useState(0);
  const [status, setStatus] = useState<'idle' | 'watching' | 'waiting' | 'done'>('idle');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentPackId, setPaymentPackId] = useState<string>('pro');
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'campaigns'),
      where('status', '==', CampaignStatus.ACTIVE),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
      // Filter out user's own campaigns
      const filtered = data.filter(c => c.ownerId !== user?.uid);
      // Sort: Boosted first
      const sorted = [...filtered].sort((a, b) => {
        const aBoost = (a as any).isBoosted ? 1 : 0;
        const bBoost = (b as any).isBoosted ? 1 : 0;
        return bBoost - aBoost;
      });
      setCampaigns(sorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    let interval: any;
    if (status === 'watching' && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    } else if (timer === 0 && status === 'watching') {
      setStatus('done');
    }
    return () => clearInterval(interval);
  }, [status, timer]);

  const getCampaignUrl = (campaign: Campaign) => {
    if (campaign.targetUrl && campaign.targetUrl.trim()) {
      return campaign.targetUrl.trim();
    }
    if (campaign.videoId) {
      return `https://www.youtube.com/watch?v=${campaign.videoId}`;
    }
    return 'https://youtube.com';
  };

  const startWatching = (campaign: Campaign) => {
    setActiveTask(campaign);
    setTimer(35); // 35s in-app engagement timer
    setStatus('watching');
    
    const url = getCampaignUrl(campaign);
    // Open in background/new tab if user prefers, but in-app framed timer stays active
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // Ignore popup blocker if in iframe
    }
  };

  const claimReward = async () => {
    if (!activeTask || !user || !profile) return;

    try {
      // 1. Record view
      await addDoc(collection(db, 'users', user.uid, 'views'), {
        campaignId: activeTask.id,
        rewardClaimed: activeTask.rewardPerView,
        timestamp: new Date().toISOString()
      });

      // 2. Increment campaign views & check goal
      const nextViews = (activeTask.currentViews || 0) + 1;
      const isCompleted = nextViews >= activeTask.targetViews;

      await updateDoc(doc(db, 'campaigns', activeTask.id), {
        currentViews: increment(1),
        ...(isCompleted ? { status: 'completed' } : {})
      });

      // 3. Notify creator if goal reached
      if (isCompleted && activeTask.ownerId) {
        await sendAppNotification({
          userId: activeTask.ownerId,
          title: '🎯 Campaign Goal Reached!',
          body: `Your campaign "${activeTask.videoTitle}" reached its goal of ${activeTask.targetViews} views!`,
          type: 'campaign_goal',
          referenceId: activeTask.id
        });
      }

      // 4. Update viewer balance
      await updateDoc(doc(db, 'users', user.uid), {
        coins: increment(activeTask.rewardPerView)
      });

      // 5. Record transaction
      await addDoc(collection(db, 'users', user.uid, 'transactions'), {
        userId: user.uid,
        amount: activeTask.rewardPerView,
        type: 'earn',
        description: `Watched ${activeTask.platform || 'video'}: ${activeTask.videoTitle}`,
        createdAt: new Date().toISOString()
      });

      setStatus('idle');
      setActiveTask(null);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to claim reward. Please try again.");
    }
  };

  const openPaymentWithPack = (packId: string = 'pro') => {
    setPaymentPackId(packId);
    setIsPaymentOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="text-slate-400 font-bold text-sm">Finding videos for you...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* In-App Framed Engagement Task Runner */}
      <AnimatePresence>
        {status !== 'idle' && activeTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            >
              {/* Task Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border",
                    activeTask.platform === 'instagram' ? "bg-pink-500/20 text-pink-300 border-pink-500/30" :
                    activeTask.platform === 'facebook' ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
                    activeTask.platform === 'other' ? "bg-purple-500/20 text-purple-300 border-purple-500/30" :
                    "bg-red-500/20 text-red-300 border-red-500/30"
                  )}>
                    {activeTask.platform || 'youtube'}
                  </span>
                  <span className="text-xs font-bold text-slate-300 truncate max-w-[150px]">
                    {activeTask.videoTitle}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setStatus('idle');
                    setActiveTask(null);
                  }}
                  className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* In-App Framed Preview / Player */}
              <div className="relative bg-slate-950 aspect-video w-full flex items-center justify-center overflow-hidden">
                {activeTask.platform === 'youtube' && activeTask.videoId && activeTask.videoId !== 'multi_platform' ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${activeTask.videoId}?autoplay=1&playsinline=1`}
                    title={activeTask.videoTitle}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="p-4 text-center space-y-2">
                    <span className="text-xs font-black text-white uppercase tracking-wider block">
                      {activeTask.platform?.toUpperCase()} Content Viewer
                    </span>
                    <p className="text-[11px] text-slate-300 line-clamp-2 px-2 font-medium">
                      {activeTask.videoTitle}
                    </p>
                    <a
                      href={getCampaignUrl(activeTask)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-black hover:bg-emerald-600 transition-all shadow-md"
                    >
                      <span>Open {activeTask.platform} Post</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                {/* Live Countdown Badge */}
                <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 flex items-center gap-1.5 text-white text-xs font-black">
                  {status === 'watching' ? (
                    <>
                      <Clock size={12} className="text-emerald-400 animate-spin" />
                      <span>{timer}s</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      <span>Ready</span>
                    </>
                  )}
                </div>
              </div>

              {/* Engagement Status & Action */}
              <div className="p-5 text-center space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-black text-slate-900">
                    <Coins size={16} className="text-amber-500 fill-amber-500" />
                    <span>Reward: +{activeTask.rewardPerView} Coins</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {status === 'watching'
                      ? `Please engage for ${timer} more seconds to verify completion.`
                      : 'Verification complete! Tap below to claim your coins.'}
                  </p>
                </div>

                {/* Progress Indicator */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${Math.min(100, ((35 - timer) / 35) * 100)}%` }}
                  />
                </div>

                {status === 'done' ? (
                  <button
                    onClick={claimReward}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle2 size={18} />
                    <span>Claim {activeTask.rewardPerView} Coins Now</span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <a
                      href={getCampaignUrl(activeTask)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-xl flex items-center justify-center gap-1 transition-all"
                    >
                      <ExternalLink size={12} />
                      <span>Open Link</span>
                    </a>
                    <button
                      onClick={() => {
                        setStatus('idle');
                        setActiveTask(null);
                      }}
                      className="py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-xs rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Home Header with Switcher & Small '+' Add Campaign Button */}
      <div className="flex items-center gap-2">
        <div className="bg-slate-200/80 p-1.5 rounded-2xl flex text-xs font-black flex-1">
          <button
            onClick={() => setHomeView('watch')}
            className={cn(
              "flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200",
              homeView === 'watch'
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <PlayCircle size={15} className={homeView === 'watch' ? "text-emerald-600" : ""} />
            <span>Earn from Watch</span>
          </button>

          <button
            onClick={() => setHomeView('leaderboard')}
            className={cn(
              "flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200",
              homeView === 'leaderboard'
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Trophy size={15} className={homeView === 'leaderboard' ? "text-amber-500" : ""} />
            <span>Leaderboard</span>
          </button>
        </div>

        {/* Small '+' Icon to Add Campaign */}
        <button
          onClick={() => setIsCreateCampaignOpen(true)}
          className="p-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all shrink-0"
          title="Create Multi-Platform Campaign (YouTube, Instagram, Facebook, Other)"
        >
          <Plus size={18} className="stroke-[3]" />
        </button>
      </div>

      {/* Instant Coin Purchase Banner (Payment Gateway Shortcut) */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 rounded-3xl p-4 text-white shadow-lg relative overflow-hidden flex items-center justify-between">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 backdrop-blur-sm text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
              Instant Gateway
            </span>
            <span className="text-[10px] text-emerald-200 font-bold">UPI • Cards • NetBanking</span>
          </div>
          <h3 className="text-sm font-black text-white">Need Coins to Boost Videos?</h3>
          <p className="text-[11px] text-emerald-100 font-medium">Get 1,500 Coins for ₹95 with instant delivery</p>
        </div>

        <button
          onClick={() => openPaymentWithPack('pro')}
          className="relative z-10 bg-white text-emerald-800 text-xs font-black px-4 py-2.5 rounded-2xl shadow-md hover:bg-emerald-50 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
        >
          <CreditCard size={14} className="text-emerald-600" />
          <span>Buy Coins</span>
        </button>

        <Coins className="absolute -bottom-6 -right-6 w-28 h-28 text-white/10 rotate-12 pointer-events-none" />
      </div>

      {/* VIEW 1: GLOBAL LEADERBOARD */}
      {homeView === 'leaderboard' && (
        <motion.div
          key="leaderboard-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <Leaderboard onOpenStore={() => openPaymentWithPack('pro')} />
        </motion.div>
      )}

      {/* VIEW 2: WATCH & EARN */}
      {homeView === 'watch' && (
        <motion.div
          key="watch-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-4"
        >
          {/* Quick Leaderboard Mini-Preview Bar */}
          <button
            onClick={() => setHomeView('leaderboard')}
            className="w-full bg-white rounded-2xl p-3 shadow-sm border border-slate-100 hover:border-amber-300 transition-all flex items-center justify-between text-left group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <Trophy size={16} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-800">Top 10 Global Leaderboard</span>
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                    Live
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">See where you rank against top creators</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400 group-hover:text-amber-600 transition-colors">
              <span className="text-[11px] font-black">View</span>
              <ChevronRight size={14} />
            </div>
          </button>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
            <ShieldCheck className="text-emerald-600" size={24} />
            <div>
              <h4 className="text-xs font-black text-slate-800">Verified System</h4>
              <p className="text-[10px] font-bold text-slate-400">Coins are added only after full watch time.</p>
            </div>
          </div>

          <AdBanner slot="7788990011" />

          <div className="space-y-1">
            <h2 className="text-xl font-black text-slate-800">Earn from Watch</h2>
            <p className="text-xs font-bold text-slate-400">Click on any video to start earning tokens instantly.</p>
          </div>

          <div className="pb-4 grid grid-cols-1 gap-4">
            {campaigns.length > 0 ? (
              campaigns.map(c => (
                <div key={c.id} className="relative group">
                  <VideoCard campaign={c} onWatch={startWatching} />
                  <div className="absolute top-4 right-4 pointer-events-none">
                     <div className="bg-emerald-500 text-white px-3 py-1.5 rounded-xl font-black text-[10px] flex items-center gap-1.5 shadow-lg shadow-emerald-200 border border-emerald-400">
                        <Coins size={12} className="fill-white" />
                        <span>+{c.rewardPerView} COINS</span>
                     </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
                <PlayCircle size={64} className="text-slate-300" />
                <p className="font-bold text-slate-400">No campaigns available right now.</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Global Payment Gateway Modal */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        initialPackId={paymentPackId}
      />

      {/* Multi-Platform Campaign Creator Modal */}
      <CreateCampaignModal
        isOpen={isCreateCampaignOpen}
        onClose={() => setIsCreateCampaignOpen(false)}
        onOpenPayment={() => openPaymentWithPack('pro')}
      />
    </div>
  );
};

