import React, { useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { 
  IconMenu2,
  IconMessage
} from "@tabler/icons-react";
import ChatHistory from './ChatHistory';

const MobileChatHistory = React.memo(({ isOpen, onOpenChange }) => {
  const handleChatAction = useCallback(() => {
    // Close mobile menu when a chat action is performed
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="lg:hidden"
        >
          <IconMenu2 className="w-4 h-4 mr-2" />
          <IconMessage className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <IconMessage className="w-5 h-5" />
            Chat History
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-hidden p-4">
          <ChatHistory onChatAction={handleChatAction} />
        </div>
      </SheetContent>
    </Sheet>
  );
});

MobileChatHistory.displayName = 'MobileChatHistory';

export default MobileChatHistory; 