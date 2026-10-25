import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Youtube, Instagram, Facebook, Globe, Sparkles, 
  Coins, CheckCircle2, AlertCircle, Loader2, ArrowRight, 
  HelpCircle, Eye, Award, ExternalLink, Plus 
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { CampaignPlatform } from '../types';
import { cn } from '../lib/utils';
import { sendAppNotification } from '../lib/notifications';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPayment?: () => void;
  onSuccess?: () => void;
}

const PLATFORMS: {
  id: CampaignPlatform;
  label: string;
  icon: any;
  color: string;
  bgGradient: string;
  borderColor: string;
  placeholder: string;
}[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    icon: Youtube,
    color: 'text-red-500',
    bgGradient: 'from-red-500/10 to-red-600/5',
    borderColor: 'border-red-500/30',
    placeholder: 'https://www.youtube.com/watch?v=... or shorts URL'
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: Instagram,
    color: 'text-pink-500',
    bgGradient: 'from-pink-500/10 via-purple-500/10 to-amber-500/5',
    borderColor: 'border-pink-500/30',
    placeholder: 'https://www.instagram.com/reel/... or post link'
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: Facebook,
    color: 'text-blue-500',
    bgGradient: 'from-blue-500/10 to-indigo-600/5',
    borderColor: 'border-blue-500/30',
    placeholder: 'https://www.facebook.com/watch/... or post URL'
  },
  {
    id: 'other',
    label: 'Other / Web',
    icon: Globe,
    color: 'text-purple-500',
    bgGradient: 'from-purple-500/10 to-indigo-600/5',
    borderColor: 'border-purple-500/30',
    placeholder: 'https://mywebsite.com or article / video link'
  }
];

const PRESET_VIEWS = [10, 25, 50, 100, 250, 500];
const PRESET_REWARDS = [20, 50, 100, 200];

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({
  isOpen,
  onClose,
  onOpenPayment,
  onSuccess
}) => {
  const { user, profile } = useAuth();
  const [platform, setPlatform] = useState<CampaignPlatform>('youtube');
  const [targetUrl, setTargetUrl] = useState('');
  const [title, setTitle] = useState('');
  const [targetViews, setTargetViews] = useState<number>(25);
  const [rewardPerView, setRewardPerView] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const totalCost = targetViews * rewardPerView;
  const userCoins = profile?.coins || 0;
  const isAffordable = userCoins >= totalCost;
  const shortage = Math.max(0, totalCost - userCoins);

  // Extract YouTube ID if applicable
  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : 'dQw4w9WgXcQ';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    if (!targetUrl.trim()) {
      setError('Please provide a valid content URL');
      return;
    }

    if (!title.trim()) {
      setError('Please provide a campaign title');
      return;
    }

    if (targetViews < 5) {
      setError('Minimum target views is 5');
      return;
    }

    if (rewardPerView < 10) {
      setError('Minimum reward per view is 10 coins');
      return;
    }

    if (!isAffordable) {
      setError(`Insufficient coins. You need ${totalCost.toLocaleString()} coins, but currently have ${userCoins.toLocaleString()}.`);
      return;
    }

    setLoading(true);

    try {
      const extractedVideoId = platform === 'youtube' ? extractYoutubeId(targetUrl) : 'multi_platform';

      // Atomic transaction: deduct coins and add campaign & transaction record
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) {
          throw new Error('User record not found');
        }

        const balance = userSnap.data().coins || 0;
        if (balance < totalCost) {
          throw new Error(`Insufficient coins. Available balance: ${balance.toLocaleString()}`);
        }

        // 1. Deduct coins from user
        transaction.update(userRef, {
          coins: increment(-totalCost)
        });

        // 2. Add campaign
        const campaignRef = doc(collection(db, 'campaigns'));
        transaction.set(campaignRef, {
          ownerId: user.uid,
          ownerEmail: user.email || '',
          platform: platform,
          targetUrl: targetUrl.trim(),
          videoId: extractedVideoId,
          videoTitle: title.trim(),
          targetViews: Number(targetViews),
          currentViews: 0,
          rewardPerView: Number(rewardPerView),
          status: 'active',
          createdAt: new Date().toISOString()
        });

        // 3. Add transaction ledger entry
        const txRef = doc(collection(db, 'users', user.uid, 'transactions'));
        transaction.set(txRef, {
          userId: user.uid,
          amount: -totalCost,
          type: 'spend',
          description: `Created ${platform.toUpperCase()} Campaign: ${title.trim()} (${targetViews} views @ ${rewardPerView} coins)`,
          status: 'completed',
          createdAt: new Date().toISOString()
        });
      });

      setSuccess(true);
      
      // Dispatch notification to user
      sendAppNotification({
        userId: user.uid,
        title: '🚀 Campaign Launched Live!',
        body: `Your ${platform.toUpperCase()} campaign "${title.trim()}" is now live on Watch & Earn! Goal: ${targetViews} views.`,
        type: 'campaign_goal'
      }).catch(console.error);

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Campaign creation error:', err);
      setError(err.message || 'Failed to create campaign. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccess(false);
    setTargetUrl('');
    setTitle('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md max-h-[92vh] overflow-y-auto p-6 space-y-6 shadow-2xl relative"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <Plus size={20} className="stroke-[3]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight font-display">New Campaign</h2>
              <p className="text-[11px] font-bold text-slate-400">Boost views & engagement across platforms</p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-3xl mx-auto flex items-center justify-center text-emerald-600 shadow-xl shadow-emerald-500/20">
              <CheckCircle2 size={36} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900">Campaign Launched!</h3>
              <p className="text-xs font-medium text-slate-500 px-6">
                Your campaign is now live on the Home feed. Real creators will start viewing and engaging immediately!
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Platform:</span>
                <span className="font-bold uppercase text-slate-900">{platform}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Goal:</span>
                <span className="font-bold text-slate-900">{targetViews} views</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reward per View:</span>
                <span className="font-bold text-emerald-600">{rewardPerView} coins</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/60 pt-2 font-black">
                <span className="text-slate-700">Total Deducted:</span>
                <span className="text-slate-900">{totalCost.toLocaleString()} coins</span>
              </div>
            </div>

            <button
              onClick={handleResetAndClose}
              className="w-full py-3.5 bg-slate-950 text-white rounded-2xl font-black text-sm hover:bg-slate-900 transition-all shadow-lg active:scale-95"
            >
              Done & View Campaign
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Step 1: Platform Selection */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                1. Select Platform
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map((item) => {
                  const Icon = item.icon;
                  const isSelected = platform === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPlatform(item.id)}
                      className={cn(
                        "p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all relative overflow-hidden",
                        isSelected 
                          ? `border-emerald-500 bg-emerald-500/10 shadow-sm` 
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <div className={cn("p-2 rounded-xl bg-white shadow-sm shrink-0", item.color)}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <span className="font-black text-xs text-slate-900 block leading-tight">
                          {item.label}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">
                          {isSelected ? 'Selected' : 'Tap to select'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Content URL & Title */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                2. Content Details
              </label>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 block">
                  {platform === 'youtube' ? 'YouTube Video URL' : 
                   platform === 'instagram' ? 'Instagram Reel / Post URL' : 
                   platform === 'facebook' ? 'Facebook Video / Post URL' : 'Target URL'}
                </label>
                <input
                  type="url"
                  required
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder={PLATFORMS.find(p => p.id === platform)?.placeholder}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 block">
                  Campaign Title / Headline
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Crazy Gaming Clutch • Watch & Subscribe!"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Step 3: Views & Reward per view */}
            <div className="space-y-4">
              <label className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                3. Views & Coin Rewards
              </label>

              {/* Target Views */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-600">Target Views:</span>
                  <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {targetViews} Views
                  </span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {PRESET_VIEWS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTargetViews(v)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                        targetViews === v
                          ? "bg-slate-950 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reward Per View */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-600">Coins Given Per View:</span>
                  <span className="font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/50 flex items-center gap-1">
                    <Coins size={12} />
                    {rewardPerView} coins / person
                  </span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {PRESET_REWARDS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRewardPerView(r)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1",
                        rewardPerView === r
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      <Coins size={10} />
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Total Cost Breakdown Card */}
            <div className={cn(
              "rounded-2xl p-4 border transition-all space-y-2",
              isAffordable 
                ? "bg-emerald-500/5 border-emerald-500/20" 
                : "bg-amber-500/5 border-amber-500/20"
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Total Campaign Cost
                  </span>
                  <div className="flex items-center gap-1.5 text-base font-black text-slate-900 mt-0.5">
                    <Coins size={16} className="text-amber-500 fill-amber-500" />
                    <span>{totalCost.toLocaleString()} Coins</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    ({targetViews} views × {rewardPerView} coins)
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Your Balance
                  </span>
                  <span className="text-sm font-black text-slate-800">
                    {userCoins.toLocaleString()} coins
                  </span>
                </div>
              </div>

              {!isAffordable && (
                <div className="pt-2 border-t border-amber-200/40 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-amber-800">
                    Need {shortage.toLocaleString()} more coins
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onOpenPayment) onOpenPayment();
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1 transition-all active:scale-95"
                  >
                    <Plus size={12} />
                    Buy Coins
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs font-bold rounded-xl border border-rose-200 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Launch Button */}
            <button
              type="submit"
              disabled={loading || !isAffordable}
              className={cn(
                "w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 disabled:opacity-50",
                isAffordable
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              )}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Launch Campaign ({totalCost.toLocaleString()} Coins)</span>
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
