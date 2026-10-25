import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Sync profile
        const userRef = doc(db, 'users', u.uid);
        
        // Listen to profile updates
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // Create profile if not exists
            const pendingRef = sessionStorage.getItem('pendingReferral');
            const initialCoins = pendingRef ? 100 : 50;
            const now = new Date().toISOString();
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || 'User',
              photoURL: u.photoURL || '',
              coins: initialCoins,
              referredBy: pendingRef || null,
              referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
              createdAt: now
            };
            setDoc(userRef, newProfile);
            setProfile(newProfile);
            // Record initial bonus transaction
            addDoc(collection(db, 'users', u.uid, 'transactions'), {
              userId: u.uid,
              amount: initialCoins,
              type: 'bonus',
              description: pendingRef ? 'Welcome Referral Sign-up Bonus' : 'Welcome Sign-up Bonus',
              createdAt: now
            }).catch(console.error);
            sessionStorage.removeItem('pendingReferral');
          }
        }, (error) => {
          console.error("Profile sync error:", error);
        });

        setLoading(false);
        return () => unsubscribe();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
