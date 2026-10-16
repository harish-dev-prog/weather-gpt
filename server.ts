import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini client
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    platform: "WeatherGPT AWS Anomaly Detection Platform",
    architecture: "SIH Software Prototype (Simulated AWS Telemetry + Open-Meteo Reference)",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasTtsKey: Boolean(process.env.GOOGLE_CLOUD_TTS_API_KEY || process.env.GOOGLE_TTS_API_KEY),
    timestamp: Date.now(),
  });
});

/**
 * Supported Languages and Google Cloud Text-to-Speech Mappings.
 * Provides high-fidelity neural/standard cloud voices for all 8 Indian & English locales.
 */
const CLOUD_TTS_CATALOG: Record<
  string,
  { locale: string; name: string; cloudVoice: string; ssmlGender: string }
> = {
  en: { locale: "en-US", name: "English", cloudVoice: "en-US-Neural2-F", ssmlGender: "FEMALE" },
  te: { locale: "te-IN", name: "Telugu", cloudVoice: "te-IN-Standard-A", ssmlGender: "FEMALE" },
  hi: { locale: "hi-IN", name: "Hindi", cloudVoice: "hi-IN-Neural2-A", ssmlGender: "FEMALE" },
  kn: { locale: "kn-IN", name: "Kannada", cloudVoice: "kn-IN-Standard-A", ssmlGender: "FEMALE" },
  ta: { locale: "ta-IN", name: "Tamil", cloudVoice: "ta-IN-Standard-A", ssmlGender: "FEMALE" },
  ml: { locale: "ml-IN", name: "Malayalam", cloudVoice: "ml-IN-Standard-A", ssmlGender: "FEMALE" },
  mr: { locale: "mr-IN", name: "Marathi", cloudVoice: "mr-IN-Standard-A", ssmlGender: "FEMALE" },
  bn: { locale: "bn-IN", name: "Bengali", cloudVoice: "bn-IN-Standard-A", ssmlGender: "FEMALE" },
};

// GET /api/tts/status: Reports whether cloud TTS provider is connected and supported catalog
app.get("/api/tts/status", (_req: Request, res: Response) => {
  const ttsKey = process.env.GOOGLE_CLOUD_TTS_API_KEY || process.env.GOOGLE_TTS_API_KEY;
  res.json({
    connected: Boolean(ttsKey),
    provider: ttsKey ? "google-cloud-tts" : "none",
    supportedLanguages: CLOUD_TTS_CATALOG,
    message: ttsKey
      ? "Cloud TTS provider is active and connected."
      : "Cloud TTS provider is not yet configured. Set GOOGLE_CLOUD_TTS_API_KEY in server environment to enable cloud voice synthesis when native browser voices are missing.",
  });
});

// POST /api/tts: Cloud TTS synthesis gateway
app.post("/api/tts", async (req: Request, res: Response) => {
  try {
    const { text, language = "en", locale } = req.body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Text string is required for TTS synthesis" });
      return;
    }

    const ttsKey = process.env.GOOGLE_CLOUD_TTS_API_KEY || process.env.GOOGLE_TTS_API_KEY;
    const langInfo = CLOUD_TTS_CATALOG[language] || {
      locale: locale || "en-US",
      name: language,
      cloudVoice: "en-US-Neural2-F",
      ssmlGender: "FEMALE",
    };

    // If Cloud TTS provider key is not yet configured in environment:
    // Report truthfully and cleanly without inventing fake audio
    if (!ttsKey) {
      res.status(200).json({
        success: false,
        connected: false,
        error: "Cloud TTS provider is not yet connected.",
        voiceStatus: "Native voice unavailable — cloud TTS required",
        details: `Native voice is unavailable for ${langInfo.name} (${langInfo.locale}). Cloud TTS gateway (/api/tts) is ready; configure GOOGLE_CLOUD_TTS_API_KEY to activate cloud synthesis.`,
      });
      return;
    }

    // Invoke Google Cloud Text-to-Speech REST API securely from server-side
    const targetLocale = locale || langInfo.locale;
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(ttsKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: targetLocale,
            name: langInfo.cloudVoice,
            ssmlGender: langInfo.ssmlGender,
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.0,
            pitch: 0.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Google Cloud TTS API error:", response.status, errBody);
      res.status(502).json({
        success: false,
        connected: true,
        error: `Google Cloud TTS API returned status ${response.status}`,
        details: errBody,
      });
      return;
    }

    const data = (await response.json()) as { audioContent?: string };
    if (!data.audioContent) {
      res.status(502).json({
        success: false,
        connected: true,
        error: "No audio stream returned from cloud provider.",
      });
      return;
    }

    res.json({
      success: true,
      connected: true,
      audioContent: data.audioContent,
      contentType: "audio/mp3",
      language,
      locale: targetLocale,
      provider: "google-cloud-tts",
      cloudVoice: langInfo.cloudVoice,
    });
  } catch (err: unknown) {
    console.error("Cloud TTS synthesis error:", err);
    res.status(500).json({
      success: false,
      connected: false,
      error: "Internal server error while processing cloud TTS request",
    });
  }
});

/**
 * Fallback meteorological intelligence response generator.
 * Used if GEMINI_API_KEY is not configured in the environment, ensuring seamless operation.
 */
function generateFallbackWeatherGPTResponse(
  query: string,
  context: Record<string, unknown>,
  language = "en"
): string {
  const q = (query || "").toLowerCase();
  const station = (context.station as Record<string, unknown>) || {};
  const telemetry = (context.telemetry as Record<string, unknown>) || {};
  const reference = (context.reference as Record<string, unknown>) || {};
  const anomalies = (context.anomalies as Array<Record<string, unknown>>) || [];
  const summary = (context.stationSummary as Record<string, unknown>) || {};

  const stationName = (station.name as string) || "AWS-001 Bengaluru";
  const temp = telemetry.temp ?? "—";
  const refTemp = reference.temp ?? telemetry.referenceTemp ?? "—";
  const humidity = telemetry.humidity ?? "—";
  const refHumidity = reference.humidity ?? telemetry.referenceHumidity ?? "—";
  const pressure = telemetry.pressure ?? "—";
  const refPressure = reference.pressure ?? telemetry.referencePressure ?? "—";
  const wind = telemetry.windSpeed ?? "—";
  const condition = telemetry.weatherCondition ?? "Clear";
  const healthScore = summary.stationHealthScore ?? 95;
  const activeCount = anomalies.length;

  if (language === "hi") {
    if (q.includes("station") || q.includes("काम") || q.includes("health") || q.includes("status")) {
      return `मौसम केंद्र **${stationName}** का सिम्युलेटेड चैनल स्वास्थ्य स्कोर **${healthScore}%** है। वर्तमान में ${activeCount} सक्रिय असंगतियां दर्ज हैं। सिम्युलेटेड तापमान ${temp}°C (ओपन-मेटियो संदर्भ: ${refTemp}°C), आर्द्रता ${humidity}%, और दबाव ${pressure} hPa है। (यह SIH प्रोटोटाइप सिमुलेशन मोड है)।`;
    }
    return `नमस्ते! WeatherGPT AI सहायक: सिम्युलेटेड AWS चैनल स्थिति: ${condition}, तापमान: ${temp}°C (संदर्भ: ${refTemp}°C), आर्द्रता: ${humidity}%। Open-Meteo से संदर्भ डेटा प्राप्त हो रहा है।`;
  }

  if (language === "te") {
    return `నమస్కారం! WeatherGPT సహాయకుడు: **${stationName}** సిమ్యులేటెడ్ ఛానల్ హెల్త్ స్కోర్ **${healthScore}%**. ఉష్ణోగ్రత: ${temp}°C (రిఫరెన్స్: ${refTemp}°C), తేమ: ${humidity}%. సక్రియ లోపాలు: ${activeCount}. (SIH సాఫ్ట్‌వేర్ ప్రొటోటైప్).`;
  }

  if (language === "kn") {
    return `ನಮಸ್ಕಾರ! WeatherGPT ಸಹಾಯಕ: **${stationName}** ಕೇಂದ್ರದ ಸಿಮ್ಯುಲೇಟೆಡ್ ಚಾನಲ್ ಆರೋಗ್ಯ ಅಂಕ **${healthScore}%**. ಪ್ರಸ್ತುತ ತಾಪಮಾನ: ${temp}°C (ಓಪನ್-ಮೆಟಿಯೋ ಉಲ್ಲೇಖ: ${refTemp}°C). ಸಕ್ರಿಯ ವೈಪರೀತ್ಯಗಳು: ${activeCount}. (SIH ಪ್ರೋಟೋಟೈಪ್).`;
  }

  if (language === "ta") {
    return `வணக்கம்! WeatherGPT அறிவார்ந்த உதவியாளர்: **${stationName}** நிலையத்தின் மாதிரி ஆரோக்கிய நிலை **${healthScore}%**. தற்போதைய வெப்பநிலை: ${temp}°C (குறிப்பு: ${refTemp}°C). செயலில் உள்ள முரண்பாடுகள்: ${activeCount}.`;
  }

  if (language === "ml") {
    return `നമസ്കാരം! WeatherGPT സഹായകൻ: **${stationName}** കേന്ദ്രത്തിന്റെ ആരോഗ്യ നില **${healthScore}%**. നിലവിലെ താപനില: ${temp}°C (റഫറൻസ്: ${refTemp}°C). സജീവമായ പിഴവുകൾ: ${activeCount}. (SIH സോഫ്റ്റ്‌വെയർ പ്രോട്ടോടൈപ്പ്).`;
  }

  if (language === "mr") {
    return `नमस्कार! WeatherGPT सहाय्यक: **${stationName}** केंद्राचा चॅनेल आरोग्य स्कोर **${healthScore}%** आहे. सध्याचे तापमान: ${temp}°C (संदर्भ: ${refTemp}°C). सक्रिय विसंगती: ${activeCount}. (SIH सॉफ्टवेअर प्रोटोटाइप).`;
  }

  if (language === "bn") {
    return `নমস্কার! WeatherGPT সহকারী: **${stationName}** কেন্দ্রের চ্যানেল স্বাস্থ্য স্কোর **${healthScore}%**। বর্তমান তাপমাত্রা: ${temp}°C (রেফারেন্স: ${refTemp}°C)। সক্রিয় অসঙ্গতি: ${activeCount}। (SIH সফটওয়্যার প্রোটোটাইপ)।`;
  }

  // English answers
  if (q.includes("working properly") || q.includes("health") || q.includes("status") || q.includes("station working")) {
    if (activeCount === 0) {
      return `**${stationName} Simulated AWS Channels are operating nominally.**\n\n- Overall Channel Health: **${healthScore}%**\n- Simulated Telemetry: Temperature ${temp}°C, Humidity ${humidity}%, Pressure ${pressure} hPa, Wind ${wind} km/h.\n- Open-Meteo Reference: Temperature ${refTemp}°C, Humidity ${refHumidity}%, Pressure ${refPressure} hPa.\n- Status: All channels align within expected microclimatic thresholds of the external reference.`;
    } else {
      const topAnom = anomalies[0];
      const channel = (topAnom.channel as string) || (topAnom.sensor as string);
      return `**${stationName} has ${activeCount} active anomaly alert(s).** Overall Channel Health is **${healthScore}%**.\n\n- **Primary Channel**: ${channel} (${topAnom.anomalyType})\n- **Simulated AWS vs Reference**: ${topAnom.simulatedValue || topAnom.observedValue} vs ${topAnom.referenceValue || topAnom.expectedValue} (${topAnom.difference})\n- **Diagnosis**: ${topAnom.explanation}\n- **Recommended Action**: ${topAnom.recommendedAction}\n\n*Note: This is an SIH software prototype with simulated AWS channels evaluated against real Open-Meteo reference data.*`;
    }
  }

  // Diagnostic evidence response for specific anomalies or general anomaly questions
  const isAnomalyQuery =
    q.includes("explain") ||
    q.includes("abnormal") ||
    q.includes("anomaly") ||
    q.includes("spike") ||
    q.includes("drop") ||
    q.includes("drift") ||
    q.includes("stuck") ||
    q.includes("disconnect") ||
    q.includes("diagnostic assessment");

  if (isAnomalyQuery) {
    // Determine target channel
    let matchedAnom = anomalies[0];
    if (q.includes("temp")) {
      matchedAnom = anomalies.find((a) => ((a.channel as string) || (a.sensor as string) || "").toLowerCase().includes("temp")) || matchedAnom;
    } else if (q.includes("humid")) {
      matchedAnom = anomalies.find((a) => ((a.channel as string) || (a.sensor as string) || "").toLowerCase().includes("humid")) || matchedAnom;
    } else if (q.includes("press") || q.includes("barom")) {
      matchedAnom = anomalies.find((a) => ((a.channel as string) || (a.sensor as string) || "").toLowerCase().includes("press")) || matchedAnom;
    } else if (q.includes("wind") || q.includes("anemo")) {
      matchedAnom = anomalies.find((a) => ((a.channel as string) || (a.sensor as string) || "").toLowerCase().includes("wind")) || matchedAnom;
    } else if (q.includes("rain") || q.includes("precip")) {
      matchedAnom = anomalies.find((a) => ((a.channel as string) || (a.sensor as string) || "").toLowerCase().includes("precip")) || matchedAnom;
    }

    if (matchedAnom) {
      const channel = (matchedAnom.channel as string) || (matchedAnom.sensor as string) || "Meteorological Channel";
      const targetSensor = (matchedAnom.targetSensorType as string) || "Standard AWS Sensor Transducer";
      const simVal = matchedAnom.simulatedValue || matchedAnom.observedValue || "—";
      const refVal = matchedAnom.referenceValue || matchedAnom.expectedValue || "—";
      const diff = matchedAnom.difference || "—";
      const change = matchedAnom.recentAwsChange || "Step deviation in observation cycle";
      const isSim = matchedAnom.isSimulatedFault ?? true;
      const signals = (matchedAnom.signals as string[]) || [
        `- Synoptic divergence between Simulated AWS (${simVal}) and Open-Meteo baseline (${refVal})`,
        "- Statistical rate of change threshold breached",
      ];

      return `**${channel} Anomaly Diagnostic Report:**\n\n- **Target Hardware Transducer**: ${targetSensor.replace("Target sensor: ", "")} (Simulated Channel)\n- **SIMULATED AWS Telemetry**: **${simVal}**\n- **OPEN-METEO REFERENCE**: **${refVal}**\n- **Difference (Delta)**: **${diff}**\n- **Recent AWS Change**: ${change}\n- **Result**: **${matchedAnom.severity} ANOMALY (${matchedAnom.anomalyType})**\n- **Anomaly Score**: ${matchedAnom.anomalyScore} / 100 (Confidence: ${matchedAnom.confidence || 90}%)\n\n**Algorithmic Signals Detected:**\n${signals.map((s) => `- ${s.replace(/^✓\s*/, "")}`).join("\n")}\n\n**Possible Root Cause**: Rapid divergence between simulated telemetry output and the external Open-Meteo synoptic baseline, exceeding natural microclimatic envelopes.\n\n${isSim ? "⚠️ **Note: This is a simulated fault scenario.** In a real AWS field deployment, this pattern indicates physical transducer degradation, loose terminal wiring, solar radiation shield failure, or calibration drift." : ""}\n\n**Recommended Field Action**: ${matchedAnom.recommendedAction}`;
    }

    return `All simulated AWS channels for **${stationName}** are currently operating within nominal atmospheric envelopes. No statistical spikes, flatlines, or synoptic deviations are active.`;
  }

  if (q.includes("which sensor") || q.includes("which channel") || q.includes("inspect")) {
    if (activeCount === 0) {
      return `Currently, **none of the simulated AWS channels are anomalous**. All 5 meteorological channels (Temperature [Pt100 RTD], Humidity [Capacitive Thin-Film], Pressure [Piezoresistive Diaphragm], Wind Speed [Ultrasonic 2D], Rain Gauge [Tipping Bucket]) are reporting valid values tracking the Open-Meteo reference model.`;
    }
    const anomList = anomalies
      .map((a, i) => `${i + 1}. **${a.channel || a.sensor}** [${a.severity}] — *${a.anomalyType}*: Simulated AWS ${a.simulatedValue || a.observedValue} vs Open-Meteo Ref ${a.referenceValue || a.expectedValue} (Diff: ${a.difference})`)
      .join("\n");
    return `**Channels with active anomalies:**\n\n${anomList}\n\n**Priority Action:** Inspect **${anomalies[0].channel || anomalies[0].sensor}** (${anomalies[0].recommendedAction}).`;
  }

  if (q.includes("trustworthy") || q.includes("trust")) {
    const tempAnom = anomalies.find((a) => ((a.channel as string) || (a.sensor as string) || "").toLowerCase().includes("temp"));
    if (tempAnom) {
      return `**Caution: The simulated temperature channel (${temp}°C) currently has low reliability (Reliability Score: ${100 - (Number(tempAnom.anomalyScore) || 50)}%).** Anomaly type **${tempAnom.anomalyType}** was flagged because simulated AWS (${temp}°C) diverged from Open-Meteo reference (${refTemp}°C) by ${tempAnom.difference}. This is a simulated fault scenario.`;
    }
    return `**Yes, the simulated temperature channel (${temp}°C) is trustworthy.** It aligns with the Open-Meteo external synoptic baseline (${refTemp}°C) within natural microclimatic tolerance (±1.5°C) and shows zero unphysical gradient jumps.`;
  }

  if (q.includes("summarize") || q.includes("weather")) {
    return `**Weather Intelligence Summary for ${stationName}:**\n\n- **Simulated AWS Telemetry**: Temp ${temp}°C, Humidity ${humidity}%, Pressure ${pressure} hPa, Wind ${wind} km/h.\n- **Open-Meteo Reference Baseline**: Temp ${refTemp}°C, Humidity ${refHumidity}%, Pressure ${refPressure} hPa.\n- **Channel Health Score**: **${healthScore}%** (${activeCount} active anomaly alert(s)).\n\nArchitecture: Simulated AWS telemetry evaluated against real Open-Meteo reference data for SIH evaluation.`;
  }

  return `WeatherGPT Meteorological Intelligence for **${stationName}**:\n\n- **Simulated AWS Telemetry**: Temp ${temp}°C, Humidity ${humidity}%, Pressure ${pressure} hPa, Wind ${wind} km/h.\n- **Open-Meteo Reference**: Temp ${refTemp}°C, Humidity ${refHumidity}%, Pressure ${refPressure} hPa.\n- **Channel Health Score**: ${healthScore}% (${activeCount} active anomaly).\n\nAsk me specific questions like: *"Why is the temperature channel abnormal?"*, *"Which channel should I inspect?"*, or *"Explain the evidence for this anomaly."*`;
}

// WeatherGPT Conversational Endpoint
app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const { message, context, language = "en" } = req.body;

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const ai = getGeminiClient();

    // If Gemini API key is not present, use the deterministic fallback engine
    if (!ai) {
      const fallbackResponse = generateFallbackWeatherGPTResponse(message, context || {}, language);
      res.json({
        text: fallbackResponse,
        model: "WeatherGPT-RuleEngine-Offline",
        language,
      });
      return;
    }

    // Build meteorological system prompt with context
    const languageNames: Record<string, string> = {
      en: "English",
      hi: "Hindi (हिंदी)",
      te: "Telugu (తెలుగు)",
      kn: "Kannada (ಕನ್ನಡ)",
      ta: "Tamil (தமிழ்)",
      ml: "Malayalam (മലയാളം)",
      mr: "Marathi (मराठी)",
      bn: "Bengali (বাংলা)",
    };

    const targetLang = languageNames[language] || "English";

    const systemPrompt = `You are WeatherGPT, an elite AI meteorological intelligence assistant and Automatic Weather Station (AWS) sensor reliability expert for the Smart India Hackathon (SIH) platform.

CRITICAL ARCHITECTURE CONSTRAINTS:
1. THIS IS AN SIH SOFTWARE PROTOTYPE:
   - AWS Telemetry channels (Temperature, Humidity, Pressure, Wind, Precipitation) are SIMULATED AWS TELEMETRY for demonstration.
   - Open-Meteo API provides REAL EXTERNAL REFERENCE WEATHER DATA.
   - Do NOT claim or hallucinate that physical hardware (ESP32, MQTT, or physical wired sensors) is connected.
   - Use channel terminology: "Temperature Channel (Target: Pt100 RTD)", "Humidity Channel (Target: Capacitive Thin-Film)", etc.
2. ANOMALY EVIDENCE:
   - When explaining an anomaly, always present the actual evidence:
     * SIMULATED AWS reading
     * OPEN-METEO REFERENCE reading
     * Difference (Delta)
     * Rate of Change / Recent AWS Change
     * Algorithmic signals (Z-score, physical bounds, stuck flatline, cross-sensor thermodynamic check)
   - If an injected demo fault scenario is active (e.g. Temp Spike, Temp Drop, Stuck Sensor, Humidity Drift, Pressure Drop, Wind Spike), explicitly state: "This is a simulated fault scenario."
3. Respond in the requested language: ${targetLang}. Use clean Markdown formatting.

Station & Telemetry Context:
${JSON.stringify(context, null, 2)}`;

    let replyText = "";
    let usedModel = "gemini-3.1-flash-lite";

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: message,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.25,
        },
      });
      replyText = response.text || "";
    } catch (primaryErr) {
      console.warn("Primary model error, attempting gemini-3.8-flash:", primaryErr);
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: message,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.25,
          },
        });
        replyText = response.text || "";
        usedModel = "gemini-3.8-flash";
      } catch (secondaryErr) {
        console.warn("Secondary model error, utilizing built-in rule engine:", secondaryErr);
        replyText = generateFallbackWeatherGPTResponse(message, context || {}, language);
        usedModel = "WeatherGPT-RuleEngine";
      }
    }

    if (!replyText) {
      replyText = generateFallbackWeatherGPTResponse(message, context || {}, language);
      usedModel = "WeatherGPT-RuleEngine";
    }

    res.json({
      text: replyText,
      model: usedModel,
      language,
    });
  } catch (err: unknown) {
    console.error("WeatherGPT error:", err);
    const fallback = generateFallbackWeatherGPTResponse(req.body?.message || "", req.body?.context || {}, req.body?.language || "en");
    res.json({
      text: fallback,
      model: "WeatherGPT-Fallback",
      note: "Generated using built-in meteorological intelligence engine.",
    });
  }
});

async function startServer() {
  // Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`WeatherGPT server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
