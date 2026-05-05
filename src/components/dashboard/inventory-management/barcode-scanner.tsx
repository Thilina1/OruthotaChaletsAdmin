'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BarcodeScannerProps {
    onScan: (decodedText: string) => void;
    trigger?: React.ReactNode;
}

export function BarcodeScanner({ onScan, trigger }: BarcodeScannerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isScannerStarted, setIsScannerStarted] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const { toast } = useToast();
    const regionId = "barcode-reader-region";

    const startScanner = async () => {
        try {
            const html5QrCode = new Html5Qrcode(regionId);
            scannerRef.current = html5QrCode;
            
            const config = { 
                fps: 10, 
                qrbox: { width: 250, height: 150 },
                aspectRatio: 1.0
            };

            await html5QrCode.start(
                { facingMode: "environment" }, 
                config, 
                (decodedText) => {
                    onScan(decodedText);
                    stopScanner();
                    setIsOpen(false);
                    toast({
                        title: "Barcode Captured",
                        description: `Code: ${decodedText}`,
                    });
                },
                (errorMessage) => {
                    // Silently ignore scan errors (they happen constantly while looking for a code)
                }
            );
            setIsScannerStarted(true);
        } catch (err) {
            console.error("Scanner start error:", err);
            toast({
                variant: "destructive",
                title: "Camera Error",
                description: "Could not access camera. Please check permissions."
            });
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            try {
                await scannerRef.current.stop();
                scannerRef.current = null;
                setIsScannerStarted(false);
            } catch (err) {
                console.error("Scanner stop error:", err);
            }
        }
    };

    useEffect(() => {
        if (isOpen) {
            // Small delay to ensure the container is rendered
            const timer = setTimeout(() => {
                startScanner();
            }, 500);
            return () => clearTimeout(timer);
        } else {
            stopScanner();
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="icon" type="button" className="shrink-0 h-10 w-10">
                        <Camera className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Scan Barcode / SKU</DialogTitle>
                    <DialogDescription>
                        Point your camera at the item's barcode.
                    </DialogDescription>
                </DialogHeader>
                <div className="relative flex flex-col items-center justify-center p-4">
                    <div 
                        id={regionId} 
                        className="w-full aspect-video bg-slate-100 rounded-lg overflow-hidden border-2 border-slate-200"
                    />
                    {!isScannerStarted && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/50 rounded-lg">
                            <div className="flex flex-col items-center gap-2">
                                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                                <span className="text-xs font-medium">Initializing camera...</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 px-4 pb-4">
                    <Button variant="ghost" onClick={() => setIsOpen(false)} type="button">
                        Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
