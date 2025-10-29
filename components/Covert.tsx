"use client";

import { useState } from "react";
import { Input } from "./ui/input";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";
import { ModeToggle } from "./ModeToggle";


interface ConversionResult {
  html: string;
  markdown: string;
  plainText: string;
  url: string;
}

const Convert = () => {
    const router = useRouter();
    const { toast } = useToast();

    const [url, setUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleConvert = async () => {
        if(!url) {
            toast({
                title: "URL Required",
                description: "Please enter a URL to convert",
                variant: "destructive",
            });
            return;
            }

            try {
                new URL(url);
            } catch {
                toast({
                    title: "Invalid URL",
                    description: "Please enter a valid URL (e.g., https://example.com)",
                    variant: "destructive",
                });
                return;
            }

            router.push(`/${encodeURIComponent(url)}`);
    }
    
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 relative">
            <div className="fixed top-3 right-3 sm:top-6 sm:right-6 z-50">
                <ModeToggle />
            </div>

            <div className="w-full max-w-4xl space-y-6 sm:space-y-8 mt-12 sm:mt-0">
                {/* Header */}
                <div className="space-y-3">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-primary">
                        # mark.md
                    </h1>
                    <p className="text-base sm:text-lg text-muted-foreground">
                        Convert any webpage into LLM-friendly markdown.
                    </p>
                </div>

                {/* Usage Instructions */}
                <div className="p-6 sm:p-8 bg-card border-2 border-border rounded-2xl space-y-4">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground">## Usage</h2>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Prefix the URL you want to convert with{" "}
                        <span className="text-primary font-bold">markmd.vercel.app/</span>
                    </p>
                    <div className="bg-background p-4 sm:p-6 rounded-xl border-2 border-border overflow-x-auto">
                        <code className="text-sm sm:text-base font-mono whitespace-nowrap block">
                            <span className="text-muted-foreground">E.g.:</span>{" "}
                            <span className="text-primary font-semibold">markmd.vercel.app/</span>
                            <span className="text-foreground">https://priyanshut.tech</span>
                        </code>
                    </div>
                </div>

                {/*Input Form*/}
                <div className="space-y-4">
                    <p className="text-sm sm:text-base text-muted-foreground">Or paste the URL below:</p>
                    <div className="flex gap-3 flex-col sm:flex-row">
                        <Input 
                            type="url"
                            placeholder="URL to convert"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleConvert()}
                            className="flex-1 h-12 sm:h-14 px-4 sm:px-6 text-sm sm:text-base bg-muted border-2 border-border rounded-xl focus:border-primary transition-colors"
                            disabled={isLoading}
                        />

                        <Button
                            onClick={() => handleConvert()}
                            disabled={isLoading}
                            className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-xl w-full sm:w-auto"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Converting...
                                </>
                            ) : (
                                "convert"
                            )}
                        </Button>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center pt-8">
                    <p className="text-sm text-muted-foreground">
                        Made By <a href="https://priyanshut.tech" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">Priyanshu Thapliyal</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Convert;