import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, increment, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MarketProduct, TransactionType } from '../types';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, Tag, FileText, Image as ImageIcon, Lightbulb, Search, Filter, Coins, Plus, Loader2, ArrowRight, User, Video, Zap, Music, Layers, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils';

export const Marketplace: React.FC = () => {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'script' | 'thumbnail' | 'strategy' | 'template' | 'course' | 'mentorship' | 'video' | 'hook' | 'sfx' | 'overlay'>('all');

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState(100);
  const [newCat, setNewCat] = useState<'script' | 'thumbnail' | 'strategy' | 'template' | 'course' | 'mentorship' | 'video' | 'hook' | 'sfx' | 'overlay'>('script');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'marketplace'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketProduct));
      
      // Seed data if empty (only for the first user to land here)
      if (data.length === 0 && !loading && user) {
        const seedItems = [
          {
            creatorId: user.uid,
            title: 'Viral Strategy Guide',
            description: 'Learn the secret algorithm hacks that top creators use to get millions of views.',
            price: 500,
            category: 'strategy' as const,
            salesCount: 1240,
            createdAt: new Date().toISOString()
          },
          {
            creatorId: user.uid,
            title: 'Master Edit Template',
            description: 'Professional video editing template for fast-paced, high-retention content.',
            price: 300,
            category: 'template' as const,
            salesCount: 850,
            createdAt: new Date().toISOString()
          },
          {
            creatorId: user.uid,
            title: 'Clickbait Thumbnail Pack',
            description: '30+ PSD templates designed to maximize your Click-Through Rate (CTR).',
            price: 250,
            category: 'thumbnail' as const,
            salesCount: 3200,
            createdAt: new Date().toISOString()
          },
          {
            creatorId: user.uid,
            title: '10 Viral Hook Templates',
            description: 'Proven script hooks that stop the scroll in the first 3 seconds.',
            price: 150,
            category: 'hook' as const,
            salesCount: 540,
            createdAt: new Date().toISOString()
          },
          {
            creatorId: user.uid,
            title: 'High-Retention SFX Pack',
            description: 'Professional sound effects including swooshes, pops, and transitions.',
            price: 100,
            category: 'sfx' as const,
            salesCount: 210,
            createdAt: new Date().toISOString()
          }
        ];
        seedItems.forEach(item => addDoc(collection(db, 'marketplace'), item));
      }

      setProducts(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loading]);

  const handleBuy = async (product: MarketProduct) => {
    if (!user || !profile) return;
    if (profile.coins < product.price) {
      alert("Insufficient coins!");
      return;
    }
    if (product.creatorId === user.uid) {
      alert("You cannot buy your own product!");
      return;
    }

    try {
      const isSystem = product.creatorId === 'system';
      const commission = isSystem ? 0 : Math.floor(product.price * 0.2); // 20% Platform Fee for users
      const sellerEarnings = product.price - commission;
      const now = new Date().toISOString();

      const buyerRef = doc(db, 'users', user.uid);
      const sellerRef = isSystem ? null : doc(db, 'users', product.creatorId);
      const productRef = doc(db, 'marketplace', product.id);
      const buyerTxRef = doc(collection(db, 'users', user.uid, 'transactions'));
      const sellerTxRef = isSystem ? null : doc(collection(db, 'users', product.creatorId, 'transactions'));

      const { runTransaction } = await import('firebase/firestore');

      await runTransaction(db, async (transaction) => {
        // Double check buyer balance inside transaction
        const buyerDoc = await transaction.get(buyerRef);
        if (!buyerDoc.exists() || (buyerDoc.data()?.coins || 0) < product.price) {
          throw new Error("Insufficient funds (verified)");
        }

        // 1. Deduct from buyer
        transaction.update(buyerRef, {
          coins: increment(-product.price)
        });

        // 2. Add to seller (if not system)
        if (sellerRef) {
          transaction.update(sellerRef, {
            coins: increment(sellerEarnings)
          });
        }

        // 3. Update sales count
        transaction.update(productRef, {
          salesCount: increment(1)
        });

        // 4. Record transactions
        transaction.set(buyerTxRef, {
          userId: user.uid,
          amount: -product.price,
          type: TransactionType.SPEND,
          description: isSystem ? `Redeemed: ${product.title}` : `Bought product: ${product.title}`,
          createdAt: now
        });

        if (sellerTxRef) {
          transaction.set(sellerTxRef, {
            userId: product.creatorId,
            amount: sellerEarnings,
            type: TransactionType.EARN,
            description: `Sold product (after 20% fee): ${product.title}`,
            createdAt: now
          });
        }

        if (isSystem && product.category === 'giftcard') {
          // Create a redemption request for the admin
          const redemptionRef = doc(collection(db, 'redemptions'));
          transaction.set(redemptionRef, {
            userId: user.uid,
            userEmail: user.email,
            productId: product.id,
            productTitle: product.title,
            amount: product.price,
            status: 'pending',
            createdAt: now
          });
        }
      });

      if (isSystem && product.category === 'giftcard') {
        alert(`REQUEST SUBMITTED! Your request for "${product.title}" has been sent to the admin. You will receive your real code at ${user.email} shortly.`);
      } else {
        alert(`Successfully purchased "${product.title}"! 20% platform fee applied.`);
      }
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Purchase failed.");
    }
  };

  const createListing = async () => {
    if (!user || !newTitle || !newDesc) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'marketplace'), {
        creatorId: user.uid,
        title: newTitle,
        description: newDesc,
        price: newPrice,
        category: newCat,
        salesCount: 0,
        createdAt: new Date().toISOString()
      });
      setShowAdd(false);
      setNewTitle('');
      setNewDesc('');
      alert("Product listed successfully!");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = activeCategory === 'all' ? products : products.filter(p => p.category === activeCategory);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-800">Content Market</h2>
          <button 
            onClick={() => setShowAdd(true)}
            className="p-2 bg-slate-900 text-white rounded-xl shadow-lg flex items-center gap-1 text-xs font-black uppercase tracking-tight"
          >
            <Plus size={18} /> Sell Content
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['all', 'script', 'thumbnail', 'strategy', 'template', 'course', 'mentorship', 'video', 'hook', 'sfx', 'overlay'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all border-2 capitalize",
                activeCategory === cat 
                  ? "bg-slate-900 border-slate-900 text-white shadow-md scale-105" 
                  : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-x-4 top-24 z-50 bg-white rounded-3xl p-6 shadow-2xl border-2 border-slate-200"
          >
            <h3 className="font-black text-lg text-slate-800 mb-4">List Your Content</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Title</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Catchy title for your content"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:border-slate-800 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Category</label>
                   <select 
                     value={newCat}
                     onChange={e => setNewCat(e.target.value as any)}
                     className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:border-slate-800 outline-none"
                   >
                     <option value="script">Script</option>
                     <option value="thumbnail">Thumbnail</option>
                     <option value="strategy">Strategy</option>
                     <option value="template">Template</option>
                     <option value="course">Course</option>
                     <option value="mentorship">Mentorship</option>
                     <option value="video">Edited Video</option>
                     <option value="hook">Viral Hook</option>
                     <option value="sfx">Sound Pack</option>
                     <option value="overlay">Overlays</option>
                   </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Price (Coins)</label>
                  <input 
                    type="number" 
                    value={newPrice}
                    onChange={e => setNewPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:border-slate-800 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Description</label>
                <textarea 
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="What makes this content special?"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:border-slate-800 outline-none h-24"
                />
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-4 text-sm font-black text-slate-400"
                >
                  Cancel
                </button>
                <button 
                  onClick={createListing}
                  disabled={isSubmitting}
                  className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : 'Confirm Listing'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Grid */}
      <div className="grid gap-4 pb-4">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : filtered.length > 0 ? (
          filtered.map(product => (
            <div key={product.id} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
               {product.creatorId === user?.uid && (
                 <div className="absolute top-0 right-0 bg-slate-100 text-slate-400 text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase">
                   Your Listing
                 </div>
               )}
               <div className="flex gap-4">
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
                    product.category === 'script' ? "bg-blue-50 text-blue-600" : 
                    product.category === 'thumbnail' ? "bg-emerald-50 text-emerald-600" :
                    product.category === 'strategy' ? "bg-orange-50 text-orange-600" :
                    product.category === 'template' ? "bg-purple-50 text-purple-600" :
                    product.category === 'course' ? "bg-red-50 text-red-600" :
                    product.category === 'mentorship' ? "bg-indigo-50 text-indigo-600" :
                    product.category === 'video' ? "bg-pink-50 text-pink-600" :
                    product.category === 'hook' ? "bg-yellow-50 text-yellow-600" :
                    product.category === 'sfx' ? "bg-cyan-50 text-cyan-600" :
                    product.category === 'giftcard' ? "bg-slate-900 text-emerald-400" :
                    "bg-rose-50 text-rose-600"
                  )}>
                    {product.category === 'script' ? <FileText size={32} /> : 
                     product.category === 'thumbnail' ? <ImageIcon size={32} /> :
                     product.category === 'strategy' ? <Lightbulb size={32} /> :
                     product.category === 'template' ? <Plus size={32} /> :
                     product.category === 'course' ? <Tag size={32} /> :
                     product.category === 'mentorship' ? <User size={32} /> :
                     product.category === 'video' ? <Video size={32} /> :
                     product.category === 'hook' ? <Zap size={32} /> :
                     product.category === 'sfx' ? <Music size={32} /> :
                     product.category === 'giftcard' ? <CreditCard size={32} /> :
                     <Layers size={32} />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="font-black text-slate-800 leading-tight">{product.title}</h4>
                    <p className="text-[10px] text-slate-400 font-bold line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  </div>
               </div>

               <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-emerald-600">
                      <Coins size={14} className="fill-emerald-600" />
                      <span className="font-black text-sm">{product.price}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-300">
                      <ShoppingBag size={14} />
                      <span className="text-[10px] font-black">{product.salesCount} sold</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleBuy(product)}
                    className={cn(
                      "px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-wide flex items-center gap-2 transition-all",
                      product.creatorId === user?.uid 
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                        : (product.category === 'giftcard' ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_5px_15px_rgba(16,185,129,0.3)]" : "bg-slate-900 text-white hover:bg-slate-800")
                    )}
                  >
                    {product.category === 'giftcard' ? 'Redeem Now' : 'Get Content'} <ArrowRight size={12} />
                  </button>
               </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
            <ShoppingBag size={64} className="text-slate-200" />
            <p className="font-bold text-slate-400 max-w-[200px]">No content listed in this category yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
