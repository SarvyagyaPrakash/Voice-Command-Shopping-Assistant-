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
  const audioChunksRef = useRef<Blob[]>([]);
  const finalTranscriptRef = useRef<string>('');

  // Setup Web Speech API & MediaRecorder
  useEffect(() => {
    const windowWithSpeech = window as unknown as IWindow;
    const SpeechRecognition =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Web Speech API is not supported in this browser. Please use Chrome/Edge or type your command.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setInterimTranscript('');
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            currentFinal += item[0].transcript;
          } else {
            currentInterim += item[0].transcript;
          }
        }

        setInterimTranscript(currentInterim);

        if (currentFinal) {
          finalTranscriptRef.current = currentFinal.trim();
          setTranscript(currentFinal.trim());
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setError('Microphone access was denied. Please grant microphone permissions.');
        } else if (event.error === 'no-speech') {
          setError('No speech was detected. Please try again.');
        } else if (event.error === 'network') {
          setError('Network error during speech recognition.');
        } else {
          setError(`Speech recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // Stop MediaRecorder if running
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        } else {
          deliverResult();
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

  const deliverResult = useCallback(() => {
    let audioBlob: Blob | null = null;
    if (audioChunksRef.current.length > 0) {
      audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    }
    const finalRecorded = finalTranscriptRef.current;
    if (onFinalResult) {
      onFinalResult(finalRecorded, audioBlob, language);
    }
  }, [language, onFinalResult]);

  const startListening = useCallback(async () => {
    setError(null);
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    audioChunksRef.current = [];

    // Start audio stream for MediaRecorder alongside speech recognition
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          deliverResult();
        };

        mediaRecorder.start();
      }
    } catch {
      // Microphone stream fallback if MediaRecorder fails
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = language;
        recognitionRef.current.start();
      } catch {
        try {
          recognitionRef.current.stop();
          setTimeout(() => recognitionRef.current.start(), 150);
        } catch {
          setError('Could not start listening. Please try again.');
        }
      }
    }
  }, [deliverResult, language]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    finalTranscriptRef.current = '';
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
