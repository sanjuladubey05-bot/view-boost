# Implementation Plan: Real Money Transactions, Admin Cashout Refund, & Multi-Platform Campaigns

## 1. Overview & Architectural Goals
This update enhances the platform with three critical production features:
1. **Interactive Real-World Payment Gateway**: An authentic payment checkout modal supporting direct UPI (`upi://pay` deep-link & dynamic QR), Cards (3DS OTP simulation), NetBanking, and Wallets with instant digital invoice receipts and real-time coin crediting.
2. **Admin Cashout Panel with Atomic Refund**: A dedicated Admin tab in the bottom navigation (unlocked exclusively for `sanjuladubey05@gmail.com`), providing real-time oversight of all user cashout requests with UPI IDs and payment methods. When an admin rejects a cashout, Firestore atomically restores the user's coins balance (`increment(coinCost)`) and logs a clear refund transaction.
3. **Multi-Platform Campaign Creation on Home Screen**: A compact `+` campaign launcher on the Home screen header opening a multi-platform campaign builder for **YouTube**, **Instagram**, **Facebook**, and **Other** with target view counts, coin rewards per view, total cost calculation, balance deduction, and in-app framed engagement verification.

---

## 2. Detailed Technical Breakdown

### Step 1: Extend Types & Data Models (`src/types.ts`)
- Update `Campaign` interface:
  - `platform`: `'youtube' | 'instagram' | 'facebook' | 'other'`
  - `targetUrl`: string (video link, Instagram reel/post URL, Facebook video/post URL, or external link)
  - `title`: string
  - `thumbnailUrl`?: string
- Update `Transaction` & `Redemption` interfaces:
  - `RedemptionStatus`: `'pending' | 'completed' | 'rejected'`
  - `rejectionReason`?: string
  - `refundedAt`?: string
  - `upiId`?: string
  - `method`: `'upi' | 'play_code' | string`

### Step 2: Admin Panel & Cashout Rejection Refund Engine (`src/components/AdminPanel.tsx` & Navigation)
- **Role Detection**: Detect if authenticated user is `sanjuladubey05@gmail.com`.
- **Navigation Update** (`src/components/AppShell.tsx`):
  - When `user?.email === 'sanjuladubey05@gmail.com'`, show a dedicated **Admin** tab with a shield icon in the bottom navigation bar.
- **Admin Panel Features**:
  - Live stream from `collection(db, 'redemptions')` ordered by `createdAt desc`.
  - Filter by status (`All`, `Pending`, `Completed`, `Rejected`).
  - View Card displaying:
    - User email & User ID
    - Payment Method badge (UPI vs Google Play Code)
    - UPI ID (with 1-tap copy button)
    - Cashout amount (₹ INR) & Coins deducted
    - Requested timestamp & UTR reference
  - **Admin Action: "Approve / Mark Settled"**:
    - Updates redemption status to `completed` in both `redemptions/{id}` and corresponding user transaction.
  - **Admin Action: "Reject & Refund Coins" (Crucial Request)**:
    - Uses Firestore `runTransaction` or atomic batch:
      1. Sets redemption doc status to `rejected` with `rejectionReason` and timestamp.
      2. Updates user doc `coins: increment(amount)` to instantly refund their deducted coins.
      3. Creates a new transaction entry in `users/{userId}/transactions`:
         - `type: 'refund'`
         - `amount: +amount`
         - `description: 'Refund: Cashout rejected by admin (₹{amountInr})'`
         - `createdAt: new Date().toISOString()`
    - Displays prompt/reason modal before rejecting for transparency.

### Step 3: Multi-Platform Campaign Creator (`src/components/CreateCampaignModal.tsx` & `src/pages/Home.tsx`)
- **Home Screen Entry**: Add a compact `+` icon button ("Create Campaign" with glowing emerald gradient) on the Home screen header.
- **Campaign Creation Flow**:
  1. **Platform Selection**:
     - YouTube (red icon)
     - Instagram (gradient pink/purple icon)
     - Facebook (blue icon)
     - Other / Web (violet icon)
  2. **URL & Details**:
     - Input for video/post/profile URL.
     - Automatic platform URL parsing & thumbnail generator.
     - Title of the campaign.
  3. **Economics & Reward Configurator**:
     - Target Views: Preset buttons (10, 25, 50, 100, 250, 500) or custom input.
     - Coin Reward Per View: Preset buttons (20, 50, 100, 200 coins) or custom input.
     - Total Coin Cost formula: `Target Views × Coins Per View`.
  4. **Balance Validation & Coin Purchase Shortcut**:
     - Real-time indicator of user's balance.
     - If balance is insufficient, shows remaining coins needed and a direct 1-tap button to open `PaymentModal`.
  5. **Submission**:
     - Atomically deducts `totalCost` coins from user profile.
     - Inserts campaign doc into `campaigns` with `ownerId`, `platform`, `targetUrl`, `targetViews`, `currentViews: 0`, `rewardPerView`, `status: 'active'`.
     - Logs `spend` transaction in `users/{uid}/transactions`.

### Step 4: Multi-Platform In-App Engagement Task Runner (`src/pages/Home.tsx`)
- Enhance task cards on Home screen to display platform-specific badges and icons (YouTube, Instagram, Facebook, Web).
- Update engagement modal / drawer:
  - Provides in-app framed preview or safe embed with engagement instructions.
  - 45s countdown timer ensuring user engagement.
  - Claim reward button that unlocks when the timer hits zero, transferring coins to the viewer and incrementing campaign view count.

### Step 5: Enhanced Real Money Payment Modal (`src/components/PaymentModal.tsx`)
- Enhance checkout flow with an interactive payment experience:
  - Authentic UPI checkout screen with dynamic QR code, `upi://pay` app launcher (GPay, PhonePe, Paytm, BHIM), and UTR entry.
  - Interactive Card checkout with live card number formatting, expiry, CVV, and 3DS OTP modal.
  - Digital Invoice Receipt modal upon payment success displaying Order ID, Amount, Coins credited, Timestamp, and Download/Copy button.
  - Instant coin balance reflection via Firestore increment.

---

## 3. Verification & Validation Plan
1. **Compilation & Types**: Run `tsc --noEmit` and `compile_applet` to ensure type safety.
2. **Admin Panel Verification**:
   - Verify `sanjuladubey05@gmail.com` sees the Admin navigation tab.
   - Verify cashout requests populate with UPI IDs.
   - Test "Reject & Refund": verify user's balance increases by the exact coin cost and transaction ledger reflects the refund.
3. **Multi-Platform Campaigns**:
   - Create campaigns across YouTube, Instagram, Facebook, and Other.
   - Verify views, reward per view, and total cost balance deduction.
   - Verify engagement timer and reward claim works properly.
4. **Payment Gateway**:
   - Test purchasing coin packs and verify instant receipt display and balance update.
