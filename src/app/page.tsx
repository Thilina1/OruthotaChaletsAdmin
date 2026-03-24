
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AtSign, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from '@/lib/supabase/client';
import { useUserContext } from '@/context/user-context';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Logo } from "@/components/icons";

import Link from "next/link";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, refreshUser } = useUserContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const loginImage = PlaceHolderImages.find(p => p.id === 'login-background');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard/profile");
    }
  }, [user, loading, router]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: data.error || "Invalid credentials. Please try again.",
        });
        form.setError("root", {
          type: "manual",
          message: data.error || "Invalid credentials. Please try again.",
        });
        setIsLoading(false);
        return;
      }

      await refreshUser(); // Refresh user context to update state

      toast({
        title: "Login Successful",
        description: "Redirecting to your dashboard...",
      });
      router.push("/dashboard/profile");
    } catch (error: any) {
      console.error("Login Error:", error);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "An unexpected error occurred. Please try again later.",
      });
      form.setError("root", {
        type: "manual",
        message: "An unexpected error occurred. Please try again later.",
      });
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-background">
      {/* Left Side - Visual (Hidden on mobile) */}
      <div className="relative hidden w-3/5 lg:block">
        {loginImage && (
          <Image
            src={loginImage.imageUrl}
            alt={loginImage.description}
            fill
            className="object-cover"
            data-ai-hint={loginImage.imageHint}
            priority
          />
        )}
        <div className="absolute inset-0 bg-premium-gradient/60 backdrop-blur-[2px]"></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center text-white">
          <div className="animate-fade-in-up stagger-1">
            <Logo className="h-[432px] w-[432px] text-white drop-shadow-2xl" />
          </div>
          <p className="animate-fade-in-up stagger-2 text-xl font-body max-w-lg opacity-90 leading-relaxed text-shadow-premium">
            Experience the pinnacle of hospitality where nature meets luxury in the heart of the hills.
          </p>
          <div className="animate-fade-in-up stagger-3 mt-12 flex gap-4">
            <div className="h-1 w-12 bg-white/40 rounded-full"></div>
            <div className="h-1 w-4 bg-white/20 rounded-full"></div>
            <div className="h-1 w-4 bg-white/20 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="relative flex w-full items-center justify-center lg:w-2/5 p-8 bg-background">
        <div className="absolute top-8 left-8 lg:hidden animate-fade-in-up">
          <Logo className="h-36 w-36 text-primary" />
        </div>

        <div className="w-full max-w-md animate-fade-in-up stagger-2">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-4xl font-headline font-bold text-foreground mb-3">Login</h2>
            <p className="text-muted-foreground text-lg">
              Welcome back! Please enter your details.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        <Input
                          placeholder="e.g. admin@example.com"
                          {...field}
                          className="h-12 pl-12 bg-muted/50 border-transparent focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all rounded-xl"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center">
                      <FormLabel className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Password</FormLabel>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          className="h-12 pl-12 bg-muted/50 border-transparent focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all rounded-xl"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <div className="animate-in fade-in zoom-in duration-300 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive text-center">
                  {form.formState.errors.root.message}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 transition-all active:scale-[0.98] rounded-xl"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Signing In...
                  </div>
                ) : "Sign In"}
              </Button>


            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
