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
import Link from 'next/link';

const formSchema = z.object({
    email: z.string().email({ message: "Invalid email address." }),
    password: z.string().min(6, { message: "Password must be at least 6 characters." }),
    confirmPassword: z.string().min(1, { message: "Please confirm your password." }),
}).refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
});

export default function SignupPage() {
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
            confirmPassword: "",
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
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Sign up failed');
            }

            await refreshUser();

            toast({
                title: "Sign Up Successful",
                description: "Account created! Redirecting to dashboard...",
            });
            router.push("/dashboard/profile");

        } catch (error: any) {
            console.error("Sign Up Error:", error);
            let errorMessage = error.message || "Could not create account. Please try again.";
            toast({
                variant: "destructive",
                title: "Sign Up Failed",
                description: errorMessage,
            });
            setIsLoading(false);
        }
    }

    return (
        <div className="relative w-full min-h-screen">
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
            <div className="absolute inset-0 bg-background/30 backdrop-blur-sm"></div>
            <div className="relative z-10 flex items-center justify-center min-h-screen p-6 sm:p-8">
                <Card className="mx-auto max-w-sm w-full glassy rounded-2xl">
                    <CardHeader className="space-y-4 text-center">
                        <div className="flex justify-center items-center gap-2">
                            <Logo className="h-8 w-8 text-primary" />
                            <h1 className="text-3xl font-headline font-bold">
                                Oruthota Chalets
                            </h1>
                        </div>
                        <CardTitle className="text-2xl font-headline">Create Account</CardTitle>
                        <CardDescription>
                            Enter your details to create a new account
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input placeholder="e.g. admin@example.com" {...field} className="pl-10 bg-input border-white/30" />
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
                                            <FormLabel>Password</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input type="password" placeholder="••••••••" {...field} className="pl-10 bg-input border-white/30" />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Confirm Password</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input type="password" placeholder="••••••••" {...field} className="pl-10 bg-input border-white/30" />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
                                    {isLoading ? "Creating Account..." : "Sign Up"}
                                </Button>
                                <div className="text-center text-sm">
                                    Already have an account?{" "}
                                    <Link href="/" className="underline hover:text-primary">
                                        Sign In
                                    </Link>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
