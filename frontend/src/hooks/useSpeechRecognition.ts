import { useState, useEffect, useRef, useCallback } from 'react';

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export type SupportedLanguage = 'en-US' | 'hi-IN' | 'es-ES';

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  error: string | null;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition(
  onFinalResult?: (text: string, audioBlob: Blob | null, language: SupportedLanguage) => void
): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<SupportedLanguage>('en-US');
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const accumulatedTranscriptRef = useRef<string>('');
  const isManuallyListeningRef = useRef<boolean>(false);

  // Initialize SpeechRecognition
  useEffect(() => {
    const windowWithSpeech = window as unknown as IWindow;
    const SpeechRecognition =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Web Speech API is not supported in this browser. Please use Google Chrome or Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      // Continuous = true so it stays listening until user manually stops
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let fullTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            fullTranscript += item[0].transcript + ' ';
          } else {
            currentInterim += item[0].transcript;
          }
        }

        const combined = (fullTranscript + currentInterim).trim();
        setInterimTranscript(combined);
        if (fullTranscript.trim()) {
          accumulatedTranscriptRef.current = fullTranscript.trim();
          setTranscript(fullTranscript.trim());
        } else if (currentInterim.trim()) {
          accumulatedTranscriptRef.current = currentInterim.trim();
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          // Keep listening; do not abort on silence
          return;
        }
        if (event.error === 'not-allowed') {
          setError('Microphone access was denied. Please allow microphone permissions.');
          setIsListening(false);
          isManuallyListeningRef.current = false;
        } else {
          console.warn('Speech recognition notice:', event.error);
        }
      };

      recognition.onend = () => {
        // If user is still recording and browser stopped recognition, restart it
        if (isManuallyListeningRef.current) {
          try {
            recognition.start();
          } catch {
            // Already started or active
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    } catch (e: any) {
      setError(`Failed to initialize speech recognition: ${e.message}`);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [language]);

  // Start Listening when user clicks the button
  const startListening = useCallback(async () => {
    setError(null);
    accumulatedTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    audioChunksRef.current = [];
    isManuallyListeningRef.current = true;

    // Start MediaRecorder stream
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start(250); // Collect slices every 250ms
      }
    } catch {
      // Fallback to browser SpeechRecognition if MediaRecorder stream fails
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = language;
        recognitionRef.current.start();
      } catch {
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            if (isManuallyListeningRef.current) {
              recognitionRef.current.start();
            }
          }, 150);
        } catch {
          setError('Could not start listening. Please try again.');
        }
      }
    }
  }, [language]);

  // Stop Listening ONLY when user clicks the button again
  const stopListening = useCallback(() => {
    isManuallyListeningRef.current = false;
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    // Stop MediaRecorder stream and prepare audio blob
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        }

        let audioBlob: Blob | null = null;
        if (audioChunksRef.current.length > 0) {
          audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        }

        const finalText = (accumulatedTranscriptRef.current || '').trim();
        if (onFinalResult) {
          onFinalResult(finalText, audioBlob, language);
        }
      };

      mediaRecorderRef.current.stop();
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const finalText = (accumulatedTranscriptRef.current || '').trim();
      if (onFinalResult) {
        onFinalResult(finalText, null, language);
      }
    }
  }, [language, onFinalResult]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    accumulatedTranscriptRef.current = '';
    audioChunksRef.current = [];
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error,
    language,
    setLanguage,
    startListening,
    stopListening,
    resetTranscript,
  };
}
