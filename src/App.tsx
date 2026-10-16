import React, { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import {
  Thermometer, Gauge, Droplets, Radio, Clock, LayoutDashboard,
  Activity, Database, TrendingUp, Settings as SettingsIcon,
  MapPin, Wifi, WifiOff, Download, CircleCheck,
  CircleAlert, ArrowUp, ArrowDown, Menu, X, RefreshCw,
  Wind, CloudRain, SunMedium, AlertTriangle, Sparkles,
  ShieldCheck, AlertOctagon, Bell, Cpu, Info, Check,
} from "lucide-react";
import {
  Reading,
  CurrentWeatherTelemetry,
  StationInfo,
  Units,
  DailyForecastDay,
  Anomaly,
  SensorHealthInfo,
  StationHealthSummary,
  DemoSimulationScenario,
} from "./types";
import { fetchWeatherData } from "./services/weatherApi";
import { runAnomalyDetection, getStandardSurfacePressure } from "./services/anomalyDetection";
import { STATIONS_NETWORK, DEFAULT_STATION, StationNetworkNode } from "./services/stationConfig";
import { getAWSObservation } from "./services/awsTelemetryProvider";

import { DemoSimulationBar } from "./components/DemoSimulationBar";
import { AnomaliesView } from "./components/AnomaliesView";
import { SensorHealthView } from "./components/SensorHealthView";
import { WeatherGPTView } from "./components/WeatherGPTView";
import { AlertCenterView } from "./components/AlertCenterView";
import { StationMapView } from "./components/StationMapView";
import { ForecastSection } from "./components/ForecastSection";

/**
 * Constructs Simulated AWS Telemetry from Open-Meteo external reference baseline
 * while incorporating demo fault injection if active.
 */
function generateSimulatedTelemetry(
  refTelemetry: CurrentWeatherTelemetry,
  scenario: DemoSimulationScenario = "NONE"
): CurrentWeatherTelemetry {
  const obs = getAWSObservation(refTelemetry, scenario);
  return {
    temp: obs.temperature,
    pressure: obs.pressure,
    humidity: obs.humidity,
    windSpeed: obs.windSpeed,
    precipitation: obs.precipitation,
    weatherCode: obs.weatherCode,
    weatherCondition: obs.weatherCondition,
    apiTime: refTelemetry.apiTime,
    apiTimestamp: obs.timestamp,
    fetchedAt: Date.now(),
    dataSource: obs.source,
    referenceTemp: refTelemetry.temp,
    referenceHumidity: refTelemetry.humidity,
    referencePressure: refTelemetry.pressure,
    referenceWindSpeed: refTelemetry.windSpeed,
    referencePrecipitation: refTelemetry.precipitation,
  };
}

/* ---------------------------------------------------------------- */
/*  Unit Conversion & Date Formatting Helpers                       */
/* ---------------------------------------------------------------- */

function fmtDate(t: number, opts?: Intl.DateTimeFormatOptions): string {
  if (!t || isNaN(t)) return "—";
  return new Date(t).toLocaleString(undefined, opts || {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function cToF(c: number): number {
  return Math.round(((c * 9) / 5 + 32) * 10) / 10;
}

function hpaToInHg(h: number): number {
  return Math.round(h * 0.0295301 * 100) / 100;
}

/* ---------------------------------------------------------------- */
/*  Constants & Theme Styles                                        */
/* ---------------------------------------------------------------- */

const COLORS = {
  bg: "#0B1420",
  panelBg: "#111D2E",
  cardBg: "#16223A",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  text: "#E9EEF5",
  muted: "#8195AD",
  temp: "#E8944A",
  pressure: "#7C93E8",
  humidity: "#4FC1D9",
  wind: "#9AE6B4",
  precip: "#63B3ED",
  good: "#5FBF8B",
  bad: "#E2615A",
  grid: "rgba(255,255,255,0.06)",
};

const styles: Record<string, CSSProperties> = {
  app: {
    display: "flex",
    minHeight: "100vh",
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: COLORS.panelBg,
    borderRight: `1px solid ${COLORS.border}`,
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  brandRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 10px 18px" },
  brandIcon: { color: COLORS.temp },
  brandText: { fontSize: 15, fontWeight: 700, letterSpacing: "0.2px" },
  brandSub: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  navItem: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "9px 12px", borderRadius: 8, cursor: "pointer",
    fontSize: "13px", color: COLORS.muted, border: "none",
    background: "transparent", width: "100%", textAlign: "left",
    fontFamily: "inherit",
  },
  navItemActive: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "9px 12px", borderRadius: 8, cursor: "pointer",
    fontSize: "13px", color: COLORS.text, border: "none",
    background: COLORS.cardBg, width: "100%", textAlign: "left",
    fontFamily: "inherit", boxShadow: `inset 2px 0 0 ${COLORS.temp}`,
  },
  main: { flex: 1, padding: "20px 28px 60px", maxWidth: 1080, minWidth: 0 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12, flexWrap: "wrap" },
  sectionTitle: { fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: "-0.2px" },
  sectionSubtitle: { fontSize: 13, color: COLORS.muted, margin: "4px 0 0" },
  readoutGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 },
  readoutCard: {
    display: "flex", alignItems: "flex-start", gap: 12,
    background: COLORS.cardBg, border: `1px solid ${COLORS.border}`,
    borderRadius: 12, padding: "16px 18px",
  },
  readoutIconWrap: { width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  readoutLabel: { fontSize: "12.5px", color: COLORS.muted, marginBottom: 4 },
  readoutValueRow: { display: "flex", alignItems: "baseline", gap: 5 },
  readoutValue: { fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 600, letterSpacing: "-0.3px" },
  readoutUnit: { fontSize: 13, color: COLORS.muted },
  readoutSub: { fontSize: "11.5px", color: COLORS.muted, marginTop: 3 },
  dashboardBottomGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 4 },
  card: {
    background: COLORS.cardBg, border: `1px solid ${COLORS.border}`,
    borderRadius: 12, padding: "18px 20px", marginBottom: 14,
  },
  cardHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: "13.5px", fontWeight: 600, color: COLORS.text },
  statusPill: { display: "flex", alignItems: "center", gap: 6, fontSize: "12px", padding: "5px 10px", borderRadius: 20, border: `1px solid ${COLORS.border}` },
  statusPillGood: { color: COLORS.good, background: "rgba(95,191,139,0.1)", borderColor: "rgba(95,191,139,0.25)" },
  statusPillBad: { color: COLORS.bad, background: "rgba(226,97,90,0.1)", borderColor: "rgba(226,97,90,0.25)" },
  kvRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 },
  kvLabel: { color: COLORS.muted, display: "flex", alignItems: "center" },
  kvValue: { color: COLORS.text, fontWeight: 500 },
  kvValueGood: { color: COLORS.good, fontWeight: 500 },
  lastUpdatedBig: { display: "flex", alignItems: "center", gap: 12 },
  minMaxRow: { display: "flex", gap: 24 },
  minMaxItem: { display: "flex", alignItems: "center", gap: 10 },
  badgeGood: { display: "inline-flex", alignItems: "center", gap: 5, color: COLORS.good, fontSize: "12.5px", fontWeight: 500 },
  badgeBad: { display: "inline-flex", alignItems: "center", gap: 5, color: COLORS.bad, fontSize: "12.5px", fontWeight: 500 },
  tooltip: { background: "#0C1420", border: `1px solid ${COLORS.borderStrong}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 },
  tooltipTime: { color: COLORS.muted, marginBottom: 4 },
  tooltipRow: { fontWeight: 500 },
  ghostButton: {
    background: "transparent", border: `1px solid ${COLORS.borderStrong}`, color: COLORS.text,
    borderRadius: 8, padding: "7px 12px", fontSize: "12.5px", cursor: "pointer", fontFamily: "inherit",
    display: "inline-flex", alignItems: "center", gap: 6,
  },
  primaryButton: {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: COLORS.temp, border: "none", color: "#1A1000",
    borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  filterRow: { display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" },
  filterField: { display: "flex", flexDirection: "column", gap: 6 },
  filterLabel: { fontSize: 12, color: COLORS.muted },
  filterMeta: { fontSize: 12, color: COLORS.muted, marginTop: 12 },
  input: {
    background: COLORS.panelBg, border: `1px solid ${COLORS.borderStrong}`, color: COLORS.text,
    borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", outline: "none",
  },
  tableWrap: { maxHeight: 340, overflowY: "auto", border: `1px solid ${COLORS.border}`, borderRadius: 8 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12.5px" },
  th: { textAlign: "left", padding: "9px 12px", color: COLORS.muted, fontWeight: 500, position: "sticky", top: 0, background: COLORS.cardBg, borderBottom: `1px solid ${COLORS.border}` },
  td: { padding: "8px 12px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 },
  helperText: { fontSize: "12.5px", color: COLORS.muted, marginBottom: 12, marginTop: 0 },
  chipRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  chip: {
    background: "transparent", border: `1px solid ${COLORS.borderStrong}`, color: COLORS.muted,
    borderRadius: 20, padding: "7px 14px", fontSize: "12.5px", cursor: "pointer", fontFamily: "inherit",
  },
  chipActive: {
    background: COLORS.temp, border: `1px solid ${COLORS.temp}`, color: "#1A1000",
    borderRadius: 20, padding: "7px 14px", fontSize: "12.5px", cursor: "pointer", fontWeight: 600, fontFamily: "inherit",
  },
  settingsRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}`, gap: 16, flexWrap: "wrap" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 },
  formField: { display: "flex", flexDirection: "column", gap: 6 },
  errorBanner: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "rgba(226,97,90,0.12)", border: "1px solid rgba(226,97,90,0.3)",
    borderRadius: 10, padding: "12px 16px", marginBottom: 18, color: "#FFA19B",
    fontSize: "13px", gap: 12, flexWrap: "wrap",
  },
};

/* ---------------------------------------------------------------- */
/*  Presentational Components                                       */
/* ---------------------------------------------------------------- */

interface ReadoutProps {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties; className?: string }>;
  label: string;
  value: number | string;
  unit: string;
  accent: string;
  sub?: string;
  isLoading?: boolean;
  sourceTag?: "SIMULATED AWS" | "DEMO FAULT" | "REAL API";
  refDisplay?: string;
  diffDisplay?: string;
  targetSensor?: string;
  isAnomaly?: boolean;
}

function Readout({
  icon: Icon,
  label,
  value,
  unit,
  accent,
  sub,
  isLoading,
  sourceTag,
  refDisplay,
  diffDisplay,
  targetSensor,
  isAnomaly,
}: ReadoutProps) {
  const isUnavailable = value === "Weather data unavailable";

  return (
    <div
      id={`readout-${label.toLowerCase().replace(/\s+/g, "-")}`}
      style={{
        ...styles.readoutCard,
        border: isAnomaly ? "1px solid rgba(239, 68, 68, 0.45)" : styles.readoutCard.border,
        boxShadow: isAnomaly ? "0 4px 14px rgba(239, 68, 68, 0.12)" : "none",
      }}
    >
      <div style={{ ...styles.readoutIconWrap, background: accent + "22", color: accent }}>
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={styles.readoutLabel}>{label}</span>
          {sourceTag && (
            <span
              style={{
                fontSize: "9.5px",
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: "4px",
                background: sourceTag === "DEMO FAULT" ? "rgba(239, 68, 68, 0.25)" : "rgba(56, 189, 248, 0.15)",
                border: `1px solid ${sourceTag === "DEMO FAULT" ? "rgba(239, 68, 68, 0.5)" : "rgba(56, 189, 248, 0.3)"}`,
                color: sourceTag === "DEMO FAULT" ? "#fca5a5" : "#7dd3fc",
                letterSpacing: "0.4px",
              }}
            >
              {sourceTag}
            </span>
          )}
        </div>
        <div style={styles.readoutValueRow}>
          {isLoading ? (
            <span style={{ ...styles.readoutValue, fontSize: 18, color: COLORS.muted }}>
              Loading...
            </span>
          ) : isUnavailable ? (
            <span style={{ ...styles.readoutValue, fontSize: 13.5, color: COLORS.bad, fontWeight: 500 }}>
              Weather data unavailable
            </span>
          ) : (
            <>
              <span style={{ ...styles.readoutValue, color: isAnomaly ? "#f87171" : styles.readoutValue.color }}>
                {value}
              </span>
              {value !== "—" && <span style={styles.readoutUnit}>{unit}</span>}
            </>
          )}
        </div>
        {refDisplay && (
          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Ref: {refDisplay}</span>
            {diffDisplay && (
              <span style={{ fontWeight: 700, color: isAnomaly ? "#f87171" : "#fbbf24" }}>
                {diffDisplay}
              </span>
            )}
          </div>
        )}
        {targetSensor && <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: 2 }}>{targetSensor}</div>}
        {sub && <div style={styles.readoutSub}>{sub}</div>}
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

function SectionHeader({ title, subtitle, right }: SectionHeaderProps) {
  return (
    <div style={styles.sectionHeader}>
      <div>
        <h1 style={styles.sectionTitle}>{title}</h1>
        {subtitle && <p style={styles.sectionSubtitle}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

interface CardProps {
  title?: string;
  children: React.ReactNode;
  style?: CSSProperties;
  right?: React.ReactNode;
}

function Card({ title, children, style, right }: CardProps) {
  return (
    <div style={{ ...styles.card, ...style }}>
      {title && (
        <div style={styles.cardHeaderRow}>
          <div style={styles.cardTitle}>{title}</div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  color?: string;
  name?: string;
  value?: number | string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
  unit?: string;
}

function ChartTooltip({ active, payload, label, unit }: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={styles.tooltip}>
      {label && <div style={styles.tooltipTime}>{fmtDate(label)}</div>}
      {payload.map((p) => (
        <div key={p.dataKey ?? p.name} style={{ ...styles.tooltipRow, color: p.color }}>
          {p.name}: {p.value}{unit}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  Views                                                           */
/* ---------------------------------------------------------------- */

interface DashboardViewProps {
  current: CurrentWeatherTelemetry | null;
  reference: CurrentWeatherTelemetry | null;
  demoScenario: DemoSimulationScenario;
  units: Units;
  station: StationInfo;
  lastUpdated: number;
  online: boolean;
  loading: boolean;
  error: string | null;
  summary: StationHealthSummary;
  anomalies: Anomaly[];
  forecast: DailyForecastDay[];
  onRefresh: () => void;
  onNavigate: (section: string) => void;
  onOpenWeatherGPT: (prompt?: string) => void;
}

function DashboardView({
  current,
  reference,
  demoScenario,
  units,
  station,
  lastUpdated,
  online,
  loading,
  error,
  summary,
  anomalies,
  forecast,
  onRefresh,
  onNavigate,
  onOpenWeatherGPT,
}: DashboardViewProps) {
  const isFailed = Boolean(error && !current);
  const tempVal = current
    ? (units.temp === "F" ? cToF(current.temp) : current.temp)
    : (isFailed ? "Weather data unavailable" : "Loading...");
  const pressVal = current
    ? (units.pressure === "inHg" ? hpaToInHg(current.pressure) : current.pressure)
    : (isFailed ? "Weather data unavailable" : "Loading...");
  const humidityVal = current
    ? current.humidity
    : (isFailed ? "Weather data unavailable" : "Loading...");

  const expectedSurfacePressure = getStandardSurfacePressure(station.elevationMeters || 920);

  return (
    <div id="view-dashboard">
      <SectionHeader
        title="Dashboard"
        subtitle={`${station.name} — ${station.id} (${station.location})`}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              id="btn-refresh-weather"
              style={styles.ghostButton}
              onClick={onRefresh}
              disabled={loading}
              title="Fetch latest Open-Meteo data"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              {loading ? "Fetching..." : "Refresh"}
            </button>
            <div style={{ ...styles.statusPill, ...(online ? styles.statusPillGood : styles.statusPillBad) }}>
              {online ? <CircleCheck size={14} /> : <CircleAlert size={14} />}
              {online ? "Station online (Real API Reference)" : "Weather data unavailable"}
            </div>
          </div>
        }
      />

      {/* Error state if API is unavailable */}
      {error && (
        <div id="weather-api-error-banner" style={styles.errorBanner}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={17} color={COLORS.bad} />
            <span>
              <strong>Weather data unavailable:</strong> {error}
            </span>
          </div>
          <button style={styles.ghostButton} onClick={onRefresh}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Platform Intelligence KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div
          onClick={() => onNavigate("sensor_health")}
          style={{
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "10px",
            padding: "14px 16px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          title="Click to view sensor health matrix"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: COLORS.muted }}>Station Health</span>
            <ShieldCheck size={16} color={summary.stationHealthScore >= 80 ? "#10b981" : "#f59e0b"} />
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#f8fafc", marginTop: "4px" }}>
            {summary.stationHealthScore}%
          </div>
          <div style={{ fontSize: "11.5px", color: summary.stationHealthScore >= 80 ? "#34d399" : "#f87171", marginTop: "2px" }}>
            {summary.healthySensorsCount}/{summary.totalSensorsCount} transducers nominal
          </div>
        </div>

        <div
          onClick={() => onNavigate("anomalies")}
          style={{
            background: "rgba(15, 23, 42, 0.8)",
            border: `1px solid ${summary.overallAnomalyScore >= 60 ? "rgba(239, 68, 68, 0.4)" : "rgba(255, 255, 255, 0.08)"}`,
            borderRadius: "10px",
            padding: "14px 16px",
            cursor: "pointer",
          }}
          title="Click to view active anomalies"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: COLORS.muted }}>Anomaly Score</span>
            <Activity size={16} color={summary.overallAnomalyScore >= 60 ? "#ef4444" : "#38bdf8"} />
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: summary.overallAnomalyScore >= 60 ? "#f87171" : "#f8fafc", marginTop: "4px" }}>
            {summary.overallAnomalyScore} / 100
          </div>
          <div style={{ fontSize: "11.5px", color: COLORS.muted, marginTop: "2px" }}>
            Statistical fault rating
          </div>
        </div>

        <div
          onClick={() => onNavigate("anomalies")}
          style={{
            background: "rgba(15, 23, 42, 0.8)",
            border: `1px solid ${anomalies.length > 0 ? "rgba(249, 115, 22, 0.4)" : "rgba(255, 255, 255, 0.08)"}`,
            borderRadius: "10px",
            padding: "14px 16px",
            cursor: "pointer",
          }}
          title="Click to inspect active anomalies"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: COLORS.muted }}>Active Anomalies</span>
            <AlertTriangle size={16} color={anomalies.length > 0 ? "#f97316" : "#10b981"} />
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: anomalies.length > 0 ? "#fb923c" : "#f8fafc", marginTop: "4px" }}>
            {anomalies.length}
          </div>
          <div style={{ fontSize: "11.5px", color: COLORS.muted, marginTop: "2px" }}>
            {summary.criticalAlertsCount} Critical • {summary.warningAlertsCount} Warnings
          </div>
        </div>

        <div
          onClick={() => onOpenWeatherGPT("Evaluate the overall health and sensor reliability of AWS-001.")}
          style={{
            background: "rgba(2, 132, 199, 0.12)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "10px",
            padding: "14px 16px",
            cursor: "pointer",
          }}
          title="Open WeatherGPT"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#38bdf8", fontWeight: 600 }}>WeatherGPT AI</span>
            <Sparkles size={16} color="#38bdf8" />
          </div>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "#f8fafc", marginTop: "8px" }}>
            Ask Diagnostics
          </div>
          <div style={{ fontSize: "11.5px", color: "#94a3b8", marginTop: "4px" }}>
            Natural language analysis & voice
          </div>
        </div>
      </div>

      {/* Primary Readouts */}
      <div style={styles.readoutGrid}>
        <Readout
          icon={Thermometer}
          label="Temperature Channel"
          value={demoScenario === "SENSOR_DISCONNECT" ? "DISCONNECTED" : tempVal}
          unit={demoScenario === "SENSOR_DISCONNECT" ? "" : `°${units.temp}`}
          accent={COLORS.temp}
          isLoading={loading && !current}
          sourceTag={current?.dataSource === "DEMO_FAULT" ? "DEMO FAULT" : "SIMULATED AWS"}
          refDisplay={reference ? `${units.temp === "F" ? cToF(reference.temp) : reference.temp}°${units.temp} (Open-Meteo)` : undefined}
          diffDisplay={demoScenario === "SENSOR_DISCONNECT" ? "No Signal (Open Circuit)" : current && reference && current.temp !== reference.temp ? `Δ ${(current.temp - reference.temp > 0 ? "+" : "")}${(Math.round((current.temp - reference.temp) * 10) / 10)}°C` : undefined}
          targetSensor="Target sensor: Pt100 RTD"
          isAnomaly={demoScenario === "TEMP_SPIKE" || demoScenario === "TEMP_DROP" || demoScenario === "SENSOR_STUCK" || demoScenario === "SENSOR_DISCONNECT"}
          sub={isFailed ? "Open-Meteo unreachable" : (loading && !current ? "Contacting Open-Meteo..." : undefined)}
        />
        <Readout
          icon={Gauge}
          label="Pressure Channel"
          value={pressVal}
          unit={` ${units.pressure}`}
          accent={COLORS.pressure}
          isLoading={loading && !current}
          sourceTag={current?.dataSource === "DEMO_FAULT" && demoScenario === "PRESSURE_DROP" ? "DEMO FAULT" : "SIMULATED AWS"}
          refDisplay={reference ? `${units.pressure === "inHg" ? hpaToInHg(reference.pressure) : reference.pressure} ${units.pressure} (Open-Meteo)` : undefined}
          diffDisplay={current && reference && current.pressure !== reference.pressure ? `Δ ${(current.pressure - reference.pressure > 0 ? "+" : "")}${(Math.round((current.pressure - reference.pressure) * 10) / 10)} hPa` : undefined}
          targetSensor="Target sensor: Piezoresistive Diaphragm"
          isAnomaly={demoScenario === "PRESSURE_DROP"}
          sub={isFailed ? "Open-Meteo unreachable" : `Elev: ${station.elevation} (Std: ${expectedSurfacePressure} hPa)`}
        />
        <Readout
          icon={Droplets}
          label="Humidity Channel"
          value={humidityVal}
          unit="%"
          accent={COLORS.humidity}
          isLoading={loading && !current}
          sourceTag={current?.dataSource === "DEMO_FAULT" && demoScenario === "HUMIDITY_DRIFT" ? "DEMO FAULT" : "SIMULATED AWS"}
          refDisplay={reference ? `${reference.humidity}% (Open-Meteo)` : undefined}
          diffDisplay={current && reference && current.humidity !== reference.humidity ? `Δ ${(current.humidity - reference.humidity > 0 ? "+" : "")}${(Math.round((current.humidity - reference.humidity) * 10) / 10)}%` : undefined}
          targetSensor="Target sensor: Capacitive Thin-Film"
          isAnomaly={demoScenario === "HUMIDITY_DRIFT"}
          sub={isFailed ? "Open-Meteo unreachable" : (loading && !current ? "Contacting Open-Meteo..." : undefined)}
        />
      </div>

      {/* Simulated AWS Dynamics & Synoptic Reference Comparison */}
      {current && (
        <Card title="Simulated AWS Channels & Reference Baseline Comparison">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0" }}>
              <SunMedium size={18} color={COLORS.temp} style={{ marginTop: 2 }} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "12px", color: COLORS.muted }}>Atmospheric Condition</span>
                  <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "3px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", fontWeight: 700 }}>
                    OPEN-METEO API
                  </span>
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: COLORS.text, marginTop: 2 }}>{current.weatherCondition}</div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>WMO Code: {current.weatherCode}</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0" }}>
              <Wind size={18} color={COLORS.wind} style={{ marginTop: 2 }} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "12px", color: COLORS.muted }}>Wind Speed Channel</span>
                  <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "3px", background: demoScenario === "WIND_SPIKE" ? "rgba(239, 68, 68, 0.2)" : "rgba(56, 189, 248, 0.15)", color: demoScenario === "WIND_SPIKE" ? "#f87171" : "#7dd3fc", fontWeight: 700 }}>
                    {demoScenario === "WIND_SPIKE" ? "DEMO FAULT" : "SIMULATED AWS"}
                  </span>
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: demoScenario === "WIND_SPIKE" ? "#f87171" : COLORS.text, marginTop: 2 }}>
                  {current.windSpeed} km/h
                </div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>
                  Ref: {reference ? reference.windSpeed : "—"} km/h • Target: Ultrasonic 2D
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0" }}>
              <CloudRain size={18} color={COLORS.precip} style={{ marginTop: 2 }} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "12px", color: COLORS.muted }}>Precipitation Channel</span>
                  <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "3px", background: "rgba(56, 189, 248, 0.15)", color: "#7dd3fc", fontWeight: 700 }}>
                    SIMULATED AWS
                  </span>
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: COLORS.text, marginTop: 2 }}>{current.precipitation} mm</div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>
                  Ref: {reference ? reference.precipitation : "—"} mm • Target: Tipping Bucket
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 7-Day Meteorological Forecast */}
      <ForecastSection forecast={forecast} units={units} />

      {/* Bottom Grid: Station Status & Actual API Update Time */}
      <div style={{ ...styles.dashboardBottomGrid, marginTop: "16px" }}>
        <Card title="Station status">
          <div style={styles.kvRow}>
            <span style={styles.kvLabel}>Status</span>
            <span style={online ? styles.kvValueGood : styles.badgeBad}>
              {online ? "Operational (Live API Reference)" : "Weather data unavailable"}
            </span>
          </div>
          <div style={styles.kvRow}>
            <span style={styles.kvLabel}>Station ID</span>
            <span style={styles.kvValue}>{station.id}</span>
          </div>
          <div style={styles.kvRow}>
            <span style={styles.kvLabel}>Location</span>
            <span style={styles.kvValue}>{station.location}</span>
          </div>
          <div style={styles.kvRow}>
            <span style={styles.kvLabel}>Coordinates</span>
            <span style={styles.kvValue}>{station.lat}, {station.lon}</span>
          </div>
        </Card>

        <Card title="Last updated">
          <div style={styles.lastUpdatedBig}>
            <Clock size={20} strokeWidth={1.75} color={COLORS.muted} />
            <div style={{ flex: 1 }}>
              {loading && !lastUpdated ? (
                <div>
                  <div style={{ ...styles.readoutValue, fontSize: 18, color: COLORS.muted }}>Loading...</div>
                  <div style={styles.readoutSub}>Fetching weather data from Open-Meteo</div>
                </div>
              ) : isFailed && !lastUpdated ? (
                <div>
                  <div style={{ ...styles.readoutValue, fontSize: 14, color: COLORS.bad }}>Weather data unavailable</div>
                  <div style={styles.readoutSub}>API request failed</div>
                </div>
              ) : (
                <div>
                  <div style={{ ...styles.readoutValue, fontSize: 18 }}>
                    {fmtDate(lastUpdated, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </div>
                  <div style={styles.readoutSub}>
                    Ref Source: Open-Meteo API ({station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}) • Evaluated by AWS Anomaly Engine
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

interface LiveReadingWithUnits extends Reading {
  tempU: number;
  pressU: number;
}

interface LiveViewProps {
  live: Reading[];
  units: Units;
  paused: boolean;
  setPaused: React.Dispatch<React.SetStateAction<boolean>>;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function LiveView({ live, units, paused, setPaused, loading, error, onRefresh }: LiveViewProps) {
  const data: LiveReadingWithUnits[] = live.map((p) => ({
    ...p,
    tempU: units.temp === "F" ? cToF(p.temp) : p.temp,
    pressU: units.pressure === "inHg" ? hpaToInHg(p.pressure) : p.pressure,
  }));
  const latest = data[data.length - 1] || null;

  return (
    <div id="view-live">
      <SectionHeader
        title="Live monitoring"
        subtitle="Streaming real atmospheric readings from Open-Meteo telemetry"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              id="btn-live-refresh"
              style={styles.ghostButton}
              onClick={onRefresh}
              disabled={loading}
              title="Fetch fresh reading"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              {loading ? "Fetching..." : "Fetch Now"}
            </button>
            <button id="btn-pause-toggle" style={styles.ghostButton} onClick={() => setPaused((p) => !p)}>
              {paused ? "Resume stream" : "Pause stream"}
            </button>
          </div>
        }
      />

      {error && (
        <div style={styles.errorBanner}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={17} color={COLORS.bad} />
            <span>Weather data unavailable: {error}</span>
          </div>
          <button style={styles.ghostButton} onClick={onRefresh}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      <div style={styles.readoutGrid}>
        <Readout
          icon={Thermometer}
          label="Real-time temperature"
          value={latest ? latest.tempU : "—"}
          unit={`°${units.temp}`}
          accent={COLORS.temp}
          sub={paused ? "Stream paused" : (loading ? "Updating..." : "Live telemetry")}
        />
        <Readout
          icon={Gauge}
          label="Real-time pressure"
          value={latest ? latest.pressU : "—"}
          unit={` ${units.pressure}`}
          accent={COLORS.pressure}
          sub={paused ? "Stream paused" : (loading ? "Updating..." : "Live telemetry")}
        />
        <Readout
          icon={Droplets}
          label="Real-time humidity"
          value={latest ? latest.humidity : "—"}
          unit="%"
          accent={COLORS.humidity}
          sub={paused ? "Stream paused" : (loading ? "Updating..." : "Live telemetry")}
        />
      </div>

      <Card title="Temperature — live stream">
        <div style={{ height: 180 }}>
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="t" tickFormatter={(t) => fmtDate(t, { hour: "2-digit", minute: "2-digit" })} stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} width={38} domain={["auto", "auto"]} />
                <Tooltip content={<ChartTooltip unit={`°${units.temp}`} />} />
                <Line type="monotone" dataKey="tempU" name="Temp" stroke={COLORS.temp} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.muted }}>
              {loading ? "Loading telemetry..." : "Weather data unavailable"}
            </div>
          )}
        </div>
      </Card>

      <Card title="Pressure — live stream">
        <div style={{ height: 180 }}>
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="t" tickFormatter={(t) => fmtDate(t, { hour: "2-digit", minute: "2-digit" })} stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} width={42} domain={["auto", "auto"]} />
                <Tooltip content={<ChartTooltip unit={` ${units.pressure}`} />} />
                <Line type="monotone" dataKey="pressU" name="Pressure" stroke={COLORS.pressure} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.muted }}>
              {loading ? "Loading telemetry..." : "Weather data unavailable"}
            </div>
          )}
        </div>
      </Card>

      <Card title="Humidity — live stream">
        <div style={{ height: 180 }}>
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="t" tickFormatter={(t) => fmtDate(t, { hour: "2-digit", minute: "2-digit" })} stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} width={34} domain={[0, 100]} />
                <Tooltip content={<ChartTooltip unit="%" />} />
                <Line type="monotone" dataKey="humidity" name="Humidity" stroke={COLORS.humidity} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.muted }}>
              {loading ? "Loading telemetry..." : "Weather data unavailable"}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

interface HistoryViewProps {
  history: Reading[];
  units: Units;
  loading: boolean;
  error: string | null;
  onInspectAnomaly?: (reading: Reading) => void;
}

function HistoryView({ history, units, loading, error, onInspectAnomaly }: HistoryViewProps) {
  const maxT = history.length ? history[history.length - 1].t : Date.now();
  const minT = history.length ? history[0].t : Date.now() - 7 * 24 * 3600 * 1000;

  const [start, setStart] = useState(() => new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().slice(0, 16));
  const [end, setEnd] = useState(() => new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16));
  const [highlightAnomalies, setHighlightAnomalies] = useState(true);

  const filtered = useMemo(() => {
    if (!history.length) return [];
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return history.filter((p) => p.t >= s && p.t <= e);
  }, [history, start, end]);

  function downloadCsv() {
    const rows = [["timestamp", "temperature_c", "pressure_hpa", "humidity_pct", "condition", "precipitation_prob"]];
    filtered.forEach((p) => {
      rows.push([
        new Date(p.t).toISOString(),
        String(p.temp),
        String(p.pressure),
        String(p.humidity),
        p.weatherCondition || "",
        String(p.precipitation ?? 0),
      ]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "weather-station-history.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const rowsToShow = filtered.slice().reverse().slice(0, 200);

  return (
    <div id="view-history">
      <SectionHeader title="Historical data" subtitle="Browse and export real meteorological records from Open-Meteo" />

      {error && (
        <div style={styles.errorBanner}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={17} color={COLORS.bad} />
            <span>Weather data unavailable: {error}</span>
          </div>
        </div>
      )}

      <Card>
        <div style={styles.filterRow}>
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>From</label>
            <input
              type="datetime-local"
              value={start}
              min={new Date(minT).toISOString().slice(0, 16)}
              max={end}
              onChange={(e) => setStart(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>To</label>
            <input
              type="datetime-local"
              value={end}
              min={start}
              max={new Date(maxT + 24 * 3600 * 1000).toISOString().slice(0, 16)}
              onChange={(e) => setEnd(e.target.value)}
              style={styles.input}
            />
          </div>
          <button id="btn-download-csv" style={styles.primaryButton} onClick={downloadCsv} disabled={filtered.length === 0}>
            <Download size={15} /> Download CSV
          </button>
          <button
            onClick={() => setHighlightAnomalies((h) => !h)}
            style={{
              ...styles.ghostButton,
              color: highlightAnomalies ? "#38bdf8" : COLORS.muted,
              borderColor: highlightAnomalies ? "#38bdf8" : COLORS.borderStrong,
            }}
          >
            <AlertTriangle size={13} />
            {highlightAnomalies ? "Anomaly Markers Active" : "Show Anomaly Markers"}
          </button>
        </div>
        <div style={styles.filterMeta}>
          {loading ? "Loading meteorological data..." : `${filtered.length} readings in range · showing latest ${rowsToShow.length}`}
        </div>
      </Card>

      <Card title="Temperature history">
        <div style={{ height: 160 }}>
          {filtered.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filtered} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="t" tickFormatter={(t) => fmtDate(t, { month: "short", day: "numeric" })} stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} minTickGap={50} />
                <YAxis stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} width={36} />
                <Tooltip content={<ChartTooltip unit={`°${units.temp}`} />} />
                <Line type="monotone" dataKey="temp" name="Temp" stroke={COLORS.temp} strokeWidth={1.75} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.muted }}>
              {loading ? "Loading readings..." : "No readings in this range"}
            </div>
          )}
        </div>
      </Card>

      <Card title="Detailed Observations Table">
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Time</th>
                <th style={styles.th}>Temp (°C)</th>
                <th style={styles.th}>Pressure (hPa)</th>
                <th style={styles.th}>Humidity (%)</th>
                <th style={styles.th}>Condition</th>
                <th style={styles.th}>Validation</th>
              </tr>
            </thead>
            <tbody>
              {rowsToShow.map((r) => (
                <tr key={r.t}>
                  <td style={styles.td}>{fmtDate(r.t)}</td>
                  <td style={styles.td}>{r.temp}</td>
                  <td style={styles.td}>{r.pressure}</td>
                  <td style={styles.td}>{r.humidity}</td>
                  <td style={{ ...styles.td, fontFamily: "inherit" }}>{r.weatherCondition || "—"}</td>
                  <td style={styles.td}>
                    <span style={{ color: "#10b981", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      <Check size={12} /> Validated
                    </span>
                  </td>
                </tr>
              ))}
              {rowsToShow.length === 0 && (
                <tr>
                  <td style={styles.td} colSpan={6}>
                    {loading ? "Fetching readings..." : "No readings in this range."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

interface AnalyticsViewProps {
  history: Reading[];
  loading: boolean;
  error: string | null;
}

function AnalyticsView({ history, loading, error }: AnalyticsViewProps) {
  const stats = useMemo(() => {
    if (!history.length) return null;
    const temps = history.map((p) => p.temp);
    const press = history.map((p) => p.pressure);
    const hums = history.map((p) => p.humidity);
    const avg = (arr: number[]) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
    return {
      avgTemp: avg(temps),
      minTemp: Math.min(...temps),
      maxTemp: Math.max(...temps),
      avgPressure: avg(press),
      avgHumidity: avg(hums),
    };
  }, [history]);

  const daily = useMemo(() => {
    const byDay: Record<string, { day: string; temps: number[]; press: number[]; hums: number[] }> = {};
    history.forEach((p) => {
      const key = new Date(p.t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      if (!byDay[key]) byDay[key] = { day: key, temps: [], press: [], hums: [] };
      byDay[key].temps.push(p.temp);
      byDay[key].press.push(p.pressure);
      byDay[key].hums.push(p.humidity);
    });
    return Object.values(byDay).map((d) => ({
      day: d.day,
      avgTemp: Math.round((d.temps.reduce((a, b) => a + b, 0) / d.temps.length) * 10) / 10,
      avgHumidity: Math.round(d.hums.reduce((a, b) => a + b, 0) / d.hums.length),
    }));
  }, [history]);

  if (!stats) {
    return (
      <div id="view-analytics">
        <SectionHeader title="Weather analytics" subtitle="Summary statistics from Open-Meteo" />
        {error ? (
          <div style={styles.errorBanner}>Weather data unavailable: {error}</div>
        ) : (
          <Card>
            <div style={{ color: COLORS.muted, padding: "20px 0", textAlign: "center" }}>
              {loading ? "Calculating meteorological analytics..." : "Weather data unavailable"}
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div id="view-analytics">
      <SectionHeader title="Weather analytics" subtitle="Summary statistics calculated from real Open-Meteo hourly observations" />

      <div style={styles.readoutGrid}>
        <Readout icon={Thermometer} label="Average temperature" value={stats.avgTemp} unit="°C" accent={COLORS.temp} />
        <Readout icon={Gauge} label="Average pressure" value={stats.avgPressure} unit=" hPa" accent={COLORS.pressure} />
        <Readout icon={Droplets} label="Average humidity" value={stats.avgHumidity} unit="%" accent={COLORS.humidity} />
      </div>

      <div style={styles.dashboardBottomGrid}>
        <Card title="Min / max temperature">
          <div style={styles.minMaxRow}>
            <div style={styles.minMaxItem}>
              <ArrowDown size={16} color={COLORS.pressure} />
              <div>
                <div style={styles.readoutValue}>{stats.minTemp}°C</div>
                <div style={styles.readoutSub}>Minimum</div>
              </div>
            </div>
            <div style={styles.minMaxItem}>
              <ArrowUp size={16} color={COLORS.temp} />
              <div>
                <div style={styles.readoutValue}>{stats.maxTemp}°C</div>
                <div style={styles.readoutSub}>Maximum</div>
              </div>
            </div>
          </div>
        </Card>
        <Card title="Range">
          <div style={styles.kvRow}><span style={styles.kvLabel}>Temperature spread</span><span style={styles.kvValue}>{Math.round((stats.maxTemp - stats.minTemp) * 10) / 10}°C</span></div>
          <div style={styles.kvRow}><span style={styles.kvLabel}>Data points analyzed</span><span style={styles.kvValue}>{history.length}</span></div>
        </Card>
      </div>

      <Card title="Daily trend — average temperature">
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="day" stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} width={36} />
              <Tooltip content={<ChartTooltip unit="°C" />} />
              <Bar dataKey="avgTemp" name="Avg temp" fill={COLORS.temp} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Weekly trend — average humidity">
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="day" stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} width={36} domain={[0, 100]} />
              <Tooltip content={<ChartTooltip unit="%" />} />
              <Bar dataKey="avgHumidity" name="Avg humidity" fill={COLORS.humidity} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

interface StationViewProps {
  station: StationInfo;
  sensors: Record<string, string>;
  connectivity: { signal: string; lastSync: number; protocol: string };
  online: boolean;
  current: CurrentWeatherTelemetry | null;
}

function StationView({ station, sensors, connectivity, online, current }: StationViewProps) {
  return (
    <div id="view-station">
      <SectionHeader title="Weather station" subtitle="Hardware and connectivity specifications" />

      <div style={styles.dashboardBottomGrid}>
        <Card title="Station information">
          <div style={styles.kvRow}><span style={styles.kvLabel}>Name</span><span style={styles.kvValue}>{station.name}</span></div>
          <div style={styles.kvRow}><span style={styles.kvLabel}>Station ID</span><span style={styles.kvValue}>{station.id}</span></div>
          <div style={styles.kvRow}><span style={styles.kvLabel}>Model</span><span style={styles.kvValue}>{station.model}</span></div>
          <div style={styles.kvRow}><span style={styles.kvLabel}>Installed</span><span style={styles.kvValue}>{station.installed}</span></div>
        </Card>
        <Card title="Location & Elevation">
          <div style={styles.kvRow}><span style={styles.kvLabel}><MapPin size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Location</span><span style={styles.kvValue}>{station.location}</span></div>
          <div style={styles.kvRow}><span style={styles.kvLabel}>Latitude</span><span style={styles.kvValue}>{station.lat} ({station.latitude})</span></div>
          <div style={styles.kvRow}><span style={styles.kvLabel}>Longitude</span><span style={styles.kvValue}>{station.lon} ({station.longitude})</span></div>
          <div style={styles.kvRow}><span style={styles.kvLabel}>Elevation</span><span style={styles.kvValue}>{station.elevation}</span></div>
        </Card>
      </div>

      <Card title="Sensor telemetry channels">
        {Object.entries(sensors).map(([name, status]) => (
          <div key={name} style={styles.kvRow}>
            <span style={styles.kvLabel}>{name}</span>
            <span style={status === "online" && online ? styles.badgeGood : styles.badgeBad}>
              {status === "online" && online ? <CircleCheck size={13} /> : <CircleAlert size={13} />}
              {status === "online" && online ? "Online" : "Offline"}
            </span>
          </div>
        ))}
      </Card>

      <Card title="Connectivity & API Status">
        <div style={styles.kvRow}>
          <span style={styles.kvLabel}>{online ? <Wifi size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> : <WifiOff size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}Connection</span>
          <span style={online ? styles.badgeGood : styles.badgeBad}>{online ? "Connected (Live API)" : "Disconnected"}</span>
        </div>
        <div style={styles.kvRow}><span style={styles.kvLabel}>Endpoint Provider</span><span style={styles.kvValue}>Open-Meteo REST API</span></div>
        <div style={styles.kvRow}><span style={styles.kvLabel}>Signal strength</span><span style={styles.kvValue}>{connectivity.signal}</span></div>
        <div style={styles.kvRow}>
          <span style={styles.kvLabel}>Last API Sync</span>
          <span style={styles.kvValue}>
            {connectivity.lastSync ? fmtDate(connectivity.lastSync, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Pending"}
          </span>
        </div>
        {current && (
          <div style={styles.kvRow}>
            <span style={styles.kvLabel}>WeatherGPT Context</span>
            <span style={styles.kvValue}>{current.weatherCondition}, {current.windSpeed} km/h wind</span>
          </div>
        )}
      </Card>
    </div>
  );
}

interface SettingsViewProps {
  units: Units;
  setUnits: React.Dispatch<React.SetStateAction<Units>>;
  updateInterval: number;
  setUpdateInterval: React.Dispatch<React.SetStateAction<number>>;
  station: StationInfo;
  setStation: React.Dispatch<React.SetStateAction<StationInfo>>;
  retention: number;
  setRetention: React.Dispatch<React.SetStateAction<number>>;
  onSaveStation: (updated: StationInfo) => void;
}

function SettingsView({
  units, setUnits,
  updateInterval, setUpdateInterval,
  station, setStation,
  retention, setRetention,
  onSaveStation,
}: SettingsViewProps) {
  const [draft, setDraft] = useState<StationInfo>(station);
  const [savedToast, setSavedToast] = useState(false);

  const handleSave = () => {
    setStation(draft);
    onSaveStation(draft);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  return (
    <div id="view-settings">
      <SectionHeader title="Settings" subtitle="Configure station coordinates, units, and polling frequency" />

      <Card title="Update interval">
        <p style={styles.helperText}>How often live readings refresh from the Open-Meteo weather API.</p>
        <div style={styles.chipRow}>
          {[3, 5, 10, 30, 60].map((s) => (
            <button
              key={s}
              onClick={() => setUpdateInterval(s)}
              style={updateInterval === s ? styles.chipActive : styles.chip}
            >
              {s < 60 ? `${s}s` : "1m"}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Units">
        <div style={styles.settingsRow}>
          <span style={styles.filterLabel}>Temperature</span>
          <div style={styles.chipRow}>
            <button onClick={() => setUnits((u) => ({ ...u, temp: "C" }))} style={units.temp === "C" ? styles.chipActive : styles.chip}>Celsius</button>
            <button onClick={() => setUnits((u) => ({ ...u, temp: "F" }))} style={units.temp === "F" ? styles.chipActive : styles.chip}>Fahrenheit</button>
          </div>
        </div>
        <div style={styles.settingsRow}>
          <span style={styles.filterLabel}>Pressure</span>
          <div style={styles.chipRow}>
            <button onClick={() => setUnits((u) => ({ ...u, pressure: "hPa" }))} style={units.pressure === "hPa" ? styles.chipActive : styles.chip}>hPa</button>
            <button onClick={() => setUnits((u) => ({ ...u, pressure: "inHg" }))} style={units.pressure === "inHg" ? styles.chipActive : styles.chip}>inHg</button>
          </div>
        </div>
      </Card>

      <Card title="Station location (Open-Meteo Coordinates)">
        <p style={styles.helperText}>
          Updating coordinates will re-query Open-Meteo for that location.
        </p>
        <div style={styles.formGrid}>
          <div style={styles.formField}>
            <label style={styles.filterLabel}>Station Name</label>
            <input
              style={styles.input}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div style={styles.formField}>
            <label style={styles.filterLabel}>Location Description</label>
            <input
              style={styles.input}
              value={draft.location}
              onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
            />
          </div>
          <div style={styles.formField}>
            <label style={styles.filterLabel}>Latitude (-90 to 90)</label>
            <input
              type="number"
              step="0.0001"
              style={styles.input}
              value={draft.latitude}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setDraft((d) => ({
                  ...d,
                  latitude: val,
                  lat: `${Math.abs(val).toFixed(4)}° ${val >= 0 ? "N" : "S"}`,
                }));
              }}
            />
          </div>
          <div style={styles.formField}>
            <label style={styles.filterLabel}>Longitude (-180 to 180)</label>
            <input
              type="number"
              step="0.0001"
              style={styles.input}
              value={draft.longitude}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setDraft((d) => ({
                  ...d,
                  longitude: val,
                  lon: `${Math.abs(val).toFixed(4)}° ${val >= 0 ? "E" : "W"}`,
                }));
              }}
            />
          </div>
        </div>
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <button id="btn-save-station-settings" style={styles.primaryButton} onClick={handleSave}>
            Save Location & Fetch Data
          </button>
          {savedToast && <span style={styles.badgeGood}><CircleCheck size={14} /> Saved and reloading weather...</span>}
        </div>
      </Card>

      <Card title="Data retention">
        <p style={styles.helperText}>Local buffer retention limit.</p>
        <div style={styles.chipRow}>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setRetention(d)}
              style={retention === d ? styles.chipActive : styles.chip}
            >
              {d} days
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  Main Weather Station Root Application Component                 */
/* ---------------------------------------------------------------- */

export default function App() {
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Weather & Telemetry State
  const [current, setCurrent] = useState<CurrentWeatherTelemetry | null>(null);
  const [referenceTelemetry, setReferenceTelemetry] = useState<CurrentWeatherTelemetry | null>(null);
  const [live, setLive] = useState<Reading[]>([]);
  const [history, setHistory] = useState<Reading[]>([]);
  const [forecast, setForecast] = useState<DailyForecastDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [online, setOnline] = useState<boolean>(true);

  // Station and Config
  const [station, setStation] = useState<StationInfo>(DEFAULT_STATION);
  const [units, setUnits] = useState<Units>({ temp: "C", pressure: "hPa" });
  const [updateInterval, setUpdateInterval] = useState<number>(10);
  const [paused, setPaused] = useState(false);
  const [retention, setRetention] = useState(30);

  // SIH Anomaly Detection & AI Diagnostics State
  const [demoScenario, setDemoScenario] = useState<DemoSimulationScenario>("NONE");
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [sensorHealth, setSensorHealth] = useState<SensorHealthInfo[]>([]);
  const [stationSummary, setStationSummary] = useState<StationHealthSummary>({
    stationHealthScore: 96,
    overallAnomalyScore: 10,
    activeAnomaliesCount: 0,
    criticalAlertsCount: 0,
    warningAlertsCount: 0,
    healthySensorsCount: 6,
    totalSensorsCount: 6,
    dataFreshnessSec: 0,
    referenceDeviationAlerts: 0,
  });
  const [weatherGPTInitialPrompt, setWeatherGPTInitialPrompt] = useState<string | undefined>();

  // Fixed hardware telemetry channels
  const sensors = useMemo(() => ({
    "Temperature (Pt100 RTD)": online ? "online" : "offline",
    "Relative Humidity (Thin-Film)": online ? "online" : "offline",
    "Barometric Pressure (Piezoresistive)": online ? "online" : "offline",
    "Wind Speed (Ultrasonic 2D)": online ? "online" : "offline",
    "Precipitation (Tipping Bucket)": online ? "online" : "offline",
    "Edge IoT Gateway": online ? "online" : "offline",
  }), [online]);

  const connectivity = useMemo(() => ({
    signal: online ? "Excellent (-58 dBm, 4G LTE-M)" : "Offline",
    lastSync: lastUpdated,
    protocol: "Open-Meteo REST / HTTPS",
  }), [online, lastUpdated]);

  /**
   * Recalculate deterministic anomaly detection whenever telemetry, history, or demo scenario changes.
   */
  const recomputeAnomalies = useCallback((
    curTelemetry: CurrentWeatherTelemetry | null,
    refTelemetry: CurrentWeatherTelemetry | null,
    histReadings: Reading[],
    curStation: StationInfo,
    scenario: DemoSimulationScenario
  ) => {
    const obs = refTelemetry ? getAWSObservation(refTelemetry, scenario) : null;
    const analysis = runAnomalyDetection(obs, refTelemetry, histReadings, curStation, scenario);
    setAnomalies(analysis.anomalies);
    setSensorHealth(analysis.sensorHealth);
    setStationSummary(analysis.stationSummary);
  }, []);

  /**
   * Main function to fetch real weather data from Open-Meteo API.
   */
  const loadWeatherData = useCallback(async (lat: number, lon: number, isInitial = false) => {
    try {
      setLoading(true);
      setError(null);

      const result = await fetchWeatherData(lat, lon);
      const refTelemetry = result.current;
      setReferenceTelemetry(refTelemetry);

      const simulatedTelemetry = generateSimulatedTelemetry(refTelemetry, demoScenario);
      setCurrent(simulatedTelemetry);
      setOnline(true);
      setLastUpdated(refTelemetry.apiTimestamp);
      if (result.dailyForecast) {
        setForecast(result.dailyForecast);
      }

      const latestReading: Reading = {
        t: simulatedTelemetry.apiTimestamp,
        temp: simulatedTelemetry.temp,
        pressure: simulatedTelemetry.pressure,
        humidity: simulatedTelemetry.humidity,
        windSpeed: simulatedTelemetry.windSpeed,
        precipitation: simulatedTelemetry.precipitation,
        weatherCode: simulatedTelemetry.weatherCode,
        weatherCondition: simulatedTelemetry.weatherCondition,
        source: simulatedTelemetry.dataSource,
      };

      setLive((prev) => {
        if (prev.length > 0 && prev[prev.length - 1].t === latestReading.t) {
          return [...prev.slice(0, -1), latestReading];
        }
        return [...prev.slice(-29), latestReading];
      });

      let updatedHistory = history;
      if (isInitial || history.length === 0) {
        if (result.hourlyReadings.length > 0) {
          updatedHistory = result.hourlyReadings;
          setHistory(updatedHistory);
          setLive(result.hourlyReadings.slice(-15));
        }
      }

      if (result.elevation !== undefined) {
        setStation((s) => ({ ...s, elevation: `${result.elevation} m`, elevationMeters: result.elevation }));
      }

      // Run statistical anomaly detection engine
      recomputeAnomalies(simulatedTelemetry, refTelemetry, updatedHistory, station, demoScenario);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect to weather API";
      setError(msg);
      setOnline(false);
      recomputeAnomalies(null, null, history, station, demoScenario);
    } finally {
      setLoading(false);
    }
  }, [history, station, demoScenario, recomputeAnomalies]);

  // Initial fetch on mount
  useEffect(() => {
    loadWeatherData(station.latitude, station.longitude, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic polling interval
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return undefined;

    intervalRef.current = setInterval(() => {
      loadWeatherData(station.latitude, station.longitude, false);
    }, updateInterval * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [updateInterval, paused, station.latitude, station.longitude, loadWeatherData]);

  // Handle demo simulation scenario switch
  const handleScenarioChange = (scenario: DemoSimulationScenario) => {
    setDemoScenario(scenario);
    if (referenceTelemetry) {
      const simulated = generateSimulatedTelemetry(referenceTelemetry, scenario);
      setCurrent(simulated);
      recomputeAnomalies(simulated, referenceTelemetry, history, station, scenario);
    } else {
      recomputeAnomalies(current, referenceTelemetry, history, station, scenario);
    }
  };

  // Handle station switch from Map or Settings
  const handleSelectStation = (newStation: StationNetworkNode | StationInfo) => {
    setStation(newStation);
    loadWeatherData(newStation.latitude, newStation.longitude, true);
  };

  const handleManualRefresh = () => {
    loadWeatherData(station.latitude, station.longitude, false);
  };

  const handleOpenWeatherGPT = (initialPrompt?: string) => {
    setWeatherGPTInitialPrompt(initialPrompt);
    setActiveSection("weathergpt");
  };

  const handleAcknowledgeAnomaly = (id: string) => {
    setAnomalies((prev) => prev.filter((a) => a.id !== id));
  };

  // Navigation Items Definition with Live Counts
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "anomalies", label: "Anomaly Detection", icon: AlertTriangle, badge: anomalies.length > 0 ? anomalies.length : undefined, badgeColor: "#ef4444" },
    { id: "sensor_health", label: "Sensor Health", icon: Activity },
    { id: "weathergpt", label: "WeatherGPT AI", icon: Sparkles, tag: "AI" },
    { id: "live", label: "Live monitoring", icon: Radio },
    { id: "history", label: "Historical data", icon: Database },
    { id: "analytics", label: "Weather analytics", icon: TrendingUp },
    { id: "alerts", label: "Alert Center", icon: Bell, badge: stationSummary.criticalAlertsCount > 0 ? stationSummary.criticalAlertsCount : undefined, badgeColor: "#f97316" },
    { id: "map", label: "Station Network", icon: MapPin },
    { id: "station", label: "Weather station", icon: Cpu },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div id="weather-station-app" style={styles.app} className="flex flex-col md:flex-row">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.6; cursor: pointer; }
        button:hover { opacity: 0.92; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 8px; }
      `}</style>

      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b" style={{ background: COLORS.panelBg, borderColor: COLORS.border }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Thermometer size={22} style={styles.brandIcon} strokeWidth={2} />
          <div>
            <div style={styles.brandText}>WeatherGPT AWS</div>
            <div style={styles.brandSub}>{station.id} • {station.name}</div>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="p-2 rounded-lg text-slate-300 hover:text-white"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        style={styles.sidebar}
        className={`${mobileMenuOpen ? "flex" : "hidden"} md:flex w-full md:w-[240px]`}
      >
        <div style={styles.brandRow} className="hidden md:flex">
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
            <div style={styles.brandText}>WeatherGPT</div>
            <div style={styles.brandSub}>AWS Platform • {station.id}</div>
          </div>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              id={`nav-${item.id}`}
              key={item.id}
              style={active ? styles.navItemActive : styles.navItem}
              onClick={() => {
                setActiveSection(item.id);
                setMobileMenuOpen(false);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon size={16} strokeWidth={active ? 2 : 1.75} color={active ? COLORS.temp : COLORS.muted} />
                <span>{item.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {item.tag && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      background: "rgba(56, 189, 248, 0.2)",
                      color: "#38bdf8",
                      padding: "1px 5px",
                      borderRadius: "4px",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                    }}
                  >
                    {item.tag}
                  </span>
                )}
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    style={{
                      fontSize: "10.5px",
                      fontWeight: 700,
                      background: item.badgeColor || "#ef4444",
                      color: "#fff",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      minWidth: "18px",
                      textAlign: "center",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </aside>

      {/* Main Content View */}
      <main style={styles.main} className="flex-1 w-full overflow-x-hidden">
        {/* SIH Anomaly Simulation Testbed Bar */}
        <DemoSimulationBar
          currentScenario={demoScenario}
          onSelectScenario={handleScenarioChange}
        />

        {activeSection === "dashboard" && (
          <DashboardView
            current={current}
            reference={referenceTelemetry}
            demoScenario={demoScenario}
            units={units}
            station={station}
            lastUpdated={lastUpdated}
            online={online}
            loading={loading}
            error={error}
            summary={stationSummary}
            anomalies={anomalies}
            forecast={forecast}
            onRefresh={handleManualRefresh}
            onNavigate={(sec) => setActiveSection(sec)}
            onOpenWeatherGPT={handleOpenWeatherGPT}
          />
        )}

        {activeSection === "anomalies" && (
          <AnomaliesView
            anomalies={anomalies}
            summary={stationSummary}
            station={station}
            onAcknowledgeAnomaly={handleAcknowledgeAnomaly}
            onOpenWeatherGPT={handleOpenWeatherGPT}
          />
        )}

        {activeSection === "sensor_health" && (
          <SensorHealthView
            sensors={sensorHealth}
            station={station}
            onOpenWeatherGPT={handleOpenWeatherGPT}
          />
        )}

        {activeSection === "weathergpt" && (
          <WeatherGPTView
            telemetry={current}
            anomalies={anomalies}
            sensorHealth={sensorHealth}
            stationSummary={stationSummary}
            station={station}
            forecast={forecast}
            initialPrompt={weatherGPTInitialPrompt}
          />
        )}

        {activeSection === "alerts" && (
          <AlertCenterView
            anomalies={anomalies}
            station={station}
            onOpenWeatherGPT={handleOpenWeatherGPT}
          />
        )}

        {activeSection === "map" && (
          <StationMapView
            currentStation={station}
            onSelectStation={handleSelectStation}
          />
        )}

        {activeSection === "live" && (
          <LiveView
            live={live}
            units={units}
            paused={paused}
            setPaused={setPaused}
            loading={loading}
            error={error}
            onRefresh={handleManualRefresh}
          />
        )}

        {activeSection === "history" && (
          <HistoryView
            history={history}
            units={units}
            loading={loading}
            error={error}
          />
        )}

        {activeSection === "analytics" && (
          <AnalyticsView
            history={history}
            loading={loading}
            error={error}
          />
        )}

        {activeSection === "station" && (
          <StationView
            station={station}
            sensors={sensors}
            connectivity={connectivity}
            online={online}
            current={current}
          />
        )}

        {activeSection === "settings" && (
          <SettingsView
            units={units}
            setUnits={setUnits}
            updateInterval={updateInterval}
            setUpdateInterval={setUpdateInterval}
            station={station}
            setStation={setStation}
            retention={retention}
            setRetention={setRetention}
            onSaveStation={handleSelectStation}
          />
        )}
      </main>
    </div>
  );
}
