'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, StopCircle, Sparkles, Loader2, AlertTriangle, Play, Pause } from 'lucide-react';
import { handleSummarizeTranscript } from './actions';
import { useToast } from '@/hooks/use-toast';

// Standard SpeechRecognitionEvent (subset, could rely on lib.dom.d.ts if fully standard)
interface CustomSpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

// Custom SpeechRecognition interface to handle potential browser inconsistencies
// and to type event handlers more specifically.
interface CustomSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart?: () => void;
  onend?: () => void;
  onerror?: (event: SpeechRecognitionErrorEvent) => void;
  onresult?: (event: CustomSpeechRecognitionEvent) => void;
  onaudiostart?: () => void;
  onaudioend?: () => void;
  onsoundstart?: () => void;
  onsoundend?: () => void;
  onspeechstart?: () => void;
  onspeechend?: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition | undefined;
    webkitSpeechRecognition: typeof CustomSpeechRecognition | undefined;
  }
}


export default function HomePage() {
  const [isRecognizing, setIsRecognizing] = useState(false); // True when SpeechRecognition API is active
  const [isSessionActive, setIsSessionActive] = useState(false); // True from "Start" until "Stop"
  const [isPaused, setIsPaused] = useState(false); // True if session is active but paused

  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState(true);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  const recognitionRef = useRef<CustomSpeechRecognition | null>(null);
  const lastFinalizedResultIndexRef = useRef<number>(-1);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionAPI) {
        setIsSpeechRecognitionSupported(false);
        console.warn("Speech Recognition API not supported in this browser.");
        return;
      }

      const recogInstance: CustomSpeechRecognition = new SpeechRecognitionAPI();
      recogInstance.continuous = true;
      recogInstance.interimResults = true;
      recogInstance.lang = 'en-US';

      recogInstance.onstart = () => {
        setIsRecognizing(true);
        setRecognitionError(null);
      };

      recogInstance.onend = () => {
        setIsRecognizing(false);
      };

      recogInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        let errorMessage = `Speech recognition error: ${event.error}`;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          errorMessage = "Microphone access denied. Please allow microphone access in your browser settings.";
        } else if (event.error === 'no-speech') {
          errorMessage = "No speech detected. Please try speaking louder or closer to the microphone.";
        } else if (event.error === 'network') {
          errorMessage = "Network error during speech recognition. Please check your internet connection.";
        }
        setRecognitionError(errorMessage);
        setIsRecognizing(false);
        setIsSessionActive(false); 
        setIsPaused(false);
      };

      recogInstance.onresult = (event: CustomSpeechRecognitionEvent) => {
        let currentInterim = '';
        let newFinalizedContent = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            // Only process this final result if its index is greater than the last one we processed
            if (i > lastFinalizedResultIndexRef.current) {
              newFinalizedContent += transcriptPart.trim() + ' ';
              lastFinalizedResultIndexRef.current = i;
            }
          } else {
            currentInterim += transcriptPart;
          }
        }

        setInterimTranscript(currentInterim);

        if (newFinalizedContent) {
          setFinalTranscript(prevFinalTranscript => prevFinalTranscript + newFinalizedContent);
        }
      };
      recognitionRef.current = recogInstance;
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      setFinalTranscript('');
      setInterimTranscript('');
      setSummary('');
      setRecognitionError(null);
      lastFinalizedResultIndexRef.current = -1; // Reset for a new session
      try {
        recognitionRef.current.start();
        setIsSessionActive(true);
        setIsPaused(false);
      } catch (e) {
        console.error("Error starting recognition:", e);
        setRecognitionError("Could not start microphone. It might be in use by another application or not supported.");
        setIsSessionActive(false);
      }
    }
  }, [recognitionRef]);

  const pauseListening = useCallback(() => {
    if (recognitionRef.current && isRecognizing) {
      recognitionRef.current.stop(); 
      setIsPaused(true);
    }
  }, [recognitionRef, isRecognizing]);

  const resumeListening = useCallback(() => {
    if (recognitionRef.current && isPaused) {
      try {
        // `lastFinalizedResultIndexRef` is NOT reset here, to continue appending
        recognitionRef.current.start(); 
        setIsPaused(false);
      } catch (e) {
        console.error("Error resuming recognition:", e);
        setRecognitionError("Could not resume microphone.");
      }
    }
  }, [recognitionRef, isPaused]);

  const stopTranscription = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsSessionActive(false);
    setIsPaused(false);
     // Optional: Consider if lastFinalizedResultIndexRef should be reset here
     // if stopping means the "session" for appending is truly over.
     // For now, it's reset only on a full "startListening".
  }, [recognitionRef]);


  const handleSummarizeClick = async () => {
    const transcriptToSummarize = finalTranscript.trim();
    if (!transcriptToSummarize) {
      toast({
        title: "Cannot Summarize",
        description: "The transcript is empty.",
        variant: "destructive",
      });
      return;
    }
    setIsLoadingSummary(true);
    setSummary(''); 
    const result = await handleSummarizeTranscript(transcriptToSummarize);
    setIsLoadingSummary(false);

    if ('error' in result) {
      toast({
        title: "Summarization Failed",
        description: result.error,
        variant: "destructive",
      });
    } else if (result.summary) {
      setSummary(result.summary);
      toast({
        title: "Summary Generated",
        description: "The call transcript has been summarized.",
      });
    }
  };

  if (!isSpeechRecognitionSupported) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Card className="w-full max-w-md p-6 shadow-xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive flex items-center justify-center">
              <AlertTriangle className="mr-2 h-6 w-6" /> Browser Not Supported
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              We're sorry, but speech recognition is not supported in your current browser.
              Please try using a modern browser like Chrome or Edge.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground p-4 sm:p-8 selection:bg-primary/30">
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-primary tracking-tight">SupportTalk</h1>
        <p className="text-muted-foreground text-lg mt-2">Customer Support Call Transcription & Summarization</p>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <Card className="shadow-xl rounded-lg overflow-hidden">
          <CardHeader className="bg-card-foreground/5">
            <CardTitle className="text-2xl text-foreground">Live Transcription</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ScrollArea className="h-[200px] w-full rounded-md border bg-muted/30 p-4 shadow-inner">
              <div className="min-h-full text-left text-lg leading-relaxed">
                {finalTranscript ? (
                  <span className="whitespace-pre-wrap">{finalTranscript}</span>
                ) : null}
                {interimTranscript ? (
                  <span className="text-muted-foreground opacity-75 whitespace-pre-wrap">{interimTranscript}</span>
                ) : null}
                
                {!recognitionError && !finalTranscript && !interimTranscript && (
                  <>
                    {!isSessionActive && (
                      <p className="text-muted-foreground">
                        Click "Start Transcription" to begin.
                      </p>
                    )}
                    {isRecognizing && !isPaused && (
                      <p className="text-muted-foreground italic">Listening...</p>
                    )}
                    {isPaused && (
                      <p className="text-muted-foreground italic">Paused. Click "Resume" or "Stop".</p>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
            {recognitionError && (
              <div className="mt-4 p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-md text-sm flex items-start">
                <AlertTriangle className="h-5 w-5 mr-2 shrink-0 mt-0.5" />
                <p>{recognitionError}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
          {!isSessionActive ? (
            <Button onClick={startListening} size="lg" className="w-full sm:w-auto px-8 py-6 text-lg rounded-lg shadow-md hover:shadow-lg transition-shadow" disabled={isLoadingSummary}>
              <Mic className="mr-2 h-6 w-6" /> Start Transcription
            </Button>
          ) : (
            <>
              {isPaused ? (
                <Button onClick={resumeListening} size="lg" className="w-full sm:w-auto px-8 py-6 text-lg rounded-lg shadow-md hover:shadow-lg transition-shadow">
                  <Play className="mr-2 h-6 w-6" /> Resume Transcription
                </Button>
              ) : (
                <Button onClick={pauseListening} size="lg" className="w-full sm:w-auto px-8 py-6 text-lg rounded-lg shadow-md hover:shadow-lg transition-shadow" disabled={!isRecognizing && isSessionActive && !isPaused}>
                  <Pause className="mr-2 h-6 w-6" /> Pause Transcription
                </Button>
              )}
              <Button onClick={stopTranscription} variant="destructive" size="lg" className="w-full sm:w-auto px-8 py-6 text-lg rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <StopCircle className="mr-2 h-6 w-6" /> Stop Transcription
              </Button>
            </>
          )}
        </div>

        {finalTranscript && (!isSessionActive || isPaused) && (
          <Card className="shadow-xl rounded-lg overflow-hidden">
            <CardHeader  className="bg-card-foreground/5">
              <CardTitle className="text-xl text-foreground">Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Button onClick={handleSummarizeClick} disabled={isLoadingSummary || (isSessionActive && !isPaused)} className="w-full sm:w-auto mb-4 rounded-md">
                {isLoadingSummary ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-5 w-5" />
                )}
                {isLoadingSummary ? 'Summarizing...' : 'Summarize Transcript'}
              </Button>
              {summary && (
                <ScrollArea className="h-[150px] w-full rounded-md border bg-muted/30 p-4 shadow-inner">
                  <p className="whitespace-pre-wrap text-left leading-relaxed">{summary}</p>
                </ScrollArea>
              )}
               {!summary && isLoadingSummary && (
                 <div className="flex items-center justify-center h-[150px] w-full rounded-md border bg-muted/30 p-4 shadow-inner">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
               )}
              {!summary && !isLoadingSummary && finalTranscript && (
                 <div className="flex items-center justify-center h-[150px] w-full rounded-md border bg-muted/30 p-4 shadow-inner">
                    <p className="text-muted-foreground">Click "Summarize Transcript" to generate a summary.</p>
                 </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
      <footer className="mt-12 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} SupportTalk. Powered by Next.js and Genkit.</p>
      </footer>
    </div>
  );
}