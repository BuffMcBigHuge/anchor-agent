import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  IconMicrophone, 
  IconMicrophoneOff, 
  IconSend,
  IconLoader,
  IconNews,
  IconMapPin,
  IconVideo,
  IconVideoOff
} from "@tabler/icons-react";
import { API_BASE_URL } from '../config/api';

const ChatFooter = React.memo(({ 
  isRecording, 
  isProcessing, 
  selectedPersona, 
  textInput,
  onTextInputChange,
  onRecord,
  onSendText,
  onKeyPress,
  inputDisabled,
  recordingDisabled,
  selectedLocations,
  onLocationChange,
  hasMessages = false,
  videoEnabled = false,
  onVideoToggle
}) => {
  const [availableLocations, setAvailableLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocationForNews, setSelectedLocationForNews] = useState(null);

  // Fetch available locations from API
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/locations`);
        if (!response.ok) {
          throw new Error('Failed to fetch locations');
        }
        const data = await response.json();
        const locations = data.locations || [];
        setAvailableLocations(locations);
        
        // Set the first location as default selection
        if (locations.length > 0) {
          setSelectedLocationForNews(locations[0]);
        }
      } catch (err) {
        console.error('Error fetching locations:', err);
        // Fallback to common locations if API fails
        const fallbackLocations = [
          'ottawa', 'toronto', 'montreal', 'vancouver', 'calgary', 
          'edmonton', 'winnipeg', 'halifax', 'saskatoon', 'regina'
        ];
        setAvailableLocations(fallbackLocations);
        setSelectedLocationForNews(fallbackLocations[0]);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, []);

  // Format location name for display
  const formatLocationName = (location) => {
    return location
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Handler for location selection
  const handleLocationSelection = (location) => {
    setSelectedLocationForNews(location);
  };

  // Handler for the "Tell me the news" button
  const handleTellMeTheNews = () => {
    if (selectedLocationForNews) {
      // Set the selected location
      onLocationChange([selectedLocationForNews]);
      
      // Create the news message for this location
      const newsMessage = `Tell me the latest news from ${formatLocationName(selectedLocationForNews)}`;
      
      // Update the text input
      const syntheticEvent = {
        target: { value: newsMessage }
      };
      onTextInputChange(syntheticEvent);
      
      // Send the message after a brief delay to allow state update
      setTimeout(() => {
        onSendText();
      }, 100);
    }
  };

  // If no messages and persona is selected, show the location selection interface
  if (!hasMessages && selectedPersona) {
    return (
      <footer className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
                <IconNews className="w-5 h-5" />
                <span className="text-sm">Ready to get the latest news?</span>
              </div>
              
              {/* Location Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <IconMapPin className="w-4 h-4" />
                  <span className="text-sm">Select a location for news:</span>
                </div>
                
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <IconLoader className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading locations...</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                    {availableLocations.map((location) => (
                      <Badge
                        key={location}
                        variant={selectedLocationForNews === location ? "default" : "outline"}
                        className={`cursor-pointer transition-all duration-200 px-3 py-1 text-sm ${
                          selectedLocationForNews === location 
                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                            : 'hover:bg-accent'
                        }`}
                        onClick={() => handleLocationSelection(location)}
                      >
                        {formatLocationName(location)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Tell me the news Button */}
              <Button
                onClick={handleTellMeTheNews}
                disabled={inputDisabled || isProcessing || !selectedLocationForNews}
                size="lg"
                className="h-12 px-8 text-base font-medium bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white mt-6"
              >
                {isProcessing ? (
                  <>
                    <IconLoader className="w-5 h-5 mr-2 animate-spin" />
                    Getting news...
                  </>
                ) : (
                  <>
                    <IconNews className="w-5 h-5 mr-2" />
                    Tell me the news
                    {selectedLocationForNews && (
                      <span className="ml-2 opacity-80">
                        from {formatLocationName(selectedLocationForNews)}
                      </span>
                    )}
                  </>
                )}
              </Button>

              <div className="space-y-4 mt-6">
                {/* Video toggle */}
                <div className="flex items-center justify-center gap-2">
                  <Button
                    onClick={onVideoToggle}
                    disabled={inputDisabled}
                    size="sm"
                    variant={videoEnabled ? "default" : "outline"}
                    className="h-8 px-3"
                    title={videoEnabled ? "Disable video generation" : "Enable video generation"}
                  >
                    {videoEnabled ? (
                      <>
                        <IconVideo className="w-4 h-4 mr-2" />
                        Video ON
                      </>
                    ) : (
                      <>
                        <IconVideoOff className="w-4 h-4 mr-2" />
                        Video OFF
                      </>
                    )}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {videoEnabled ? "Videos will be generated" : "Audio only"}
                  </span>
                </div>
                
                {/* Alternative input row (disabled state) */}
                <div className="flex items-center gap-2 opacity-60">
                  <Button
                    onClick={onRecord}
                    disabled={true}
                    size="lg"
                    variant="outline"
                    className="h-10 w-10 p-0"
                    title="Voice recording available after first message"
                  >
                    <IconMicrophone className="w-4 h-4" />
                  </Button>
                  
                  <Input
                    value=""
                    onChange={() => {}}
                    placeholder="Select a location above and click 'Tell me the news' to get started..."
                    disabled={true}
                    className="flex-1"
                  />
                  
                  <Button
                    disabled={true}
                    size="lg"
                    variant="outline"
                    className="h-10 w-10 p-0"
                    title="Text input available after first message"
                  >
                    <IconSend className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  // Regular chat footer for ongoing conversations
  return (
    <footer className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <Button
              onClick={onRecord}
              disabled={recordingDisabled}
              size="lg"
              variant={isRecording ? "destructive" : "outline"}
              className="h-10 w-10 p-0"
            >
              {isRecording ? (
                <IconMicrophoneOff className="w-4 h-4" />
              ) : (
                <IconMicrophone className="w-4 h-4" />
              )}
            </Button>
            
            <Button
              onClick={onVideoToggle}
              disabled={inputDisabled}
              size="lg"
              variant={videoEnabled ? "default" : "outline"}
              className="h-8 px-3"
              title={videoEnabled ? "Disable video generation" : "Enable video generation"}
            >
              {videoEnabled ? (
                <>
                  <IconVideo className="w-4 h-4 mr-1" />
                  Video
                </>
              ) : (
                <>
                  <IconVideoOff className="w-4 h-4 mr-1" />
                  Video
                </>
              )}
            </Button>
            
            <Input
              value={textInput}
              onChange={onTextInputChange}
              onKeyPress={onKeyPress}
              placeholder={selectedPersona ? `Message ${selectedPersona.name}...` : "Select a news anchor to start chatting..."}
              disabled={inputDisabled}
              className="flex-1"
            />
            
            <Button
              onClick={onSendText}
              disabled={inputDisabled || !textInput.trim()}
              size="lg"
              className="h-10 w-10 p-0"
            >
              <IconSend className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
});

ChatFooter.displayName = 'ChatFooter';

export default ChatFooter; 