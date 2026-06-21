import React, { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';

export default function TokenChangeAlert({ currentToken, currentPatientName, voiceEnabled }) {
  const [alert, setAlert] = useState(null);
  const previousTokenRef = useRef(currentToken);
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    // Wait for the websocket snap to first populate currentToken (either null or number)
    if (currentToken === undefined) return;

    if (currentToken !== previousTokenRef.current) {
      const prev = previousTokenRef.current;
      previousTokenRef.current = currentToken;

      // Skip announcement on the very first hydration snapshot
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false;
        return;
      }

      // If transition is to empty room, do not announce
      if (currentToken === null) return;

      // Set alert state to trigger rendering
      setAlert(currentToken);
      
      // 1. Play notification chime
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.4;
        audio.play().catch(e => console.log('Audio autoplay blocked by browser', e));
      } catch (e) {
        // ignore
      }

      // 2. Perform voice announcement if enabled
      if (voiceEnabled) {
        try {
          // Cancel ongoing synthesis to prevent queuing backlog
          window.speechSynthesis.cancel();

          const namePhrase = currentPatientName ? `. ${currentPatientName}` : '';
          const text = `Token Number ${currentToken}${namePhrase}. Please proceed to the consultation room.`;
          
          const utterance = new SpeechSynthesisUtterance(text);
          
          // Selection of a clear English voice
          const voices = window.speechSynthesis.getVoices();
          const englishVoice = voices.find(v => v.lang.startsWith('en-') && v.localService) || 
                               voices.find(v => v.lang.startsWith('en-')) || 
                               voices[0];
          
          if (englishVoice) {
            utterance.voice = englishVoice;
          }
          
          utterance.rate = 0.85; // moderate clear speaking pace
          utterance.pitch = 1.0;
          
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.error("Speech Synthesis failed", e);
        }
      }
      
      // Clear visual alert after 5 seconds
      const timer = setTimeout(() => {
        setAlert(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [currentToken, currentPatientName, voiceEnabled]);

  if (!alert) return null;

  return (
    <div 
      role="alert" 
      aria-live="assertive"
      className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-10 fade-in duration-500"
    >
      <div className="bg-indigo-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border-4 border-indigo-400">
        <Bell className="w-8 h-8 animate-bounce" />
        <div>
          <p className="text-indigo-100 font-bold uppercase tracking-widest text-sm">Now Serving</p>
          <p className="text-3xl font-black">Token #{alert}</p>
        </div>
      </div>
    </div>
  );
}
