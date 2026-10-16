import React from "react";
import { SensorHealthInfo, StationInfo } from "../types";
import {
  Thermometer,
  Droplets,
  Gauge,
  Wind,
  CloudRain,
  Radio,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  XCircle,
  Clock,
  Sparkles,
  Info,
  Beaker,
} from "lucide-react";

interface SensorHealthViewProps {
  sensors: SensorHealthInfo[];
  station: StationInfo;
  onOpenWeatherGPT: (prompt?: string) => void;
}

export function SensorHealthView({ sensors, station, onOpenWeatherGPT }: SensorHealthViewProps) {
  const getIcon = (id: string) => {
    switch (id) {
      case "temp":
        return Thermometer;
      case "humidity":
        return Droplets;
      case "pressure":
        return Gauge;
      case "wind":
        return Wind;
      case "precip":
        return CloudRain;
      default:
        return Radio;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "HEALTHY":
        return { bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.35)", text: "#34d399", icon: CheckCircle2 };
      case "WARNING":
        return { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.35)", text: "#fbbf24", icon: AlertTriangle };
      case "CRITICAL":
        return { bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.35)", text: "#f87171", icon: AlertOctagon };
      default:
        return { bg: "rgba(148, 163, 184, 0.15)", border: "rgba(148, 163, 184, 0.35)", text: "#cbd5e1", icon: XCircle };
    }
  };

  return (
    <div id="view-sensor-health" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
            Simulated AWS Channel Health
          </h1>
          <p style={{ fontSize: "13.5px", color: "#94a3b8", marginTop: "4px" }}>
            Real-time diagnostic health matrix for all simulated meteorological channels on {station.name}. Telemetry is evaluated against the Open-Meteo external synoptic baseline.
          </p>
        </div>
        <button
          id="btn-ask-weathergpt-health"
          onClick={() => onOpenWeatherGPT("Which simulated AWS channel has the lowest health score and what anomaly evidence was detected?")}
          style={{
            background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
            border: "1px solid #38bdf8",
            color: "#fff",
            borderRadius: "8px",
            padding: "8px 14px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
          }}
        >
          <Sparkles size={14} />
          Ask AI Diagnostics
        </button>
      </div>

      {/* Prototype Status Card */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.7)",
          border: "1px solid rgba(56, 189, 248, 0.2)",
          borderRadius: "8px",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "12.5px",
          color: "#cbd5e1",
        }}
      >
        <Info size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
        <span>
          <strong>Modular Architecture:</strong> In this SIH software prototype, channels are simulated and labeled with target hardware transducers (e.g. Pt100 RTD). In hardware deployment, this table dynamically binds to real ESP32 MQTT telemetry frames without rewriting detection rules.
        </span>
      </div>

      {/* Sensor Health Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "16px" }}>
        {sensors.map((s) => {
          const Icon = getIcon(s.sensorId);
          const badge = getStatusBadge(s.status);
          const StatusIcon = badge.icon;
          const isHealthy = s.status === "HEALTHY";
          const isFaultInjected = s.simulationStatus === "Fault Injected";

          return (
            <div
              key={s.sensorId}
              id={`sensor-health-card-${s.sensorId}`}
              style={{
                background: "#0f172a",
                border: `1px solid ${isFaultInjected ? "rgba(249, 115, 22, 0.5)" : isHealthy ? "rgba(255,255,255,0.08)" : badge.border}`,
                borderRadius: "10px",
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                boxShadow: isFaultInjected ? "0 4px 16px rgba(249, 115, 22, 0.1)" : "none",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "8px",
                      background: isFaultInjected ? "rgba(249, 115, 22, 0.15)" : "rgba(56, 189, 248, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isFaultInjected ? "#f97316" : "#38bdf8",
                    }}
                  >
                    <Icon size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                      {s.channelName || s.name}
                    </h3>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                      {s.targetSensorType || "Target sensor: Standard Instrument"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "3px 8px",
                      borderRadius: "5px",
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                      color: badge.text,
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    <StatusIcon size={12} />
                    {s.status}
                  </div>

                  <span
                    style={{
                      fontSize: "10.5px",
                      color: isFaultInjected ? "#fb923c" : "#38bdf8",
                      background: isFaultInjected ? "rgba(249, 115, 22, 0.15)" : "rgba(56, 189, 248, 0.1)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: 500,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    {isFaultInjected && <Beaker size={10} />}
                    {s.simulationStatus || "Simulation Active"}
                  </span>
                </div>
              </div>

              {/* Health Score Bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                  <span style={{ color: "#94a3b8" }}>Health Score</span>
                  <span style={{ color: s.healthScore >= 80 ? "#34d399" : s.healthScore >= 50 ? "#fbbf24" : "#f87171", fontWeight: 700 }}>
                    {s.healthScore}%
                  </span>
                </div>
                <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${s.healthScore}%`,
                      height: "100%",
                      background: s.healthScore >= 80 ? "#10b981" : s.healthScore >= 50 ? "#f59e0b" : "#ef4444",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>

              {/* Explicit Dual Telemetry Grid (Simulated vs Reference) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  background: "rgba(0,0,0,0.3)",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div>
                  <div style={{ fontSize: "10.5px", color: "#fca5a5", fontWeight: 600 }}>SIMULATED AWS</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#f8fafc", marginTop: "2px" }}>
                    {s.currentValue} {s.unit !== "RSSI" && s.unit !== "V" && s.unit}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "10.5px", color: "#7dd3fc", fontWeight: 600 }}>OPEN-METEO REF</div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: "#cbd5e1", marginTop: "2px" }}>
                    {s.referenceValue} {s.unit !== "RSSI" && s.unit !== "V" && s.unit}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "10.5px", color: "#94a3b8" }}>Reference Difference</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#fbbf24", marginTop: "2px" }}>
                    {s.referenceDiff || s.driftEstimate}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "10.5px", color: "#94a3b8" }}>Anomaly Score</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: s.currentAnomalyScore >= 30 ? "#f87171" : "#34d399", marginTop: "2px" }}>
                    {s.currentAnomalyScore} / 100
                  </div>
                </div>
              </div>

              {/* Detection Reason */}
              <div style={{ background: "rgba(255,255,255,0.02)", padding: "10px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>Detection Reason / Diagnosis:</div>
                <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "3px", lineHeight: 1.4 }}>
                  {s.detectionReason || "Operating within nominal atmospheric boundaries."}
                </div>
              </div>

              {/* Quick AI Diagnostic Link */}
              <button
                id={`btn-health-diagnose-${s.sensorId}`}
                onClick={() => onOpenWeatherGPT(`Provide a diagnostic assessment for the ${s.channelName || s.name} (${s.targetSensorType}). Simulated AWS is ${s.currentValue} ${s.unit} vs Open-Meteo Reference ${s.referenceValue} ${s.unit} (diff: ${s.referenceDiff}). Health score is ${s.healthScore}%. Explain reason and recommend next steps.`)}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  color: "#38bdf8",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  padding: "7px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <Sparkles size={13} />
                Ask WeatherGPT about {s.channelName ? s.channelName.split(" ")[0] : s.name.split(" ")[0]}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
