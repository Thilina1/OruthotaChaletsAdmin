'use client';

import { useMemo } from 'react';
import type { User as UserType } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Briefcase, 
  Phone, 
  MapPin, 
  IdCard,
  Clock,
  Terminal
} from 'lucide-react';
import { useUserContext } from '@/context/user-context';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function ProfilePage() {
  const { user, loading } = useUserContext();
  
  const avatar = useMemo(() => {
    if (!user?.gender) return PlaceHolderImages.find(p => p.id === 'avatar-2');
    
    if (user.gender.toLowerCase() === 'female') {
      return PlaceHolderImages.find(p => p.id === 'avatar-4');
    }
    
    return PlaceHolderImages.find(p => p.id === 'avatar-2');
  }, [user?.gender]);

  if (loading || !user) {
    return (
      <div className="container mx-auto p-4 space-y-8 animate-pulse">
        <div className="h-48 w-full bg-muted rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 -mt-20 px-4">
          <Skeleton className="h-[400px] w-full rounded-xl" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto pb-12">
      {/* Hero Header */}
      <div className="relative h-48 md:h-64 w-full rounded-xl overflow-hidden bg-gradient-to-r from-primary/80 via-primary to-accent/50 shadow-lg">
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        <div className="absolute bottom-4 right-4 flex gap-2">
           <Badge variant="secondary" className="bg-background/20 text-white border-white/20 backdrop-blur-md">
             Active Account
           </Badge>
        </div>
      </div>

      <div className="px-4 md:px-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-start gap-6 mb-8">
          <Avatar className="w-32 h-32 md:w-44 md:h-44 border-8 border-background shadow-2xl ring-2 ring-primary/10 -mt-16 md:-mt-22 shrink-0">
            {avatar && <AvatarImage src={avatar.imageUrl} alt={user.name} />}
            <AvatarFallback className="text-4xl bg-muted">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 md:pt-3 pb-2">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-headline text-foreground drop-shadow-sm">
              {user.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <Badge className="bg-primary text-primary-foreground px-3 py-1 text-sm font-medium capitalize">
                {user.role}
              </Badge>
              {user.department && (
                <span className="text-muted-foreground flex items-center gap-1 text-sm md:text-base">
                  <Briefcase className="w-4 h-4" />
                  {user.department}
                </span >
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Personal Information */}
          <Card className="glassy border-none shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <CardHeader className="border-b border-border/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <User className="w-5 h-5 text-primary" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <InfoRow icon={Mail} label="Email Address" value={user.email} />
              <InfoRow icon={User} label="Gender" value={user.gender || 'Not provided'} />
              <InfoRow icon={Phone} label="Phone Number" value={user.phone_number || 'Not provided'} />
              <InfoRow icon={IdCard} label="NIC / ID Number" value={user.nic || 'Not provided'} />
              <InfoRow icon={MapPin} label="Residential Address" value={user.address || 'Not provided'} />
            </CardContent>
          </Card>

          {/* Right Column: Professional Details & Account */}
          <div className="space-y-8">
            <Card className="glassy border-none shadow-xl hover:shadow-2xl transition-shadow duration-300">
              <CardHeader className="border-b border-border/10 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                  <Shield className="w-5 h-5 text-primary" />
                  Professional Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <InfoRow icon={Briefcase} label="Designation / Job Title" value={user.job_title || user.role} />
                <InfoRow 
                  icon={Calendar} 
                  label="Joining Date" 
                  value={user.join_date ? new Date(user.join_date).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'} 
                />
                <InfoRow 
                  icon={Clock} 
                  label="Member Since" 
                  value={user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'} 
                />
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-dashed border-2 border-primary/20 shadow-sm">
              <CardContent className="pt-6">
                 <div className="flex items-start gap-4">
                   <div className="p-3 bg-primary/10 rounded-lg">
                     <Terminal className="w-6 h-6 text-primary" />
                   </div>
                   <div>
                     <h4 className="font-semibold text-primary">System Permissions</h4>
                     <p className="text-sm text-muted-foreground mt-1">
                       Your account is currently active with <strong>{user.role}</strong> privileges. 
                       {user.restrict_admin_permissions ? ' Access is restricted to assigned departments.' : ' Full administrative access is enabled.'}
                     </p>
                   </div>
                 </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="group">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-muted/50 rounded-md group-hover:bg-primary/10 transition-colors">
          <Icon className="w-4 h-4 text-primary/70 group-hover:text-primary" />
        </div>
        <span className="font-medium text-foreground">{value}</span>
      </div>
    </div>
  );
}
