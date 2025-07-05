import React, { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  fetchChatHistory, 
  loadChat, 
  deleteChat, 
  startNewChat 
} from '../store/slices/chatSlice';
import {
  selectChatHistory,
  selectCurrentChatId,
  selectIsLoadingHistory,
  selectNeedsHistoryRefresh,
  selectUserState
} from '../store/selectors';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { 
  IconMessage, 
  IconTrash, 
  IconPlus, 
  IconClock,
  IconLoader
} from "@tabler/icons-react";

const ChatHistory = React.memo(({ onChatAction }) => {
  const dispatch = useAppDispatch();
  
  // Use optimized selectors
  const chatHistory = useAppSelector(selectChatHistory);
  const currentChatId = useAppSelector(selectCurrentChatId);
  const isLoadingHistory = useAppSelector(selectIsLoadingHistory);
  const needsHistoryRefresh = useAppSelector(selectNeedsHistoryRefresh);
  const { hasUser } = useAppSelector(selectUserState);

  // Get audio player controls
  const { stopAudio } = useAudioPlayer();

  // Load chat history when user is available
  useEffect(() => {
    if (hasUser) {
      dispatch(fetchChatHistory());
    }
  }, [dispatch, hasUser]);

  // Refresh chat history when needed (e.g., after sending messages)
  useEffect(() => {
    if (needsHistoryRefresh && hasUser) {
      dispatch(fetchChatHistory());
    }
  }, [needsHistoryRefresh, dispatch, hasUser]);

  // Memoized handlers for better performance
  const handleLoadChat = useCallback(async (chatId) => {
    try {
      // Stop any currently playing audio when switching chats
      stopAudio();
      console.log('🎵 Stopped audio when switching chats');
      
      await dispatch(loadChat(chatId)).unwrap();
      console.log('💬 Loaded chat:', chatId);
      
      // Call optional callback for mobile menu
      if (onChatAction) {
        onChatAction();
      }
    } catch (error) {
      console.error('❌ Error loading chat:', error);
    }
  }, [dispatch, stopAudio, onChatAction]);

  const handleDeleteChat = useCallback(async (chatId, chatTitle) => {
    if (window.confirm(`Are you sure you want to delete "${chatTitle}"?`)) {
      try {
        await dispatch(deleteChat(chatId)).unwrap();
        console.log('🗑️ Deleted chat:', chatId);
      } catch (error) {
        console.error('❌ Error deleting chat:', error);
      }
    }
  }, [dispatch]);

  const handleNewChat = useCallback(async () => {
    try {
      // Stop any currently playing audio when starting new chat
      stopAudio();
      console.log('🎵 Stopped audio when starting new chat');
      
      dispatch(startNewChat());
      console.log('➕ Started new chat');
      
      // Call optional callback for mobile menu
      if (onChatAction) {
        onChatAction();
      }
    } catch (error) {
      console.error('❌ Error starting new chat:', error);
    }
  }, [dispatch, stopAudio, onChatAction]);

  // Memoized chat list to prevent unnecessary re-renders
  const sortedChatHistory = React.useMemo(() => {
    return [...chatHistory].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }, [chatHistory]);

  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now - date) / 36e5;

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }, []);

  // Show loading state if no user yet
  if (!hasUser) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <IconMessage className="w-4 h-4" />
            Chat History
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <IconLoader className="w-8 h-8 mx-auto mb-3 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">
              Setting up your news anchor profile...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with New Chat Button */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <IconMessage className="w-4 h-4" />
            Chats
          </h2>
          <Button
            onClick={handleNewChat}
            size="sm"
            variant="outline"
            className="h-7 px-2"
          >
            <IconPlus className="w-3 h-3" />
          </Button>
        </div>
        

      </div>

      {/* Chat List */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-2">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <IconLoader className="w-4 h-4 animate-spin mr-2" />
                <span className="text-xs text-muted-foreground">Loading chats...</span>
              </div>
            ) : sortedChatHistory.length === 0 ? (
              <div className="text-center py-8">
                <IconMessage className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">No chats yet</p>
                <p className="text-xs text-muted-foreground/60">Start a conversation to see it here</p>
              </div>
            ) : (
              <div className="space-y-1">
                {sortedChatHistory.map((chat) => (
                  <Card
                    key={chat.id}
                    className={`cursor-pointer transition-all duration-200 hover:bg-accent/50 ${
                      currentChatId === chat.id ? 'ring-1 ring-blue-500 bg-blue-50 dark:bg-blue-950' : ''
                    }`}
                  >
                    <CardContent className="p-3" onClick={() => handleLoadChat(chat.id)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-xs truncate">{chat.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <IconClock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatDate(chat.updated_at)}
                            </span>
                            {chat.persona_name && (
                              <>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground truncate">
                                  {chat.persona_name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChat(chat.id, chat.title);
                          }}
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                        >
                          <IconTrash className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
});

ChatHistory.displayName = 'ChatHistory';

export default ChatHistory; 