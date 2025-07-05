import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../../config/api';

// Generate a UUID for new users
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Get or create user ID from localStorage
const getUserId = () => {
  let userId = localStorage.getItem('anchor-agent-user-id');
  if (!userId) {
    userId = generateUUID();
    localStorage.setItem('anchor-agent-user-id', userId);
  }
  return userId;
};

// Async thunk for loading user profile
export const loadProfile = createAsyncThunk(
  'profile/loadProfile',
  async (_, { rejectWithValue }) => {
    try {
      const userId = getUserId();
      
      const response = await fetch(`${API_BASE_URL}/api/profile/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.profile;
      } else if (response.status === 404) {
        // Profile doesn't exist, return the userId so we can create a profile later if needed
        return {
          uid: userId,
          displayName: '',
          email: '',
          personaId: null,
          persona: null,
          isSavedToSupabase: false,
          savedAt: null
        };
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load profile');
      }
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Async thunk for saving profile
export const saveProfile = createAsyncThunk(
  'profile/saveProfile',
  async ({ displayName, email, personaId }, { rejectWithValue }) => {
    try {
      const userId = getUserId();
      
      const response = await fetch(`${API_BASE_URL}/api/profile/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: userId,
          displayName: displayName,
          email: email,
          personaId: personaId
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.profile;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save profile');
      }
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Async thunk for deleting profile
export const deleteProfile = createAsyncThunk(
  'profile/deleteProfile',
  async (_, { rejectWithValue }) => {
    try {
      const userId = getUserId();
      
      const response = await fetch(`${API_BASE_URL}/api/profile/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.deletedProfile;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete profile');
      }
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  userId: getUserId(), // Set userId immediately on initialization
  displayName: '',
  email: '',
  personaId: null,
  persona: null,
  isSavedToSupabase: false,
  savedAt: null,
  isLoading: false,
  error: null
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    
    resetProfile: () => {
      return initialState;
    },

    // Set user ID directly (for initialization)
    setUserId: (state, action) => {
      state.userId = action.payload;
    },

    // Update profile data locally without saving to backend
    updateProfileLocal: (state, action) => {
      const { displayName, email, personaId } = action.payload;
      if (displayName !== undefined) state.displayName = displayName;
      if (email !== undefined) state.email = email;
      if (personaId !== undefined) state.personaId = personaId;
    }
  },
  extraReducers: (builder) => {
    builder
      // Load profile
      .addCase(loadProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          // Keep existing userId if it's already set correctly
          if (action.payload.uid) {
            state.userId = action.payload.uid;
          }
          state.displayName = action.payload.displayName || '';
          state.email = action.payload.email || '';
          state.personaId = action.payload.personaId || null;
          state.persona = action.payload.persona || null;
          state.isSavedToSupabase = action.payload.isSavedToSupabase || false;
          state.savedAt = action.payload.savedAt;
        }
      })
      .addCase(loadProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        // Still set userId even if profile load fails
        state.userId = getUserId();
      })
      
      // Save profile
      .addCase(saveProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(saveProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.userId = action.payload.uid;
        state.displayName = action.payload.displayName || '';
        state.email = action.payload.email || '';
        state.personaId = action.payload.personaId || null;
        state.persona = action.payload.persona || null;
        state.isSavedToSupabase = action.payload.isSavedToSupabase || false;
        state.savedAt = action.payload.savedAt;
      })
      .addCase(saveProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Delete profile
      .addCase(deleteProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        // Reset profile data but keep userId
        const userId = state.userId;
        Object.assign(state, initialState);
        state.userId = userId;
      })
      .addCase(deleteProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const {
  clearError,
  resetProfile,
  setUserId,
  updateProfileLocal
} = profileSlice.actions;

export default profileSlice.reducer; 