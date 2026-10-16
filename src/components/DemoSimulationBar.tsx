import React from "react";
import { DemoSimulationScenario } from "../types";
import {
  Beaker,
  RotateCcw,
  Flame,
  Snowflake,
  PauseCircle,
  Unplug,
  Waves,
  Gauge,
  Wind,
  Info,
  AlertTriangle,
} from "lucide-react";

interface DemoSimulationBarProps {
  currentScenario: DemoSimulationScenario;
  onSelectScenario: (scenario: DemoSimulationScenario) => void;
}

export function DemoSimulationBar({ currentScenario, onSelectScenario }: DemoSimulationBarProps) {
  const isDemoActive = currentScenario !== "NONE";

  const getActiveChannelDescription = () => {
    switch (currentScenario) {
      case "TEMP_SPIKE":
        return "Temperature Channel: +8.8°C sudden spike injected on Simulated AWS telemetry (Target: Pt100 RTD)";
      case "TEMP_DROP":
        return "Temperature Channel: -7.6°C rapid drop injected on Simulated AWS telemetry (Target: Pt100 RTD)";
      case "SENSOR_STUCK":
        return "Temperature Channel: Zero variance / stuck flatline simulated (Target: Pt100 RTD)";
      case "SENSOR_DISCONNECT":
        return "Temperature Channel: Open-circuit / disconnect simulated (Target: Pt100 RTD)";
      case "HUMIDITY_DRIFT":
        return "Humidity Channel: +28% calibration drift injected on Simulated AWS telemetry (Target: Capacitive Thin-Film)";
      case "PRESSURE_DROP":
        return "Pressure Channel: -18.5 hPa barometric drop injected on Simulated AWS telemetry (Target: Piezoresistive Diaphragm)";
      case "WIND_SPIKE":
        return "Wind Speed Channel: +58.0 km/h gust spike injected on Simulated AWS telemetry (Target: Ultrasonic 2D)";
      default:
        return "Simulated AWS telemetry operating nominally alongside real Open-Meteo reference.";
    }
  };

  return (
    <div
      id="demo-simulation-bar"
      style={{
        background: isDemoActive ? "rgba(234, 88, 12, 0.14)" : "rgba(15, 23, 42, 0.8)",
        border: `1px solid ${isDemoActive ? "rgba(249, 115, 22, 0.5)" : "rgba(56, 189, 248, 0.25)"}`,
        borderRadius: "10px",
        padding: "12px 16px",
        marginBottom: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        boxShadow: isDemoActive ? "0 4px 20px rgba(234, 88, 12, 0.1)" : "none",
      }}
    >
      {/* Top Banner Notice */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "5px",
                background: isDemoActive ? "#ea580c" : "#0284c7",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.6px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Beaker size={13} />
              SIH DEMO MODE
            </span>

            {isDemoActive ? (
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "5px",
                  background: "rgba(239, 68, 68, 0.25)",
                  border: "1px solid rgba(239, 68, 68, 0.6)",
                  color: "#fca5a5",
                  fontSize: "11px",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <AlertTriangle size={12} />
                DEMO FAULT ACTIVE
              </span>
            ) : (
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "5px",
                  background: "rgba(16, 185, 129, 0.2)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  color: "#6ee7b7",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                ● Nominal Simulation Stream
              </span>
            )}

            <span style={{ fontSize: "12px", color: isDemoActive ? "#fdba74" : "#94a3b8", fontWeight: 500 }}>
              {isDemoActive ? getActiveChannelDescription() : "AWS telemetry is simulated for demonstration. Open-Meteo provides external reference weather data."}
            </span>
          </div>

          <div style={{ fontSize: "11.5px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
            <Info size={12} />
            <span>
              Architecture: <strong>Simulated AWS Telemetry</strong> is cross-compared against <strong>Open-Meteo Reference</strong> by the deterministic statistical anomaly engine.
            </span>
          </div>
        </div>

        {isDemoActive && (
          <button
            id="btn-reset-demo-simulation"
            onClick={() => onSelectScenario("NONE")}
            style={{
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.5)",
              color: "#fca5a5",
              fontSize: "12px",
              fontWeight: 600,
              padding: "5px 12px",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <RotateCcw size={13} />
            Restore Nominal Stream
          </button>
        )}
      </div>

      {/* Testbed Scenario Buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
        <button
          id="btn-demo-none"
          onClick={() => onSelectScenario("NONE")}
          style={{
            padding: "5px 11px",
            fontSize: "11.5px",
            fontWeight: 600,
            borderRadius: "6px",
            border: `1px solid ${currentScenario === "NONE" ? "#38bdf8" : "rgba(255,255,255,0.1)"}`,
            background: currentScenario === "NONE" ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.03)",
            color: currentScenario === "NONE" ? "#38bdf8" : "#94a3b8",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ● Nominal (No Fault)
        </button>

        <button
          id="btn-demo-temp-spike"
          onClick={() => onSelectScenario("TEMP_SPIKE")}
          style={{
            padding: "5px 11px",
            fontSize: "11.5px",
            fontWeight: 500,
            borderRadius: "6px",
            border: `1px solid ${currentScenario === "TEMP_SPIKE" ? "#ef4444" : "rgba(255,255,255,0.1)"}`,
            background: currentScenario === "TEMP_SPIKE" ? "rgba(239, 68, 68, 0.3)" : "rgba(255,255,255,0.03)",
            color: currentScenario === "TEMP_SPIKE" ? "#fca5a5" : "#cbd5e1",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            whiteSpace: "nowrap",
          }}
        >
          <Flame size={13} color="#f87171" />
          Temp Spike (+8.8°C)
        </button>

        <button
          id="btn-demo-temp-drop"
          onClick={() => onSelectScenario("TEMP_DROP")}
          style={{
            padding: "5px 11px",
            fontSize: "11.5px",
            fontWeight: 500,
            borderRadius: "6px",
            border: `1px solid ${currentScenario === "TEMP_DROP" ? "#38bdf8" : "rgba(255,255,255,0.1)"}`,
            background: currentScenario === "TEMP_DROP" ? "rgba(56, 189, 248, 0.3)" : "rgba(255,255,255,0.03)",
            color: currentScenario === "TEMP_DROP" ? "#7dd3fc" : "#cbd5e1",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            whiteSpace: "nowrap",
          }}
        >
          <Snowflake size={13} color="#38bdf8" />
          Temp Drop (-7.6°C)
        </button>

        <button
          id="btn-demo-sensor-stuck"
          onClick={() => onSelectScenario("SENSOR_STUCK")}
          style={{
            padding: "5px 11px",
            fontSize: "11.5px",
            fontWeight: 500,
            borderRadius: "6px",
            border: `1px solid ${currentScenario === "SENSOR_STUCK" ? "#f59e0b" : "rgba(255,255,255,0.1)"}`,
            background: currentScenario === "SENSOR_STUCK" ? "rgba(245, 158, 11, 0.3)" : "rgba(255,255,255,0.03)",
            color: currentScenario === "SENSOR_STUCK" ? "#fcd34d" : "#cbd5e1",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            whiteSpace: "nowrap",
          }}
        >
          <PauseCircle size={13} color="#fbbf24" />
          Stuck Sensor (Flatline)
        </button>

        <button
          id="btn-demo-sensor-disconnect"
          onClick={() => onSelectScenario("SENSOR_DISCONNECT")}
          style={{
            padding: "5px 11px",
            fontSize: "11.5px",
            fontWeight: 500,
            borderRadius: "6px",
            border: `1px solid ${currentScenario === "SENSOR_DISCONNECT" ? "#dc2626" : "rgba(255,255,255,0.1)"}`,
            background: currentScenario === "SENSOR_DISCONNECT" ? "rgba(220, 38, 38, 0.35)" : "rgba(255,255,255,0.03)",
            color: currentScenario === "SENSOR_DISCONNECT" ? "#f87171" : "#cbd5e1",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            whiteSpace: "nowrap",
          }}
        >
          <Unplug size={13} color="#f87171" />
          Sensor Disconnect
        </button>

        <button
          id="btn-demo-humidity-drift"
          onClick={() => onSelectScenario("HUMIDITY_DRIFT")}
          style={{
            padding: "5px 11px",
            fontSize: "11.5px",
            fontWeight: 500,
            borderRadius: "6px",
            border: `1px solid ${currentScenario === "HUMIDITY_DRIFT" ? "#06b6d4" : "rgba(255,255,255,0.1)"}`,
            background: currentScenario === "HUMIDITY_DRIFT" ? "rgba(6, 182, 212, 0.3)" : "rgba(255,255,255,0.03)",
            color: currentScenario === "HUMIDITY_DRIFT" ? "#67e8f9" : "#cbd5e1",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            whiteSpace: "nowrap",
          }}
        >
          <Waves size={13} color="#22d3ee" />
          Humidity Drift (+28%)
        </button>

        <button
          id="btn-demo-pressure-drop"
          onClick={() => onSelectScenario("PRESSURE_DROP")}
          style={{
            padding: "5px 11px",
            fontSize: "11.5px",
            fontWeight: 500,
            borderRadius: "6px",
            border: `1px solid ${currentScenario === "PRESSURE_DROP" ? "#8b5cf6" : "rgba(255,255,255,0.1)"}`,
            background: currentScenario === "PRESSURE_DROP" ? "rgba(139, 92, 246, 0.3)" : "rgba(255,255,255,0.03)",
            color: currentScenario === "PRESSURE_DROP" ? "#c4b5fd" : "#cbd5e1",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            whiteSpace: "nowrap",
          }}
        >
          <Gauge size={13} color="#a78bfa" />
          Pressure Drop (-18.5 hPa)
        </button>

        <button
          id="btn-demo-wind-spike"
          onClick={() => onSelectScenario("WIND_SPIKE")}
          style={{
            padding: "5px 11px",
            fontSize: "11.5px",
            fontWeight: 500,
            borderRadius: "6px",
            border: `1px solid ${currentScenario === "WIND_SPIKE" ? "#10b981" : "rgba(255,255,255,0.1)"}`,
            background: currentScenario === "WIND_SPIKE" ? "rgba(16, 185, 129, 0.3)" : "rgba(255,255,255,0.03)",
            color: currentScenario === "WIND_SPIKE" ? "#6ee7b7" : "#cbd5e1",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            whiteSpace: "nowrap",
          }}
        >
          <Wind size={13} color="#34d399" />
          Wind Spike (+58 km/h)
        </button>
      </div>
    </div>
  );
}
