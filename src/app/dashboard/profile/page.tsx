'use client';

import type { User as UserType } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Mail, Calendar, Shield } from 'lucide-react';
import { useUserContext } from '@/context/user-context';

export default function ProfilePage() {
  const { user, supabaseUser } = useUserContext();
  const avatar = PlaceHolderImages.find(p => p.id === 'avatar-2');

  if (!user || !supabaseUser) {
    return (
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center space-y-4">
          <Skeleton className="h-32 w-32 rounded-full mx-auto" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-6 w-32 mx-auto" />
          </div>
          <Card className="max-w-md mx-auto mt-8 w-full">
            <CardHeader>
              <Skeleton className="h-6 w-1/4" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <div className="flex flex-col items-center space-y-4">
        <Avatar className="w-32 h-32 border-4 border-primary">
          {avatar && <AvatarImage src={avatar.imageUrl} alt={user.name} />}
          <AvatarFallback className="text-4xl">
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h1 className="text-3xl font-bold font-headline">{user.name}</h1>
          <p className="text-muted-foreground capitalize">{user.role}</p>
        </div>
      </div>

      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <User className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">{user.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">{supabaseUser?.email}</span>
          </div>
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
          </div>
          <div className="flex items-center gap-4">
            <Shield className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium capitalize">{user.role}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
