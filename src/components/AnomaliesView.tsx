import React, { useState } from "react";
import { Anomaly, StationHealthSummary, StationInfo } from "../types";
import {
  AlertTriangle,
  ShieldCheck,
  AlertCircle,
  Activity,
  CheckCircle2,
  Sparkles,
  Info,
  Clock,
  ArrowRight,
  Filter,
  Beaker,
  Database,
} from "lucide-react";

interface AnomaliesViewProps {
  anomalies: Anomaly[];
  summary: StationHealthSummary;
  station: StationInfo;
  onAcknowledgeAnomaly: (id: string) => void;
  onOpenWeatherGPT: (initialPrompt?: string) => void;
}

export function AnomaliesView({
  anomalies,
  summary,
  station,
  onAcknowledgeAnomaly,
  onOpenWeatherGPT,
}: AnomaliesViewProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");

  const filteredAnomalies = anomalies.filter((a) => {
    if (filterSeverity === "ALL") return true;
    return a.severity === filterSeverity;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return { bg: "rgba(239, 68, 68, 0.2)", border: "rgba(239, 68, 68, 0.5)", text: "#fca5a5" };
      case "HIGH":
        return { bg: "rgba(249, 115, 22, 0.2)", border: "rgba(249, 115, 22, 0.5)", text: "#fdba74" };
      case "WARNING":
        return { bg: "rgba(245, 158, 11, 0.2)", border: "rgba(245, 158, 11, 0.5)", text: "#fcd34d" };
      default:
        return { bg: "rgba(56, 189, 248, 0.2)", border: "rgba(56, 189, 248, 0.5)", text: "#7dd3fc" };
    }
  };

  return (
    <div id="view-anomalies" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
            Simulated AWS Anomaly Detection & Evidence Engine
          </h1>
          <p style={{ fontSize: "13.5px", color: "#94a3b8", marginTop: "4px" }}>
            Multi-signal comparative validation: Evaluates <strong>Simulated AWS Telemetry</strong> against <strong>Open-Meteo External Reference Data</strong>, physical terrestrial envelopes, and rolling statistics for {station.name}.
          </p>
        </div>
        <button
          id="btn-ask-weathergpt-anomalies"
          onClick={() => onOpenWeatherGPT("Explain the current anomalies detected across the simulated AWS channels and compare them with Open-Meteo reference.")}
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
          Diagnose with WeatherGPT AI
        </button>
      </div>

      {/* Architecture Disclaimer Card */}
      <div
        style={{
          background: "rgba(30, 41, 59, 0.6)",
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
          <strong>SIH Software Prototype Mode:</strong> Real Open-Meteo synoptic data serves as the <strong>External Reference Baseline</strong>. Telemetry channels are simulated to replicate AWS station behaviors, with testbed fault injection for demonstration.
        </span>
      </div>

      {/* High-level KPI Summary Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px" }}>
        <div
          style={{
            background: "#0f172a",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>Channel Health Score</span>
            <ShieldCheck size={18} color={summary.stationHealthScore >= 80 ? "#10b981" : summary.stationHealthScore >= 50 ? "#f59e0b" : "#ef4444"} />
          </div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "#f8fafc", marginTop: "6px" }}>
            {summary.stationHealthScore}%
          </div>
          <div style={{ fontSize: "12px", color: summary.stationHealthScore >= 80 ? "#34d399" : "#f87171", marginTop: "4px" }}>
            {summary.stationHealthScore >= 80 ? "Nominal baseline" : "Degraded simulated channel"}
          </div>
        </div>

        <div
          style={{
            background: "#0f172a",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>Composite Anomaly Score</span>
            <Activity size={18} color={summary.overallAnomalyScore >= 70 ? "#ef4444" : summary.overallAnomalyScore >= 30 ? "#f59e0b" : "#38bdf8"} />
          </div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "#f8fafc", marginTop: "6px" }}>
            {summary.overallAnomalyScore} / 100
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
            Max channel statistical penalty
          </div>
        </div>

        <div
          style={{
            background: "#0f172a",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>Active Anomalies</span>
            <AlertTriangle size={18} color={anomalies.length > 0 ? "#f97316" : "#10b981"} />
          </div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "#f8fafc", marginTop: "6px" }}>
            {anomalies.length}
          </div>
          <div style={{ fontSize: "12px", color: anomalies.length > 0 ? "#fb923c" : "#34d399", marginTop: "4px" }}>
            {anomalies.length > 0 ? `${summary.criticalAlertsCount} critical, ${summary.warningAlertsCount} warnings` : "All channels nominal"}
          </div>
        </div>

        <div
          style={{
            background: "#0f172a",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>Reference Baseline</span>
            <Database size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#38bdf8", marginTop: "8px" }}>
            Open-Meteo API
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
            Real external synoptic comparison
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          {["ALL", "CRITICAL", "HIGH", "WARNING"].map((sev) => (
            <button
              key={sev}
              id={`btn-filter-${sev.toLowerCase()}`}
              onClick={() => setFilterSeverity(sev)}
              style={{
                padding: "6px 12px",
                fontSize: "12.5px",
                fontWeight: 600,
                borderRadius: "6px",
                border: `1px solid ${filterSeverity === sev ? "#38bdf8" : "rgba(255,255,255,0.1)"}`,
                background: filterSeverity === sev ? "rgba(56, 189, 248, 0.15)" : "transparent",
                color: filterSeverity === sev ? "#38bdf8" : "#94a3b8",
                cursor: "pointer",
              }}
            >
              {sev} {sev === "ALL" ? `(${anomalies.length})` : `(${anomalies.filter((a) => a.severity === sev).length})`}
            </button>
          ))}
        </div>
        <div style={{ fontSize: "12.5px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
          <Filter size={13} />
          {filteredAnomalies.length} anomaly incidents showing
        </div>
      </div>

      {/* Anomaly Evidence Cards */}
      {filteredAnomalies.length === 0 ? (
        <div
          style={{
            background: "#0f172a",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            padding: "40px 20px",
            textAlign: "center",
          }}
        >
          <CheckCircle2 size={42} color="#10b981" style={{ margin: "0 auto 12px auto" }} />
          <h3 style={{ fontSize: "17px", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
            All Simulated AWS Channels Normal
          </h3>
          <p style={{ fontSize: "13.5px", color: "#94a3b8", maxWidth: "520px", margin: "8px auto 0 auto" }}>
            No unphysical spikes, stuck flatlines, or model deviations detected on {station.name}. You can inject a fault using the <strong>SIH DEMO MODE</strong> bar at the top to test live anomaly detection.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filteredAnomalies.map((anom) => {
            const badge = getSeverityBadge(anom.severity);
            const channelName = anom.channel || anom.sensor;
            const targetSensor = anom.targetSensorType || "Target sensor: Standard AWS Instrument";

            return (
              <div
                key={anom.id}
                id={`card-anomaly-${anom.id}`}
                style={{
                  background: "#0f172a",
                  border: `1px solid ${anom.severity === "CRITICAL" ? "rgba(239, 68, 68, 0.4)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "10px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  boxShadow: anom.severity === "CRITICAL" ? "0 4px 20px rgba(239, 68, 68, 0.1)" : "none",
                }}
              >
                {/* Header Row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <div
                      style={{
                        padding: "3px 8px",
                        borderRadius: "5px",
                        background: badge.bg,
                        border: `1px solid ${badge.border}`,
                        color: badge.text,
                        fontSize: "11.5px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {anom.severity} ANOMALY
                    </div>

                    <div
                      style={{
                        padding: "3px 8px",
                        borderRadius: "5px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#93c5fd",
                        fontSize: "11.5px",
                        fontWeight: 600,
                      }}
                    >
                      {anom.anomalyType.replace(/_/g, " ")}
                    </div>

                    <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                      {channelName}
                    </h3>

                    <span style={{ fontSize: "11.5px", color: "#94a3b8", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: "4px" }}>
                      {targetSensor}
                    </span>

                    {anom.isSimulatedFault && (
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "#fb923c", background: "rgba(249, 115, 22, 0.2)", border: "1px solid rgba(249, 115, 22, 0.4)", padding: "2px 8px", borderRadius: "4px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Beaker size={11} />
                        DEMO FAULT ACTIVE
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Clock size={13} />
                      {new Date(anom.timestamp).toLocaleTimeString()}
                    </div>
                    <button
                      id={`btn-ack-${anom.id}`}
                      onClick={() => onAcknowledgeAnomaly(anom.id)}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "#cbd5e1",
                        fontSize: "12px",
                        fontWeight: 500,
                        borderRadius: "6px",
                        padding: "5px 12px",
                        cursor: "pointer",
                      }}
                    >
                      Acknowledge
                    </button>
                    <button
                      id={`btn-chat-anom-${anom.id}`}
                      onClick={() => onOpenWeatherGPT(`Explain the ${channelName} anomaly (${anom.anomalyType}). SIMULATED AWS is ${anom.simulatedValue || anom.observedValue} while OPEN-METEO REFERENCE is ${anom.referenceValue || anom.expectedValue} (diff: ${anom.difference}). Why was it flagged and is it a simulated fault?`)}
                      style={{
                        background: "rgba(2, 132, 199, 0.25)",
                        border: "1px solid rgba(56, 189, 248, 0.5)",
                        color: "#38bdf8",
                        fontSize: "12px",
                        fontWeight: 600,
                        borderRadius: "6px",
                        padding: "5px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <Sparkles size={12} />
                      Ask WeatherGPT
                    </button>
                  </div>
                </div>

                {/* Explicit Evidence Side-by-Side Strip */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                    background: "rgba(0,0,0,0.35)",
                    padding: "14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  {/* Simulated AWS */}
                  <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)", paddingRight: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#fca5a5" }}>SIMULATED AWS</span>
                      <span style={{ fontSize: "9.5px", background: "rgba(239,68,68,0.2)", color: "#fca5a5", padding: "1px 5px", borderRadius: "3px", fontWeight: 600 }}>AWS SENSOR</span>
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "#f87171", marginTop: "4px" }}>
                      {anom.simulatedValue || anom.observedValue}
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                      Current channel telemetry
                    </div>
                  </div>

                  {/* Open-Meteo Reference */}
                  <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)", paddingRight: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#7dd3fc" }}>OPEN-METEO REFERENCE</span>
                      <span style={{ fontSize: "9.5px", background: "rgba(56,189,248,0.2)", color: "#7dd3fc", padding: "1px 5px", borderRadius: "3px", fontWeight: 600 }}>REAL API</span>
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "#38bdf8", marginTop: "4px" }}>
                      {anom.referenceValue || anom.expectedValue}
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                      External synoptic model
                    </div>
                  </div>

                  {/* Difference */}
                  <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)", paddingRight: "10px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#fbbf24" }}>Difference</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "#fbbf24", marginTop: "4px" }}>
                      {anom.difference}
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                      AWS vs External Model
                    </div>
                  </div>

                  {/* Recent Rate of Change */}
                  {anom.recentAwsChange && (
                    <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)", paddingRight: "10px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#e2e8f0" }}>Recent AWS Change</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#e2e8f0", marginTop: "6px" }}>
                        {anom.recentAwsChange}
                      </div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                        Rate of change in cycle
                      </div>
                    </div>
                  )}

                  {/* Score & Confidence */}
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#f8fafc" }}>Anomaly Score</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "#f8fafc", marginTop: "4px" }}>
                      {anom.anomalyScore} / 100
                    </div>
                    <div style={{ fontSize: "11px", color: "#34d399", marginTop: "2px" }}>
                      Confidence: {anom.confidence}%
                    </div>
                  </div>
                </div>

                {/* Algorithmic Evidence (Why Detected?) */}
                <div style={{ background: "rgba(255,255,255,0.02)", padding: "14px 16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#38bdf8", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Info size={14} />
                    Algorithmic Evidence (Why detected?):
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {anom.signals.map((sig, i) => (
                      <div key={i} style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: 1.45 }}>
                        {sig}
                      </div>
                    ))}
                  </div>
                  {anom.isSimulatedFault && (
                    <div style={{ marginTop: "8px", padding: "6px 10px", borderRadius: "5px", background: "rgba(249, 115, 22, 0.15)", border: "1px solid rgba(249, 115, 22, 0.3)", fontSize: "12px", color: "#fdba74" }}>
                      <strong>Demo Notice:</strong> This is a simulated fault scenario triggered via the testbed for SIH evaluation.
                    </div>
                  )}
                </div>

                {/* Recommended Engineering Action */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "#94a3b8" }}>
                  <ArrowRight size={16} color="#f97316" style={{ marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: "#e2e8f0" }}>Recommended Engineering Action: </strong>
                    {anom.recommendedAction}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
