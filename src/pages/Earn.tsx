import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gift, Star, Users, Coins, Sparkles, Loader2, PlayCircle, Play, Package, 
  Trophy, ArrowRight, Gamepad2, ExternalLink, ClipboardList, ShieldCheck, 
  CreditCard, Lightbulb, Youtube, Instagram, Facebook, Globe, CheckCircle2, 
  Clock, X, Eye 
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, increment, addDoc, collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { Redeem } from './Redeem';
import { Campaign, CampaignStatus } from '../types';
import { sendAppNotification } from '../lib/notifications';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return error instanceof Error ? error.message : String(error);
}
interface EarnProps {
  mode?: 'rewards' | 'play' | 'redeem';
}

export const Earn: React.FC<EarnProps> = ({ mode: initialMode = 'rewards' }) => {
  const { user, profile } = useAuth();
  const [mode, setMode] = useState<'rewards' | 'play' | 'redeem'>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  const [claiming, setClaiming] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [adLoading, setAdLoading] = useState(false);
  const [adTimer, setAdTimer] = useState(0);
  const [adType, setAdType] = useState<'normal' | 'chest'>('normal');
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [tryingApp, setTryingApp] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  // Live User Campaigns in Watch & Earn
  const [videoCampaigns, setVideoCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [activeCampaignTask, setActiveCampaignTask] = useState<Campaign | null>(null);
  const [campaignTimer, setCampaignTimer] = useState(0);
  const [campaignWatchStatus, setCampaignWatchStatus] = useState<'idle' | 'watching' | 'done'>('idle');

  const redeemOptions = [
    { id: 'r1', title: '₹10 Play Store Code', price: 10000, amount: 10 },
    { id: 'r2', title: '₹50 Play Store Code', price: 50000, amount: 50 },
    { id: 'r3', title: '₹100 Play Store Code', price: 100000, amount: 100 },
    { id: 'r4', title: '₹250 Play Store Code', price: 250000, amount: 250 },
    { id: 'r5', title: '₹500 Play Store Code', price: 500000, amount: 500 },
  ];

  const handleRedeemRequest = async (option: typeof redeemOptions[0]) => {
    if (!user || !profile || profile.coins < option.price) return;
    setRedeeming(option.id);

    let generatedCode = '';
    try {
      const { runTransaction } = await import('firebase/firestore');
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists() || (userDoc.data().coins || 0) < option.price) {
          throw new Error("Insufficient coins");
        }

        // 1. Deduct coins
        transaction.update(userRef, {
          coins: increment(-option.price)
        });

        // Generate clean Play Store style redeem code
        const segment = () => Math.random().toString(36).substring(2, 6).toUpperCase();
        generatedCode = `PLAY-${segment()}-${segment()}-${segment()}`;

        // 2. Create redemption request
        const redemptionRef = doc(collection(db, 'redemptions'));
        transaction.set(redemptionRef, {
          userId: user.uid,
          userEmail: user.email,
          productId: option.id,
          productTitle: option.title,
          amount: option.price,
          status: 'pending',
          redeemCode: generatedCode,
          createdAt: new Date().toISOString()
        });

        // 3. Log transaction
        const txRef = doc(collection(db, 'users', user.uid, 'transactions'));
        transaction.set(txRef, {
          userId: user.uid,
          amount: -option.price,
          type: 'spend',
          description: `Redeemed: ${option.title}`,
          redeemCode: generatedCode,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      });

      alert(`YOUR REDEEM CODE HAS BEEN GENERATED!\n\nCode: ${generatedCode}\n\nYou can view and copy your redeem code anytime from Profile > Transaction History.`);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Redemption failed.");
    } finally {
      setRedeeming(null);
    }
  };
  const [referrals, setReferrals] = useState<any[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);

  const quizQuestions = [
    {
      question: "What does RAID stand for in computer storage?",
      options: ["Redundant Array of Independent Disks", "Rapid Access Integrated Drive", "Remote Array of International Data", "Redundant Analog Integrated Device"],
      answer: 0,
      reward: 50
    },
    {
      question: "What is the most abundant noble gas in Earth's atmosphere?",
      options: ["Helium", "Neon", "Argon", "Krypton"],
      answer: 2,
      reward: 50
    },
    {
      question: "Which country was the first to implement a nationwide carbon tax?",
      options: ["Sweden", "Finland", "Norway", "Canada"],
      answer: 1,
      reward: 50
    },
    {
      question: "In what year was the C programming language created?",
      options: ["1969", "1972", "1975", "1980"],
      answer: 1,
      reward: 50
    },
    {
      question: "What is the only metal that is liquid at room temperature?",
      options: ["Gallium", "Mercury", "Bromine", "Cesium"],
      answer: 1,
      reward: 50
    }
  ];

  const handleQuizAnswer = async (optionIndex: number) => {
    const q = quizQuestions[currentQuizIndex];
    if (optionIndex === q.answer) {
      setQuizScore(prev => prev + q.reward);
      alert("Correct! +50 Coins");
      
      // Update coins
      try {
        await updateDoc(doc(db, 'users', user!.uid), {
          coins: increment(q.reward)
        });
        await addDoc(collection(db, 'users', user!.uid, 'transactions'), {
          userId: user!.uid,
          amount: q.reward,
          type: 'earn',
          description: `Quiz Correct: ${q.question}`,
          createdAt: new Date().toISOString()
        });
      } catch (e) {
        console.error(e);
      }
    } else {
      alert("Incorrect. The correct answer was: " + q.options[q.answer]);
    }

    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex(prev => prev + 1);
    } else {
      alert(`Quiz Finished! Total Earned: ${quizScore + (optionIndex === q.answer ? q.reward : 0)} Coins`);
      setShowQuiz(false);
      setCurrentQuizIndex(0);
      setQuizScore(0);
    }
  };
  const [spinning, setSpinning] = useState(false);
  const [qualifying, setQualifying] = useState(false);
  const [qualified, setQualified] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});

  const qualificationQuestions = [
    {
      id: 1,
      question: "What is your approximate annual household income?",
      options: [
        { label: "Below ₹10 Lakh", value: "low" },
        { label: "₹10 Lakh - ₹50 Lakh", value: "mid" },
        { label: "₹50 Lakh - ₹1 Crore", value: "high" },
        { label: "₹2 Crore or Above", value: "premium" },
      ],
      correctValue: "premium"
    },
    {
      id: 2,
      question: "Please confirm your age group to ensure survey accuracy.",
      options: [
        { label: "Under 18", value: "minor" },
        { label: "18 - 35", value: "young" },
        { label: "35 - 50", value: "mid" },
        { label: "50 Years or Above", value: "senior" },
      ],
      correctValue: "senior"
    }
  ];

  const handleQualificationAnswer = (value: string) => {
    const newAnswers = { ...answers, [currentQuestion]: value };
    setAnswers(newAnswers);

    if (currentQuestion < qualificationQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      // Check eligibility
      const isEligible = qualificationQuestions.every((q, idx) => newAnswers[idx] === q.correctValue);
      if (isEligible) {
        setQualified(true);
        setQualifying(false);
      } else {
        alert("Sorry, you do not meet the criteria for these premium surveys at this time.");
        setQualifying(false);
        setCurrentQuestion(0);
        setAnswers({});
      }
    }
  };

  useEffect(() => {
    if (!user || mode !== 'rewards') return;

    const q = query(collection(db, 'users'), where('referredBy', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      setReferrals(data);
    });

    return () => unsubscribe();
  }, [user, mode]);

  // Fetch active campaigns for "Watch & Earn"
  useEffect(() => {
    const q = query(
      collection(db, 'campaigns'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Campaign[];
      // Keep only campaigns that haven't reached target views yet
      setVideoCampaigns(items.filter(c => (c.currentViews || 0) < c.targetViews));
      setCampaignsLoading(false);
    }, (err) => {
      console.warn("Failed to load user campaigns in Earn:", err.message);
      setCampaignsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Campaign engagement countdown timer
  useEffect(() => {
    let interval: any;
    if (campaignWatchStatus === 'watching' && campaignTimer > 0) {
      interval = setInterval(() => {
        setCampaignTimer(prev => prev - 1);
      }, 1000);
    } else if (campaignTimer === 0 && campaignWatchStatus === 'watching') {
      setCampaignWatchStatus('done');
    }
    return () => clearInterval(interval);
  }, [campaignWatchStatus, campaignTimer]);

  const getCampaignUrl = (c: Campaign) => {
    if (c.targetUrl && c.targetUrl.trim()) return c.targetUrl.trim();
    if (c.videoId && c.videoId !== 'multi_platform') return `https://www.youtube.com/watch?v=${c.videoId}`;
    return 'https://youtube.com';
  };

  const startWatchingCampaign = (camp: Campaign) => {
    setActiveCampaignTask(camp);
    setCampaignTimer(30);
    setCampaignWatchStatus('watching');
    const url = getCampaignUrl(camp);
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {}
  };

  const claimCampaignReward = async () => {
    if (!activeCampaignTask || !user || !profile) return;
    const camp = activeCampaignTask;
    try {
      // 1. Record view in user history
      await addDoc(collection(db, 'users', user.uid, 'views'), {
        campaignId: camp.id,
        rewardClaimed: camp.rewardPerView,
        timestamp: new Date().toISOString()
      });

      // 2. Increment currentViews and check if target reached
      const nextViews = (camp.currentViews || 0) + 1;
      const isCompleted = nextViews >= camp.targetViews;

      await updateDoc(doc(db, 'campaigns', camp.id), {
        currentViews: increment(1),
        ...(isCompleted ? { status: 'completed' } : {})
      });

      // 3. Send push notification to campaign creator if goal reached
      if (isCompleted && camp.ownerId) {
        await sendAppNotification({
          userId: camp.ownerId,
          title: '🎯 Campaign Goal Reached!',
          body: `Congratulations! Your campaign "${camp.videoTitle}" reached its goal of ${camp.targetViews} views!`,
          type: 'campaign_goal',
          referenceId: camp.id
        });
      }

      // 4. Update viewer balance
      await updateDoc(doc(db, 'users', user.uid), {
        coins: increment(camp.rewardPerView)
      });

      // 5. Add ledger transaction
      await addDoc(collection(db, 'users', user.uid, 'transactions'), {
        userId: user.uid,
        amount: camp.rewardPerView,
        type: 'earn',
        description: `Watched Campaign Video: ${camp.videoTitle} (+${camp.rewardPerView} coins)`,
        createdAt: new Date().toISOString()
      });

      setRewardAmount(camp.rewardPerView);
      setShowReward(true);
      setTimeout(() => setShowReward(false), 3000);
      setCampaignWatchStatus('idle');
      setActiveCampaignTask(null);
    } catch (e: any) {
      console.error("Failed to claim campaign reward:", e);
      alert(e.message || "Failed to claim reward. Please try again.");
    }
  };

  const spinAndEarn = async () => {
    if (!user || spinning) return;
    setSpinning(true);
    try {
      // Simulate spin
      await new Promise(r => setTimeout(r, 2000));
      const amount = Math.floor(Math.random() * 50) + 5;
      
      await updateDoc(doc(db, 'users', user.uid), {
        coins: increment(amount)
      });
      
      await addDoc(collection(db, 'users', user.uid, 'transactions'), {
        userId: user.uid,
        amount: amount,
        type: 'earn',
        description: `Lucky Spin Reward`,
        createdAt: new Date().toISOString()
      });

      setRewardAmount(amount);
      setShowReward(true);
      setTimeout(() => setShowReward(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSpinning(false);
    }
  };

  const appsToTry = [
    { id: 'app1', title: 'StreamBoost Pro', reward: 5, icon: '🚀', category: 'Streaming', url: 'https://example.com/app1' },
    { id: 'app2', title: 'ClipMaster AI', reward: 8, icon: '🎬', category: 'Editing', url: 'https://example.com/app2' },
    { id: 'app3', title: 'TagGen Elite', reward: 3, icon: '🏷️', category: 'SEO', url: 'https://example.com/app3' }
  ];

  const tryApp = async (appId: string, amount: number) => {
    if (!user) return;
    setTryingApp(appId);
    
    // Simulate staying in the app for a bit
    const userPath = `users/${user.uid}`;
    try {
      await new Promise(r => setTimeout(r, 2000));
      
      await updateDoc(doc(db, 'users', user.uid), {
        coins: increment(amount)
      });
      
      await addDoc(collection(db, 'users', user.uid, 'transactions'), {
        userId: user.uid,
        amount: amount,
        type: 'earn',
        description: `Tried Featured App`,
        createdAt: new Date().toISOString()
      });

      setRewardAmount(amount);
      setShowReward(true);
      setTimeout(() => setShowReward(false), 3000);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, userPath);
    } finally {
      setTryingApp(null);
    }
  };

  // Daily Timer logic
  useEffect(() => {
    const updateTimer = () => {
      const claimStr = profile?.lastDailyClaim;
      if (!claimStr) {
        setTimeLeft('');
        return;
      }

      const lastClaimTime = new Date(claimStr).getTime();
      
      if (isNaN(lastClaimTime)) {
        console.error("Invalid daily claim date:", claimStr);
        setTimeLeft('');
        return;
      }

      const nextClaimTime = lastClaimTime + (24 * 60 * 60 * 1000);
      const now = new Date().getTime();
      const diff = nextClaimTime - now;

      if (diff <= 0) {
        setTimeLeft('');
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${h}h ${m}m ${s}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [profile?.lastDailyClaim]);

  const claimDaily = async () => {
    if (!user || !profile) return;
    
    // Check cooldown
    if (timeLeft) {
      return;
    }

    setClaiming(true);
    const userPath = `users/${user.uid}`;
    try {
      const now = new Date();
      const nowStr = now.toISOString();
      
      // Determine day in progression (1-7)
      // If last claim was > 48h ago, reset to Day 1
      let nextDay = (profile.rewardDay || 0) + 1;
      const lastClaimStr = profile.lastDailyClaim;
      if (lastClaimStr) {
        const lastClaimTime = new Date(lastClaimStr).getTime();
        const diffHours = (now.getTime() - lastClaimTime) / (1000 * 60 * 60);
        if (diffHours > 48) {
          nextDay = 1;
        }
      }
      if (nextDay > 7) nextDay = 1;

      // Rewards: 10, 20, 30, 40, 50, 60, 100 (Bonus on day 7)
      const rewards = [10, 20, 30, 40, 50, 75, 150];
      const amount = rewards[(nextDay - 1) % 7];
      
      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        coins: increment(amount),
        lastDailyClaim: nowStr,
        rewardDay: nextDay
      });

      // Log transaction
      await addDoc(collection(db, 'users', user.uid, 'transactions'), {
        userId: user.uid,
        amount: amount,
        type: 'bonus',
        description: `Daily Bonus (Day ${nextDay})`,
        createdAt: nowStr
      });

      setRewardAmount(amount);
      setShowReward(true);
      setTimeout(() => setShowReward(false), 4000);
    } catch (e) {
      const msg = handleFirestoreError(e, OperationType.UPDATE, userPath);
      alert(`Claim failed: ${msg}. Refreshing page might help.`);
    } finally {
      setClaiming(false);
    }
  };

  const watchAd = (type: 'normal' | 'chest' = 'normal') => {
    setAdType(type);
    setAdLoading(true);
    setAdTimer(15); 
    
    // Simulate real ad loading state
    setTimeout(() => {
      const interval = setInterval(() => {
        setAdTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            handleAdFinished(type);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 1000);
  };

  const handleAdFinished = async (type: 'normal' | 'chest') => {
     if (!user) return;
     const amount = type === 'chest' ? 10 : 5;
     const userPath = `users/${user.uid}`;
     try {
       await updateDoc(doc(db, 'users', user.uid), {
         coins: increment(amount)
       });
       await addDoc(collection(db, 'users', user.uid, 'transactions'), {
         userId: user.uid,
         amount: amount,
         type: 'earn',
         description: type === 'chest' ? 'Opened Lucky Chest' : 'Watched Ad',
         createdAt: new Date().toISOString()
       });
       setRewardAmount(amount);
       setShowReward(true);
       setTimeout(() => setShowReward(false), 3000);
     } catch (e) {
       handleFirestoreError(e, OperationType.UPDATE, userPath);
     } finally {
       setAdLoading(false);
     }
  };

  const surveys = [
    { id: 's1', title: 'Consumer Habits', reward: 150, duration: '5 min', icon: '📝' },
    { id: 's2', title: 'Tech Trends 2024', reward: 200, duration: '8 min', icon: '💻' },
    { id: 's3', title: 'Fast Food Opinions', reward: 100, duration: '3 min', icon: '🍔' },
    { id: 's4', title: 'Banking & Fintech', reward: 500, duration: '12 min', icon: '🏦' },
    { id: 's5', title: 'Luxury Travel', reward: 350, duration: '10 min', icon: '✈️' },
    { id: 's6', title: 'Investment Strategies', reward: 600, duration: '15 min', icon: '📊' },
  ];

  const takeSurvey = async (id: string, reward: number) => {
    if (!user || tryingApp) return;
    setTryingApp(id);
    
    // Simulate survey process
    await new Promise(r => setTimeout(r, 2000));
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        coins: increment(reward)
      });
      
      await addDoc(collection(db, 'users', user.uid, 'transactions'), {
        userId: user.uid,
        amount: reward,
        type: 'earn',
        description: `Survey Completion Reward`,
        createdAt: new Date().toISOString()
      });

      setRewardAmount(reward);
      setShowReward(true);
      setTimeout(() => setShowReward(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setTryingApp(null);
    }
  };

  if (mode === 'redeem') {
    return <Redeem />;
  }

  if (mode === 'play') {
    return (
      <div className="space-y-8 pb-10">
        <div className="text-center py-6">
          <h2 className="text-4xl font-black italic tracking-tighter text-slate-900 leading-tight">EARN MONEY</h2>
          <p className="text-slate-400 font-bold text-sm">Apps, Surveys & Premium Offers</p>
        </div>

        {/* Answer & Earn Section */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
           <Sparkles className="absolute -bottom-10 -right-10 w-64 h-64 text-white/10 group-hover:scale-110 transition-transform duration-700" />
           <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
              <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-xl border border-white/20">
                <Lightbulb size={40} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-3xl font-black italic tracking-tighter uppercase">Answer & Earn</h3>
                <p className="text-blue-100 font-bold text-sm mt-1 opacity-80 uppercase tracking-widest">Hard-Level Knowledge Quiz</p>
                <p className="text-blue-200 text-xs mt-3 leading-relaxed">Test your IQ in Tech, Science & History. Earn 50 Coins for every correct answer.</p>
              </div>
              <button 
                onClick={() => setShowQuiz(true)}
                className="bg-white text-blue-600 px-8 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-blue-50 transition-colors border-b-4 border-blue-100"
              >
                Start Quiz
              </button>
           </div>
        </div>

        {/* PubScale Featured Section */}
        <div className="bg-gradient-to-br from-orange-500 to-rose-600 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
           <Trophy className="absolute -bottom-10 -right-10 w-64 h-64 text-white/10 group-hover:scale-110 transition-transform duration-700" />
           <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
              <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-xl border border-white/20">
                <Trophy size={40} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-3xl font-black italic tracking-tighter">PUBSCALE OFFERS</h3>
                <p className="text-rose-100 font-bold text-sm mt-1 opacity-80 uppercase tracking-widest">Premium Reward Wall</p>
                <p className="text-rose-200 text-xs mt-3 leading-relaxed">Access high-paying surveys and exclusive games. Earn up to 5,000 tokens per task.</p>
              </div>
              <button 
                onClick={() => window.open('https://pubscale.com/offerwall', '_blank')}
                className="bg-white text-rose-600 px-8 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-rose-50 transition-colors border-b-4 border-rose-100"
              >
                Launch Offers
              </button>
           </div>
        </div>

        {/* Surveys Section */}
        <div className="space-y-4">
           <div className="flex items-center gap-2 px-2">
            <ClipboardList size={16} className="text-blue-500" />
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">High Paying Surveys</h3>
          </div>
          <div className="space-y-3">
            {!qualified ? (
              <div className="bg-white rounded-[2rem] p-8 border-2 border-dashed border-slate-200 text-center space-y-4">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-500">
                  <ShieldCheck size={32} />
                </div>
                <div>
                  <h4 className="font-black text-slate-800">Survey Qualification Required</h4>
                  <p className="text-xs font-bold text-slate-400 mt-1">These premium surveys require specific demographic verification.</p>
                </div>
                <button 
                  onClick={() => setQualifying(true)}
                  className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs shadow-lg hover:bg-blue-700 transition-all border-b-4 border-blue-900 active:translate-y-1 active:border-b-0 uppercase tracking-widest"
                >
                  Start Screening
                </button>
              </div>
            ) : (
              surveys.map((survey) => (
                <motion.div 
                  key={survey.id}
                  whileHover={{ x: 5 }}
                  className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-lg flex items-center justify-between group"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                      {survey.icon}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800">{survey.title}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{survey.duration} • SURVEY</p>
                    </div>
                  </div>
                  <button 
                    disabled={!!tryingApp}
                    onClick={() => takeSurvey(survey.id, survey.reward)}
                    className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-xs shadow-lg hover:bg-blue-700 transition-all border-b-4 border-blue-900 active:translate-y-1 active:border-b-0"
                  >
                    {tryingApp === survey.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      `+${survey.reward} COINS`
                    )}
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Qualification Modal Overlay */}
        <AnimatePresence>
          {qualifying && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white w-full max-w-md rounded-[3rem] p-10 space-y-8"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black italic tracking-tighter">SURVEY SCREENING</h3>
                  <button onClick={() => setQualifying(false)} className="text-slate-400 font-black">CLOSE</button>
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-500" 
                        style={{ width: `${((currentQuestion + 1) / qualificationQuestions.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase">Q{currentQuestion + 1} of {qualificationQuestions.length}</span>
                  </div>

                  <h4 className="text-lg font-black text-slate-800 leading-snug">
                    {qualificationQuestions[currentQuestion].question}
                  </h4>

                  <div className="grid grid-cols-1 gap-3">
                    {qualificationQuestions[currentQuestion].options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleQualificationAnswer(opt.value)}
                        className="w-full text-left p-5 rounded-2xl border-2 border-slate-100 font-bold text-slate-600 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-between group"
                      >
                        {opt.label}
                        <ArrowRight size={18} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 font-bold text-center leading-relaxed">
                  Your privacy is important. Screening data is analyzed anonymously to match you with high-paying surveys.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Gamepad2 size={16} className="text-emerald-500" />
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">App Install Tasks</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {appsToTry.map((app) => (
            <motion.div 
              key={app.id}
              whileHover={{ y: -2 }}
              className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-xl flex items-center gap-6 group hover:border-emerald-100 transition-all"
            >
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-4xl shadow-inner group-hover:scale-105 transition-transform">
                {app.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-lg text-slate-800">{app.title}</h4>
                  <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-1 rounded-full uppercase tracking-widest">{app.category}</span>
                </div>
                <p className="text-xs font-bold text-slate-400 mt-1 leading-relaxed">Experience this app for 2 seconds to unlock your reward.</p>
              </div>
              <button 
                disabled={!!tryingApp}
                onClick={() => tryApp(app.id, app.reward)}
                className={cn(
                  "flex flex-col items-center gap-1 px-8 py-4 rounded-[2rem] transition-all border-b-4",
                  tryingApp === app.id 
                    ? "bg-slate-100 text-slate-400 border-slate-200" 
                    : "bg-emerald-500 text-white border-emerald-700 shadow-xl"
                )}
              >
                {tryingApp === app.id ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Coins size={14} className="fill-white" />
                      <span className="font-black text-lg">+{app.reward}</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Collect</span>
                  </>
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Ad Player Overlay */}
      <AnimatePresence>
        {showQuiz && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <div className="bg-white w-full max-w-md rounded-[3rem] p-10 space-y-8 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8">
                 <button onClick={() => setShowQuiz(false)} className="text-slate-400 font-bold">CLOSE</button>
               </div>
               <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-500" 
                        style={{ width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase">Q{currentQuizIndex + 1} of {quizQuestions.length}</span>
                  </div>

                  <h3 className="text-2xl font-black text-slate-900 leading-tight">
                    {quizQuestions[currentQuizIndex].question}
                  </h3>

                  <div className="grid grid-cols-1 gap-3">
                    {quizQuestions[currentQuizIndex].options.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuizAnswer(idx)}
                        className="w-full text-left p-6 rounded-2xl border-2 border-slate-100 font-bold text-slate-600 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
               </div>
            </div>
          </motion.div>
        )}
        {adLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6 text-white"
          >
            <div className="absolute top-10 right-6 flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest">Sponsored Content ({adTimer}s)</span>
            </div>

            <div className="w-full max-w-sm aspect-video bg-slate-900 rounded-2xl overflow-hidden relative shadow-2xl flex items-center justify-center p-12 text-center group">
               <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 opacity-50" />
               <div className="space-y-4 relative z-10 transition-transform group-hover:scale-105 duration-500">
                  <Play size={48} className="text-white mx-auto drop-shadow-lg" fill="currentColor" />
                  <div className="space-y-1">
                    <h4 className="text-xl font-black italic tracking-tighter">ViewBoost Pro</h4>
                    <p className="text-xs font-bold text-slate-400">Scaling creators to millions.</p>
                  </div>
               </div>
               {/* Progress bar */}
               <div className="absolute bottom-0 left-0 h-1.5 bg-emerald-500 transition-all duration-1000" style={{ width: `${( (15 - adTimer) / 15 ) * 100}%` }} />
            </div>

            <p className="mt-8 text-xs font-bold text-slate-500 animate-pulse uppercase tracking-[0.2em]">Rewards unlocking soon...</p>
          </motion.div>
        )}
        {campaignWatchStatus !== 'idle' && activeCampaignTask && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-sm p-6 text-center space-y-5 border border-slate-100 shadow-2xl relative"
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  "p-1.5 px-2.5 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5",
                  activeCampaignTask.platform === 'youtube' ? "bg-red-50 text-red-600 border-red-200" :
                  activeCampaignTask.platform === 'instagram' ? "bg-pink-50 text-pink-600 border-pink-200" :
                  activeCampaignTask.platform === 'facebook' ? "bg-blue-50 text-blue-600 border-blue-200" :
                  "bg-purple-50 text-purple-600 border-purple-200"
                )}>
                  {activeCampaignTask.platform === 'youtube' && <Youtube size={12} />}
                  {activeCampaignTask.platform === 'instagram' && <Instagram size={12} />}
                  {activeCampaignTask.platform === 'facebook' && <Facebook size={12} />}
                  {activeCampaignTask.platform === 'other' && <Globe size={12} />}
                  <span>{activeCampaignTask.platform?.toUpperCase() || 'VIDEO'} CAMPAIGN</span>
                </span>

                <button 
                  onClick={() => {
                    setCampaignWatchStatus('idle');
                    setActiveCampaignTask(null);
                  }}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Title & Preview Link */}
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 leading-snug line-clamp-2">
                  {activeCampaignTask.videoTitle}
                </h3>
                <a
                  href={getCampaignUrl(activeCampaignTask)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center justify-center gap-1 truncate max-w-[260px] mx-auto"
                >
                  <ExternalLink size={12} />
                  <span className="truncate">{getCampaignUrl(activeCampaignTask)}</span>
                </a>
              </div>

              {/* Countdown Circular Timer */}
              <div className="w-24 h-24 rounded-full border-4 border-slate-100 border-t-emerald-500 mx-auto flex flex-col items-center justify-center relative shadow-inner">
                {campaignWatchStatus === 'watching' ? (
                  <>
                    <span className="text-2xl font-black text-slate-900 font-mono tabular-nums">
                      {campaignTimer}s
                    </span>
                    <span className="text-[8px] font-bold uppercase text-slate-400">Watching</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={32} className="text-emerald-500" />
                    <span className="text-[8px] font-black uppercase text-emerald-600 mt-0.5">Ready!</span>
                  </>
                )}
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Earn Reward:</span>
                <span className="font-black text-emerald-600 flex items-center gap-1">
                  <Coins size={12} />
                  +{activeCampaignTask.rewardPerView} coins
                </span>
              </div>

              {campaignWatchStatus === 'watching' ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-400 font-medium animate-pulse">
                    Keep engagement window active for {campaignTimer}s...
                  </p>
                  <a
                    href={getCampaignUrl(activeCampaignTask)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <ExternalLink size={13} />
                    <span>Open Content Link</span>
                  </a>
                </div>
              ) : (
                <button
                  onClick={claimCampaignReward}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} />
                  <span>Claim +{activeCampaignTask.rewardPerView} Coins</span>
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Primary Daily Check-in (Highlighted) */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-[3rem] blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
        <div className="relative bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-100 flex flex-col items-center text-center gap-6 overflow-hidden">
           <div className="absolute top-0 right-0 p-4">
             {timeLeft ? (
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                  <Star size={14} className="text-slate-300" />
                  <span className="text-[10px] font-black text-slate-400 tabular-nums uppercase tracking-widest">{timeLeft}</span>
                </div>
             ) : (
                <div className="bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full animate-bounce">
                  Ready!
                </div>
             )}
           </div>

           <div className="w-24 h-24 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center text-emerald-500 shadow-inner">
             <Gift size={48} />
           </div>

           <div>
              <h2 className="text-4xl font-black italic tracking-tighter font-display text-slate-900 leading-tight">DAILY REWARD</h2>
              <p className="text-slate-400 font-bold text-sm mt-2">Log in every 24 hours to claim your free bonus tokens.</p>
           </div>

           <div className="flex items-center gap-2 mb-2 w-full justify-between">
              {[10, 20, 30, 40, 50, 75, 150].map((v, i) => {
                const dayNum = i + 1;
                const isPast = (profile?.rewardDay || 0) >= dayNum;
                const isCurrent = (profile?.rewardDay || 0) + (timeLeft ? 0 : 1) === dayNum;
                
                return (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className={cn(
                      "w-10 h-10 rounded-2xl border-2 flex items-center justify-center font-black text-[10px] transition-all",
                      isPast ? "bg-emerald-500 border-emerald-500 text-white shadow-lg" : 
                      isCurrent ? "bg-white border-emerald-500 text-emerald-600 animate-pulse" :
                      "bg-slate-50 border-slate-100 text-slate-400"
                    )}>
                      {v}
                    </div>
                    <span className="text-[8px] font-black uppercase text-slate-400">Day {dayNum}</span>
                  </div>
                );
              })}
           </div>

           <button 
             disabled={claiming || !!timeLeft}
             onClick={claimDaily}
             className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-lg shadow-2xl hover:bg-emerald-600 transition-all disabled:opacity-30 border-b-4 border-slate-950 active:translate-y-1 active:border-b-0"
           >
             {claiming ? (
               <Loader2 className="animate-spin mx-auto" size={24} />
             ) : timeLeft ? (
               <div className="flex flex-col items-center">
                 <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Unlocks in</span>
                 <span className="tabular-nums">{timeLeft}</span>
               </div>
             ) : (
               "Claim Now"
             )}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Watch Ad and Earn Header Banner */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden group">
           <PlayCircle className="absolute -bottom-8 -right-8 w-48 h-48 text-white/10 group-hover:scale-110 transition-transform duration-700" />
           <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/20 shrink-0">
                <PlayCircle size={36} className="text-blue-200" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-black italic tracking-tighter">WATCH & EARN</h3>
                <p className="text-blue-100 font-bold text-xs mt-0.5 opacity-90 uppercase tracking-widest">
                  Quick Promo • Instant 10-15 Tokens
                </p>
                <p className="text-blue-200 text-xs mt-1.5 leading-relaxed">
                  Support the ecosystem with brief promos or watch creator videos below for custom token rewards.
                </p>
              </div>
              <button 
                disabled={adLoading}
                onClick={() => watchAd('chest')}
                className="bg-white text-blue-700 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-xl hover:bg-blue-50 transition-colors disabled:opacity-50 active:scale-95 shrink-0"
              >
                {adLoading ? "Loading..." : "Watch Promo"}
              </button>
           </div>
        </div>

        {/* Live Community Video Campaigns (User Campaigns) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Community Video Campaigns ({videoCampaigns.length})
              </h3>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
              Real Views • Direct Video Links
            </span>
          </div>

          {campaignsLoading ? (
            <div className="py-8 text-center bg-white rounded-3xl border border-slate-100 space-y-2">
              <Loader2 size={24} className="animate-spin text-emerald-500 mx-auto" />
              <p className="text-xs font-bold text-slate-400">Loading creator campaigns...</p>
            </div>
          ) : videoCampaigns.length === 0 ? (
            <div className="bg-white rounded-3xl p-6 border-2 border-dashed border-slate-200 text-center space-y-3">
              <PlayCircle size={32} className="mx-auto text-slate-300" />
              <div>
                <h4 className="font-black text-sm text-slate-700">No Active Creator Campaigns</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  When users launch video campaigns, their video links and rewards appear here for everyone to watch & earn!
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {videoCampaigns.map((camp) => {
                const targetUrl = getCampaignUrl(camp);
                const viewsPct = Math.min(100, Math.round(((camp.currentViews || 0) / (camp.targetViews || 1)) * 100));

                return (
                  <div
                    key={camp.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md hover:shadow-lg transition-all space-y-3 relative overflow-hidden group"
                  >
                    {/* Platform Tag & Rewards Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border",
                          camp.platform === 'youtube' ? "bg-red-50 text-red-600 border-red-200" :
                          camp.platform === 'instagram' ? "bg-pink-50 text-pink-600 border-pink-200" :
                          camp.platform === 'facebook' ? "bg-blue-50 text-blue-600 border-blue-200" :
                          "bg-purple-50 text-purple-600 border-purple-200"
                        )}>
                          {camp.platform === 'youtube' && <Youtube size={12} />}
                          {camp.platform === 'instagram' && <Instagram size={12} />}
                          {camp.platform === 'facebook' && <Facebook size={12} />}
                          {camp.platform === 'other' && <Globe size={12} />}
                          <span>{camp.platform?.toUpperCase() || 'VIDEO'}</span>
                        </span>

                        <span className="text-[10px] text-slate-400 font-medium">
                          Goal: {camp.targetViews} views
                        </span>
                      </div>

                      {/* Reward Badge */}
                      <span className="bg-emerald-50 text-emerald-700 font-black text-xs px-2.5 py-1 rounded-xl border border-emerald-200 flex items-center gap-1 shadow-sm">
                        <Coins size={12} className="text-amber-500 fill-amber-500" />
                        <span>+{camp.rewardPerView} coins</span>
                      </span>
                    </div>

                    {/* Campaign Title & Direct Link */}
                    <div className="space-y-1">
                      <h4 className="font-black text-sm text-slate-900 leading-snug line-clamp-2">
                        {camp.videoTitle}
                      </h4>
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 truncate"
                        title={targetUrl}
                      >
                        <ExternalLink size={12} className="shrink-0" />
                        <span className="truncate">{targetUrl}</span>
                      </a>
                    </div>

                    {/* Progress Bar of Views */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500">
                        <span>Progress: {camp.currentViews || 0} / {camp.targetViews} views</span>
                        <span>{viewsPct}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                          style={{ width: `${viewsPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => startWatchingCampaign(camp)}
                      className="w-full py-3 bg-slate-900 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
                    >
                      <Play size={13} className="fill-white" />
                      <span>Watch & Earn +{camp.rewardPerView} Coins (30s)</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Spin and Earn */}
        <div className="bg-gradient-to-br from-purple-600 to-indigo-800 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
           <Sparkles className="absolute -top-8 -right-8 w-48 h-48 text-white/10 group-hover:rotate-12 transition-transform duration-700" />
           <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
              <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-xl border border-white/20">
                <motion.div
                  animate={spinning ? { rotate: 360 * 5 } : { rotate: 0 }}
                  transition={spinning ? { duration: 2, ease: "circOut" } : { duration: 0 }}
                >
                  <Sparkles size={40} className="text-purple-200" />
                </motion.div>
              </div>
              <div className="flex-1">
                <h3 className="text-3xl font-black italic tracking-tighter">LUCKY SPIN</h3>
                <p className="text-purple-100 font-bold text-sm mt-1 opacity-80 uppercase tracking-widest">Win up to 50 Tokens</p>
                <p className="text-purple-200 text-xs mt-3 leading-relaxed">Test your luck daily! Spin the wheel and unlock massive bonuses instantly.</p>
              </div>
              <button 
                disabled={spinning}
                onClick={spinAndEarn}
                className="bg-white text-purple-700 px-8 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-purple-50 transition-colors disabled:opacity-50"
              >
                {spinning ? <Loader2 className="animate-spin" /> : "Spin Wheel"}
              </button>
           </div>
        </div>

        {/* Play Store Redemption Shortcut */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
           <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <CreditCard size={32} />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-black italic tracking-tighter uppercase">Redeem Play Store Codes</h3>
                <p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest">Exchange coins for credits</p>
              </div>
              <button 
                onClick={() => setMode('redeem')}
                className="bg-white text-emerald-600 px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-50"
              >
                Go to Redeem
              </button>
           </div>
        </div>

        {/* Premium Offers Shortcut */}
        <div className="bg-gradient-to-r from-orange-500 to-rose-500 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
           <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <Trophy size={32} />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-black italic tracking-tighter uppercase">Premium Offers</h3>
                <p className="text-orange-100 text-[10px] font-black uppercase tracking-widest">High Earnings Wall</p>
              </div>
              <button 
                onClick={() => window.open('https://pubscale.com/offerwall', '_blank')}
                className="bg-white text-orange-600 px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest"
              >
                Go to PubScale
              </button>
           </div>
        </div>

        {/* Quick Surveys Shortcut */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
           <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <ClipboardList size={32} />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-black italic tracking-tighter uppercase">Quick Surveys</h3>
                <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest">Earn by sharing opinions</p>
              </div>
              <button 
                onClick={() => {
                   const playTab = document.querySelector('[id="play"]') as HTMLElement;
                   if (playTab) playTab.click();
                }}
                className="bg-white text-blue-600 px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest"
              >
                Take Survey
              </button>
           </div>
        </div>
      </div>

      {/* Referral Section (Enhanced) */}
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-3xl relative overflow-hidden border border-white/5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px]" />
        
        <div className="relative z-10 space-y-10">
          <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/30">
               <Users size={28} />
             </div>
             <div>
               <h3 className="text-3xl font-black italic tracking-tighter uppercase font-display">Affiliate Dashboard</h3>
               <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Build your empire</p>
             </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
             <div className="flex-1 bg-white/5 rounded-[2rem] p-8 border border-white/10">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">My Unique Link</p>
                <div className="flex items-center justify-between gap-4">
                   <p className="text-3xl font-black tracking-widest tabular-nums text-emerald-400">{profile?.referralCode || '------'}</p>
                   <button 
                     onClick={() => {
                       navigator.clipboard.writeText(profile?.referralCode || '');
                       alert("Referral code copied!");
                     }}
                     className="bg-white/10 p-4 rounded-2xl hover:bg-emerald-500 transition-colors group"
                   >
                     <ArrowRight className="text-white group-hover:translate-x-1 transition-transform" />
                   </button>
                </div>
             </div>

             <div className="flex-1 bg-white/5 rounded-[2rem] p-8 border border-white/10 flex items-center gap-6">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 border border-blue-500/30">
                  <Trophy size={32} />
                </div>
                <div>
                   <p className="text-4xl font-black tabular-nums">{referrals.length}</p>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Referrals</p>
                </div>
             </div>
          </div>

          {referrals.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Recently Connected</h4>
              <div className="grid grid-cols-2 gap-4">
                {referrals.map((ref, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <img src={ref.photoURL} alt="" className="w-8 h-8 rounded-full border border-white/20" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold truncate">{ref.displayName}</p>
                      <p className="text-[8px] font-black text-emerald-400 uppercase">Active</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reward Animation Overlay */}
      <AnimatePresence>
        {showReward && (
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xl touch-none pointer-events-none"
          >
             <motion.div 
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 15 }}
                className="relative flex flex-col items-center"
             >
                <div className="absolute -inset-20 bg-emerald-500/20 rounded-full blur-[100px] animate-pulse" />
                <Sparkles className="text-yellow-400 mb-6 w-32 h-32 drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]" />
                <h4 className="text-6xl font-black italic tracking-tighter text-white font-display">+{rewardAmount}</h4>
                <p className="text-emerald-400 font-black uppercase tracking-[0.5em] text-sm mt-4">Tokens Earned</p>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
