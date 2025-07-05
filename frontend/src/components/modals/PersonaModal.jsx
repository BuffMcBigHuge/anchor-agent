import React, { useEffect } from 'react';
import { useAppSelector } from '../../store/hooks';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IconSparkles } from "@tabler/icons-react";
import PersonaSelector from '../PersonaSelector';

const PersonaModal = React.memo(({ isOpen, onOpenChange }) => {
  const { selectedPersona } = useAppSelector((state) => state.persona);

  // Handle modal body scroll prevention using CSS classes
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    // Cleanup function
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  const handlePersonaSelect = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
        >
          <IconSparkles className="w-3 h-3" />
          {selectedPersona ? selectedPersona.name : 'Choose News Anchor'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[80vh] p-0 flex flex-col">
        <DialogHeader className="flex-shrink-0 p-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <IconSparkles className="w-4 h-4" />
            Choose News Anchor
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <PersonaSelector onSelect={handlePersonaSelect} />
        </div>
      </DialogContent>
    </Dialog>
  );
});

PersonaModal.displayName = 'PersonaModal';

export default PersonaModal; 