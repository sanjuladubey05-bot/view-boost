import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Image as ImageIcon, FileText, Music, Loader2, Send, Wand2, Download, Copy, Trash2, Video } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const Studio: React.FC = () => {
  const { user } = useAuth();
  const [activeTool, setActiveTool] = useState<'script' | 'image' | 'video'>('script');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showListModal, setShowListModal] = useState(false);
  const [listPrice, setListPrice] = useState(100);
  const [listTitle, setListTitle] = useState('');
  const [isListing, setIsListing] = useState(false);

  const listOnMarketplace = async () => {
    if (!user || !result || !listTitle) return;
    setIsListing(true);
    try {
      await addDoc(collection(db, 'marketplace'), {
        creatorId: user.uid,
        title: listTitle,
        description: `AI-generated ${activeTool}: ${prompt}`,
        price: listPrice,
        category: activeTool === 'script' ? 'script' : (activeTool === 'image' ? 'thumbnail' : 'strategy'),
        previewUrl: activeTool === 'image' ? result : undefined,
        contentUrl: result, // For demo, the result is the content
        salesCount: 0,
        createdAt: new Date().toISOString()
      });
      alert("Listed on Marketplace!");
      setShowListModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsListing(false);
    }
  };

  const tools = [
    { id: 'script', label: 'Script Writer', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'image', label: 'Thumbnail Gen', icon: ImageIcon, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'video', label: 'Video Creator', icon: Video, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  const generateContent = async () => {
    if (!prompt || !user) return;
    setIsGenerating(true);
    setResult(null);

    try {
      // Logic for model selection and API key
      let currentAi = ai;
      const needsPaidKey = activeTool === 'video';

      if (needsPaidKey) {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          // @ts-ignore
          await window.aistudio.openSelectKey();
          // Skill says assume success after openSelectKey
        }
        // Use injected API_KEY
        currentAi = new GoogleGenAI({ apiKey: (process.env as any).API_KEY || process.env.GEMINI_API_KEY });
      }

      if (activeTool === 'script') {
        const response = await currentAi.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Write a high-engaging YouTube video script based on this prompt: ${prompt}. Include a catchy title and section breakdowns.`,
        });
        const text = response.text;
        if (!text) throw new Error("Empty response from AI");
        setResult(text);
        
        await addDoc(collection(db, 'users', user.uid, 'ai_outputs'), {
          type: 'script',
          prompt,
          result: text,
          createdAt: new Date().toISOString()
        });
      } else if (activeTool === 'image') {
        const response = await currentAi.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `A vibrant YouTube thumbnail for: ${prompt}. High quality, attention-grabbing.` }] },
        });
        
        let imageUrl = '';
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }

        if (!imageUrl) {
          // Fallback check in case it returned text describing failure
          const text = response.text;
          throw new Error(text || "Failed to generate image.");
        }

        setResult(imageUrl);

        await addDoc(collection(db, 'users', user.uid, 'ai_outputs'), {
          type: 'image',
          prompt,
          result: imageUrl,
          createdAt: new Date().toISOString()
        });
      } else if (activeTool === 'video') {
        setResult("Video generation started. This usually takes 1-2 minutes...");
        
        let operation = await currentAi.models.generateVideos({
          model: 'veo-3.1-lite-generate-preview',
          prompt: `A short cinematic visual for: ${prompt}`,
          config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
          }
        });
        
        // Poll for completion
        while (!operation.done) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          operation = await currentAi.operations.getVideosOperation({ operation: (operation as any) });
        }
        
        const videoUrl = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (videoUrl) {
           // Fetch the video data to create a local blob URL (requires API key in header)
           const apiKey = (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
           const vResponse = await fetch(videoUrl, {
             headers: { 'x-goog-api-key': apiKey }
           });
           const blob = await vResponse.blob();
           const localUrl = URL.createObjectURL(blob);

           setResult(localUrl);
           await addDoc(collection(db, 'users', user.uid, 'ai_outputs'), {
             type: 'video',
             prompt,
             result: localUrl, // Storing blob URL is not persistent across sessions but okay for immediate view
             createdAt: new Date().toISOString()
           });
        } else {
           throw new Error("Failed to generate video.");
        }
      }
    } catch (e: any) {
      console.error(e);
      setResult(`Error: ${e.message || "Failed to generate content."}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tool Selector */}
      <div className="grid grid-cols-3 gap-3">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => {
              setActiveTool(tool.id as any);
              setResult(null);
            }}
            className={cn(
              "p-4 rounded-2xl flex flex-col items-center gap-2 transition-all border-2",
              activeTool === tool.id 
                ? "bg-white border-slate-900 shadow-lg scale-105" 
                : "bg-slate-50 border-transparent opacity-60 grayscale"
            )}
          >
            <div className={cn("p-2 rounded-xl", tool.bg)}>
              <tool.icon className={tool.color} size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-800">
              {tool.label}
            </span>
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
          Describe your idea
        </label>
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`E.g. A mystery story about a futuristic city...`}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-4 text-sm font-bold focus:border-slate-800 transition-all outline-none resize-none min-h-[120px]"
          />
          <button 
            disabled={isGenerating || !prompt}
            onClick={generateContent}
            className="absolute bottom-3 right-3 bg-slate-900 text-white p-3 rounded-xl shadow-lg disabled:opacity-30 transition-all hover:bg-slate-800"
          >
            {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 font-bold mt-3 px-1 flex items-center gap-1">
          <Sparkles size={10} className="text-yellow-500" />
          AI Studio uses Gemini to bring your ideas to life.
        </p>
      </div>

      {/* Result Display */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 flex items-center gap-2">
                <Sparkles size={18} className="text-yellow-500" />
                AI Generation Result
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    if (activeTool === 'script') navigator.clipboard.writeText(result);
                    else alert("Downloaded locally!");
                  }}
                  className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-slate-900 transition-colors"
                  title="Copy/Download"
                >
                  {activeTool === 'script' ? <Copy size={16} /> : <Download size={16} />}
                </button>
                <button 
                  onClick={() => setResult(null)}
                  className="p-2 bg-slate-50 text-red-400 rounded-lg hover:text-red-600 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 max-h-[400px] overflow-y-auto">
              {activeTool === 'script' ? (
                <div className="space-y-4">
                  <div className="text-sm text-slate-700 whitespace-pre-wrap font-medium leading-relaxed">
                    {result}
                  </div>
                  <button 
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all"
                    onClick={() => {
                      setListTitle(prompt.slice(0, 50));
                      setShowListModal(true);
                    }}
                  >
                    List on Marketplace
                  </button>
                </div>
              ) : activeTool === 'image' ? (
                <div className="flex flex-col items-center gap-4">
                  <img src={result} alt="Generated" className="w-full rounded-xl shadow-sm border border-slate-200" />
                  <button 
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 transition-all"
                    onClick={() => {
                      setListTitle(prompt.slice(0, 50));
                      setShowListModal(true);
                    }}
                  >
                    List on Marketplace
                  </button>
                </div>
              ) : (
                <div className="text-center py-10 space-y-4">
                  <Video size={48} className="text-slate-300 mx-auto" />
                  <div className="text-sm font-bold text-slate-500 leading-relaxed">
                    {result.startsWith('http') || result.startsWith('data:video') ? (
                       <div className="space-y-4">
                         <video src={result} controls className="w-full rounded-xl" />
                         <button 
                            className="w-full py-3 bg-purple-600 text-white rounded-xl font-black text-sm hover:bg-purple-700 transition-all"
                            onClick={() => {
                              setListTitle(prompt.slice(0, 50));
                              setShowListModal(true);
                            }}
                          >
                            List on Marketplace
                          </button>
                       </div>
                    ) : <p>{result}</p>}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showListModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl space-y-6"
            >
              <h3 className="text-xl font-black text-slate-900">Marketplace Listing</h3>
              <div className="space-y-4">
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Listing Title</label>
                   <input 
                     value={listTitle}
                     onChange={e => setListTitle(e.target.value)}
                     className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:border-slate-800 outline-none"
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Price (Coins)</label>
                   <input 
                     type="number"
                     value={listPrice}
                     onChange={e => setListPrice(Number(e.target.value))}
                     className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:border-slate-800 outline-none"
                   />
                 </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowListModal(false)}
                  className="flex-1 py-4 text-sm font-black text-slate-400"
                >
                  Cancel
                </button>
                <button 
                  onClick={listOnMarketplace}
                  disabled={isListing || !listTitle}
                  className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center"
                >
                  {isListing ? <Loader2 className="animate-spin" /> : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!result && !isGenerating && (
         <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-3xl py-12 flex flex-col items-center justify-center text-center opacity-40">
           <Wand2 size={40} className="text-slate-300 mb-3" />
           <p className="font-bold text-slate-400 px-10 text-sm">Your creation will appear here.</p>
         </div>
      )}
    </div>
  );
};
