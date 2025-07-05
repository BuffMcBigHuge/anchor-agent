import React, { forwardRef, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  IconMicrophone,
  IconVolume, 
  IconUser, 
  IconRobot,
  IconDownload,
  IconVideo,
  IconPlayerPlay,
  IconPlayerPause
} from "@tabler/icons-react";

const ChatMessages = React.memo(forwardRef(({ messages, selectedPersona, currentChatId, playAudio, downloadAudio }, ref) => {
  
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

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <ScrollArea ref={ref} className="h-full">
        <div className="p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                  <IconMicrophone className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-sm font-semibold mb-2">
                  {currentChatId ? 'Continue your conversation!' : 'Start a new conversation!'}
                </h2>
                <p className="text-xs">
                  {selectedPersona 
                    ? `Currently speaking with ${selectedPersona.name}`
                    : 'Select a news anchor above to begin'
                  }
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const MessageVideoPlayer = () => {
                  const videoRef = useRef(null);
                  const [isVideoPlaying, setIsVideoPlaying] = React.useState(false);

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

                  return (
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
                  );
                };

                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.type === 'bot' && (
                      <Avatar className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 shrink-0">
                        <AvatarFallback>
                          <IconRobot className="w-4 h-4 text-white" />
                        </AvatarFallback>
                      </Avatar>
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
                        {message.videoUrl && <MessageVideoPlayer />}
                        
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
                );
              })
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}));

ChatMessages.displayName = 'ChatMessages';

export default ChatMessages; 