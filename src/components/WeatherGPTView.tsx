import React, { useState, useEffect, useRef } from "react";
import {
  CurrentWeatherTelemetry,
  Anomaly,
  SensorHealthInfo,
  StationHealthSummary,
  StationInfo,
  DailyForecastDay,
  ChatMessage,
  SupportedLanguage,
} from "../types";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Languages,
  Bot,
  User,
  RotateCcw,
  Loader2,
  Check,
  HelpCircle,
  Sliders,
} from "lucide-react";

/**
 * Required BCP-47 Language Mapping for SpeechSynthesis
 * English → en-US
 * Telugu → te-IN
 * Hindi → hi-IN
 * Kannada → kn-IN
 * Tamil → ta-IN
 * Malayalam → ml-IN
 * Marathi → mr-IN
 * Bengali → bn-IN
 */
const languageCodeMap: Record<string, string> = {
  English: "en-US",
  Telugu: "te-IN",
  Hindi: "hi-IN",
  Kannada: "kn-IN",
  Tamil: "ta-IN",
  Malayalam: "ml-IN",
  Marathi: "mr-IN",
  Bengali: "bn-IN",
  en: "en-US",
  te: "te-IN",
  hi: "hi-IN",
  kn: "kn-IN",
  ta: "ta-IN",
  ml: "ml-IN",
  mr: "mr-IN",
  bn: "bn-IN",
};

const languageDisplayNames: Record<string, string> = {
  English: "English",
  Telugu: "Telugu",
  Hindi: "Hindi",
  Kannada: "Kannada",
  Tamil: "Tamil",
  Malayalam: "Malayalam",
  Marathi: "Marathi",
  Bengali: "Bengali",
  en: "English",
  te: "Telugu",
  hi: "Hindi",
  kn: "Kannada",
  ta: "Tamil",
  ml: "Malayalam",
  mr: "Marathi",
  bn: "Bengali",
};

/**
 * Voice Matching Algorithm (Exact order specified):
 * For the selected language, try in this order:
 * 1. Exact match:
 *    voice.lang === "te-IN"
 * 2. Case-insensitive exact match:
 *    voice.lang.toLowerCase() === "te-in"
 * 3. Base language:
 *    voice.lang.toLowerCase().startsWith("te-") or voice.lang.toLowerCase() === "te"
 *
 * Safety:
 * Do NOT select an English voice as a fallback.
 * Return null and empty array if no match exists.
 */
function findMatchingVoice(
  voices: SpeechSynthesisVoice[],
  targetCode: string
): { selectedVoice: SpeechSynthesisVoice | null; matchingVoices: SpeechSynthesisVoice[] } {
  if (!voices || voices.length === 0) {
    return { selectedVoice: null, matchingVoices: [] };
  }

  const targetExact = targetCode; // e.g. "te-IN"
  const targetLower = targetCode.toLowerCase().replace(/_/g, "-"); // e.g. "te-in"
  const baseLang = targetLower.split("-")[0]; // e.g. "te"

  // 1. Exact match: voice.lang === "te-IN"
  let matches = voices.filter(
    (v) => (v.lang || "").replace(/_/g, "-") === targetExact
  );
  if (matches.length > 0) {
    const chosen = matches.find((v) => v.default) || matches[0];
    return { selectedVoice: chosen, matchingVoices: matches };
  }

  // 2. Case-insensitive exact match: voice.lang.toLowerCase() === "te-in"
  matches = voices.filter(
    (v) => (v.lang || "").toLowerCase().replace(/_/g, "-") === targetLower
  );
  if (matches.length > 0) {
    const chosen = matches.find((v) => v.default) || matches[0];
    return { selectedVoice: chosen, matchingVoices: matches };
  }

  // 3. Base language: voice.lang.toLowerCase().startsWith("te-") or voice.lang.toLowerCase() === "te"
  matches = voices.filter((v) => {
    const vLang = (v.lang || "").toLowerCase().replace(/_/g, "-");
    return vLang === baseLang || vLang.startsWith(`${baseLang}-`);
  });
  if (matches.length > 0) {
    const chosen = matches.find((v) => v.default) || matches[0];
    return { selectedVoice: chosen, matchingVoices: matches };
  }

  // Strictly do NOT select an English voice as a fallback.
  return { selectedVoice: null, matchingVoices: [] };
}

/**
 * Asynchronously wait for speechSynthesis voices to be fully populated by the browser.
 * Handles both the onvoiceschanged event and polling fallback for chromium/webkit environments.
 */
function getSpeechVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing && existing.length > 0) {
      resolve(existing);
      return;
    }

    let settled = false;
    let pollTimer: any = null;
    let timeoutTimer: any = null;

    const cleanup = () => {
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
    };

    const done = () => {
      if (settled) return;
      cleanup();
      resolve(window.speechSynthesis.getVoices() || []);
    };

    const onVoicesChanged = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        done();
      }
    };

    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);

    // Poll every 100ms up to 1500ms
    let count = 0;
    pollTimer = setInterval(() => {
      count++;
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        done();
      } else if (count >= 15) {
        done();
      }
    }, 100);

    timeoutTimer = setTimeout(done, 1500);
  });
}

interface WeatherGPTViewProps {
  telemetry: CurrentWeatherTelemetry | null;
  anomalies: Anomaly[];
  sensorHealth: SensorHealthInfo[];
  stationSummary: StationHealthSummary;
  station: StationInfo;
  forecast: DailyForecastDay[];
  initialPrompt?: string;
}

export function WeatherGPTView({
  telemetry,
  anomalies,
  sensorHealth,
  stationSummary,
  station,
  forecast,
  initialPrompt,
}: WeatherGPTViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "assistant",
      text: `Hello! I am **WeatherGPT**, your meteorological AI assistant for **${station.name}**.\n\nI have real-time access to live AWS telemetry, statistical anomaly detection flags, sensor health calibrations, and regional forecasts. How can I assist you today?`,
      timestamp: Date.now(),
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>("en");
  const language = selectedLanguage;
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null);
  const [voiceWarningMsgId, setVoiceWarningMsgId] = useState<string | null>(null);
  const [showVoiceDiagnostics, setShowVoiceDiagnostics] = useState(false);
  const [cloudTtsStatus, setCloudTtsStatus] = useState<{
    connected: boolean;
    provider: string;
    message: string;
  } | null>(null);
  const [isCloudTtsLoading, setIsCloudTtsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const cloudAudioRef = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Check Cloud TTS Gateway backend status on mount
  useEffect(() => {
    fetch("/api/tts/status")
      .then((res) => res.json())
      .then((data) => setCloudTtsStatus(data))
      .catch((err) => console.warn("Cloud TTS status check error:", err));
  }, []);

  // Load and cache browser speech synthesis voices with onvoiceschanged + async fallback
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const logAndSetVoices = (voices: SpeechSynthesisVoice[]) => {
      if (voices && voices.length > 0) {
        setAvailableVoices(voices);
        console.log(
          "Available voices loaded:",
          voices.length,
          voices.map((v) => ({
            name: v.name,
            lang: v.lang,
            localService: v.localService,
            default: v.default,
          }))
        );
      }
    };

    // 1. Initial attempt
    const initialVoices = window.speechSynthesis.getVoices();
    if (initialVoices && initialVoices.length > 0) {
      logAndSetVoices(initialVoices);
    } else {
      // 2. Wait for async population
      getSpeechVoicesAsync().then((v) => {
        logAndSetVoices(v);
      });
    }

    // 3. Listen for browser voiceschanged event
    const handleVoicesChanged = () => {
      const v = window.speechSynthesis.getVoices();
      logAndSetVoices(v);
    };

    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);

    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
        window.speechSynthesis.cancel();
      }
      if (cloudAudioRef.current) {
        cloudAudioRef.current.pause();
        cloudAudioRef.current = null;
      }
    };
  }, []);

  // When user changes language: stop active speech, clear warnings, and update selectedLanguage
  const handleLanguageChange = (newLang: SupportedLanguage) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (cloudAudioRef.current) {
      cloudAudioRef.current.pause();
      cloudAudioRef.current = null;
    }
    setSpeakingMsgId(null);
    setVoiceWarning(null);
    setVoiceWarningMsgId(null);
    setSelectedLanguage(newLang);
  };

  // Handle initial prompt passed from another view
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim().length > 0) {
      handleSendMessage(initialPrompt);
    }
  }, [initialPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Setup Web Speech Recognition (Microphone input - completely independent from TTS Listen)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      // Set speech lang based on selected language
      const langCodes: Record<string, string> = {
        en: "en-IN",
        hi: "hi-IN",
        te: "te-IN",
        kn: "kn-IN",
        ta: "ta-IN",
        ml: "ml-IN",
        mr: "mr-IN",
        bn: "bn-IN",
      };
      recognition.lang = langCodes[selectedLanguage] || "en-IN";

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognition.onerror = (e: any) => {
        // Isolated STT error: never affects TTS or Listen button
        console.warn("Speech recognition (Mic input) error:", e?.error || e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [selectedLanguage]);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser environment. Please type your query.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Speech start error:", err);
      }
    }
  };

  const handleSpeak = async (msgId: string, text: string) => {
    if (speakingMsgId === msgId) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (cloudAudioRef.current) {
        cloudAudioRef.current.pause();
        cloudAudioRef.current = null;
      }
      setSpeakingMsgId(null);
      return;
    }

    // Stop mic if recording is active so TTS audio is clean
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (cloudAudioRef.current) {
      cloudAudioRef.current.pause();
      cloudAudioRef.current = null;
    }
    setVoiceWarning(null);
    setVoiceWarningMsgId(null);

    // Clean markdown bold, bullets, headers, links, and tables for speech
    const cleanText = text
      .replace(/[*_#`~>]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\|/g, " ")
      .replace(/-{3,}/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanText) return;

    // Dynamically set language based on the currently selected language
    const bcp47Code = languageCodeMap[selectedLanguage] || "en-US";
    const langDisplayName = languageDisplayNames[selectedLanguage] || selectedLanguage;

    // Ensure latest voices are loaded before selecting
    let voices = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis.getVoices() : [];
    if (!voices || voices.length === 0) {
      voices = await getSpeechVoicesAsync();
    }
    if (!voices || voices.length === 0) {
      voices = availableVoices;
    }
    if (voices && voices.length > 0 && voices.length !== availableVoices.length) {
      setAvailableVoices(voices);
    }

    // Select compatible voice matching selected language
    const { selectedVoice, matchingVoices } = findMatchingVoice(voices, bcp47Code);

    // Required Debug Information exactly as specified
    console.log("Selected language:", selectedLanguage);
    console.log("Speech language:", bcp47Code);
    console.log("Available voices:", voices.length);
    console.log("Matching voices:", matchingVoices.length);
    console.log("Selected voice:", selectedVoice ? selectedVoice.name : undefined);
    console.log(
      "voices.map detailed:",
      voices.map((v) => ({
        name: v.name,
        lang: v.lang,
        localService: v.localService,
        default: v.default,
      }))
    );

    // =========================================================================
    // OPTION 1: Compatible native voice exists -> Use browser SpeechSynthesis
    // =========================================================================
    if (selectedVoice && typeof window !== "undefined" && "speechSynthesis" in window) {
      console.log("Voice Status: Native voice available");
      console.log("Active TTS Provider: Browser SpeechSynthesis");

      const utterance = new SpeechSynthesisUtterance(cleanText);
      currentUtteranceRef.current = utterance;
      utterance.lang = bcp47Code;
      utterance.voice = selectedVoice;

      utterance.onend = () => {
        setSpeakingMsgId(null);
        currentUtteranceRef.current = null;
      };

      utterance.onerror = (e) => {
        console.warn("SpeechSynthesis error:", e);
        setSpeakingMsgId(null);
        currentUtteranceRef.current = null;
      };

      setSpeakingMsgId(msgId);
      window.speechSynthesis.speak(utterance);
      return;
    }

    // =========================================================================
    // OPTION 2: Compatible native voice NOT found -> Cloud TTS Fallback Architecture
    // IMPORTANT:
    // - Do NOT use en-US.
    // - Do NOT silently use an English voice.
    // - Route through backend/server-side endpoint (/api/tts).
    // - Truthfully report if cloud TTS provider is not yet configured.
    // =========================================================================
    console.log("Voice Status: Native voice unavailable — cloud TTS required");
    console.log(`Dispatching synthesis request to backend Cloud TTS gateway (/api/tts) for ${langDisplayName} (${bcp47Code})...`);

    try {
      setIsCloudTtsLoading(true);
      setSpeakingMsgId(msgId);

      const ttsResponse = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanText,
          language: selectedLanguage,
          locale: bcp47Code,
        }),
      });

      const ttsResult = await ttsResponse.json();

      if (ttsResult.success && ttsResult.audioContent) {
        console.log(`Cloud audio stream received via ${ttsResult.provider || "cloud-tts"} (${ttsResult.cloudVoice || ""})`);
        const audio = new Audio(`data:${ttsResult.contentType || "audio/mp3"};base64,${ttsResult.audioContent}`);
        cloudAudioRef.current = audio;

        audio.onended = () => {
          setSpeakingMsgId(null);
          cloudAudioRef.current = null;
        };

        audio.onerror = (audioErr) => {
          console.warn("Cloud audio playback error:", audioErr);
          setVoiceWarning("Failed to play synthesized cloud audio.");
          setVoiceWarningMsgId(msgId);
          setSpeakingMsgId(null);
          cloudAudioRef.current = null;
        };

        await audio.play();
      } else {
        // Cloud provider not configured or returned notice; report truthfully
        console.warn("Cloud TTS gateway status:", ttsResult);
        const warningText =
          ttsResult.details ||
          ttsResult.error ||
          `Native voice unavailable — cloud TTS required. ${langDisplayName} voice is not available on this device/browser.`;
        setVoiceWarning(warningText);
        setVoiceWarningMsgId(msgId);
        setSpeakingMsgId(null);
      }
    } catch (fetchErr) {
      console.error("Cloud TTS gateway fetch failed:", fetchErr);
      setVoiceWarning(
        `Native voice unavailable — cloud TTS required. Server endpoint (/api/tts) could not be reached.`
      );
      setVoiceWarningMsgId(msgId);
      setSpeakingMsgId(null);
    } finally {
      setIsCloudTtsLoading(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: Date.now(),
      language,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Gather rich context for the server-side Gemini intelligence engine
      const context = {
        station: {
          id: station.id,
          name: station.name,
          location: station.location,
          elevation: station.elevation,
          elevationMeters: station.elevationMeters,
          latitude: station.latitude,
          longitude: station.longitude,
          model: station.model,
          firmware: station.firmwareVersion,
        },
        telemetry: telemetry
          ? {
              temp: telemetry.temp,
              humidity: telemetry.humidity,
              pressure: telemetry.pressure,
              windSpeed: telemetry.windSpeed,
              precipitation: telemetry.precipitation,
              weatherCondition: telemetry.weatherCondition,
              dataSource: telemetry.dataSource,
              apiTime: telemetry.apiTime,
              referenceTemp: telemetry.referenceTemp,
              referenceHumidity: telemetry.referenceHumidity,
              referencePressure: telemetry.referencePressure,
            }
          : null,
        reference: telemetry
          ? {
              temp: telemetry.referenceTemp,
              humidity: telemetry.referenceHumidity,
              pressure: telemetry.referencePressure,
              windSpeed: telemetry.windSpeed,
              dataSource: "OPEN_METEO_REAL_API",
              fetchTime: telemetry.apiTime,
            }
          : null,
        anomalies: anomalies.map((a) => ({
          sensor: a.sensor,
          channel: a.channel || a.sensor,
          targetSensorType: a.targetSensorType,
          anomalyType: a.anomalyType,
          severity: a.severity,
          simulatedValue: a.simulatedValue || a.observedValue,
          referenceValue: a.referenceValue || a.expectedValue,
          observedValue: a.observedValue,
          expectedValue: a.expectedValue,
          difference: a.difference,
          recentAwsChange: a.recentAwsChange,
          anomalyScore: a.anomalyScore,
          confidence: a.confidence,
          signals: a.signals,
          isSimulatedFault: a.isSimulatedFault,
          explanation: a.explanation,
          recommendedAction: a.recommendedAction,
        })),
        sensorHealth: sensorHealth.map((s) => ({
          channel: s.channelName || s.name,
          targetSensorType: s.targetSensorType,
          healthScore: s.healthScore,
          status: s.status,
          currentValue: s.currentValue,
          referenceValue: s.referenceValue,
          referenceDiff: s.referenceDiff,
          simulationStatus: s.simulationStatus,
          detectionReason: s.detectionReason,
          anomalyScore: s.currentAnomalyScore,
        })),
        stationSummary,
        forecastPreview: forecast.slice(0, 3).map((f) => ({
          day: f.dayName,
          condition: f.weatherCondition,
          tempRange: `${f.minTemp}°C - ${f.maxTemp}°C`,
          precipProb: `${f.precipProb}%`,
        })),
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          context,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error(`WeatherGPT server error (${response.status})`);
      }

      const data = await response.json();

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "assistant",
        text: data.text || "I was unable to process that telemetry inquiry. Please try again.",
        timestamp: Date.now(),
        language,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      console.error("WeatherGPT conversation error:", err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: "I encountered a network issue while consulting the meteorological intelligence model. Please verify your connection or retry.",
        timestamp: Date.now(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTED_QUESTIONS = [
    "Is AWS-001 working properly?",
    "Why is the temperature channel abnormal?",
    "Which channel should I inspect first?",
    "Is the simulated temperature reading trustworthy?",
    "Compare simulated AWS telemetry with Open-Meteo reference.",
    "Summarize current atmospheric conditions and forecast.",
  ];

  return (
    <div
      id="view-weathergpt"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 120px)",
        minHeight: "560px",
        background: "#0b1329",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          background: "#0f172a",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "12px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 2px 6px rgba(2, 132, 199, 0.4)",
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
              WeatherGPT Intelligence Assistant
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: 600,
                  background: "rgba(56, 189, 248, 0.15)",
                  color: "#38bdf8",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                }}
              >
                Gemini 3.8
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>
              Live connected to {station.name} telemetry & anomaly engine
            </div>
          </div>
        </div>

        {/* Controls: Language Selector & Reset */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Languages size={14} color="#94a3b8" />
            <select
              id="select-weathergpt-language"
              value={selectedLanguage}
              onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
              style={{
                background: "transparent",
                border: "none",
                color: "#cbd5e1",
                fontSize: "12px",
                fontWeight: 500,
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="en" style={{ background: "#0f172a" }}>English</option>
              <option value="te" style={{ background: "#0f172a" }}>Telugu (తెలుగు)</option>
              <option value="hi" style={{ background: "#0f172a" }}>Hindi (हिंदी)</option>
              <option value="kn" style={{ background: "#0f172a" }}>Kannada (ಕನ್ನಡ)</option>
              <option value="ta" style={{ background: "#0f172a" }}>Tamil (தமிழ்)</option>
              <option value="ml" style={{ background: "#0f172a" }}>Malayalam (മലയാളം)</option>
              <option value="mr" style={{ background: "#0f172a" }}>Marathi (मराठी)</option>
              <option value="bn" style={{ background: "#0f172a" }}>Bengali (বাংলা)</option>
            </select>
          </div>

          {/* Voice Status Indicator Pill */}
          {(() => {
            const currentBcp47 = languageCodeMap[selectedLanguage] || "en-US";
            const { selectedVoice: currentMatch } = findMatchingVoice(availableVoices, currentBcp47);
            const isNativeAvailable = Boolean(currentMatch);
            const statusLabel = isNativeAvailable
              ? "Native voice available"
              : "Native voice unavailable — cloud TTS required";

            return (
              <div
                id="weathergpt-voice-status-badge"
                title={`Voice Status (${languageDisplayNames[selectedLanguage]}): ${statusLabel}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  background: isNativeAvailable ? "rgba(74, 222, 128, 0.12)" : "rgba(245, 158, 11, 0.12)",
                  border: isNativeAvailable ? "1px solid rgba(74, 222, 128, 0.28)" : "1px solid rgba(245, 158, 11, 0.3)",
                  color: isNativeAvailable ? "#86efac" : "#fcd34d",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: isNativeAvailable ? "#4ade80" : "#fbbf24",
                    flexShrink: 0,
                  }}
                />
                <span>{statusLabel}</span>
              </div>
            );
          })()}

          <button
            id="btn-toggle-voice-diagnostics"
            onClick={() => setShowVoiceDiagnostics(!showVoiceDiagnostics)}
            title="Voice Diagnostics (Inspect TTS voices)"
            style={{
              background: showVoiceDiagnostics ? "rgba(56, 189, 248, 0.15)" : "rgba(255,255,255,0.05)",
              border: showVoiceDiagnostics ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: showVoiceDiagnostics ? "#38bdf8" : "#94a3b8",
              padding: "6px 10px",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            <Sliders size={13} />
            <span>Voice Diagnostics</span>
          </button>

          <button
            id="btn-reset-weathergpt-chat"
            onClick={() =>
              setMessages([
                {
                  id: `welcome-${Date.now()}`,
                  sender: "assistant",
                  text: `Chat session reset. I'm ready to answer any questions about **${station.name}** telemetry, sensor reliability, or weather analytics.`,
                  timestamp: Date.now(),
                },
              ])
            }
            title="Reset conversation"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#94a3b8",
              padding: "6px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Voice Diagnostics Panel */}
      {showVoiceDiagnostics && (() => {
        const diagBcp47 = languageCodeMap[selectedLanguage] || "en-US";
        const diagMatching = findMatchingVoice(availableVoices, diagBcp47);
        const langName = languageDisplayNames[selectedLanguage] || selectedLanguage;

        return (
          <div
            id="voice-diagnostics-panel"
            style={{
              background: "#081021",
              borderBottom: "1px solid #1e293b",
              padding: "14px 18px",
              fontSize: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sliders size={15} color="#38bdf8" />
                <span style={{ fontWeight: 600, color: "#f1f5f9", fontSize: "13px" }}>
                  TTS Voice Diagnostics
                </span>
                <span style={{ color: "#64748b", fontSize: "11px" }}>
                  (Browser SpeechSynthesis Inspection)
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  id="btn-refresh-diagnostics-voices"
                  onClick={async () => {
                    const v = await getSpeechVoicesAsync();
                    setAvailableVoices(v);
                    console.log(
                      "Refreshed voices:",
                      v.length,
                      v.map((voice) => ({
                        name: voice.name,
                        lang: voice.lang,
                        localService: voice.localService,
                        default: voice.default,
                      }))
                    );
                  }}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#94a3b8",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "11px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <RotateCcw size={11} /> Refresh Voices
                </button>
                <button
                  onClick={() => setShowVoiceDiagnostics(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    fontSize: "16px",
                    padding: "0 4px",
                    lineHeight: 1,
                  }}
                  title="Close Diagnostics"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Diagnostics Metrics Required by Specification */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: "8px",
                marginBottom: "10px",
              }}
            >
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "2px" }}>Selected language:</div>
                <div style={{ color: "#f8fafc", fontWeight: 600, fontSize: "13px" }}>
                  {langName} ({selectedLanguage})
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "2px" }}>Required speech locale:</div>
                <div style={{ color: "#38bdf8", fontWeight: 600, fontSize: "13px", fontFamily: "monospace" }}>
                  {diagBcp47}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "2px" }}>Voice Status:</div>
                <div
                  style={{
                    color: diagMatching.selectedVoice ? "#4ade80" : "#fbbf24",
                    fontWeight: 600,
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: diagMatching.selectedVoice ? "#4ade80" : "#fbbf24",
                      flexShrink: 0,
                    }}
                  />
                  <span>
                    {diagMatching.selectedVoice
                      ? "Native voice available"
                      : "Native voice unavailable — cloud TTS required"}
                  </span>
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "2px" }}>Active TTS Pipeline:</div>
                <div style={{ color: "#38bdf8", fontWeight: 600, fontSize: "12px" }}>
                  {diagMatching.selectedVoice
                    ? "1. Browser SpeechSynthesis"
                    : "2. Cloud TTS Gateway (/api/tts)"}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "2px" }}>Available matching voices:</div>
                <div style={{ color: diagMatching.matchingVoices.length > 0 ? "#4ade80" : "#f87171", fontWeight: 600, fontSize: "13px" }}>
                  {diagMatching.matchingVoices.length}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "2px" }}>Selected native voice:</div>
                <div
                  style={{
                    color: diagMatching.selectedVoice ? "#f8fafc" : "#94a3b8",
                    fontWeight: 600,
                    fontSize: "12px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={diagMatching.selectedVoice?.name || "None"}
                >
                  {diagMatching.selectedVoice ? diagMatching.selectedVoice.name : "None (Using Cloud TTS)"}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "2px" }}>Cloud TTS Fallback:</div>
                <div style={{ color: cloudTtsStatus?.connected ? "#4ade80" : "#94a3b8", fontWeight: 600, fontSize: "12px" }}>
                  {cloudTtsStatus?.connected
                    ? "Active (Google Cloud TTS)"
                    : "Ready (Awaiting GOOGLE_CLOUD_TTS_API_KEY)"}
                </div>
              </div>
            </div>

            {/* List of Available Voices */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 500 }}>
                  Available voices ({availableVoices.length} total):
                </span>
                {diagMatching.matchingVoices.length === 0 ? (
                  <span style={{ color: "#f87171", fontSize: "11px" }}>
                    ⚠ {langName} voice not found on device
                  </span>
                ) : (
                  <span style={{ color: "#4ade80", fontSize: "11px" }}>
                    ✓ Compatible voice ready ({diagMatching.matchingVoices.length} found)
                  </span>
                )}
              </div>

              <div
                style={{
                  maxHeight: "120px",
                  overflowY: "auto",
                  background: "rgba(0,0,0,0.35)",
                  borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  padding: "6px 8px",
                }}
              >
                {availableVoices.length === 0 ? (
                  <div style={{ color: "#64748b", padding: "6px", fontStyle: "italic" }}>
                    Loading voices from speech synthesis engine...
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "4px" }}>
                    {availableVoices.map((v, idx) => {
                      const isMatch = diagMatching.matchingVoices.some(
                        (mv) => mv.name === v.name && mv.lang === v.lang
                      );
                      return (
                        <div
                          key={`voice-${v.name}-${v.lang}-${idx}`}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            background: isMatch ? "rgba(74, 222, 128, 0.12)" : "rgba(255,255,255,0.02)",
                            border: isMatch ? "1px solid rgba(74, 222, 128, 0.35)" : "1px solid transparent",
                            fontSize: "11px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                          }}
                        >
                          <span
                            style={{
                              color: isMatch ? "#4ade80" : "#cbd5e1",
                              fontWeight: isMatch ? 600 : 400,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={v.name}
                          >
                            {isMatch && "★ "}
                            {v.name}
                          </span>
                          <span
                            style={{
                              color: isMatch ? "#86efac" : "#64748b",
                              fontFamily: "monospace",
                              fontSize: "10px",
                              flexShrink: 0,
                            }}
                          >
                            {v.lang}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Voice Warning Notification when requested speech voice is unavailable on client device */}
      {voiceWarning && (
        <div
          id="tts-voice-warning-banner"
          style={{
            background: "rgba(239, 68, 68, 0.12)",
            borderBottom: "1px solid rgba(239, 68, 68, 0.25)",
            padding: "8px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
            color: "#fca5a5",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <VolumeX size={15} color="#f87171" />
            <span>{voiceWarning}</span>
          </div>
          <button
            onClick={() => {
              setVoiceWarning(null);
              setVoiceWarningMsgId(null);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#fca5a5",
              cursor: "pointer",
              fontSize: "16px",
              lineHeight: 1,
              padding: "0 4px",
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Messages Stream */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          const isSpeaking = speakingMsgId === msg.id;

          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                gap: "10px",
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: isUser ? "80%" : "88%",
              }}
            >
              {!isUser && (
                <div
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "6px",
                    background: "rgba(2, 132, 199, 0.2)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#38bdf8",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  <Bot size={16} />
                </div>
              )}

              <div
                style={{
                  background: isUser ? "#0284c7" : "#1e293b",
                  border: isUser ? "1px solid #0369a1" : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  padding: "12px 15px",
                  color: "#f8fafc",
                  fontSize: "13.5px",
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                }}
              >
                {/* Render markdown bold and bullet markers cleanly */}
                <div>
                  {msg.text.split("\n").map((line, idx) => {
                    // Check for markdown bullet
                    const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("• ");
                    const content = isBullet ? line.trim().substring(2) : line;

                    return (
                      <div key={idx} style={{ marginLeft: isBullet ? "12px" : "0", marginTop: isBullet ? "2px" : "0" }}>
                        {isBullet && <span style={{ color: "#38bdf8", marginRight: "6px" }}>•</span>}
                        {content.split(/(\*\*.*?\*\*)/g).map((part, pIdx) => {
                          if (part.startsWith("**") && part.endsWith("**")) {
                            return <strong key={pIdx} style={{ color: "#ffffff", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
                          }
                          return part;
                        })}
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "8px",
                    paddingTop: "6px",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    fontSize: "11px",
                    color: isUser ? "rgba(255,255,255,0.7)" : "#64748b",
                  }}
                >
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {!isUser && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        id={`btn-tts-${msg.id}`}
                        onClick={() => handleSpeak(msg.id, msg.text)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: isSpeaking ? "#38bdf8" : "#94a3b8",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11px",
                        }}
                        title="Read aloud"
                      >
                        {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
                        {isSpeaking
                          ? "Stop"
                          : isCloudTtsLoading && speakingMsgId === msg.id
                          ? "Synthesizing..."
                          : "Listen"}
                      </button>
                      {voiceWarningMsgId === msg.id && voiceWarning && (
                        <span
                          style={{
                            color: "#f87171",
                            fontSize: "10px",
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                            maxWidth: "260px",
                          }}
                          title={voiceWarning}
                        >
                          <VolumeX size={11} />
                          {voiceWarning.includes("cloud TTS required")
                            ? "Cloud TTS required"
                            : "Voice not on device"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isUser && (
                <div
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  <User size={16} />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div style={{ display: "flex", gap: "10px", alignSelf: "flex-start" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "6px",
                background: "rgba(2, 132, 199, 0.2)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#38bdf8",
              }}
            >
              <Bot size={16} />
            </div>
            <div
              style={{
                background: "#1e293b",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px 12px 12px 2px",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#94a3b8",
                fontSize: "13px",
              }}
            >
              <Loader2 size={14} className="animate-spin" color="#38bdf8" />
              Analyzing station telemetry & physical models...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions Chips */}
      <div
        style={{
          background: "#0f172a",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          overflowX: "auto",
        }}
      >
        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>
          Quick Queries:
        </span>
        {SUGGESTED_QUESTIONS.map((q, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(q)}
            disabled={loading}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#94a3b8",
              fontSize: "11.5px",
              padding: "4px 9px",
              borderRadius: "6px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = "#38bdf8";
              e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.4)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = "#94a3b8";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Composer */}
      <div
        style={{
          background: "#0f172a",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <button
          id="btn-weathergpt-mic"
          onClick={toggleListen}
          title={isListening ? "Listening... click to stop" : "Speak your query"}
          style={{
            background: isListening ? "rgba(239, 68, 68, 0.2)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${isListening ? "rgba(239, 68, 68, 0.5)" : "rgba(255,255,255,0.1)"}`,
            color: isListening ? "#ef4444" : "#94a3b8",
            width: "38px",
            height: "38px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.2s",
          }}
        >
          {isListening ? <MicOff size={18} className="animate-pulse" /> : <Mic size={18} />}
        </button>

        <input
          id="input-weathergpt-query"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSendMessage();
          }}
          placeholder={isListening ? "Listening to your voice..." : "Ask WeatherGPT about anomalies, sensor calibrations, or weather conditions..."}
          disabled={loading}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            padding: "9px 14px",
            color: "#f8fafc",
            fontSize: "13.5px",
            outline: "none",
          }}
        />

        <button
          id="btn-weathergpt-send"
          onClick={() => handleSendMessage()}
          disabled={loading || !input.trim()}
          style={{
            background: input.trim() ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${input.trim() ? "#38bdf8" : "rgba(255,255,255,0.08)"}`,
            color: input.trim() ? "#fff" : "#64748b",
            width: "38px",
            height: "38px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: input.trim() ? "pointer" : "not-allowed",
            flexShrink: 0,
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
