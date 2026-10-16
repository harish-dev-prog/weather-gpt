import React, { useState } from "react";
import { Anomaly, StationInfo } from "../types";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  Clock,
  Sparkles,
  Check,
} from "lucide-react";

interface AlertCenterViewProps {
  anomalies: Anomaly[];
  station: StationInfo;
  onOpenWeatherGPT: (prompt?: string) => void;
}

export function AlertCenterView({ anomalies, station, onOpenWeatherGPT }: AlertCenterViewProps) {
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "WARNING" | "RESOLVED">("ALL");

  const handleAck = (id: string) => {
    setAcknowledgedIds((prev) => new Set(prev).add(id));
  };

  const handleResolve = (id: string) => {
    setResolvedIds((prev) => new Set(prev).add(id));
  };

  const allAlerts = anomalies.map((a) => ({
    ...a,
    acknowledged: acknowledgedIds.has(a.id),
    resolved: resolvedIds.has(a.id),
  }));

  const filteredAlerts = allAlerts.filter((a) => {
    if (filter === "RESOLVED") return a.resolved;
    if (a.resolved) return false;
    if (filter === "CRITICAL") return a.severity === "CRITICAL";
    if (filter === "WARNING") return a.severity === "WARNING" || a.severity === "HIGH";
    return true;
  });

  return (
    <div id="view-alerts" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
            Station Alert Center
          </h1>
          <p style={{ fontSize: "13.5px", color: "#94a3b8", marginTop: "4px" }}>
            Real-time incident dispatch, telemetry anomaly notifications, and engineering actions for {station.name}.
          </p>
        </div>
        <button
          id="btn-alert-center-ai"
          onClick={() => onOpenWeatherGPT("Review all open station alerts and suggest maintenance dispatch priority.")}
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
          }}
        >
          <Sparkles size={14} />
          Prioritize with WeatherGPT
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        {(["ALL", "CRITICAL", "WARNING", "RESOLVED"] as const).map((tab) => {
          const active = filter === tab;
          const count =
            tab === "ALL"
              ? allAlerts.filter((a) => !a.resolved).length
              : tab === "CRITICAL"
              ? allAlerts.filter((a) => a.severity === "CRITICAL" && !a.resolved).length
              : tab === "WARNING"
              ? allAlerts.filter((a) => (a.severity === "WARNING" || a.severity === "HIGH") && !a.resolved).length
              : allAlerts.filter((a) => a.resolved).length;

          return (
            <button
              key={tab}
              id={`tab-alert-${tab.toLowerCase()}`}
              onClick={() => setFilter(tab)}
              style={{
                background: active ? "#1e293b" : "rgba(255,255,255,0.03)",
                border: `1px solid ${active ? "#38bdf8" : "rgba(255,255,255,0.08)"}`,
                color: active ? "#38bdf8" : "#94a3b8",
                fontSize: "12.5px",
                fontWeight: 600,
                padding: "6px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {tab === "ALL" && <Bell size={13} />}
              {tab === "CRITICAL" && <AlertOctagon size={13} color="#ef4444" />}
              {tab === "WARNING" && <AlertTriangle size={13} color="#f59e0b" />}
              {tab === "RESOLVED" && <CheckCircle2 size={13} color="#10b981" />}
              {tab.charAt(0) + tab.slice(1).toLowerCase()} ({count})
            </button>
          );
        })}
      </div>

      {/* Alert Feed */}
      {filteredAlerts.length === 0 ? (
        <div
          style={{
            background: "#0f172a",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            padding: "40px 20px",
            textAlign: "center",
          }}
        >
          <ShieldCheck size={42} color="#10b981" style={{ margin: "0 auto 12px auto" }} />
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
            {filter === "RESOLVED" ? "No Resolved Incidents Yet" : "No Open Alerts in this Category"}
          </h3>
          <p style={{ fontSize: "13px", color: "#94a3b8", marginTop: "6px" }}>
            All sensor readings and hardware channels on {station.name} are operating nominally.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              id={`alert-row-${alert.id}`}
              style={{
                background: "#0f172a",
                border: `1px solid ${alert.resolved ? "rgba(16, 185, 129, 0.3)" : alert.severity === "CRITICAL" ? "rgba(239, 68, 68, 0.4)" : "rgba(245, 158, 11, 0.3)"}`,
                borderRadius: "10px",
                padding: "16px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", gap: "12px", flex: 1, minWidth: "260px" }}>
                <div style={{ marginTop: "2px" }}>
                  {alert.resolved ? (
                    <CheckCircle2 size={20} color="#10b981" />
                  ) : alert.severity === "CRITICAL" ? (
                    <AlertOctagon size={20} color="#ef4444" />
                  ) : (
                    <AlertTriangle size={20} color="#f59e0b" />
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        padding: "2px 7px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: alert.severity === "CRITICAL" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                        color: alert.severity === "CRITICAL" ? "#fca5a5" : "#fcd34d",
                      }}
                    >
                      {alert.severity}
                    </span>
                    <span style={{ fontSize: "14.5px", fontWeight: 600, color: "#f8fafc" }}>
                      {alert.sensor} — {alert.anomalyType.replace(/_/g, " ")}
                    </span>
                    {alert.acknowledged && !alert.resolved && (
                      <span style={{ fontSize: "11px", color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                        Acknowledged
                      </span>
                    )}
                    {alert.resolved && (
                      <span style={{ fontSize: "11px", color: "#34d399", background: "rgba(16, 185, 129, 0.15)", padding: "2px 6px", borderRadius: "4px" }}>
                        Resolved
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: "13px", color: "#cbd5e1", margin: "6px 0 0 0", lineHeight: 1.4 }}>
                    {alert.explanation}
                  </p>

                  <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "8px", fontSize: "11.5px", color: "#64748b" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Clock size={12} />
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                    <span>Observed: <strong>{alert.observedValue}</strong></span>
                    <span>Expected: <strong>{alert.expectedValue}</strong></span>
                    <span>Anomaly Score: <strong>{alert.anomalyScore}/100</strong></span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {!alert.resolved && !alert.acknowledged && (
                  <button
                    id={`btn-ack-alert-${alert.id}`}
                    onClick={() => handleAck(alert.id)}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#cbd5e1",
                      fontSize: "12px",
                      fontWeight: 500,
                      padding: "6px 12px",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    Acknowledge
                  </button>
                )}

                {!alert.resolved && (
                  <button
                    id={`btn-resolve-alert-${alert.id}`}
                    onClick={() => handleResolve(alert.id)}
                    style={{
                      background: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      color: "#34d399",
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "6px 12px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Check size={13} />
                    Mark Resolved
                  </button>
                )}

                <button
                  onClick={() => onOpenWeatherGPT(`Diagnose the alert for ${alert.sensor} (${alert.anomalyType}) observed at ${alert.observedValue} and recommend corrective technician steps.`)}
                  style={{
                    background: "rgba(2, 132, 199, 0.15)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    color: "#38bdf8",
                    fontSize: "12px",
                    fontWeight: 500,
                    padding: "6px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Sparkles size={12} />
                  AI Fix
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
