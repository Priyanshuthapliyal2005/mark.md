"use client";
import { useToast } from "@/hooks/use-toast";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { ArrowLeft, Download, Loader2, Home, Copy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { functions } from "@/lib/appwrite";
import { ModeToggle } from "./ModeToggle";

interface ConversionResult {
  html: string;
  markdown: string;
  plainText: string;
  url: string;
}

const Results = () => {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();

    const [isLoading,setIsLoading] = useState(true);
    const [result,setResult] = useState<ConversionResult | null>(null);
    const [error,setError] = useState<string | null> (null);
    const [activeTab , setActiveTab] = useState("markdown");

    // Fetch and convert URL when component mounts
    useEffect(() => {
        // Get the full URL from slug array
        const slug = params.slug;
        const fullUrl = Array.isArray(slug) ? slug.join('/') : slug;
        
        if (fullUrl) {
            handleConvert(fullUrl as string);
        } else {
            router.push('/');
        }
    }, [params]);

    // Function to convert URL using Appwrite
    const handleConvert = async (fullUrl: string) => {
        try {
            const decodedUrl = decodeURIComponent(fullUrl);
            
            // Validate URL format
            new URL(decodedUrl);

            setIsLoading(true);
            setError(null);

            console.log('Converting URL:', decodedUrl);

            // Call Appwrite function
            const response = await functions.createExecution(
                process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_ID!,
                JSON.stringify({ url: decodedUrl }),
                false // async = false (wait for result)
            );

            console.log('Appwrite response:', response);

            // Parse the response body
            const data = JSON.parse(response.responseBody);

            if (data.success) {
                setResult(data);
            } else {
                setError(data.error || 'Conversion failed');
            }
        } catch (err) {
            console.error('Conversion error:', err);
            if (err instanceof TypeError && err.message.includes('Invalid URL')) {
                setError('Invalid URL format. Please verify the URL.');
            } else {
                setError(err instanceof Error ? err.message : 'Failed to convert URL');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = async (text: string , format: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast({
                title: "Copied!",
                description: `${format} copied to clipboard`,
            });
        } catch (error) {
            toast({
                title: "Copy Failed",
                description: "Failed to copy to clipboard",
                variant: "destructive",
            });
        }
    };

    const downloadContent = (content: string , format: string) => {
        try {
            const blob = new Blob([content], {type: 'text/plain'});
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href= url;
            a.download = `converted.${format.toLowerCase()}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({
                title: "Downloaded!",
                description: `${format} file downloaded successfully`,
            });
        } catch (error) {
            toast({
                title: "Download Failed",
                description: "Failed to download file",
                variant: "destructive",
            });     
        }
    };

    //error state
    if(error) {
        const slug = params.slug;
        const fullUrl = Array.isArray(slug) ? slug.join('/') : slug;
        
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="w-full max-w-2xl">
                    <h2 className="text-2xl font-bold mb-6 text-destructive">
                        ### Conversion Failed
                    </h2>

                    <div className="border border-destructive bg-destructive/10 rounded-lg p-6 mb-6">
                        <p className="text-foreground mb-4">{error}</p>
                        {fullUrl && (
                            <p className="text-sm text-foreground">
                                <span className="font-semibold">URL:</span>{" "}
                                <span className="text-foreground">{decodeURIComponent(fullUrl as string)}</span>
                            </p>
                        )}
                    </div>

                    <div className="flex gap-4 flex-wrap">
                        <Button
                            variant="outline"
                            onClick={()=>router.push('/')}
                            className="border-border hover:bg-accent"
                        >
                            <Home className="mr-2 h-4 w-4" />
                            Back to Home
                        </Button>

                        <Button
                            variant="outline"
                            onClick={()=> window.history.back()}
                            className="border-border hover:bg-accent"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Go Back
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    const getCurrentContent = () => {
        if(!result) return '';
        switch (activeTab) {
            case 'markdown' :
                return result.markdown;
            case 'html' :
                return result.html;
            case 'plainText' :
                return result.plainText;
            default: 
                return '';
        }
    }

    const getCurrentFormat = () => {
        switch (activeTab) {
            case 'markdown':
                return 'md';
            case 'html':
                return 'html';
            case 'plainText':
                return 'txt';
            default:
                return 'md';
        }
    }

    if(isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Converting webpage...</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-background">
            <div className="border-b border-border bg-card sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
                    <Button 
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/')}
                        className="hover:bg-accent text-xs sm:text-sm h-10"
                    >
                        <ArrowLeft className="mr-1 sm:mr-2 h-4 w-4"/>
                        <span className="hidden sm:inline">Back</span>
                    </Button>

                    <div className="flex gap-2 items-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(getCurrentContent(), activeTab.toUpperCase())}
                            className="border-border hover:bg-accent text-xs sm:text-sm px-2 sm:px-3 h-10"
                        >
                            <Copy className="h-4 w-4" />
                            <span className="hidden sm:inline sm:ml-2">Copy</span>
                        </Button>
                        
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={()=> downloadContent(getCurrentContent(),getCurrentFormat())}
                            className="border-border hover:bg-accent text-xs sm:text-sm px-2 sm:px-3 h-10"
                        >
                            <Download className="h-4 w-4"/>
                            <span className="hidden sm:inline sm:ml-2">Download</span>
                        </Button>

                        <ModeToggle />
                    </div>
                </div>
            </div>

            <div className="border-b border-border bg-card sticky top-[57px] sm:top-[61px] z-10">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-secondary mb-3 sm:mb-4">
                            <TabsTrigger 
                                value="markdown"
                                className="text-gray-900 dark:text-gray-900 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-[0_4px_14px_0_rgba(0,0,0,0.4)] dark:data-[state=active]:bg-white dark:data-[state=active]:text-gray-900 dark:data-[state=active]:shadow-[0_4px_14px_0_rgba(255,255,255,0.4)] font-semibold text-xs sm:text-sm transition-all"
                            >
                                Markdown
                            </TabsTrigger>

                            <TabsTrigger
                                value="html"
                                className="text-gray-900 dark:text-gray-900 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-[0_4px_14px_0_rgba(0,0,0,0.4)] dark:data-[state=active]:bg-white dark:data-[state=active]:text-gray-900 dark:data-[state=active]:shadow-[0_4px_14px_0_rgba(255,255,255,0.4)] font-semibold text-xs sm:text-sm transition-all"
                            >
                                HTML
                            </TabsTrigger>

                            <TabsTrigger
                                value="plainText"
                                className="text-gray-900 dark:text-gray-900 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-[0_4px_14px_0_rgba(0,0,0,0.4)] dark:data-[state=active]:bg-white dark:data-[state=active]:text-gray-900 dark:data-[state=active]:shadow-[0_4px_14px_0_rgba(255,255,255,0.4)] font-semibold text-xs sm:text-sm transition-all"
                            >
                                Plain Text
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-3 sm:p-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsContent value="markdown">
                        <pre className="bg-code-bg border border-border rounded-lg p-4 sm:p-6 overflow-x-auto text-xs sm:text-sm">
                            <code className="text-foreground whitespace-pre-wrap wrap-break-word">{result?.markdown}</code>
                        </pre>
                    </TabsContent>

                    <TabsContent value="html">
                        <pre className="bg-code-bg border border-border rounded-lg p-4 sm:p-6 overflow-x-auto text-xs sm:text-sm">
                            <code className="text-foreground whitespace-pre-wrap wrap-break-word">{result?.html}</code>
                        </pre>
                    </TabsContent>

                    <TabsContent value="plainText">
                        <pre className="bg-code-bg border border-border rounded-lg p-4 sm:p-6 overflow-x-auto text-xs sm:text-sm">
                            <code className="text-foreground whitespace-pre-wrap wrap-break-word">{result?.plainText}</code>
                        </pre>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default Results;