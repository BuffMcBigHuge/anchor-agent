import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { fetchPersonas } from './store/slices/personaSlice';
import { loadProfile } from './store/slices/profileSlice';
import { 
  setIsRecording, 
  addUserMessage, 
  sendAudioMessage,
  sendTextMessage,
  fetchAudioFromUrl,
  fetchAudioFromS3Key
} from './store/slices/chatSlice';
// Import optimized selectors
import {
  selectVisibleMessages,
  selectChatIsRecording,
  selectChatIsProcessing,
  selectCurrentChatId,
  selectSelectedPersona,
  selectChatInputDisabled,
  selectRecordingDisabled,
  selectMessageCount
} from './store/selectors';
import { Button } from "@/components/ui/button";
import ChatHistory from './components/ChatHistory';
import { Toaster } from './components/ui/toaster';
import { useToast } from './hooks/use-toast';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useRealtimeChats } from './hooks/useRealtimeChats';
import ChatHeader from './components/ChatHeader';
import MessageCarousel from './components/MessageCarousel';
import ChatFooter from './components/ChatFooter';



function App() {
  const dispatch = useAppDispatch();
  
  // Use optimized selectors instead of selecting entire state slices
  const messages = useAppSelector(selectVisibleMessages);
  const isRecording = useAppSelector(selectChatIsRecording);
  const isProcessing = useAppSelector(selectChatIsProcessing);
  const currentChatId = useAppSelector(selectCurrentChatId);

  const selectedPersona = useAppSelector(selectSelectedPersona);
  const messageCount = useAppSelector(selectMessageCount);
  
  // Memoized computed values
  const chatInputDisabled = useAppSelector(selectChatInputDisabled);
  const recordingDisabled = useAppSelector(selectRecordingDisabled);
  
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [videoEnabled, setVideoEnabled] = useState(false);
  
  // Use the modern AudioWorklet-based audio player
  const { playPCMAudio, downloadPCMAudio, stopAudio, isS3Key } = useAudioPlayer();
  
  // Set up real-time chat subscriptions
  const { isSubscribed: isRealtimeConnected } = useRealtimeChats();
  
  // Toast system
  const { toast } = useToast();

  // Memoize derived state to prevent unnecessary recalculations
  const hasMessages = useMemo(() => messageCount > 0, [messageCount]);





  // Memoized handlers to prevent unnecessary re-renders
  const handleMobileMenuChange = useCallback((open) => {
    setIsMobileMenuOpen(open);
  }, []);

  const handlePersonaModalChange = useCallback((open) => {
    setIsPersonaModalOpen(open);
  }, []);

  const handleProfileModalChange = useCallback((open) => {
    setIsProfileModalOpen(open);
  }, []);

  const handleTextInputChange = useCallback((e) => {
    setTextInput(e.target.value);
  }, []);

  const handleLocationChange = useCallback((locations) => {
    setSelectedLocations(locations);
  }, []);

  const handleVideoToggle = useCallback(() => {
    setVideoEnabled(prev => !prev);
  }, []);

  // Load personas and initialize user profile on component mount
  useEffect(() => {
    // Load personas
    dispatch(fetchPersonas());
          // Initialize user profile (creates user if doesn't exist)
      dispatch(loadProfile());
  }, [dispatch]);

  // Clear text input when a new chat is started
  useEffect(() => {
    if (!currentChatId) {
      setTextInput('');
      setSelectedLocations([]);
    }
  }, [currentChatId]);



  // Define playAudio function with useCallback to prevent recreation on every render
  const playAudio = useCallback(async (message) => {
    console.log('🎵 Playing audio for message:', message.id);
    
    // Stop any currently playing audio
    stopAudio();
    
    try {
      if (message.audioUrl) {
        console.log('🎵 Processing audio for message:', message.id, 'URL:', message.audioUrl);
        
        // Check if we already have cached audio data
        if (message.audioData) {
          console.log('🎵 Using cached audio data');
          await playPCMAudio(message.audioData);
          console.log('✅ Cached audio playback completed');
        } else {
          // Determine if it's an S3 key or legacy URL
          if (isS3Key(message.audioUrl)) {
            console.log('🔗 S3 key detected, fetching via signed URL...');
            
            // Fetch audio data from S3 key
            const result = await dispatch(fetchAudioFromS3Key({ 
              messageId: message.id, 
              s3Key: message.audioUrl 
            })).unwrap();
            
            // Play the audio data directly from the dispatch result
            if (result.audioData) {
              await playPCMAudio(result.audioData);
              console.log('✅ S3 audio playback completed');
            } else {
              console.warn('⚠️ No audio data returned from S3 fetch operation');
            }
          } else {
            console.log('🌐 Legacy URL detected, fetching directly...');
            
            // Fetch audio data from legacy URL
            const result = await dispatch(fetchAudioFromUrl({ 
              messageId: message.id, 
              audioUrl: message.audioUrl 
            })).unwrap();
            
            // Play the audio data directly from the dispatch result
            if (result.audioData) {
              await playPCMAudio(result.audioData);
              console.log('✅ Legacy audio playback completed');
            } else {
              console.warn('⚠️ No audio data returned from legacy fetch operation');
            }
          }
        }
      } else {
        console.warn('⚠️ No audio URL available for message:', message.id);
      }
    } catch (error) {
      console.error('❌ Audio playback failed:', error);
    }
  }, [dispatch, fetchAudioFromS3Key, fetchAudioFromUrl, isS3Key, playPCMAudio, stopAudio]);



  // Show toast notifications for real-time connection status changes
  useEffect(() => {
    if (isRealtimeConnected) {
      toast({
        title: "📡 Real-time connected",
        description: "You'll now receive live updates for new messages",
        duration: 3000,
      });
    }
  }, [isRealtimeConnected, toast]);

  const handleRecord = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorder.current.stop();
      dispatch(setIsRecording(false));
    } else {
      // Start recording
      try {
        // Stop any currently playing persona audio before starting to record
        stopAudio();
        console.log('🎵 Stopped persona audio to start recording');
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder.current = new MediaRecorder(stream);
        audioChunks.current = [];
        
        mediaRecorder.current.ondataavailable = (event) => {
          audioChunks.current.push(event.data);
        };
        
        mediaRecorder.current.onstop = async () => {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
          const reader = new FileReader();
          
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result.split(',')[1];
            
            // Add user message placeholder
            dispatch(addUserMessage({
              content: 'Processing audio...',
              timestamp: new Date().toLocaleTimeString(),
              isProcessing: true
            }));
            
            // Send audio message with selected persona and current chat ID
            dispatch(sendAudioMessage({
              base64Audio,
              personaName: selectedPersona?.name,
              personaId: selectedPersona?.id,
              chatId: currentChatId,
              locations: selectedLocations,
              videoEnabled: videoEnabled
            }));
          };
        };
        
        mediaRecorder.current.start();
        dispatch(setIsRecording(true));
      } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access microphone. Please check permissions.');
      }
    }
  }, [isRecording, dispatch, stopAudio, selectedPersona, currentChatId, selectedLocations, videoEnabled]);

  const handleSendText = useCallback(async () => {
    if (!textInput.trim() || !selectedPersona || isProcessing) return;
    
    const message = textInput.trim();
    setTextInput('');
    
    // Add user message
    dispatch(addUserMessage({
      content: message,
      timestamp: new Date().toLocaleTimeString(),
      isProcessing: false
    }));
    
    // Send text message to backend using the proper API endpoint
    dispatch(sendTextMessage({
      textMessage: message,
      personaName: selectedPersona.name,
      personaId: selectedPersona.id,
      chatId: currentChatId,
      locations: selectedLocations,
      videoEnabled: videoEnabled
    }));
      }, [textInput, selectedPersona, isProcessing, dispatch, currentChatId, selectedLocations, videoEnabled]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }, [handleSendText]);

  const downloadAudio = useCallback(async (message) => {
    console.log('💾 Downloading audio for message:', message.id);
    
    try {
      if (message.audioUrl) {
        console.log('💾 Processing audio for download:', message.id, 'URL:', message.audioUrl);
        
        // Check if we already have cached audio data
        if (message.audioData) {
          console.log('💾 Using cached audio data for download');
          
          // Generate filename with timestamp and persona
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const persona = message.persona || 'unknown';
          const filename = `audio-${persona}-${timestamp}.wav`;
          
          await downloadPCMAudio(message.audioData, filename);
          console.log('✅ Cached audio download completed');
        } else {
          // Determine if it's an S3 key or legacy URL
          if (isS3Key(message.audioUrl)) {
            console.log('🔗 S3 key detected, fetching via signed URL...');
            
            // Fetch audio data from S3 key
            const result = await dispatch(fetchAudioFromS3Key({ 
              messageId: message.id, 
              s3Key: message.audioUrl 
            })).unwrap();
            
            // Download the audio data directly from the dispatch result
            if (result.audioData) {
              // Generate filename with timestamp and persona
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const persona = message.persona || 'unknown';
              const filename = `audio-${persona}-${timestamp}.wav`;
              
              await downloadPCMAudio(result.audioData, filename);
              console.log('✅ S3 audio download completed');
            } else {
              console.warn('⚠️ No audio data returned from S3 fetch operation');
            }
          } else {
            console.log('🌐 Legacy URL detected, fetching directly...');
            
            // Fetch audio data from legacy URL
            const result = await dispatch(fetchAudioFromUrl({ 
              messageId: message.id, 
              audioUrl: message.audioUrl 
            })).unwrap();
            
            // Download the audio data directly from the dispatch result
            if (result.audioData) {
              // Generate filename with timestamp and persona
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const persona = message.persona || 'unknown';
              const filename = `audio-${persona}-${timestamp}.wav`;
              
              await downloadPCMAudio(result.audioData, filename);
              console.log('✅ Legacy audio download completed');
            } else {
              console.warn('⚠️ No audio data returned from legacy fetch operation');
            }
          }
        }
      } else {
        console.warn('⚠️ No audio URL available for download:', message.id);
      }
    } catch (error) {
      console.error('❌ Audio download failed:', error);
    }
  }, [dispatch, fetchAudioFromS3Key, fetchAudioFromUrl, isS3Key, downloadPCMAudio]);

  return (
    <div className="flex h-screen h-screen-mobile bg-background overflow-hidden">
      {/* Desktop Sidebar - Fixed width, full height */}
      <div className="hidden lg:flex w-80 flex-col border-r border-border">
        <ChatHistory />
      </div>

      {/* Main Chat Area - Takes remaining space */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <ChatHeader
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuChange={handleMobileMenuChange}
          isProfileModalOpen={isProfileModalOpen}
          onProfileModalChange={handleProfileModalChange}
          isPersonaModalOpen={isPersonaModalOpen}
          onPersonaModalChange={handlePersonaModalChange}
          isRealtimeConnected={isRealtimeConnected}
        />

        {/* Message Carousel - Centered display with navigation */}
        <MessageCarousel
          messages={messages}
          selectedPersona={selectedPersona}
          playAudio={playAudio}
          downloadAudio={downloadAudio}
          stopAudio={stopAudio}
          hasMessages={hasMessages}
        />

        {/* Footer */}
        <ChatFooter
          isRecording={isRecording}
          isProcessing={isProcessing}
          selectedPersona={selectedPersona}
          textInput={textInput}
          onTextInputChange={handleTextInputChange}
          onRecord={handleRecord}
          onSendText={handleSendText}
          onKeyPress={handleKeyPress}
          inputDisabled={chatInputDisabled}
          recordingDisabled={recordingDisabled}
          selectedLocations={selectedLocations}
          onLocationChange={handleLocationChange}
          hasMessages={hasMessages}
          videoEnabled={videoEnabled}
          onVideoToggle={handleVideoToggle}
        />
      </div>
      

      
      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}

export default App;