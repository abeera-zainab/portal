import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { ShieldAlert } from 'lucide-react';

export const AccessDenied: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-100">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <ShieldAlert className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
          <CardDescription>
            You are not authorized to access this portal. Please contact your administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full"
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
