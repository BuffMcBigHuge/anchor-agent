import React, { useState } from 'react';
import { useAppSelector } from '../store/hooks';
import { selectUserId, selectUserName } from '../store/selectors';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  IconUser, 
  IconSettings
} from "@tabler/icons-react";
import ProfilePage from './ProfilePage';

const ProfileButton = ({ isMobile = false, isOpen, onOpenChange }) => {
  const userId = useAppSelector(selectUserId);
  const userName = useAppSelector(selectUserName);
  
  // Use external state if provided, otherwise use internal state
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isProfileOpen = isOpen !== undefined ? isOpen : internalIsOpen;
  const setIsProfileOpen = onOpenChange !== undefined ? onOpenChange : setInternalIsOpen;

  const getDisplayName = () => {
    if (userName && userName.trim()) {
      return userName;
    }
    return userId ? 'User' : 'Loading...';
  };

  const getInitials = () => {
    if (!userId) {
      return <IconUser className="w-3 h-3 text-white" />;
    }
    const name = getDisplayName();
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusColor = () => {
    return 'bg-gradient-to-r from-blue-500 to-purple-500';
  };

  const getStatusIcon = () => {
    return <IconSettings className="w-3 h-3 text-white" />;
  };

  if (isMobile) {
    return (
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
          >
            <Avatar className={`w-6 h-6 ${getStatusColor()}`}>
              <AvatarFallback className="text-white text-xs font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium hidden sm:inline">
              {getDisplayName()}
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] p-0 flex flex-col">
          <DialogHeader className="flex-shrink-0 p-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <IconUser className="w-4 h-4" />
              User Profile
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <ProfilePage onClose={() => setIsProfileOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="flex items-center gap-2 hover:bg-muted/50"
          title={`Profile: ${getDisplayName()}`}
        >
          <Avatar className={`w-7 h-7 ${getStatusColor()}`}>
            <AvatarFallback className="text-white text-xs font-semibold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start">
            <span className="text-xs font-medium leading-none">
              {getDisplayName()}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              {getStatusIcon()}
              <span className="text-2xs text-muted-foreground">
                User
              </span>
            </div>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] p-0 flex flex-col">
        <DialogHeader className="flex-shrink-0 p-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <IconUser className="w-4 h-4" />
            User Profile
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ProfilePage onClose={() => setIsProfileOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileButton; 