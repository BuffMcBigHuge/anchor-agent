import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectPersona } from '../store/slices/personaSlice';
import { startNewChat } from '../store/slices/chatSlice';
import { 
  selectPersonas, 
  selectSelectedPersona, 
  selectPersonaLoading 
} from '../store/selectors';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconLoader } from "@tabler/icons-react";
import { useToast } from "../hooks/use-toast";

const PersonaSelector = React.memo(({ onSelect }) => {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  
  // Use optimized selectors
  const personas = useAppSelector(selectPersonas);
  const selectedPersona = useAppSelector(selectSelectedPersona);
  const loading = useAppSelector(selectPersonaLoading);

  const handlePersonaSelect = (persona) => {
    // Check if this is a different persona than currently selected
    const isDifferentPersona = !selectedPersona || selectedPersona.id !== persona.id;
    
    // Update the selected persona
    dispatch(selectPersona(persona));
    
    // If it's a different persona, start a new chat
    if (isDifferentPersona) {
      dispatch(startNewChat());
      
      // Show a toast notification
      toast({
        title: "🎬 New Chat Started",
        description: `Starting fresh conversation with ${persona.name}`,
        duration: 3000,
      });
    }
    
    // Call the optional onSelect callback (useful for closing modals)
    if (onSelect) {
      onSelect(persona);
    }
  };

  // Sort personas to put selected one first
  const sortedPersonas = React.useMemo(() => {
    if (!selectedPersona) return personas;
    
    const selected = personas.find(p => p.id === selectedPersona.id);
    const others = personas.filter(p => p.id !== selectedPersona.id);
    
    return selected ? [selected, ...others] : personas;
  }, [personas, selectedPersona]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <IconLoader className="w-5 h-5 animate-spin" />
        <span className="ml-2 text-xs text-muted-foreground">Loading personas...</span>
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-muted-foreground">No personas available</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full p-4">
      {selectedPersona && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg border">
          <div className="flex items-start gap-4">
                         <div className="relative w-20 h-32 rounded-lg overflow-hidden shadow-lg flex-shrink-0">
               {selectedPersona.image_url ? (
                 <img 
                   src={selectedPersona.image_url} 
                   alt={selectedPersona.name}
                   className="w-full h-full object-cover"
                 />
               ) : (
                 <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                   <span className="text-white font-semibold text-lg">
                     {selectedPersona.name.slice(0, 2).toUpperCase()}
                   </span>
                 </div>
               )}
               <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
             </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-foreground mb-1">
                {selectedPersona.name}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {selectedPersona.description}
              </p>
              <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                ✓ Currently Selected
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3">
        {sortedPersonas.map((persona) => (
          <Button
            key={persona.id}
            variant={selectedPersona?.id === persona.id ? "default" : "outline"}
            className={`h-auto p-4 flex items-center gap-4 text-left transition-all duration-200 min-h-[120px] ${
              selectedPersona?.id === persona.id 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            onClick={() => handlePersonaSelect(persona)}
          >
            <div className="relative w-16 h-28 rounded-lg overflow-hidden shadow-md flex-shrink-0">
              {persona.image_url ? (
                <img 
                  src={persona.image_url} 
                  alt={persona.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {persona.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{persona.name}</h3>
              <div className="text-xs text-muted-foreground mt-1 h-8 overflow-hidden">
                <p className="line-clamp-2 leading-4">
                  {persona.description || 'No description available for this persona.'}
                </p>
              </div>
            </div>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
});

PersonaSelector.displayName = 'PersonaSelector';

export default PersonaSelector; 