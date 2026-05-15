import { useState, useRef, useCallback } from 'react';

export function useVoiceToText() {
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const finalVoiceTranscriptRef = useRef('');

  const supportsSpeechRecognition = typeof window !== 'undefined' && (
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );

  const toggleRecording = useCallback(() => {
    setMicError(null);
    if (!supportsSpeechRecognition) {
      setMicError('Speech recognition is not supported in this browser.');
      return;
    }
    
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setTranscript(finalVoiceTranscriptRef.current.trim());
      return;
    }
    
    // When starting, clear transcript and show 'Listening...'
    setTranscript('Listening...');
    finalVoiceTranscriptRef.current = '';
    
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';
      
      let silenceTimeout: any = null;

      recognition.onstart = () => {
        setIsRecording(true);
      };
      
      recognition.onerror = (event: any) => {
        setMicError('Speech recognition error: ' + event.error);
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognition.onresult = (event: any) => {
        let newFinalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const resultTranscript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            newFinalTranscript += resultTranscript;
          }
        }
        
        if (newFinalTranscript) {
          finalVoiceTranscriptRef.current += newFinalTranscript;
          setTranscript(finalVoiceTranscriptRef.current);
        }
        
        // Reset silence timer
        if (silenceTimeout) clearTimeout(silenceTimeout);
        silenceTimeout = setTimeout(() => {
          recognition.stop();
          setIsRecording(false);
          setTranscript(finalVoiceTranscriptRef.current.trim() || '');
        }, 3000);
      };
      
      recognition.start();
    } catch (err: any) {
      setMicError('Speech recognition failed to start.');
      setIsRecording(false);
      setTranscript(finalVoiceTranscriptRef.current.trim());
    }
  }, [isRecording, supportsSpeechRecognition]);

  return {
    isRecording,
    micError,
    transcript,
    setTranscript,
    toggleRecording,
    supportsSpeechRecognition
  };
}
