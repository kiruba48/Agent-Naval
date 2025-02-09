import { auth, database } from './config';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User
} from 'firebase/auth';
import {
  ref,
  set,
  get,
  update,
  DatabaseReference
} from 'firebase/database';

export interface UserProfile {
  uid: string;
  name: string;
  preferences: {
    themes: {
      [theme: string]: {
        strength: number;
        lastUpdated: string;
      }
    }
  };
  created_at: string;
  updated_at: string;
}

export class FirebaseService {
  private userRef(uid: string): DatabaseReference {
    return ref(database, `users/${uid}`);
  }

  async createUser(email: string, password: string, name: string): Promise<UserProfile> {
    try {
      // Create authentication user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { uid } = userCredential.user;

      // Create user profile
      const userProfile: UserProfile = {
        uid,
        name,
        preferences: {
          themes: {}
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Save to realtime database
      await set(this.userRef(uid), userProfile);

      return userProfile;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async signIn(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const snapshot = await get(this.userRef(uid));
      return snapshot.val() as UserProfile;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  async updateUserPreferences(
    uid: string,
    themes: { [theme: string]: { strength: number } }
  ): Promise<void> {
    try {
      const preferences: UserProfile['preferences'] = {
        themes: {}
      };
      
      // Create valid Firebase keys
      Object.entries(themes).forEach(([theme, { strength }]) => {
        preferences.themes[theme.replace(/[.#$\/\[\]]/g, '_')] = {
          strength,
          lastUpdated: new Date().toISOString()
        };
      });

      await update(this.userRef(uid), {
        preferences,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const firebaseService = new FirebaseService();
