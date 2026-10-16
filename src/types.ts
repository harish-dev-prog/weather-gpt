export type TelemetryDataSource = "OPEN_METEO_REFERENCE" | "SIMULATED_AWS" | "DEMO_FAULT" | "REAL_API";

export interface Reading {
  t: number;
  temp: number;
  pressure: number;
  humidity: number;
  windSpeed?: number;
  precipitation?: number;
  weatherCode?: number;
  weatherCondition?: string;
  hasAnomaly?: boolean;
  anomalyType?: AnomalyType;
  anomalyScore?: number;
  source?: TelemetryDataSource;
}

export interface CurrentWeatherTelemetry {
  temp: number; // in °C
  pressure: number; // in hPa
  humidity: number; // in %
  windSpeed: number; // in km/h
  precipitation: number; // in mm
  weatherCode: number;
  weatherCondition: string;
  apiTime: string; // ISO string from Open-Meteo
  apiTimestamp: number; // timestamp in ms
  fetchedAt: number; // client fetch timestamp in ms
  dataSource: TelemetryDataSource;
  referenceTemp?: number;
  referenceHumidity?: number;
  referencePressure?: number;
  referenceWindSpeed?: number;
  referencePrecipitation?: number;
}

export interface DailyForecastDay {
  date: string; // YYYY-MM-DD
  dayName: string;
  maxTemp: number;
  minTemp: number;
  precipProb: number;
  windSpeed: number;
  weatherCode: number;
  weatherCondition: string;
}

export interface StationInfo {
  name: string;
  id: string;
  model: string;
  installed: string;
  location: string;
  state?: string;
  lat: string;
  lon: string;
  latitude: number;
  longitude: number;
  elevation: string;
  elevationMeters?: number;
  sensorTypes?: string[];
  gatewayStatus?: "ONLINE" | "DEGRADED" | "OFFLINE";
  firmwareVersion?: string;
  isPrototypeSimulation?: boolean;
}

export interface Units {
  temp: "C" | "F";
  pressure: "hPa" | "inHg";
}

export type AnomalyType =
  | "NORMAL"
  | "SENSOR_STUCK"
  | "SENSOR_DISCONNECTED"
  | "SENSOR_DRIFT"
  | "SUDDEN_SPIKE"
  | "SUDDEN_DROP"
  | "INVALID_READING"
  | "REFERENCE_DEVIATION"
  | "CROSS_SENSOR_INCONSISTENCY"
  | "DATA_STALE";

export type AnomalySeverity = "LOW" | "WARNING" | "HIGH" | "CRITICAL";

export interface Anomaly {
  id: string;
  channel: string; // e.g. "Temperature Channel"
  sensor: string; // Legacy compatibility alias for channel
  targetSensorType: string; // e.g., "Target: Pt100 RTD"
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  observedValue: number | string; // Simulated AWS Telemetry
  simulatedValue: number | string; // Explicit alias
  expectedValue: number | string;
  referenceValue: number | string; // Open-Meteo Reference
  difference: string;
  recentAwsChange?: string; // Rate of change in recent interval
  anomalyScore: number; // 0 to 100
  confidence: number; // 0 to 100
  timestamp: number;
  explanation: string;
  signals: string[]; // Algorithmic evidence list
  recommendedAction: string;
  isSimulatedFault: boolean;
  faultScenario?: DemoSimulationScenario;
  isDemo?: boolean;
  acknowledged?: boolean;
  resolved?: boolean;
}

export interface SensorHealthInfo {
  sensorId: string;
  channelName: string; // e.g. "Temperature Channel"
  targetSensorType: string; // e.g. "Target: Pt100 RTD"
  name: string; // compatibility
  unit: string;
  currentValue: number | string; // Simulated AWS value
  referenceValue: number | string; // Open-Meteo reference value
  referenceDiff: string;
  healthScore: number; // 0 to 100%
  lastUpdate: number;
  dataFreshnessSec: number;
  anomalyCount: number;
  currentAnomalyScore: number; // 0 to 100
  driftEstimate: string;
  status: "HEALTHY" | "WARNING" | "CRITICAL" | "OFFLINE";
  simulationStatus: "Simulation Active" | "Fault Injected" | "Disconnected Channel";
  connectivity: "ONLINE" | "DEGRADED" | "DISCONNECTED";
  source: TelemetryDataSource;
  detectionReason?: string;
  trend?: "stable" | "increasing" | "decreasing" | "noisy";
}

export interface StationHealthSummary {
  stationHealthScore: number; // 0 to 100%
  overallAnomalyScore: number; // 0 to 100
  activeAnomaliesCount: number;
  criticalAlertsCount: number;
  warningAlertsCount: number;
  healthySensorsCount: number;
  totalSensorsCount: number;
  dataFreshnessSec: number;
  referenceDeviationAlerts: number;
  activeFaultScenario: DemoSimulationScenario;
}

export type DemoSimulationScenario =
  | "NONE"
  | "TEMP_SPIKE"
  | "TEMP_DROP"
  | "SENSOR_STUCK"
  | "SENSOR_DISCONNECT"
  | "HUMIDITY_DRIFT"
  | "PRESSURE_DROP"
  | "WIND_SPIKE";

export type SupportedLanguage =
  | "en"
  | "hi"
  | "te"
  | "kn"
  | "ta"
  | "ml"
  | "mr"
  | "bn";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: number;
  language?: SupportedLanguage | string;
  suggestedQuestions?: string[];
  isError?: boolean;
}

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  elevation: number;
  utc_offset_seconds: number;
  timezone: string;
  current: {
    time: string;
    interval?: number;
    temperature_2m: number;
    relative_humidity_2m: number;
    surface_pressure: number;
    wind_speed_10m: number;
    precipitation: number;
    weather_code: number;
  };
  hourly: {
    time: string[];
    temperature_2m?: number[];
    relative_humidity_2m?: number[];
    surface_pressure?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
  };
  daily?: {
    time: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max?: number[];
    weather_code?: number[];
  };
}
