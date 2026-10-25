import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Campaign, CampaignStatus, TransactionType } from '../types';
import { useAuth } from '../lib/AuthContext';
import { Plus, Youtube, AlertCircle, Trash2, Pause, Play, Loader2, TrendingUp, CheckCircle2 } from 'lucide-react';
import { AdBanner } from '../components/AdBanner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const Campaigns: React.FC = () => {
  const { user, profile } = useAuth();
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  
  // Form state
  const [videoUrl, setVideoUrl] = useState('');
  const [targetViews, setTargetViews] = useState(100);
  const [reward, setReward] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'campaigns'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
      setMyCampaigns(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const extractVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const createCampaign = async () => {
    if (!user || !profile) return;
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      alert("Invalid YouTube URL");
      return;
    }

    const totalCost = targetViews * reward;
    if (profile.coins < totalCost) {
      alert(`Insufficient coins! You need ${totalCost} coins.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create campaign
      await addDoc(collection(db, 'campaigns'), {
        ownerId: user.uid,
        videoId: videoId,
        videoTitle: "My Video Campaign", // In real app, fetch from YT API
        targetViews: targetViews,
        currentViews: 0,
        rewardPerView: reward,
        status: CampaignStatus.ACTIVE,
        createdAt: new Date().toISOString()
      });

      // 2. Deduct coins
      await updateDoc(doc(db, 'users', user.uid), {
        coins: increment(-totalCost)
      });

      // 3. Record transaction
      await addDoc(collection(db, 'users', user.uid, 'transactions'), {
        userId: user.uid,
        amount: -totalCost,
        type: TransactionType.SPEND,
        description: `Created campaign for ${videoId}`,
        createdAt: new Date().toISOString()
      });

      setShowAdd(false);
      setVideoUrl('');
      alert("Campaign created successfully!");
    } catch (e) {
      console.error(e);
      alert("Error creating campaign.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (cam: Campaign) => {
    const newStatus = cam.status === CampaignStatus.ACTIVE ? CampaignStatus.PAUSED : CampaignStatus.ACTIVE;
    await updateDoc(doc(db, 'campaigns', cam.id), { status: newStatus });
  };

  const boostCampaign = async (cam: Campaign) => {
    if (!profile || profile.coins < 500) {
      alert("You need 500 coins to boost a campaign for 24 hours!");
      return;
    }

    if (window.confirm("Boost this campaign for 500 coins? It will appear at the top of the feed.")) {
       try {
         await updateDoc(doc(db, 'campaigns', cam.id), {
           isBoosted: true,
           boostedAt: new Date().toISOString()
         });
         await updateDoc(doc(db, 'users', user!.uid), {
           coins: increment(-500)
         });
         await addDoc(collection(db, 'users', user!.uid, 'transactions'), {
           userId: user!.uid,
           amount: -500,
           type: TransactionType.SPEND,
           description: `Boosted campaign: ${cam.videoId}`,
           createdAt: new Date().toISOString()
         });
         alert("Campaign boosted successfully!");
       } catch (e) {
         console.error(e);
       }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800">My Campaigns</h2>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-emerald-600 text-white p-2 rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-1 text-sm font-bold"
        >
          <Plus size={20} /> Create New
        </button>
      </div>

      <AdBanner slot="9900887766" />

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border-2 border-emerald-100 rounded-3xl p-6 shadow-sm overflow-hidden"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">YouTube URL</label>
                <div className="relative">
                  <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="https://youtu.be/..." 
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold focus:border-emerald-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Target Views</label>
                  <input 
                    type="number" 
                    value={targetViews}
                    onChange={(e) => setTargetViews(Number(e.target.value))}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:border-emerald-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Reward per View</label>
                  <input 
                    type="number" 
                    value={reward}
                    onChange={(e) => setReward(Number(e.target.value))}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:border-emerald-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="bg-emerald-50 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Total Cost</p>
                  <p className="text-lg font-black text-emerald-800">{targetViews * reward} Coins</p>
                </div>
                <button 
                  disabled={isSubmitting}
                  onClick={createCampaign}
                  className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-sm hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : 'Confirm'}
                </button>
              </div>
              
              <button 
                onClick={() => setShowAdd(false)}
                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {loading ? (
             <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-emerald-600" /></div>
        ) : myCampaigns.length > 0 ? (
          myCampaigns.map(cam => (
            <div key={cam.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm relative overflow-hidden">
               <div className="flex gap-4 items-start">
                  <img 
                    src={`https://img.youtube.com/vi/${cam.videoId}/mqdefault.jpg`} 
                    alt="Video"
                    className="w-24 h-16 rounded-xl object-cover"
                  />
                  <div className="flex-1 space-y-1">
                    <h4 className="font-black text-xs text-slate-800 line-clamp-1">{cam.videoTitle}</h4>
                    <div className="flex items-center gap-2">
                       <div className={cn(
                         "flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-full transition-colors",
                         cam.status === CampaignStatus.ACTIVE && "bg-emerald-100 text-emerald-600 ring-1 ring-emerald-500/20",
                         cam.status === CampaignStatus.PAUSED && "bg-amber-100 text-amber-600 ring-1 ring-amber-500/20",
                         cam.status === CampaignStatus.COMPLETED && "bg-slate-100 text-slate-400 ring-1 ring-slate-500/20"
                       )}>
                         {cam.status === CampaignStatus.ACTIVE && <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />}
                         {cam.status === CampaignStatus.PAUSED && <Pause size={8} />}
                         {cam.status === CampaignStatus.COMPLETED && <CheckCircle2 size={8} />}
                         <span>{cam.status}</span>
                       </div>
                       <span className="text-[10px] font-bold text-slate-400">
                         {cam.currentViews} / {cam.targetViews} views
                       </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                      <button 
                        disabled={cam.status === CampaignStatus.COMPLETED}
                        onClick={() => toggleStatus(cam)}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          cam.status === CampaignStatus.COMPLETED 
                            ? "bg-slate-50 text-slate-200 cursor-not-allowed" 
                            : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                        )}
                      >
                        {cam.status === CampaignStatus.ACTIVE ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button 
                        onClick={() => boostCampaign(cam)}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          (cam as any).isBoosted 
                            ? "bg-yellow-50 text-yellow-600" 
                            : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                        )}
                      >
                        <TrendingUp size={16} />
                      </button>
                  </div>
               </div>
               <div className="mt-3 h-1 bg-slate-50 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      cam.status === CampaignStatus.COMPLETED ? "bg-slate-300" : "bg-emerald-500"
                    )}
                    style={{ width: `${Math.min((cam.currentViews / cam.targetViews) * 100, 100)}%` }}
                  />
               </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50 bg-white rounded-3xl border border-dashed border-slate-200">
            <Youtube size={48} className="text-slate-300" />
            <p className="font-bold text-slate-400 px-10">You haven't created any campaigns yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
