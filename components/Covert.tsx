"use client";

import { useState } from "react";
import { Input } from "./ui/input";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";


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

            // Validate URL format
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

            // Redirect to direct URL route (catch-all)
            router.push(`/${encodeURIComponent(url)}`);
    }
    
    return (
        <div className="min-h-screen bg-background flex flex-col items-center p-4 md:p-8">
            <div className="w-full max-w-5xl">
                {/* Header */}
                <div className="mb-8 md:mb-12">
                    <h1 className="text-3xl md:text-4xl font-bold mb-2 text-primary">
                        # mark.md
                    </h1>
                    <p className="text-muted-foreground text-sm md:text-base">
                        Convert any webpage into LLM-friendly markdown.
                    </p>
                </div>

                {/* Usage Instructions */}
                <div className="mb-6 md:mb-8 p-4 md:p-6 bg-card border border-border rounded-lg">
                    <h2 className="text-lg font-semibold mb-3 text-foreground">## Usage</h2>
                    <p className="text-sm text-muted-foreground mb-3">
                        Prefix the URL you want to convert with{" "}
                        <span className="text-primary font-bold">mark.md/</span>
                    </p>
                    <div className="bg-code-bg p-3 md:p-4 rounded border border-border overflow-x-auto">
                        <code className="text-xs md:text-sm">
                            <span className="text-muted-foreground">E.g.:</span>{" "}
                            <span className="text-primary">mark.md/  </span>
                            <span className="text-foreground">https://priyanshut.tech</span>
                        </code>
                    </div>
                </div>

                {/*Input Form*/}
                <div className="mb-6">
                    <p className="text-sm text-muted-foreground mb-3">Or paste the URL below:</p>
                    <div className="flex gap-2 flex-col sm:flex-row">
                        <Input 
                            type="url"
                            placeholder="URL to convert"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleConvert()}
                            className="flex-1 bg-input border-border text-foreground"
                            disabled={isLoading}
                        />

                        <Button
                            onClick={() => handleConvert()}
                            disabled={isLoading}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Converting...
                                </>
                            ) : (
                                "convert"
                            )}
                        </Button>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center text-sm text-muted-foreground">
                    <a href="https://priyanshut.tech" target="_blank" rel="noopener noreferrer">Made By Priyanshu Thapliyal</a>
                </div>
            </div>
        </div>
    );
};

export default Convert;