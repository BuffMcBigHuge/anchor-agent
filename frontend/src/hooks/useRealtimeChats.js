import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchChatHistory, loadChat } from '../store/slices/chatSlice';
import { selectUserId, selectCurrentChatId } from '../store/selectors';
import { SUPABASE_CONFIG } from '../config/api';

// Create Supabase client for real-time subscriptions
const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

export const useRealtimeChats = () => {
  const dispatch = useAppDispatch();
  const userId = useAppSelector(selectUserId);
  const currentChatId = useAppSelector(selectCurrentChatId);
  const channelRef = useRef(null);
  const isSubscribedRef = useRef(false);

  // Handle real-time chat updates
  const handleChatUpdate = useCallback((payload) => {
    console.log('📡 Real-time chat update received:', payload);
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
      case 'INSERT':
        console.log('📝 New chat created:', newRecord.id);
        // Refresh chat history to include new chat
        dispatch(fetchChatHistory());
        break;
        
      case 'UPDATE':
        console.log('✏️ Chat updated:', newRecord.id);
        console.log('📊 Updated chat data:', {
          id: newRecord.id,
          title: newRecord.title,
          messageCount: newRecord.messages?.length || 0,
          updatedAt: newRecord.updated_at
        });
        
        // If this is the currently loaded chat, reload it to get new messages
        if (currentChatId === newRecord.id) {
          console.log('🔄 Reloading current chat with new messages');
          dispatch(loadChat(newRecord.id));
        }
        
        // Always refresh chat history to update timestamps and message counts
        dispatch(fetchChatHistory());
        break;
        
      case 'DELETE':
        console.log('🗑️ Chat deleted:', oldRecord.id);
        // Refresh chat history to remove deleted chat
        dispatch(fetchChatHistory());
        break;
        
      default:
        console.log('📡 Unknown event type:', eventType);
    }
  }, [dispatch, currentChatId]);

  // Subscribe to real-time updates
  const subscribe = useCallback(() => {
    if (!userId || isSubscribedRef.current) {
      console.log('📡 Skipping subscription:', { userId, isSubscribed: isSubscribedRef.current });
      return;
    }

    console.log('📡 Subscribing to real-time chat updates for user:', userId);
    console.log('🔧 Supabase config:', { url: SUPABASE_CONFIG.url, hasAnonKey: !!SUPABASE_CONFIG.anonKey });

    // Create a channel for this user's chats
    const channel = supabase
      .channel(`chats_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats',
          filter: `user_id=eq.${userId}`
        },
        handleChatUpdate
      )
      .subscribe((status) => {
        console.log('📡 Real-time subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to real-time chat updates');
          isSubscribedRef.current = true;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error');
          isSubscribedRef.current = false;
        } else if (status === 'TIMED_OUT') {
          console.warn('⏰ Real-time subscription timed out');
          isSubscribedRef.current = false;
        } else if (status === 'CLOSED') {
          console.log('🔒 Real-time subscription closed');
          isSubscribedRef.current = false;
        }
      });

    channelRef.current = channel;
  }, [userId, handleChatUpdate]);

  // Unsubscribe from real-time updates
  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      console.log('📡 Unsubscribing from real-time chat updates');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      isSubscribedRef.current = false;
    }
  }, []);

  // Set up subscription when user ID is available
  useEffect(() => {
    if (userId) {
      console.log('📡 Setting up real-time subscription for user:', userId);
      subscribe();
    } else {
      console.log('📡 No user ID available, skipping subscription');
    }

    // Cleanup on unmount or user change
    return () => {
      unsubscribe();
    };
  }, [userId, subscribe, unsubscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    isSubscribed: isSubscribedRef.current,
    subscribe,
    unsubscribe
  };
}; 