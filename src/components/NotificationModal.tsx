import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Bell, CheckCircle2, AlertCircle, Clock, ShieldCheck, 
  Trash2, CheckCheck, Sparkles, ExternalLink 
} from 'lucide-react';
import { AppNotification } from '../types';
import { requestPushPermission } from '../lib/notifications';
import { useAuth } from '../lib/AuthContext';
import { cn } from '../lib/utils';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  const { user } = useAuth();
  const [requesting, setRequesting] = React.useState(false);
  const [permissionState, setPermissionState] = React.useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  if (!isOpen) return null;

  const handleEnablePush = async () => {
    if (!user) return;
    setRequesting(true);
    const granted = await requestPushPermission(user.uid);
    setPermissionState(granted ? 'granted' : 'denied');
    setRequesting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-slate-950 text-white px-5 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bell size={16} />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight text-white flex items-center gap-2">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded-md">
                    {unreadCount} new
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">Campaign goals & payment alerts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg transition-all"
                title="Mark all as read"
              >
                <CheckCheck size={12} />
                <span>Read all</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Push Notification Permission Banner */}
        {permissionState !== 'granted' && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-700">
                <Sparkles size={14} />
              </div>
              <div>
                <p className="text-[11px] font-black text-emerald-950">Enable Instant Push Alerts</p>
                <p className="text-[9px] text-emerald-700 font-medium">Get notified when coins arrive or goals hit</p>
              </div>
            </div>
            <button
              onClick={handleEnablePush}
              disabled={requesting}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-[10px] font-black shadow-sm transition-all disabled:opacity-50 shrink-0"
            >
              {requesting ? 'Enabling...' : 'Enable'}
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Bell size={22} />
              </div>
              <h4 className="font-black text-sm text-slate-800">No Notifications Yet</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                You'll receive push alerts when your campaigns reach view goals or when payment/cashout status updates.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const isGoal = item.type === 'campaign_goal';
              const isPurchase = item.type === 'purchase_status';
              const isCashout = item.type === 'cashout_status';

              return (
                <div
                  key={item.id}
                  onClick={() => !item.read && onMarkAsRead(item.id)}
                  className={cn(
                    "p-3.5 rounded-2xl border text-left transition-all relative cursor-pointer",
                    item.read 
                      ? "bg-white border-slate-100 hover:border-slate-200" 
                      : "bg-emerald-50/50 border-emerald-200/80 shadow-sm"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                      isGoal ? "bg-amber-100 text-amber-700 border border-amber-200" :
                      isPurchase ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                      isCashout ? "bg-blue-100 text-blue-700 border border-blue-200" :
                      "bg-purple-100 text-purple-700 border border-purple-200"
                    )}>
                      {isGoal ? <Sparkles size={15} /> :
                       isPurchase ? <CheckCircle2 size={15} /> :
                       <ShieldCheck size={15} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={cn("text-xs leading-snug", item.read ? "font-bold text-slate-800" : "font-black text-slate-900")}>
                          {item.title}
                        </h4>
                        {!item.read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        {item.body}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[9px] text-slate-400">
                        <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(item.createdAt).toLocaleDateString()}</span>
                        <span className="font-bold uppercase tracking-wider text-[8px] text-slate-400">
                          {isGoal ? 'Goal' : isPurchase ? 'Deposit' : isCashout ? 'Cashout' : 'Alert'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            Push alerts are sent automatically on campaign completions & admin decisions.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
