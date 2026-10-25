export enum TransactionType {
  EARN = 'earn',
  SPEND = 'spend',
  PURCHASE = 'purchase',
  BONUS = 'bonus',
  REDEEM = 'redeem'
}

export enum CampaignStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  PAUSED = 'paused'
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  coins: number;
  referralCode: string;
  referredBy?: string | null;
  lastDailyClaim?: string;
  rewardDay?: number;
  createdAt: string;
}

export type CampaignPlatform = 'youtube' | 'instagram' | 'facebook' | 'other';

export interface Campaign {
  id: string;
  ownerId: string;
  videoId?: string;
  videoTitle: string;
  platform?: CampaignPlatform;
  targetUrl?: string;
  targetViews: number;
  currentViews: number;
  rewardPerView: number;
  status: CampaignStatus;
  createdAt: string;
  isBoosted?: boolean;
}

export interface ViewEntry {
  id: string;
  viewerId: string;
  campaignId: string;
  rewardClaimed: number;
  timestamp: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: TransactionType | 'earn' | 'spend' | 'purchase' | 'bonus' | 'redeem' | 'refund' | string;
  description: string;
  redeemCode?: string;
  status?: 'pending' | 'completed' | 'fulfilled' | 'rejected' | 'processing' | string;
  method?: string;
  upiId?: string;
  amountInr?: number;
  utrNumber?: string;
  createdAt: string;
}

export interface RedemptionRecord {
  id: string;
  userId: string;
  userEmail: string;
  method: 'upi' | 'play_code' | string;
  productTitle: string;
  amountInr: number;
  amount: number; // Coins deducted
  upiId?: string;
  redeemCode?: string;
  utrNumber?: string;
  status: 'pending' | 'completed' | 'rejected' | string;
  rejectionReason?: string;
  rejectedAt?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface MarketProduct {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  price: number;
  category: 'script' | 'thumbnail' | 'strategy' | 'template' | 'course' | 'mentorship' | 'video' | 'hook' | 'sfx' | 'overlay' | 'giftcard';
  contentUrl?: string; // For downloadable content
  previewUrl?: string; // For thumbnail preview or snippet
  salesCount: number;
  createdAt: string;
}

export interface AIStudioOutput {
  id: string;
  userId: string;
  type: 'script' | 'image' | 'video';
  prompt: string;
  result: string; // The generated text or image URL/base64 or video blob URL
  createdAt: string;
}

export interface LeaderboardUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  coins: number;
  rank?: number;
  badge?: string;
  level?: string;
  isCurrentUser?: boolean;
}

export interface CoinPack {
  id: string;
  name: string;
  coins: number;
  bonusCoins?: number;
  priceInr: number;
  priceFormatted: string;
  badge?: string;
  popular?: boolean;
  color?: string;
}

export interface CoinPurchase {
  id: string;
  userId: string;
  userEmail: string;
  packId: string;
  packName: string;
  coins: number;
  bonusCoins?: number;
  priceInr: number;
  utrNumber: string;
  adminUpiId: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  rejectionReason?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'campaign_goal' | 'cashout_status' | 'purchase_status' | 'system';
  referenceId?: string;
  read: boolean;
  createdAt: string;
}
