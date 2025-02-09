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
      [themeId: string]: {
        strength: number;
        lastUpdated: string;
      }
    }
  };
  created_at: string;
  updated_at: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export class FirebaseService {
  private userRef(uid: string): DatabaseReference {
    return ref(database, `users/${uid}`);
  }

  private themesRef(): DatabaseReference {
    return ref(database, 'themes');
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

  async getAllThemes(): Promise<Theme[]> {
    try {
      const snapshot = await get(this.themesRef());
      return snapshot.val() ? Object.values(snapshot.val()) : [];
    } catch (error) {
      console.error('Error getting themes:', error);
      return [];
    }
  }

  async addTheme(id: string, name: string, description: string): Promise<Theme> {
    try {
      const theme: Theme = {
        id,
        name,
        description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await set(ref(database, `themes/${id}`), theme);
      return theme;
    } catch (error) {
      console.error('Error adding theme:', error);
      throw error;
    }
  }

  async updateUserPreferences(
    uid: string,
    themes: { [themeId: string]: { strength: number } }
  ): Promise<void> {
    try {
      // Validate that all theme IDs exist
      const availableThemes = await this.getAllThemes();
      const availableThemeIds = availableThemes.map(theme => theme.id);
      
      const invalidThemes = Object.keys(themes).filter(
        themeId => !availableThemeIds.includes(themeId)
      );

      if (invalidThemes.length > 0) {
        throw new Error(`Invalid theme IDs: ${invalidThemes.join(', ')}`);
      }

      const preferences: UserProfile['preferences'] = {
        themes: {}
      };
      
      Object.entries(themes).forEach(([themeId, { strength }]) => {
        preferences.themes[themeId] = {
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
