import {
  CurrentWeatherTelemetry,
  DemoSimulationScenario,
  TelemetryDataSource,
} from "../types";

/**
 * AWSObservation Interface
 *
 * This modular interface represents a telemetry frame from an Automatic Weather Station.
 * In this SIH software prototype, it is generated via software simulation.
 * In a future hardware deployment, this exact interface can be populated by:
 * ESP32 -> MQTT Broker -> FastAPI backend -> Database.
 */
export interface AWSObservation {
  stationId: string;
  timestamp: number;
  source: TelemetryDataSource;
  faultScenario: DemoSimulationScenario;

  // Primary telemetry channels
  temperature: number; // in °C
  humidity: number; // in %
  pressure: number; // in hPa
  windSpeed: number; // in km/h
  precipitation: number; // in mm
  weatherCode: number;
  weatherCondition: string;

  // External Reference Model (Open-Meteo Synoptic Baseline)
  reference: {
    source: "OPEN_METEO_REFERENCE";
    temperature: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    precipitation: number;
    timestamp: number;
    apiTime: string;
  };

  // Hardware Channel Targets & Diagnostic Flags
  channels: {
    temperature: {
      channelName: "Temperature Channel";
      targetSensor: "Pt100 RTD";
      status: "ACTIVE" | "FAULT_INJECTED" | "DISCONNECTED";
      rateOfChange: number; // delta compared to previous cycle
    };
    humidity: {
      channelName: "Humidity Channel";
      targetSensor: "Capacitive Thin-Film";
      status: "ACTIVE" | "FAULT_INJECTED" | "DISCONNECTED";
      rateOfChange: number;
    };
    pressure: {
      channelName: "Pressure Channel";
      targetSensor: "Piezoresistive Diaphragm";
      status: "ACTIVE" | "FAULT_INJECTED" | "DISCONNECTED";
      rateOfChange: number;
    };
    wind: {
      channelName: "Wind Speed Channel";
      targetSensor: "Ultrasonic 2D Anemometer";
      status: "ACTIVE" | "FAULT_INJECTED" | "DISCONNECTED";
      rateOfChange: number;
    };
    precipitation: {
      channelName: "Precipitation Channel";
      targetSensor: "Tipping Bucket (0.2mm)";
      status: "ACTIVE" | "FAULT_INJECTED" | "DISCONNECTED";
      rateOfChange: number;
    };
  };
}

/**
 * getAWSObservation()
 *
 * Pluggable data provider function.
 * CURRENT (SIH PROTOTYPE): Returns simulated AWS telemetry derived from reference weather
 * and applies any active demo fault injection scenarios.
 *
 * FUTURE (HARDWARE EXPANSION):
 * Replace this function body with:
 *   const res = await fetch("http://fastapi-backend/api/stations/AWS-001/telemetry");
 *   return await res.json();
 */
export function getAWSObservation(
  referenceTelemetry: CurrentWeatherTelemetry,
  scenario: DemoSimulationScenario = "NONE",
  previousObservation?: AWSObservation | null
): AWSObservation {
  const now = Date.now();

  // Baseline simulated values start with real reference meteorology + slight natural microclimatic offset
  let temp = referenceTelemetry.temp;
  let humidity = referenceTelemetry.humidity;
  let pressure = referenceTelemetry.pressure;
  let wind = referenceTelemetry.windSpeed;
  let precip = referenceTelemetry.precipitation;

  let source: TelemetryDataSource = "SIMULATED_AWS";
  const tempStatus: "ACTIVE" | "FAULT_INJECTED" | "DISCONNECTED" =
    scenario === "TEMP_SPIKE" || scenario === "TEMP_DROP" || scenario === "SENSOR_STUCK"
      ? "FAULT_INJECTED"
      : scenario === "SENSOR_DISCONNECT"
      ? "DISCONNECTED"
      : "ACTIVE";

  const humStatus: "ACTIVE" | "FAULT_INJECTED" | "DISCONNECTED" =
    scenario === "HUMIDITY_DRIFT" ? "FAULT_INJECTED" : "ACTIVE";

  const pressStatus: "ACTIVE" | "FAULT_INJECTED" | "DISCONNECTED" =
    scenario === "PRESSURE_DROP" ? "FAULT_INJECTED" : "ACTIVE";

  const windStatus: "ACTIVE" | "FAULT_INJECTED" | "DISCONNECTED" =
    scenario === "WIND_SPIKE" ? "FAULT_INJECTED" : "ACTIVE";

  // Injected Fault Scenarios for SIH demonstration
  if (scenario === "TEMP_SPIKE") {
    temp = Math.round((temp + 8.8) * 10) / 10;
    source = "DEMO_FAULT";
  } else if (scenario === "TEMP_DROP") {
    temp = Math.round((temp - 7.6) * 10) / 10;
    source = "DEMO_FAULT";
  } else if (scenario === "HUMIDITY_DRIFT") {
    humidity = Math.min(100, Math.round(humidity + 28));
    source = "DEMO_FAULT";
  } else if (scenario === "PRESSURE_DROP") {
    pressure = Math.round((pressure - 18.5) * 10) / 10;
    source = "DEMO_FAULT";
  } else if (scenario === "WIND_SPIKE") {
    wind = Math.round((wind + 58.0) * 10) / 10;
    source = "DEMO_FAULT";
  } else if (scenario === "SENSOR_STUCK") {
    // Hold previous value completely static
    if (previousObservation) {
      temp = previousObservation.temperature;
    }
    source = "DEMO_FAULT";
  } else if (scenario === "SENSOR_DISCONNECT") {
    source = "DEMO_FAULT";
  }

  // Calculate rate-of-change compared to previous observation
  const prevTemp = previousObservation ? previousObservation.temperature : referenceTelemetry.temp;
  const prevHum = previousObservation ? previousObservation.humidity : referenceTelemetry.humidity;
  const prevPress = previousObservation ? previousObservation.pressure : referenceTelemetry.pressure;
  const prevWind = previousObservation ? previousObservation.windSpeed : referenceTelemetry.windSpeed;
  const prevPrecip = previousObservation ? previousObservation.precipitation : referenceTelemetry.precipitation;

  const rateOfChangeTemp = Math.round((temp - prevTemp) * 10) / 10;
  const rateOfChangeHum = Math.round((humidity - prevHum) * 10) / 10;
  const rateOfChangePress = Math.round((pressure - prevPress) * 10) / 10;
  const rateOfChangeWind = Math.round((wind - prevWind) * 10) / 10;
  const rateOfChangePrecip = Math.round((precip - prevPrecip) * 10) / 10;

  return {
    stationId: "AWS-001",
    timestamp: now,
    source,
    faultScenario: scenario,
    temperature: temp,
    humidity,
    pressure,
    windSpeed: wind,
    precipitation: precip,
    weatherCode: referenceTelemetry.weatherCode,
    weatherCondition: referenceTelemetry.weatherCondition,

    reference: {
      source: "OPEN_METEO_REFERENCE",
      temperature: referenceTelemetry.temp,
      humidity: referenceTelemetry.humidity,
      pressure: referenceTelemetry.pressure,
      windSpeed: referenceTelemetry.windSpeed,
      precipitation: referenceTelemetry.precipitation,
      timestamp: referenceTelemetry.apiTimestamp,
      apiTime: referenceTelemetry.apiTime,
    },

    channels: {
      temperature: {
        channelName: "Temperature Channel",
        targetSensor: "Pt100 RTD",
        status: tempStatus,
        rateOfChange: rateOfChangeTemp,
      },
      humidity: {
        channelName: "Humidity Channel",
        targetSensor: "Capacitive Thin-Film",
        status: humStatus,
        rateOfChange: rateOfChangeHum,
      },
      pressure: {
        channelName: "Pressure Channel",
        targetSensor: "Piezoresistive Diaphragm",
        status: pressStatus,
        rateOfChange: rateOfChangePress,
      },
      wind: {
        channelName: "Wind Speed Channel",
        targetSensor: "Ultrasonic 2D Anemometer",
        status: windStatus,
        rateOfChange: rateOfChangeWind,
      },
      precipitation: {
        channelName: "Precipitation Channel",
        targetSensor: "Tipping Bucket (0.2mm)",
        status: "ACTIVE",
        rateOfChange: rateOfChangePrecip,
      },
    },
  };
}
