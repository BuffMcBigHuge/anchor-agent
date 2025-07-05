import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { 
  IconChevronLeft, 
  IconChevronRight, 
  IconVolume, 
  IconDownload,
  IconVideo,
  IconPlayerPlay,
  IconPlayerPause,
  IconMicrophone
} from "@tabler/icons-react";

const MessageCarousel = React.memo(({ 
  messages, 
  selectedPersona, 
  playAudio, 
  downloadAudio,
  stopAudio,
  hasMessages
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRef = useRef(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Get current message
  const currentMessage = useMemo(() => {
    if (!messages || messages.length === 0) return null;
    return messages[currentIndex] || null;
  }, [messages, currentIndex]);

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
    // Stop any playing audio when navigating
    if (stopAudio) {
      stopAudio();
    }
    setIsVideoPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [stopAudio]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(messages.length - 1, prev + 1));
    // Stop any playing audio when navigating
    if (stopAudio) {
      stopAudio();
    }
    setIsVideoPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [messages.length, stopAudio]);

  // Video controls
  const handleVideoPlay = useCallback(() => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  }, [isVideoPlaying]);

  const handleVideoEnded = useCallback(() => {
    setIsVideoPlaying(false);
  }, []);

  // Video download function
  const downloadVideo = useCallback(async (message) => {
    if (!message.videoUrl) return;
    
    try {
      console.log('📹 Downloading video for message:', message.id);
      const response = await fetch(message.videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video_${message.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      console.log('✅ Video downloaded successfully');
    } catch (error) {
      console.error('❌ Error downloading video:', error);
    }
  }, []);

  // Update current index when messages change (new message arrives or chat switches)
  React.useEffect(() => {
    if (messages.length > 0) {
      setCurrentIndex(messages.length - 1);
    } else {
      setCurrentIndex(0);
    }
    
    // Stop any playing audio when messages change (chat switch or new messages)
    if (stopAudio) {
      stopAudio();
    }
    
    // Reset video state when messages change (chat switch or new messages)
    setIsVideoPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [messages, stopAudio]);

  // Ensure currentIndex is always valid when messages change
  React.useEffect(() => {
    if (currentIndex >= messages.length && messages.length > 0) {
      setCurrentIndex(messages.length - 1);
    } else if (currentIndex < 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, messages.length]);

  // Reset video state when current message changes
  React.useEffect(() => {
    setIsVideoPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [currentMessage?.id]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext]);

  if (!hasMessages) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <IconMicrophone className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-semibold mb-2">
            Start a conversation!
          </h2>
          <p className="text-sm">
            {selectedPersona 
              ? `Currently speaking with ${selectedPersona.name}`
              : 'Select a news anchor above to begin'
            }
          </p>
        </div>
      </div>
    );
  }

  if (!currentMessage) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground py-8">
          <p className="text-sm">No message to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Navigation Arrows */}
      <Button
        variant="outline"
        size="sm"
        className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 h-12 w-12 rounded-full"
        onClick={goToPrevious}
        disabled={currentIndex === 0}
      >
        <IconChevronLeft className="w-5 h-5" />
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 h-12 w-12 rounded-full"
        onClick={goToNext}
        disabled={currentIndex === messages.length - 1}
      >
        <IconChevronRight className="w-5 h-5" />
      </Button>

      {/* Message Counter */}
      <div className="absolute top-4 right-4 text-sm text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full">
        {currentIndex + 1} / {messages.length}
      </div>

      {/* Main Content - Media takes full height, text positioned at bottom */}
      <div className="flex flex-col w-full h-full relative">
        {/* Media Display - Takes full available height */}
        <div className="flex-1 flex items-center justify-center w-full min-h-0">
          {currentMessage.videoUrl ? (
            <div className="relative flex items-center justify-center w-full h-full">
              <video
                key={currentMessage.id}
                ref={videoRef}
                className="w-auto h-auto rounded-2xl shadow-2xl object-contain"
                poster={selectedPersona?.image_url}
                onEnded={handleVideoEnded}
                controls
                style={{ 
                  maxHeight: 'calc(100vh - 120px - 100px)', // Screen height minus header and input area minus 50px
                  maxWidth: '120vw',
                  height: '100%'
                }}
              >
                <source src={currentMessage.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              
              {/* Video Controls */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleVideoPlay}
                  className="text-white hover:bg-white/20 h-8 px-3"
                >
                  {isVideoPlaying ? (
                    <IconPlayerPause className="w-4 h-4" />
                  ) : (
                    <IconPlayerPlay className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadVideo(currentMessage)}
                  className="text-white hover:bg-white/20 h-8 px-3"
                >
                  <IconDownload className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : selectedPersona?.image_url ? (
            <div className="relative flex items-center justify-center w-full h-full">
              <img
                src={selectedPersona.image_url}
                alt={selectedPersona.name}
                className="w-auto h-auto rounded-2xl shadow-2xl object-contain"
                style={{ 
                  maxHeight: 'calc(100vh - 120px - 50px)', // Screen height minus header and input area minus 50px
                  maxWidth: '95vw',
                  height: '100%'
                }}
              />
            </div>
          ) : (
            <div className="w-full max-w-md h-64 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl shadow-2xl flex items-center justify-center">
              <IconMicrophone className="w-16 h-16 text-white" />
            </div>
          )}
        </div>

        {/* Message Content - Positioned at bottom above input area */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="w-full max-w-2xl mx-auto space-y-3">
            {/* Bot Message */}
            {currentMessage.type === 'bot' && (
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 shadow-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center shrink-0">
                    <IconMicrophone className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm leading-relaxed mb-2">{currentMessage.content}</p>
                    
                    {/* Audio Controls */}
                    {currentMessage.audioUrl && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => playAudio(currentMessage)}
                          className="flex items-center gap-2 h-8 px-3"
                        >
                          <IconVolume className="w-3 h-3" />
                          Play Audio
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadAudio(currentMessage)}
                          className="flex items-center gap-2 h-8 px-3"
                        >
                          <IconDownload className="w-3 h-3" />
                          Download
                        </Button>
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground mt-2">
                      {currentMessage.timestamp}
                      {currentMessage.persona && (
                        <span className="ml-2">• {currentMessage.persona}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* User Message */}
            {currentMessage.type === 'user' && (
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 shadow-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center shrink-0">
                    <IconMicrophone className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm leading-relaxed mb-2">{currentMessage.content}</p>
                    
                    {currentMessage.isProcessing && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-2 h-2 bg-current animate-pulse rounded-full" />
                        Processing...
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground mt-2">
                      {currentMessage.timestamp}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard Navigation Hint */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full">
        Use ← → arrows to navigate
      </div>
    </div>
  );
});

MessageCarousel.displayName = 'MessageCarousel';

export default MessageCarousel; 