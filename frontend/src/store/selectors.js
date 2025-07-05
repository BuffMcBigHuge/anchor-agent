import { createSelector } from '@reduxjs/toolkit';

// Chat selectors
export const selectChatMessages = (state) => state.chat.messages;
export const selectChatIsRecording = (state) => state.chat.isRecording;
export const selectChatIsProcessing = (state) => state.chat.isProcessing;
export const selectCurrentChatId = (state) => state.chat.currentChatId;
export const selectChatHistory = (state) => state.chat.chatHistory;
export const selectIsLoadingHistory = (state) => state.chat.isLoadingHistory;
export const selectNeedsHistoryRefresh = (state) => state.chat.needsHistoryRefresh;

// Persona selectors
export const selectSelectedPersona = (state) => state.persona.selectedPersona;
export const selectPersonas = (state) => state.persona.personas;
export const selectPersonaLoading = (state) => state.persona.loading;

// User selectors (simplified - no auth required)
export const selectUserId = (state) => state.profile.userId;
export const selectUserName = (state) => state.profile.displayName;

// Profile selectors
export const selectDisplayName = (state) => state.profile.displayName;
export const selectEmail = (state) => state.profile.email;
export const selectProfilePersonaId = (state) => state.profile.personaId;
export const selectProfilePersona = (state) => state.profile.persona;
export const selectIsSavedToSupabase = (state) => state.profile.isSavedToSupabase;
export const selectProfileIsLoading = (state) => state.profile.isLoading;
export const selectProfileError = (state) => state.profile.error;
export const selectProfileSavedAt = (state) => state.profile.savedAt;

// Memoized derived selectors
export const selectVisibleMessages = createSelector(
  [selectChatMessages],
  (messages) => {
    // Filter out any invalid messages and ensure proper ordering
    return messages
      .filter(message => message && message.id)
      .sort((a, b) => {
        // Sort by timestamp if available, otherwise by id
        if (a.timestamp && b.timestamp) {
          return new Date(a.timestamp) - new Date(b.timestamp);
        }
        return a.id - b.id;
      });
  }
);

export const selectMessageCount = createSelector(
  [selectChatMessages],
  (messages) => messages.length
);

export const selectHasMessages = createSelector(
  [selectMessageCount],
  (count) => count > 0
);

export const selectLastMessage = createSelector(
  [selectVisibleMessages],
  (messages) => messages.length > 0 ? messages[messages.length - 1] : null
);

export const selectBotMessages = createSelector(
  [selectVisibleMessages],
  (messages) => messages.filter(message => message.type === 'bot')
);

export const selectUserMessages = createSelector(
  [selectVisibleMessages],
  (messages) => messages.filter(message => message.type === 'user')
);

export const selectMessagesWithAudio = createSelector(
  [selectVisibleMessages],
  (messages) => messages.filter(message => message.audioUrl)
);

export const selectChatInputDisabled = createSelector(
  [selectSelectedPersona, selectChatIsProcessing],
  (selectedPersona, isProcessing) => 
    !selectedPersona || isProcessing
);

export const selectRecordingDisabled = createSelector(
  [selectChatIsProcessing, selectSelectedPersona],
  (isProcessing, selectedPersona) => 
    isProcessing || !selectedPersona
);

export const selectCurrentPersonaName = createSelector(
  [selectSelectedPersona],
  (selectedPersona) => selectedPersona?.name || null
);

export const selectUserState = createSelector(
  [selectUserId, selectUserName, selectProfileIsLoading],
  (userId, userName, isLoading) => ({
    userId,
    userName,
    hasUser: !!userId && !isLoading // Only consider user "ready" when not loading
  })
);

// Chat summary selectors
export const selectChatSummary = createSelector(
  [selectCurrentChatId, selectMessageCount, selectCurrentPersonaName],
  (currentChatId, messageCount, personaName) => ({
    chatId: currentChatId,
    messageCount,
    personaName,
    hasActiveChat: !!currentChatId
  })
); 