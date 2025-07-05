import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconMapPin, IconX, IconPlus } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { API_BASE_URL } from '../config/api';

const LocationSelector = React.memo(({ 
  selectedLocations = [], 
  onLocationChange,
  disabled = false,
  className = ""
}) => {
  const [availableLocations, setAvailableLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSelector, setShowSelector] = useState(false);

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
        setAvailableLocations(data.locations || []);
      } catch (err) {
        console.error('Error fetching locations:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, []);

  // Handle adding a location
  const handleAddLocation = (location) => {
    if (!selectedLocations.includes(location)) {
      const newLocations = [...selectedLocations, location];
      onLocationChange(newLocations);
    }
    setShowSelector(false);
  };

  // Handle removing a location
  const handleRemoveLocation = (location) => {
    const newLocations = selectedLocations.filter(loc => loc !== location);
    onLocationChange(newLocations);
  };

  // Get available locations that aren't already selected
  const unselectedLocations = availableLocations.filter(
    location => !selectedLocations.includes(location)
  );

  // Format location name for display
  const formatLocationName = (location) => {
    return location
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <IconMapPin className="w-4 h-4 text-muted-foreground animate-pulse" />
        <span className="text-sm text-muted-foreground">Loading locations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <IconMapPin className="w-4 h-4 text-destructive" />
        <span className="text-sm text-destructive">Error loading locations</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Location icon */}
      <IconMapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      
      {/* Selected locations as badges */}
      {selectedLocations.map((location) => (
        <Badge
          key={location}
          variant="secondary"
          className="flex items-center gap-1 text-xs"
        >
          {formatLocationName(location)}
          {!disabled && (
            <Button
              variant="ghost"
              size="sm"
              className="h-3 w-3 p-0 hover:bg-destructive/20"
              onClick={() => handleRemoveLocation(location)}
            >
              <IconX className="w-2 h-2" />
            </Button>
          )}
        </Badge>
      ))}

      {/* Add location button/selector */}
      {!disabled && unselectedLocations.length > 0 && (
        <div className="relative">
          {!showSelector ? (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setShowSelector(true)}
            >
              <IconPlus className="w-3 h-3 mr-1" />
              Add Location
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Select onValueChange={handleAddLocation}>
                <SelectTrigger className="h-6 w-32 text-xs">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {unselectedLocations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {formatLocationName(location)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowSelector(false)}
              >
                <IconX className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Help text */}
      {selectedLocations.length === 0 && (
        <span className="text-xs text-muted-foreground">
          Add news locations for context
        </span>
      )}
    </div>
  );
});

LocationSelector.displayName = 'LocationSelector';

export default LocationSelector; 