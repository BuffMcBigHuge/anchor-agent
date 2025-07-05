import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import {
  loadProfile,
  saveProfile,
  clearError,
  resetProfile
} from '../store/slices/profileSlice';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  IconUser, 
  IconDeviceFloppy, 
  IconShield, 
  IconUserCheck, 
  IconAlertTriangle,
  IconRefresh,
  IconSettings,
  IconSparkles,
  IconCircleCheck,
  IconInfoCircle,
  IconLogout,
  IconMail
} from "@tabler/icons-react";
import { useToast } from "@/hooks/use-toast";

const ProfilePage = ({ onClose }) => {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const {
    userId,
    displayName,
    email,
    isLoading,
    error,
    isSavedToSupabase,
    savedAt
  } = useAppSelector((state) => state.profile);

  // Local state for form inputs
  const [localDisplayName, setLocalDisplayName] = useState(displayName);
  const [localEmail, setLocalEmail] = useState(email);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  // Update local state when Redux state changes
  useEffect(() => {
    setLocalDisplayName(displayName);
    setLocalEmail(email);
  }, [displayName, email]);

  // Load profile on component mount
  useEffect(() => {
    if (!userId) {
      dispatch(loadProfile());
    }
  }, [dispatch, userId]);

  const handleSaveProfile = async () => {
    setShowConfirmSave(true);
  };

  const performSave = async () => {
    try {
      await dispatch(saveProfile({
        displayName: localDisplayName,
        email: localEmail,
        personaId: null // Not used in this simplified version
      })).unwrap();
      
      setShowConfirmSave(false);
      toast({
        title: "Profile saved",
        description: "Your profile has been saved successfully",
      });
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast({
        title: "Save failed",
        description: error.message || "Failed to save profile",
        variant: "destructive"
      });
    }
  };

  const handleClearError = () => {
    dispatch(clearError());
  };

  const handleClearData = async () => {
    try {
      // Clear local storage
      localStorage.removeItem('anchor-agent-user-id');
      
      // Reset profile state
      dispatch(resetProfile());
      
      toast({
        title: "Data cleared",
        description: "Your local data has been cleared. Refresh to start fresh.",
      });
      
      // Close the profile modal
      if (onClose) onClose();
    } catch (error) {
      toast({
        title: "Clear failed", 
        description: error.message || "Failed to clear data",
        variant: "destructive"
      });
    }
  };

  // Show loading state if profile is still loading
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <IconRefresh className="w-8 h-8 text-gray-400 mb-4 animate-spin" />
        <h2 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
          Loading Profile...
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Setting up your news anchor profile.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4">
          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <IconAlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleClearError}
                  className="text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20"
                >
                  ✕
                </Button>
              </div>
            </div>
          )}
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>
            
            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconUser className="w-5 h-5" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16">
                      <AvatarFallback className="text-lg">
                        {(localDisplayName || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Display Name
                          </label>
                          <Input
                            value={localDisplayName}
                            onChange={(e) => setLocalDisplayName(e.target.value)}
                            placeholder="Enter your display name"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Email (Optional)
                          </label>
                          <Input
                            type="email"
                            value={localEmail}
                            onChange={(e) => setLocalEmail(e.target.value)}
                            placeholder="Enter your email"
                            className="mt-1"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Email is required to save your profile to the database
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isSavedToSupabase && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800/50 rounded-md">
                      <IconCircleCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <div>
                        <div className="font-medium text-green-800 dark:text-green-200">
                          Profile Saved
                        </div>
                        <div className="text-sm text-green-600 dark:text-green-400">
                          Your profile is saved to the database
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSaveProfile}
                      disabled={isLoading || !localDisplayName}
                      className="flex items-center gap-2"
                    >
                      <IconDeviceFloppy className="w-4 h-4" />
                      {isLoading ? 'Saving...' : 'Save Profile'}
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      onClick={() => dispatch(loadProfile())}
                      disabled={isLoading}
                      className="flex items-center gap-2"
                    >
                      <IconRefresh className="w-4 h-4" />
                      Refresh
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="account" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconSettings className="w-5 h-5" />
                    User Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/50 rounded-md">
                    <div className="flex items-center gap-2">
                      <IconInfoCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <div>
                        <div className="font-medium text-blue-800 dark:text-blue-200">
                          News Anchor Bot
                        </div>
                        <div className="text-sm text-blue-600 dark:text-blue-400">
                          Your data is stored locally on this device
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        User ID
                      </label>
                      <Input
                        value={userId || ''}
                        disabled
                        className="mt-1 bg-gray-50 dark:bg-gray-800 font-mono text-xs"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Unique identifier for your news anchor sessions
                      </p>
                    </div>

                    {savedAt && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Last Saved
                        </label>
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(savedAt).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-red-600 dark:text-red-400">
                            Clear Data
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Remove all local data and start fresh
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleClearData}
                          className="flex items-center gap-2"
                        >
                          <IconAlertTriangle className="w-4 h-4" />
                          Clear Data
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <Dialog open={showConfirmSave} onOpenChange={setShowConfirmSave}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Profile Changes</DialogTitle>
            <DialogDescription>
              Are you sure you want to save these changes to your profile?
              {localEmail && " This will save your profile to the database."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmSave(false)}
            >
              Cancel
            </Button>
            <Button onClick={performSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage; 