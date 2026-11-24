import { useEffect, useRef } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { useGetCustomConfigSpeechQuery } from 'librechat-data-provider/react-query';
import { STTEndpoints, TTSEndpoints } from '~/common';
import { logger } from '~/utils';
import store from '~/store';

const VALID_TTS_ENGINES: string[] = [TTSEndpoints.browser, TTSEndpoints.external];
const VALID_STT_ENGINES: string[] = [STTEndpoints.browser, STTEndpoints.external];

/**
 * librechat.yaml only accepts provider names for `speechTab.speechToText.engineSTT`
 * ('openai' | 'azureOpenAI'), but the client understands 'browser' | 'external'.
 * Any non-browser value from the server means the external (server-side) STT.
 */
const normalizeEngineSTT = (value: unknown): string =>
  value === STTEndpoints.browser ? STTEndpoints.browser : STTEndpoints.external;

/**
 * Initializes speech-related Recoil values from the server-side custom
 * configuration on first load (only when the user is authenticated)
 */
export default function useSpeechSettingsInit(isAuthenticated: boolean) {
  const { data } = useGetCustomConfigSpeechQuery({ enabled: isAuthenticated });
  const [engineTTS, setEngineTTS] = useRecoilState<string>(store.engineTTS);
  const [engineSTT, setEngineSTT] = useRecoilState<string>(store.engineSTT);

  const setters = useRef({
    conversationMode: useSetRecoilState(store.conversationMode),
    advancedMode: useSetRecoilState(store.advancedMode),
    speechToText: useSetRecoilState(store.speechToText),
    textToSpeech: useSetRecoilState(store.textToSpeech),
    cacheTTS: useSetRecoilState(store.cacheTTS),
    engineSTT: (value: unknown) => setEngineSTT(normalizeEngineSTT(value)),
    languageSTT: useSetRecoilState(store.languageSTT),
    autoTranscribeAudio: useSetRecoilState(store.autoTranscribeAudio),
    decibelValue: useSetRecoilState(store.decibelValue),
    autoSendText: useSetRecoilState(store.autoSendText),
    engineTTS: setEngineTTS,
    voice: useSetRecoilState(store.voice),
    cloudBrowserVoices: useSetRecoilState(store.cloudBrowserVoices),
    languageTTS: useSetRecoilState(store.languageTTS),
    automaticPlayback: useSetRecoilState(store.automaticPlayback),
    playbackRate: useSetRecoilState(store.playbackRate),
  }).current;

  useEffect(() => {
    if (!isAuthenticated || !data || data.message === 'not_found') return;

    logger.log('Initializing speech settings from config:', data);

    Object.entries(data).forEach(([key, value]) => {
      if (key === 'sttExternal' || key === 'ttsExternal') return;

      if (localStorage.getItem(key) !== null) return;

      const setter = setters[key as keyof typeof setters];
      if (setter) {
        logger.log(`Setting default speech setting: ${key} = ${value}`);
        setter(value as any);
      }
    });
  }, [isAuthenticated, data, setters]);

  useEffect(() => {
    if (VALID_STT_ENGINES.includes(engineSTT)) return;
    const fallback = data?.sttExternal ? STTEndpoints.external : STTEndpoints.browser;
    logger.log(`Resetting invalid STT engine "${engineSTT}" to ${fallback}`);
    setEngineSTT(fallback);
  }, [engineSTT, setEngineSTT, data?.sttExternal]);

  useEffect(() => {
    if (VALID_TTS_ENGINES.includes(engineTTS)) return;
    logger.log(`Resetting invalid TTS engine "${engineTTS}" to ${TTSEndpoints.browser}`);
    setEngineTTS(TTSEndpoints.browser);
  }, [engineTTS, setEngineTTS]);
}
