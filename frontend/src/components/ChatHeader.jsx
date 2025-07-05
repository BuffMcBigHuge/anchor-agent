import React from 'react';
import MobileChatHistory from './MobileChatHistory';
import ProfileButton from './ProfileButton';
import PersonaModal from './PersonaModal';
import { ModeToggle } from './ui/mode-toggle';
import { IconWifi, IconWifiOff } from '@tabler/icons-react';

const ChatHeader = React.memo(({ 
  isMobileMenuOpen, 
  onMobileMenuChange,
  isProfileModalOpen,
  onProfileModalChange,
  isPersonaModalOpen,
  onPersonaModalChange,
  isRealtimeConnected = false
}) => {

  return (
    <header className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between p-4">
        {/* Left: Mobile menu and profile */}
        <div className="flex items-center gap-2">
          <MobileChatHistory 
            isOpen={isMobileMenuOpen} 
            onOpenChange={onMobileMenuChange} 
          />
          <div className="lg:hidden">
            <ProfileButton 
              isMobile={true} 
              isOpen={isProfileModalOpen}
              onOpenChange={onProfileModalChange}
            />
          </div>
        </div>
        
        {/* Center: Title and real-time status */}
        <div className="flex-1 flex flex-col justify-center items-center">
          <h1 className="text-sm font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🇨🇦 Anchor Agent
          </h1>
          {/* Real-time status indicator */}
          <div className="flex items-center gap-1 mt-1">
            {isRealtimeConnected ? (
              <IconWifi className="w-3 h-3 text-green-500" />
            ) : (
              <IconWifiOff className="w-3 h-3 text-gray-400" />
            )}
            <span className={`text-xs ${isRealtimeConnected ? 'text-green-500' : 'text-gray-400'}`}>
              {isRealtimeConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
        
        {/* Right: Profile (desktop), persona selector and theme toggle */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <ProfileButton 
              isOpen={isProfileModalOpen}
              onOpenChange={onProfileModalChange}
            />
          </div>
          <PersonaModal 
            isOpen={isPersonaModalOpen}
            onOpenChange={onPersonaModalChange}
          />
          <ModeToggle />
        </div>
      </div>
    </header>
  );
});

ChatHeader.displayName = 'ChatHeader';

export default ChatHeader; 