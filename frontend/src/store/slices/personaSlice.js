import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { loadChat } from './chatSlice';
import { API_BASE_URL } from '../../config/api';

// Async thunk for fetching personas
export const fetchPersonas = createAsyncThunk(
  'persona/fetchPersonas',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/personas`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch personas');
      }
      
      const data = await response.json();
      return data.personas;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const personaSlice = createSlice({
  name: 'persona',
  initialState: {
    personas: [],
    selectedPersona: null,
    loading: false,
    error: null,
  },
  reducers: {
    selectPersona: (state, action) => {
      state.selectedPersona = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPersonas.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPersonas.fulfilled, (state, action) => {
        state.loading = false;
        state.personas = action.payload;
        // Auto-select first persona if none selected
        if (!state.selectedPersona && action.payload.length > 0) {
          state.selectedPersona = action.payload[0];
        }
      })
      .addCase(fetchPersonas.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Listen for loadChat success to update selected persona
      .addCase(loadChat.fulfilled, (state, action) => {
        const chatPersona = action.payload.persona;
        if (chatPersona && state.personas.length > 0) {
          // Find the matching persona in our personas array
          const matchingPersona = state.personas.find(
            persona => persona.id === chatPersona.id || persona.name === chatPersona.name
          );
          
          if (matchingPersona) {
            console.log('🎭 Auto-selecting persona from chat:', matchingPersona.name);
            state.selectedPersona = matchingPersona;
          }
        }
      });
  },
});

export const { selectPersona, clearError } = personaSlice.actions;

export default personaSlice.reducer; 