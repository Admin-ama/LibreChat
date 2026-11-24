import { useState, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { useToastContext } from '@librechat/client';
import { dataService } from 'librechat-data-provider';
import { useSpeechToTextMutation } from '~/data-provider';
import useGetAudioSettings from './useGetAudioSettings';
import store from '~/store';

type LivePreviewRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

/**
 * AMA: while recording for the external (server-side) STT, show a live preview.
 * - Chrome/Edge: the browser's Web Speech API (instant, free).
 * - Electron or any browser where Web Speech fails (no Google keys → 'network' error):
 *   periodically send the audio recorded so far to the server STT with `preview=true`.
 * The preview is replaced by the full server transcription when recording stops.
 */
const SERVER_PREVIEW_INTERVAL_MS = 2500;
const SERVER_PREVIEW_MAX_MS = 120000;
const SERVER_PREVIEW_MIN_BYTES = 4000;
const WEB_SPEECH_FATAL_ERRORS = ['network', 'service-not-allowed', 'not-allowed', 'audio-capture'];

const isElectron = () =>
  typeof navigator !== 'undefined' && /\bElectron\//.test(navigator.userAgent);

const getLivePreviewRecognitionCtor = (): (new () => LivePreviewRecognition) | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const w = window as unknown as {
    SpeechRecognition?: new () => LivePreviewRecognition;
    webkitSpeechRecognition?: new () => LivePreviewRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const useSpeechToTextExternal = (
  setText: (text: string) => void,
  onTranscriptionComplete: (text: string) => void,
) => {
  const { showToast } = useToastContext();
  const { speechToTextEndpoint } = useGetAudioSettings();
  const isExternalSTTEnabled = speechToTextEndpoint === 'external';
  const audioStream = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const audioChunksRef = useRef<Blob[]>([]);
  const livePreviewRef = useRef<LivePreviewRecognition | null>(null);
  const livePreviewActiveRef = useRef(false);
  const serverPreviewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const serverPreviewInFlightRef = useRef(false);
  const serverPreviewStartRef = useRef(0);
  const [permission, setPermission] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isRequestBeingMade, setIsRequestBeingMade] = useState(false);
  const [audioMimeType, setAudioMimeType] = useState<string>(() => getBestSupportedMimeType());

  const [minDecibels] = useRecoilState(store.decibelValue);
  const [autoSendText] = useRecoilState(store.autoSendText);
  const [languageSTT] = useRecoilState<string>(store.languageSTT);
  const [speechToText] = useRecoilState<boolean>(store.speechToText);
  const [autoTranscribeAudio] = useRecoilState<boolean>(store.autoTranscribeAudio);

  const { mutate: processAudio, isLoading: isProcessing } = useSpeechToTextMutation({
    onSuccess: (data) => {
      const extractedText = data.text;
      setText(extractedText);
      setIsRequestBeingMade(false);

      if (autoSendText > -1 && speechToText && extractedText.length > 0) {
        setTimeout(() => {
          onTranscriptionComplete(extractedText);
        }, autoSendText * 1000);
      }
    },
    onError: () => {
      showToast({
        message: 'An error occurred while processing the audio, maybe the audio was too short',
        status: 'error',
      });
      setIsRequestBeingMade(false);
    },
  });

  function getBestSupportedMimeType() {
    const types = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav',
    ];

    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.indexOf('safari') !== -1 && ua.indexOf('chrome') === -1) {
        return 'audio/mp4';
      } else if (ua.indexOf('firefox') !== -1) {
        return 'audio/ogg';
      }
    }

    return 'audio/webm';
  }

  const getFileExtension = (mimeType: string) => {
    if (mimeType.includes('mp4')) {
      return 'm4a';
    } else if (mimeType.includes('ogg')) {
      return 'ogg';
    } else if (mimeType.includes('wav')) {
      return 'wav';
    } else {
      return 'webm';
    }
  };

  const stopServerPreview = () => {
    if (serverPreviewTimerRef.current !== null) {
      clearInterval(serverPreviewTimerRef.current);
      serverPreviewTimerRef.current = null;
    }
  };

  const startServerPreview = () => {
    if (serverPreviewTimerRef.current !== null) {
      return;
    }
    livePreviewActiveRef.current = true;
    serverPreviewStartRef.current = Date.now();
    serverPreviewTimerRef.current = setInterval(() => {
      if (!livePreviewActiveRef.current) {
        stopServerPreview();
        return;
      }
      if (Date.now() - serverPreviewStartRef.current > SERVER_PREVIEW_MAX_MS) {
        stopServerPreview();
        return;
      }
      if (serverPreviewInFlightRef.current) {
        return;
      }
      const mimeType = mediaRecorderRef.current?.mimeType || audioMimeType;
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      if (blob.size < SERVER_PREVIEW_MIN_BYTES) {
        return;
      }
      const formData = new FormData();
      formData.append('audio', blob, `audio.${getFileExtension(mimeType)}`);
      if (languageSTT) {
        formData.append('language', languageSTT);
      }
      formData.append('preview', 'true');
      serverPreviewInFlightRef.current = true;
      dataService
        .speechToText(formData)
        .then((data) => {
          if (livePreviewActiveRef.current && data?.text) {
            setText(data.text);
          }
        })
        .catch(() => {
          /* preview is best-effort */
        })
        .finally(() => {
          serverPreviewInFlightRef.current = false;
        });
    }, SERVER_PREVIEW_INTERVAL_MS);
  };

  const startLivePreview = () => {
    const Ctor = getLivePreviewRecognitionCtor();
    if (!Ctor || isElectron()) {
      startServerPreview();
      return;
    }
    try {
      const recognition = new Ctor();
      recognition.lang = languageSTT || navigator.language || 'es';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        if (!livePreviewActiveRef.current) {
          return;
        }
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0]?.transcript ?? '';
        }
        transcript = transcript.trim();
        if (transcript) {
          setText(transcript);
        }
      };
      recognition.onerror = (event) => {
        /** Web Speech unavailable (e.g. Electron without Google keys) → server preview */
        if (
          livePreviewActiveRef.current &&
          livePreviewRef.current === recognition &&
          WEB_SPEECH_FATAL_ERRORS.includes(event?.error ?? '')
        ) {
          livePreviewRef.current = null;
          try {
            recognition.abort();
          } catch {
            /* ignore */
          }
          startServerPreview();
        }
      };
      recognition.onend = () => {
        /** Chrome ends recognition after a pause; restart while still recording */
        if (livePreviewActiveRef.current && livePreviewRef.current === recognition) {
          try {
            recognition.start();
          } catch {
            /* ignore */
          }
        }
      };
      livePreviewRef.current = recognition;
      livePreviewActiveRef.current = true;
      recognition.start();
    } catch {
      livePreviewRef.current = null;
      startServerPreview();
    }
  };

  const stopLivePreview = () => {
    livePreviewActiveRef.current = false;
    stopServerPreview();
    const recognition = livePreviewRef.current;
    livePreviewRef.current = null;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => stopLivePreview, []);

  const cleanup = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
  };

  const getMicrophonePermission = async () => {
    try {
      const streamData = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setPermission(true);
      audioStream.current = streamData ?? null;
    } catch {
      setPermission(false);
    }
  };

  const handleStop = () => {
    if (audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: audioMimeType });
      const fileExtension = getFileExtension(audioMimeType);

      audioChunksRef.current = [];

      const formData = new FormData();
      formData.append('audio', audioBlob, `audio.${fileExtension}`);
      if (languageSTT) {
        formData.append('language', languageSTT);
      }
      setIsRequestBeingMade(true);
      cleanup();
      processAudio(formData);
    } else {
      showToast({ message: 'The audio was too short', status: 'warning' });
    }
  };

  const monitorSilence = (stream: MediaStream, stopRecording: () => void) => {
    const audioContext = new AudioContext();
    const audioStreamSource = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.minDecibels = minDecibels;
    audioStreamSource.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const domainData = new Uint8Array(bufferLength);
    let lastSoundTime = Date.now();

    const detectSound = () => {
      analyser.getByteFrequencyData(domainData);
      const isSoundDetected = domainData.some((value) => value > 0);

      if (isSoundDetected) {
        lastSoundTime = Date.now();
      }

      const timeSinceLastSound = Date.now() - lastSoundTime;
      const isOverSilenceThreshold = timeSinceLastSound > 3000;

      if (isOverSilenceThreshold) {
        stopRecording();
        return;
      }

      animationFrameIdRef.current = window.requestAnimationFrame(detectSound);
    };

    animationFrameIdRef.current = window.requestAnimationFrame(detectSound);
  };

  const startRecording = async () => {
    if (isRequestBeingMade) {
      showToast({ message: 'A request is already being made. Please wait.', status: 'warning' });
      return;
    }

    if (!audioStream.current) {
      await getMicrophonePermission();
    }

    if (audioStream.current) {
      try {
        audioChunksRef.current = [];
        const bestMimeType = getBestSupportedMimeType();
        setAudioMimeType(bestMimeType);

        mediaRecorderRef.current = new MediaRecorder(audioStream.current, {
          mimeType: audioMimeType,
        });
        mediaRecorderRef.current.addEventListener('dataavailable', (event: BlobEvent) => {
          audioChunksRef.current.push(event.data);
        });
        mediaRecorderRef.current.addEventListener('stop', handleStop);
        mediaRecorderRef.current.start(100);
        if (!audioContextRef.current && autoTranscribeAudio && speechToText) {
          monitorSilence(audioStream.current, stopRecording);
        }
        setIsListening(true);
        startLivePreview();
      } catch (error) {
        showToast({ message: `Error starting recording: ${error}`, status: 'error' });
      }
    } else {
      showToast({ message: 'Microphone permission not granted', status: 'error' });
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) {
      return;
    }

    stopLivePreview();

    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();

      audioStream.current?.getTracks().forEach((track) => track.stop());
      audioStream.current = null;

      if (animationFrameIdRef.current !== null) {
        window.cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }

      setIsListening(false);
    } else {
      showToast({ message: 'MediaRecorder is not recording', status: 'error' });
    }
  };

  const externalStartRecording = () => {
    if (isListening) {
      showToast({ message: 'Already listening. Please stop recording first.', status: 'warning' });
      return;
    }

    startRecording();
  };

  const externalStopRecording = () => {
    if (!isListening) {
      showToast({
        message: 'Not currently recording. Please start recording first.',
        status: 'warning',
      });
      return;
    }

    stopRecording();
  };

  const handleKeyDown = async (e: KeyboardEvent) => {
    if (e.shiftKey && e.altKey && e.code === 'KeyL' && isExternalSTTEnabled) {
      if (!window.MediaRecorder) {
        showToast({ message: 'MediaRecorder is not supported in this browser', status: 'error' });
        return;
      }

      if (permission === false) {
        await getMicrophonePermission();
      }

      if (isListening) {
        stopRecording();
      } else {
        startRecording();
      }

      e.preventDefault();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  return {
    isListening,
    externalStopRecording,
    externalStartRecording,
    isLoading: isProcessing,
  };
};

export default useSpeechToTextExternal;
