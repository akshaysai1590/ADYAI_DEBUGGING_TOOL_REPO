import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  teamId: string | null; // e.g. "DBG01"
  teamDbId: string | null; // UUID from DB
  displayName: string | null;
  isAdmin: boolean;
  setTeamLogin: (token: string, teamId: string, displayName: string, teamDbId?: string) => void;
  setAdminLogin: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      teamId: null,
      teamDbId: null,
      displayName: null,
      isAdmin: false,
      setTeamLogin: (token, teamId, displayName, teamDbId) => 
        set({ 
          token, 
          teamId, 
          displayName, 
          teamDbId: teamDbId || '33333333-3333-3333-3333-333333333333', 
          isAdmin: false 
        }),
      setAdminLogin: (token) => 
        set({ token, teamId: null, teamDbId: null, displayName: null, isAdmin: true }),
      logout: () => set({ token: null, teamId: null, teamDbId: null, displayName: null, isAdmin: false }),
    }),
    {
      name: 'adhyant-auth-storage',
    }
  )
);
