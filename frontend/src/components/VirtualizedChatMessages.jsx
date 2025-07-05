import React, { forwardRef, useCallback, useMemo, useEffect, useRef } from 'react';
import { VariableSizeList as List } from 'react-window';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  IconMicrophone,
  IconVolume, 
  IconUser, 
  IconRobot,
  IconDownload,
  IconVideo,
  IconPlayerPlay,
  IconPlayerPause,
} from "@tabler/icons-react";

// Individual message component that's memoized for performance
const MessageItem = React.memo(({ index, style, data }) => {
  const { messages, playAudio, downloadAudio, selectedPersona } = data;
  const message = messages[index];
  const videoRef = useRef(null);
  const [isVideoPlaying, setIsVideoPlaying] = React.useState(false);

  // Video controls - hooks must be called before any early returns
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

  if (!message) {
    return <div style={style} />;
  }

  return (
    <div style={style} className="px-4 py-2">
      <div className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
        {message.type === 'bot' && (
          <div className="relative w-12 h-20 rounded-lg overflow-hidden shadow-md flex-shrink-0">
            {selectedPersona?.image_url ? (
              <img 
                src={selectedPersona.image_url} 
                alt={selectedPersona.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <IconRobot className="w-6 h-6 text-white" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
          </div>
        )}
        
        <div className={`max-w-[75%] ${message.type === 'user' ? 'order-2' : ''}`}>
          <div
            className={`px-4 py-3 rounded-lg ${
              message.type === 'user'
                ? 'bg-blue-500 text-white ml-auto'
                : 'bg-muted text-foreground'
            }`}
          >
            {/* Video display */}
            {message.videoUrl && (
              <div className="mb-3">
                <video
                  ref={videoRef}
                  className="w-full max-w-sm rounded-lg"
                  poster={selectedPersona?.image_url}
                  onEnded={handleVideoEnded}
                  controls
                >
                  <source src={message.videoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 hover:bg-white/20 shrink-0"
                    onClick={handleVideoPlay}
                    type="button"
                    title={isVideoPlaying ? "Pause video" : "Play video"}
                  >
                    {isVideoPlaying ? (
                      <IconPlayerPause className="w-3 h-3" />
                    ) : (
                      <IconPlayerPlay className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 hover:bg-white/20 shrink-0"
                    onClick={() => downloadVideo(message)}
                    type="button"
                    title="Download video"
                  >
                    <IconDownload className="w-3 h-3" />
                  </Button>
                  <div className="flex items-center gap-1 text-xs opacity-75">
                    <IconVideo className="w-3 h-3" />
                    <span>Video</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <span className="text-xs leading-relaxed">{message.content}</span>
              {message.isProcessing && (
                <div className="w-2 h-2 bg-current animate-pulse shrink-0" />
              )}
              {message.audioUrl && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 hover:bg-white/20 shrink-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🔊 Play button clicked for message:', message.id);
                      playAudio(message);
                    }}
                    type="button"
                    title="Play audio"
                  >
                    <IconVolume className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 hover:bg-white/20 shrink-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('💾 Download button clicked for message:', message.id);
                      downloadAudio(message);
                    }}
                    type="button"
                    title="Download audio"
                  >
                    <IconDownload className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="text-2xs text-muted-foreground mt-1 px-2">
            {message.timestamp}
            {message.persona && (
              <span className="ml-2">• {message.persona}</span>
            )}
          </div>
        </div>

        {message.type === 'user' && (
          <Avatar className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 order-3 shrink-0">
            <AvatarFallback>
              <IconUser className="w-4 h-4 text-white" />
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

// Estimate message height based on content length
const getMessageHeight = (message) => {
  if (!message) return 80;
  
  const baseHeight = 80; // Base height for avatar and padding
  const contentLength = message.content?.length || 0;
  const lineHeight = 20; // Approximate line height
  const charactersPerLine = 60; // Approximate characters per line
  
  // Calculate estimated lines based on content length
  const estimatedLines = Math.ceil(contentLength / charactersPerLine);
  const contentHeight = estimatedLines * lineHeight;
  
  // Add extra height for video if present
  const videoHeight = message.videoUrl ? 200 : 0; // Approximate video height
  
  return Math.max(baseHeight, baseHeight + contentHeight + videoHeight);
};

const VirtualizedChatMessages = React.memo(forwardRef(({ 
  messages, 
  selectedPersona, 
  playAudio, 
  downloadAudio,
  hasMessages
}, ref) => {
  const listRef = useRef(null);
  const heightCache = useRef(new Map());

  // Memoize item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    messages,
    playAudio,
    downloadAudio,
    selectedPersona
  }), [messages, playAudio, downloadAudio, selectedPersona]);

  // Get cached or calculate message height
  const getItemSize = useCallback((index) => {
    const message = messages[index];
    const cacheKey = `${message?.id || index}-${message?.content?.length || 0}`;
    
    if (heightCache.current.has(cacheKey)) {
      return heightCache.current.get(cacheKey);
    }
    
    const height = getMessageHeight(message);
    heightCache.current.set(cacheKey, height);
    return height;
  }, [messages]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages.length]);

  // Expose scroll to bottom function to parent
  React.useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      if (listRef.current && messages.length > 0) {
        listRef.current.scrollToItem(messages.length - 1, 'end');
      }
    }
  }), [messages.length]);

  if (!hasMessages) {
    return (
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full flex items-center justify-center">
          <div className="text-center text-muted-foreground py-8">
            {selectedPersona ? (
              <div className="mb-6">
                <div className="relative mx-auto mb-4 w-32 h-52 rounded-xl overflow-hidden shadow-xl">
                  {selectedPersona.image_url ? (
                    <img 
                      src={selectedPersona.image_url} 
                      alt={selectedPersona.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <span className="text-white font-semibold text-3xl">
                        {selectedPersona.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                </div>
                <h2 className="text-lg font-semibold mb-2 text-foreground">
                  {selectedPersona.name}
                </h2>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  {selectedPersona.description}
                </p>
              </div>
            ) : (
              <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                <IconMicrophone className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <List
        ref={listRef}
        height={600} // This will be overridden by CSS
        itemCount={messages.length}
        itemSize={getItemSize}
        itemData={itemData}
        className="w-full h-full"
        style={{ height: '100%' }}
      >
        {MessageItem}
      </List>
    </div>
  );
}));

VirtualizedChatMessages.displayName = 'VirtualizedChatMessages';

export default VirtualizedChatMessages; 