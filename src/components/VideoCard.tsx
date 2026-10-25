import React from 'react';
import { motion } from 'motion/react';
import { Play, Coins, ExternalLink } from 'lucide-react';
import { Campaign } from '../types';
import { cn } from '../lib/utils';

interface VideoCardProps {
  campaign: Campaign;
  onWatch: (campaign: Campaign) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ campaign, onWatch }) => {
  const progress = (campaign.currentViews / campaign.targetViews) * 100;
  const platform = campaign.platform || 'youtube';

  const renderThumbnail = () => {
    if (platform === 'youtube' && campaign.videoId && campaign.videoId !== 'multi_platform') {
      return (
        <img 
          src={`https://img.youtube.com/vi/${campaign.videoId}/mqdefault.jpg`} 
          alt={campaign.videoTitle}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
      );
    }

    if (platform === 'instagram') {
      return (
        <div className="w-full h-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex flex-col items-center justify-center text-white p-2">
          <span className="text-[9px] font-black uppercase tracking-wider mb-0.5">Instagram</span>
          <span className="text-[8px] font-bold opacity-80">Reel / Post</span>
        </div>
      );
    }

    if (platform === 'facebook') {
      return (
        <div className="w-full h-full bg-gradient-to-tr from-blue-700 to-indigo-600 flex flex-col items-center justify-center text-white p-2">
          <span className="text-[9px] font-black uppercase tracking-wider mb-0.5">Facebook</span>
          <span className="text-[8px] font-bold opacity-80">Watch / Post</span>
        </div>
      );
    }

    return (
      <div className="w-full h-full bg-gradient-to-tr from-purple-700 to-slate-900 flex flex-col items-center justify-center text-white p-2">
        <span className="text-[9px] font-black uppercase tracking-wider mb-0.5">Web Content</span>
        <span className="text-[8px] font-bold opacity-80">Engagement</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-[2rem] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-slate-100 mb-4 hover:shadow-[0_20px_50px_rgba(0,0,0,0.06)] transition-all group relative overflow-hidden">
      <div className="flex gap-4">
        <div className="relative w-32 h-20 bg-slate-200 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-slate-50">
          {renderThumbnail()}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px]">
            <Play className="text-white fill-white drop-shadow-lg" size={24} />
          </div>
          {/* Platform Tag */}
          <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[8px] font-black text-white uppercase tracking-wider">
            {platform}
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-between py-0.5">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
                platform === 'youtube' ? "bg-red-50 text-red-600 border border-red-200" :
                platform === 'instagram' ? "bg-pink-50 text-pink-600 border border-pink-200" :
                platform === 'facebook' ? "bg-blue-50 text-blue-600 border border-blue-200" :
                "bg-purple-50 text-purple-600 border border-purple-200"
              )}>
                {platform}
              </span>
            </div>
            <h3 className="font-black text-sm line-clamp-2 leading-snug text-slate-800 font-display">
              {campaign.videoTitle}
            </h3>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-emerald-500">
              <Coins size={14} className="fill-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-tighter">+{campaign.rewardPerView} Coins</span>
            </div>
            
            <button 
              onClick={() => onWatch(campaign)}
              className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-emerald-500 transition-all shadow-md active:scale-95"
            >
              Watch <ExternalLink size={10} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-[8px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">
          <span className="flex items-center gap-1"><ExternalLink size={8} /> Engagement Level</span>
          <span className="text-emerald-500">{campaign.currentViews} / {campaign.targetViews}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
          />
        </div>
      </div>
    </div>
  );
};
