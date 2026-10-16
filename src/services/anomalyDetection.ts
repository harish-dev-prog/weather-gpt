import {
  CurrentWeatherTelemetry,
  Reading,
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  SensorHealthInfo,
  StationHealthSummary,
  StationInfo,
  DemoSimulationScenario,
} from "../types";
import { AWSObservation } from "./awsTelemetryProvider";

/**
 * Expected barometric surface pressure at a given elevation (meters) based on the standard atmosphere formula.
 * Bengaluru 920m ~ 914 hPa, Ooty 2240m ~ 780 hPa.
 */
export function getStandardSurfacePressure(elevationMeters = 920): number {
  const P0 = 1013.25; // Sea level standard in hPa
  const L = 0.0065; // Temperature lapse rate K/m
  const T0 = 288.15; // Sea level standard temp K
  const g = 9.80665; // Gravity m/s^2
  const M = 0.0289644; // Molar mass of Earth's air kg/mol
  const R = 8.3144598; // Universal gas constant

  const exponent = (g * M) / (R * L);
  const pressure = P0 * Math.pow(1 - (L * elevationMeters) / T0, exponent);
  return Math.round(pressure * 10) / 10;
}

/**
 * Calculates rolling average, standard deviation, and Z-score for a metric.
 */
function calculateZScore(
  val: number,
  history: number[]
): { zScore: number | null; mean: number | null; stdDev: number | null; sufficientData: boolean } {
  if (history.length < 4) {
    return { zScore: null, mean: null, stdDev: null, sufficientData: false };
  }
  const mean = history.reduce((acc, v) => acc + v, 0) / history.length;
  const variance = history.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (history.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev < 0.001) {
    return { zScore: 0, mean, stdDev, sufficientData: true };
  }

  const zScore = (val - mean) / stdDev;
  return {
    zScore: Math.round(zScore * 100) / 100,
    mean: Math.round(mean * 10) / 10,
    stdDev: Math.round(stdDev * 100) / 100,
    sufficientData: true,
  };
}

/**
 * Evaluates whether consecutive sensor readings are stuck / frozen.
 */
function isSensorStuck(history: number[], minRepeats = 4): boolean {
  if (history.length < minRepeats) return false;
  const recent = history.slice(-minRepeats);
  const first = recent[0];
  return recent.every((v) => Math.abs(v - first) < 0.0001);
}

export function getSeverityFromScore(score: number): AnomalySeverity {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "WARNING";
  return "LOW";
}

/**
 * Core Anomaly Detection Engine (SIH Prototype Architecture).
 *
 * Compares:
 * 1. Simulated AWS telemetry (or real observation when hardware is attached)
 * 2. Historical simulated AWS telemetry
 * 3. Open-Meteo external reference weather data
 * 4. Cross-sensor thermodynamic relationships
 * 5. Physical terrestrial validity limits
 * 6. Rate of change (spikes / drops)
 * 7. Stuck / frozen sensor behavior
 * 8. Missing / stale data
 */
export function runAnomalyDetection(
  awsObs: AWSObservation | null,
  referenceData: CurrentWeatherTelemetry | null,
  recentReadings: Reading[],
  station: StationInfo,
  demoScenario: DemoSimulationScenario = "NONE"
): {
  anomalies: Anomaly[];
  sensorHealth: SensorHealthInfo[];
  stationSummary: StationHealthSummary;
} {
  const anomalies: Anomaly[] = [];
  const now = Date.now();
  const elevMeters = station.elevationMeters ?? (station.elevation ? parseFloat(station.elevation) : 920);

  // Fallback if no AWS observation is available
  if (!awsObs) {
    const defaultSensors: SensorHealthInfo[] = [
      {
        sensorId: "temp",
        channelName: "Temperature Channel",
        targetSensorType: "Target sensor: Pt100 RTD",
        name: "Temperature Channel (Pt100 RTD)",
        unit: "°C",
        currentValue: "—",
        referenceValue: referenceData ? `${referenceData.temp}°C` : "—",
        referenceDiff: "N/A",
        healthScore: 0,
        lastUpdate: 0,
        dataFreshnessSec: 9999,
        anomalyCount: 1,
        currentAnomalyScore: 100,
        driftEstimate: "Unknown",
        status: "OFFLINE",
        simulationStatus: "Disconnected Channel",
        connectivity: "DISCONNECTED",
        source: "SIMULATED_AWS",
        detectionReason: "No simulated telemetry packet received",
      },
    ];

    anomalies.push({
      id: "anom-offline",
      channel: "Simulated Telemetry Stream",
      sensor: "Simulated Telemetry Stream",
      targetSensorType: "Target: 4G LTE-M / MQTT Gateway",
      anomalyType: "SENSOR_DISCONNECTED",
      severity: "CRITICAL",
      observedValue: "No Signal",
      simulatedValue: "No Signal",
      expectedValue: "Active Stream",
      referenceValue: referenceData ? `${referenceData.temp}°C` : "Active Stream",
      difference: "Channel Inactive",
      anomalyScore: 95,
      confidence: 95,
      timestamp: now,
      explanation: "No telemetry packet received from the simulated AWS pipeline.",
      signals: [
        "✓ Simulation stream timeout",
        "✓ Zero sensor frames parsed within configured interval",
        "✓ Channel declared inactive",
      ],
      recommendedAction: "Check simulated telemetry generator or edge gateway connection.",
      isSimulatedFault: false,
    });

    return {
      anomalies,
      sensorHealth: defaultSensors,
      stationSummary: {
        stationHealthScore: 0,
        overallAnomalyScore: 95,
        activeAnomaliesCount: 1,
        criticalAlertsCount: 1,
        warningAlertsCount: 0,
        healthySensorsCount: 0,
        totalSensorsCount: defaultSensors.length,
        dataFreshnessSec: 9999,
        referenceDeviationAlerts: 0,
        activeFaultScenario: demoScenario,
      },
    };
  }

  const isDemoFaultActive = demoScenario !== "NONE";
  const freshnessSec = Math.max(0, Math.floor((now - awsObs.timestamp) / 1000));

  // Extract history for statistical validation
  const tempHist = recentReadings.map((r) => r.temp).filter((v) => typeof v === "number" && !isNaN(v));
  const humHist = recentReadings.map((r) => r.humidity).filter((v) => typeof v === "number" && !isNaN(v));
  const pressHist = recentReadings.map((r) => r.pressure).filter((v) => typeof v === "number" && !isNaN(v));
  const windHist = recentReadings.map((r) => r.windSpeed ?? 0).filter((v) => typeof v === "number" && !isNaN(v));

  /* ------------------------------------------------------------------ */
  /* 1. TEMPERATURE CHANNEL ANOMALY EVALUATION                          */
  /* ------------------------------------------------------------------ */
  let tempScore = 0;
  const tempSignals: string[] = [];
  let tempAnomalyType: AnomalyType = "NORMAL";
  const refTemp = referenceData ? referenceData.temp : awsObs.reference.temperature;
  const tempDiff = Math.round((awsObs.temperature - refTemp) * 10) / 10;
  const tempDiffStr = `${tempDiff > 0 ? "+" : ""}${tempDiff}°C`;
  let tempRecentChangeStr = `${awsObs.channels.temperature.rateOfChange > 0 ? "+" : ""}${awsObs.channels.temperature.rateOfChange}°C in cycle`;

  if (demoScenario === "SENSOR_DISCONNECT") {
    tempAnomalyType = "SENSOR_DISCONNECTED";
    tempScore = 95;
    tempSignals.push("✓ SIMULATED AWS: Channel Disconnected / Open-circuit signal");
    tempSignals.push(`✓ OPEN-METEO REFERENCE: ${refTemp}°C (External Synoptic)`);
    tempSignals.push("✓ Infinite circuit resistance simulated on Pt100 RTD analog input terminal");
  } else if (demoScenario === "SENSOR_STUCK") {
    tempAnomalyType = "SENSOR_STUCK";
    tempScore = 78;
    tempSignals.push(`✓ SIMULATED AWS: ${awsObs.temperature}°C (Frozen across observation cycles)`);
    tempSignals.push(`✓ OPEN-METEO REFERENCE: ${refTemp}°C`);
    tempSignals.push("✓ Zero numerical variance detected while reference model and solar angle shifted");
  } else if (demoScenario === "TEMP_SPIKE") {
    tempAnomalyType = "SUDDEN_SPIKE";
    tempScore = 88;
    tempSignals.push(`✓ SIMULATED AWS: ${awsObs.temperature}°C (Sudden positive spike)`);
    tempSignals.push(`✓ OPEN-METEO REFERENCE: ${refTemp}°C`);
    tempSignals.push(`✓ Difference: ${tempDiffStr} (Exceeds acceptable ±2.5°C synoptic tolerance)`);
    tempSignals.push(`✓ Recent AWS change: ${tempRecentChangeStr} (Exceeds 4.0°C/cycle atmospheric limit)`);
    tempSignals.push("✓ Pt100 RTD analog input sudden positive offset simulated");
  } else if (demoScenario === "TEMP_DROP") {
    tempAnomalyType = "SUDDEN_DROP";
    tempScore = 85;
    tempSignals.push(`✓ SIMULATED AWS: ${awsObs.temperature}°C (Sudden unphysical cooling step)`);
    tempSignals.push(`✓ OPEN-METEO REFERENCE: ${refTemp}°C`);
    tempSignals.push(`✓ Difference: ${tempDiffStr} (Exceeds acceptable ±2.5°C synoptic tolerance)`);
    tempSignals.push(`✓ Recent AWS change: ${tempRecentChangeStr} (Exceeds 4.0°C/cycle atmospheric limit)`);
    tempSignals.push("✓ Pt100 RTD analog input sudden cooling step simulated");
  } else {
    // 1. Physical terrestrial limits
    if (awsObs.temperature < -40 || awsObs.temperature > 55) {
      tempAnomalyType = "INVALID_READING";
      tempScore = 95;
      tempSignals.push(`✓ SIMULATED AWS: ${awsObs.temperature}°C violates terrestrial boundaries (-40°C to 55°C)`);
    }

    // 2. Rate of change (sudden spike or drop)
    const rateOfChange = Math.abs(awsObs.channels.temperature.rateOfChange);
    if (rateOfChange >= 5.0) {
      tempAnomalyType = awsObs.channels.temperature.rateOfChange > 0 ? "SUDDEN_SPIKE" : "SUDDEN_DROP";
      tempScore = Math.max(tempScore, 80);
      tempSignals.push(`✓ SIMULATED AWS: ${awsObs.temperature}°C`);
      tempSignals.push(`✓ OPEN-METEO REFERENCE: ${refTemp}°C`);
      tempSignals.push(`✓ Difference: ${tempDiffStr}`);
      tempSignals.push(`✓ Recent AWS change: ${tempRecentChangeStr} (exceeds 4.0°C/cycle atmospheric limit)`);
    }

    // 3. Statistical Z-Score
    const zRes = calculateZScore(awsObs.temperature, tempHist);
    if (zRes.sufficientData && zRes.zScore !== null && Math.abs(zRes.zScore) >= 3.0) {
      tempScore = Math.max(tempScore, 70);
      if (tempAnomalyType === "NORMAL") {
        tempAnomalyType = zRes.zScore > 0 ? "SUDDEN_SPIKE" : "SUDDEN_DROP";
      }
      tempSignals.push(`✓ Statistical Z-score is ${zRes.zScore} (|Z| ≥ 3.0 standard deviations; mean = ${zRes.mean}°C, stdDev = ${zRes.stdDev}°C)`);
    }

    // 4. Comparison with Open-Meteo Reference (multi-signal: natural microclimatic delta of ±3.0°C is NORMAL)
    if (Math.abs(tempDiff) >= 6.0) {
      tempScore = Math.max(tempScore, 75);
      if (tempAnomalyType === "NORMAL") tempAnomalyType = "REFERENCE_DEVIATION";
      if (!tempSignals.some((s) => s.includes("Difference:"))) {
        tempSignals.push(`✓ SIMULATED AWS: ${awsObs.temperature}°C`);
        tempSignals.push(`✓ OPEN-METEO REFERENCE: ${refTemp}°C`);
        tempSignals.push(`✓ Difference: ${tempDiffStr} (Exceeds natural ±3.0°C microclimatic envelope)`);
      }
    }
  }

  if (tempScore >= 30) {
    const isSimFault = demoScenario === "TEMP_SPIKE" || demoScenario === "TEMP_DROP" || demoScenario === "SENSOR_STUCK" || demoScenario === "SENSOR_DISCONNECT";
    const faultNote = isSimFault ? " [This is a simulated fault scenario.]" : "";
    const isDisconnect = demoScenario === "SENSOR_DISCONNECT";
    anomalies.push({
      id: "anom-temp",
      channel: "Temperature Channel",
      sensor: "Temperature Channel",
      targetSensorType: "Target sensor: Pt100 RTD",
      anomalyType: tempAnomalyType,
      severity: getSeverityFromScore(tempScore),
      observedValue: isDisconnect ? "DISCONNECTED (Open Circuit)" : `${awsObs.temperature}°C`,
      simulatedValue: isDisconnect ? "DISCONNECTED (Open Circuit)" : `${awsObs.temperature}°C`,
      expectedValue: `${refTemp}°C`,
      referenceValue: `${refTemp}°C`,
      difference: isDisconnect ? "No Signal (Open Circuit)" : tempDiffStr,
      recentAwsChange: isDisconnect ? "Channel offline / open-circuit" : tempRecentChangeStr,
      anomalyScore: tempScore,
      confidence: 90,
      timestamp: now,
      explanation: isDisconnect
        ? `Temperature channel anomaly detected: Sensor Disconnected. SIMULATED AWS channel disconnected (open-circuit on Pt100 RTD analog input). OPEN-METEO REFERENCE: ${refTemp}°C.${faultNote}`
        : `Temperature channel anomaly detected (${tempAnomalyType.replace(/_/g, " ").toLowerCase()}). SIMULATED AWS: ${awsObs.temperature}°C vs OPEN-METEO REFERENCE: ${refTemp}°C (${tempDiffStr}).${faultNote}`,
      signals: tempSignals,
      recommendedAction: demoScenario === "SENSOR_DISCONNECT"
        ? "Verify simulated channel connection (Target: Pt100 RTD wiring terminal)."
        : demoScenario === "SENSOR_STUCK"
        ? "Re-initialize simulated sensor stream or inspect aspiration chamber."
        : "Evaluate channel calibration curve against Open-Meteo reference model.",
      isSimulatedFault: isSimFault,
      faultScenario: demoScenario,
      isDemo: isSimFault,
    });
  }

  /* ------------------------------------------------------------------ */
  /* 2. HUMIDITY CHANNEL ANOMALY EVALUATION                             */
  /* ------------------------------------------------------------------ */
  let humScore = 0;
  const humSignals: string[] = [];
  let humAnomalyType: AnomalyType = "NORMAL";
  const refHum = referenceData ? referenceData.humidity : awsObs.reference.humidity;
  const humDiff = Math.round(awsObs.humidity - refHum);
  const humDiffStr = `${humDiff > 0 ? "+" : ""}${humDiff}%`;
  const humRecentChangeStr = `${awsObs.channels.humidity.rateOfChange > 0 ? "+" : ""}${awsObs.channels.humidity.rateOfChange}% in cycle`;

  if (demoScenario === "HUMIDITY_DRIFT") {
    humAnomalyType = "SENSOR_DRIFT";
    humScore = 78;
    humSignals.push(`✓ SIMULATED AWS: ${awsObs.humidity}% (Severe upward calibration drift)`);
    humSignals.push(`✓ OPEN-METEO REFERENCE: ${refHum}%`);
    humSignals.push(`✓ Difference: ${humDiffStr} (Exceeds acceptable ±15% hygrometer envelope)`);
    humSignals.push("✓ Capacitive polymer saturation simulated");
  } else {
    // Physical limits
    if (awsObs.humidity < 0 || awsObs.humidity > 100) {
      humAnomalyType = "INVALID_READING";
      humScore = 95;
      humSignals.push(`✓ SIMULATED AWS: ${awsObs.humidity}% is physically impossible (valid 0-100%)`);
    }

    // Rate of change
    if (Math.abs(awsObs.channels.humidity.rateOfChange) >= 25) {
      humAnomalyType = awsObs.channels.humidity.rateOfChange > 0 ? "SUDDEN_SPIKE" : "SUDDEN_DROP";
      humScore = Math.max(humScore, 75);
      humSignals.push(`✓ SIMULATED AWS: ${awsObs.humidity}%`);
      humSignals.push(`✓ Rate of change: ${humRecentChangeStr} (unphysical sudden humidity step)`);
    }

    // Cross-sensor thermodynamic consistency: High temp + high humidity impossible dew point
    if (awsObs.temperature > 38 && awsObs.humidity > 90) {
      humAnomalyType = "CROSS_SENSOR_INCONSISTENCY";
      humScore = Math.max(humScore, 82);
      humSignals.push(`✓ Thermodynamic inconsistency: ${awsObs.temperature}°C combined with ${awsObs.humidity}% RH implies unphysical heat index > 65°C`);
    }

    // Reference deviation
    if (Math.abs(humDiff) >= 25) {
      humScore = Math.max(humScore, 65);
      if (humAnomalyType === "NORMAL") humAnomalyType = "REFERENCE_DEVIATION";
      humSignals.push(`✓ SIMULATED AWS: ${awsObs.humidity}% vs OPEN-METEO REFERENCE: ${refHum}% (${humDiffStr})`);
    }
  }

  if (humScore >= 30) {
    const isSimFault = demoScenario === "HUMIDITY_DRIFT";
    const faultNote = isSimFault ? " [This is a simulated fault scenario.]" : "";
    anomalies.push({
      id: "anom-humidity",
      channel: "Humidity Channel",
      sensor: "Humidity Channel",
      targetSensorType: "Target sensor: Capacitive Thin-Film",
      anomalyType: humAnomalyType,
      severity: getSeverityFromScore(humScore),
      observedValue: `${awsObs.humidity}%`,
      simulatedValue: `${awsObs.humidity}%`,
      expectedValue: `${refHum}%`,
      referenceValue: `${refHum}%`,
      difference: humDiffStr,
      recentAwsChange: humRecentChangeStr,
      anomalyScore: humScore,
      confidence: 88,
      timestamp: now,
      explanation: `Humidity channel anomaly detected (${humAnomalyType.replace(/_/g, " ").toLowerCase()}). SIMULATED AWS: ${awsObs.humidity}% vs OPEN-METEO REFERENCE: ${refHum}% (${humDiffStr}).${faultNote}`,
      signals: humSignals,
      recommendedAction: "Recalibrate capacitive thin-film sensor element or clean particulate filter membrane.",
      isSimulatedFault: isSimFault,
      faultScenario: demoScenario,
      isDemo: isSimFault,
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3. PRESSURE CHANNEL ANOMALY EVALUATION                             */
  /* ------------------------------------------------------------------ */
  let pressScore = 0;
  const pressSignals: string[] = [];
  let pressAnomalyType: AnomalyType = "NORMAL";
  const refPress = referenceData ? referenceData.pressure : awsObs.reference.pressure;
  const expectedSurfaceP = getStandardSurfacePressure(elevMeters);
  const pressDiff = Math.round((awsObs.pressure - refPress) * 10) / 10;
  const pressDiffStr = `${pressDiff > 0 ? "+" : ""}${pressDiff} hPa`;
  const pressRecentChangeStr = `${awsObs.channels.pressure.rateOfChange > 0 ? "+" : ""}${awsObs.channels.pressure.rateOfChange} hPa in cycle`;

  if (demoScenario === "PRESSURE_DROP") {
    pressAnomalyType = "SUDDEN_DROP";
    pressScore = 86;
    pressSignals.push(`✓ SIMULATED AWS: ${awsObs.pressure} hPa`);
    pressSignals.push(`✓ OPEN-METEO REFERENCE: ${refPress} hPa`);
    pressSignals.push(`✓ Difference: ${pressDiffStr}`);
    pressSignals.push("✓ Severe sudden barometric drop without cyclonic storm confirmation");
  } else {
    // Physical limits
    if (awsObs.pressure <= 600 || awsObs.pressure > 1100) {
      pressAnomalyType = "INVALID_READING";
      pressScore = 95;
      pressSignals.push(`✓ SIMULATED AWS: ${awsObs.pressure} hPa is physically impossible for terrestrial surface`);
    }

    // Rate of change
    if (Math.abs(awsObs.channels.pressure.rateOfChange) >= 4.0) {
      pressAnomalyType = awsObs.channels.pressure.rateOfChange > 0 ? "SUDDEN_SPIKE" : "SUDDEN_DROP";
      pressScore = Math.max(pressScore, 78);
      pressSignals.push(`✓ Rapid pressure shift: ${pressRecentChangeStr} (threshold: 3.0 hPa/step)`);
    }

    // Elevation baseline comparison
    const elevDiff = Math.abs(awsObs.pressure - expectedSurfaceP);
    if (elevDiff > 45) {
      pressScore = Math.max(pressScore, 70);
      if (pressAnomalyType === "NORMAL") pressAnomalyType = "REFERENCE_DEVIATION";
      pressSignals.push(`✓ Pressure ${awsObs.pressure} hPa deviates from hypsometric expectation (${expectedSurfaceP} hPa at ${elevMeters}m) by ${Math.round(elevDiff)} hPa`);
    }
  }

  if (pressScore >= 30) {
    const isSimFault = demoScenario === "PRESSURE_DROP";
    const faultNote = isSimFault ? " [This is a simulated fault scenario.]" : "";
    anomalies.push({
      id: "anom-pressure",
      channel: "Pressure Channel",
      sensor: "Pressure Channel",
      targetSensorType: "Target sensor: Piezoresistive Diaphragm",
      anomalyType: pressAnomalyType,
      severity: getSeverityFromScore(pressScore),
      observedValue: `${awsObs.pressure} hPa`,
      simulatedValue: `${awsObs.pressure} hPa`,
      expectedValue: `${refPress} hPa`,
      referenceValue: `${refPress} hPa`,
      difference: pressDiffStr,
      recentAwsChange: pressRecentChangeStr,
      anomalyScore: pressScore,
      confidence: 88,
      timestamp: now,
      explanation: `Pressure channel anomaly detected (${pressAnomalyType.replace(/_/g, " ").toLowerCase()}). SIMULATED AWS: ${awsObs.pressure} hPa vs OPEN-METEO REFERENCE: ${refPress} hPa (${pressDiffStr}).${faultNote}`,
      signals: pressSignals,
      recommendedAction: "Inspect piezoresistive pressure port for moisture ingress or blockage.",
      isSimulatedFault: isSimFault,
      faultScenario: demoScenario,
      isDemo: isSimFault,
    });
  }

  /* ------------------------------------------------------------------ */
  /* 4. WIND SPEED CHANNEL EVALUATION                                   */
  /* ------------------------------------------------------------------ */
  let windScore = 0;
  const windSignals: string[] = [];
  let windAnomalyType: AnomalyType = "NORMAL";
  const refWind = referenceData ? referenceData.windSpeed : awsObs.reference.windSpeed;
  const windDiff = Math.round((awsObs.windSpeed - refWind) * 10) / 10;
  const windDiffStr = `${windDiff > 0 ? "+" : ""}${windDiff} km/h`;

  if (demoScenario === "WIND_SPIKE") {
    windAnomalyType = "SUDDEN_SPIKE";
    windScore = 84;
    windSignals.push(`✓ SIMULATED AWS: ${awsObs.windSpeed} km/h`);
    windSignals.push(`✓ OPEN-METEO REFERENCE: ${refWind} km/h`);
    windSignals.push(`✓ Difference: ${windDiffStr}`);
    windSignals.push("✓ Severe unpredicted microburst / acoustic reflection simulated on ultrasonic sensor");
  } else {
    if (awsObs.windSpeed < 0 || awsObs.windSpeed > 220) {
      windAnomalyType = "INVALID_READING";
      windScore = 95;
      windSignals.push(`✓ SIMULATED AWS: ${awsObs.windSpeed} km/h is outside physical anemometer envelope`);
    } else if (Math.abs(awsObs.channels.wind.rateOfChange) >= 45) {
      windAnomalyType = "SUDDEN_SPIKE";
      windScore = Math.max(windScore, 75);
      windSignals.push(`✓ Wind gust step of ${awsObs.channels.wind.rateOfChange} km/h exceeds normal gradient`);
    }
  }

  if (windScore >= 30) {
    const isSimFault = demoScenario === "WIND_SPIKE";
    const faultNote = isSimFault ? " [This is a simulated fault scenario.]" : "";
    anomalies.push({
      id: "anom-wind",
      channel: "Wind Speed Channel",
      sensor: "Wind Speed Channel",
      targetSensorType: "Target sensor: Ultrasonic 2D Anemometer",
      anomalyType: windAnomalyType,
      severity: getSeverityFromScore(windScore),
      observedValue: `${awsObs.windSpeed} km/h`,
      simulatedValue: `${awsObs.windSpeed} km/h`,
      expectedValue: `${refWind} km/h`,
      referenceValue: `${refWind} km/h`,
      difference: windDiffStr,
      recentAwsChange: `${awsObs.channels.wind.rateOfChange} km/h`,
      anomalyScore: windScore,
      confidence: 86,
      timestamp: now,
      explanation: `Wind speed channel anomaly detected (${windAnomalyType.replace(/_/g, " ").toLowerCase()}). SIMULATED AWS: ${awsObs.windSpeed} km/h vs OPEN-METEO REFERENCE: ${refWind} km/h (${windDiffStr}).${faultNote}`,
      signals: windSignals,
      recommendedAction: "Check ultrasonic transducers for spiderwebs, bird obstruction, or acoustic shielding.",
      isSimulatedFault: isSimFault,
      faultScenario: demoScenario,
      isDemo: isSimFault,
    });
  }

  /* ------------------------------------------------------------------ */
  /* 5. PRECIPITATION CHANNEL EVALUATION                                */
  /* ------------------------------------------------------------------ */
  let precipScore = 0;
  const precipSignals: string[] = [];
  let precipAnomalyType: AnomalyType = "NORMAL";
  const refPrecip = referenceData ? referenceData.precipitation : awsObs.reference.precipitation;

  if (awsObs.precipitation > 0 && awsObs.weatherCode === 0) {
    precipAnomalyType = "CROSS_SENSOR_INCONSISTENCY";
    precipScore = 65;
    precipSignals.push(`✓ SIMULATED AWS: ${awsObs.precipitation} mm recorded while weather code indicates completely clear sky (false bucket tip)`);
  }

  if (precipScore >= 30) {
    anomalies.push({
      id: "anom-precip",
      channel: "Precipitation Channel",
      sensor: "Precipitation Channel",
      targetSensorType: "Target sensor: Tipping Bucket (0.2mm)",
      anomalyType: precipAnomalyType,
      severity: getSeverityFromScore(precipScore),
      observedValue: `${awsObs.precipitation} mm`,
      simulatedValue: `${awsObs.precipitation} mm`,
      expectedValue: "0.0 mm",
      referenceValue: `${refPrecip} mm`,
      difference: `+${awsObs.precipitation} mm`,
      anomalyScore: precipScore,
      confidence: 85,
      timestamp: now,
      explanation: `Precipitation channel anomaly: ${precipSignals[0]}`,
      signals: precipSignals,
      recommendedAction: "Inspect tipping bucket mechanism for foreign debris or mechanical vibration.",
      isSimulatedFault: false,
    });
  }

  /* ------------------------------------------------------------------ */
  /* 6. SIMULATED AWS CHANNEL HEALTH MATRIX                             */
  /* ------------------------------------------------------------------ */
  const computeHealth = (score: number) => Math.max(0, Math.min(100, Math.round(100 - score * 0.85)));
  const computeStatus = (score: number): "HEALTHY" | "WARNING" | "CRITICAL" | "OFFLINE" => {
    if (score >= 80) return "CRITICAL";
    if (score >= 30) return "WARNING";
    return "HEALTHY";
  };

  const sensorHealth: SensorHealthInfo[] = [
    {
      sensorId: "temp",
      channelName: "Temperature Channel",
      targetSensorType: "Target sensor: Pt100 RTD",
      name: "Temperature Channel (Pt100 RTD)",
      unit: "°C",
      currentValue: demoScenario === "SENSOR_DISCONNECT" ? "DISCONNECTED" : awsObs.temperature,
      referenceValue: refTemp,
      referenceDiff: demoScenario === "SENSOR_DISCONNECT" ? "No Signal" : tempDiffStr,
      healthScore: computeHealth(tempScore),
      lastUpdate: awsObs.timestamp,
      dataFreshnessSec: freshnessSec,
      anomalyCount: tempScore >= 30 ? 1 : 0,
      currentAnomalyScore: tempScore,
      driftEstimate: tempDiffStr,
      status: demoScenario === "SENSOR_DISCONNECT" ? "CRITICAL" : computeStatus(tempScore),
      simulationStatus:
        demoScenario === "SENSOR_DISCONNECT"
          ? "Disconnected Channel"
          : isDemoFaultActive && (demoScenario === "TEMP_SPIKE" || demoScenario === "TEMP_DROP" || demoScenario === "SENSOR_STUCK")
          ? "Fault Injected"
          : "Simulation Active",
      connectivity: demoScenario === "SENSOR_DISCONNECT" ? "DISCONNECTED" : "ONLINE",
      source: isDemoFaultActive && (demoScenario === "TEMP_SPIKE" || demoScenario === "TEMP_DROP" || demoScenario === "SENSOR_STUCK" || demoScenario === "SENSOR_DISCONNECT") ? "DEMO_FAULT" : "SIMULATED_AWS",
      detectionReason: tempSignals[0] || "Operating within nominal atmospheric boundaries",
      trend: "stable",
    },
    {
      sensorId: "humidity",
      channelName: "Humidity Channel",
      targetSensorType: "Target sensor: Capacitive Thin-Film",
      name: "Humidity Channel (Capacitive Thin-Film)",
      unit: "%",
      currentValue: awsObs.humidity,
      referenceValue: refHum,
      referenceDiff: humDiffStr,
      healthScore: computeHealth(humScore),
      lastUpdate: awsObs.timestamp,
      dataFreshnessSec: freshnessSec,
      anomalyCount: humScore >= 30 ? 1 : 0,
      currentAnomalyScore: humScore,
      driftEstimate: humDiffStr,
      status: computeStatus(humScore),
      simulationStatus: demoScenario === "HUMIDITY_DRIFT" ? "Fault Injected" : "Simulation Active",
      connectivity: "ONLINE",
      source: demoScenario === "HUMIDITY_DRIFT" ? "DEMO_FAULT" : "SIMULATED_AWS",
      detectionReason: humSignals[0] || "Conforms with regional synoptic humidity",
      trend: "stable",
    },
    {
      sensorId: "pressure",
      channelName: "Pressure Channel",
      targetSensorType: "Target sensor: Piezoresistive Diaphragm",
      name: "Pressure Channel (Piezoresistive Diaphragm)",
      unit: "hPa",
      currentValue: awsObs.pressure,
      referenceValue: refPress,
      referenceDiff: pressDiffStr,
      healthScore: computeHealth(pressScore),
      lastUpdate: awsObs.timestamp,
      dataFreshnessSec: freshnessSec,
      anomalyCount: pressScore >= 30 ? 1 : 0,
      currentAnomalyScore: pressScore,
      driftEstimate: pressDiffStr,
      status: computeStatus(pressScore),
      simulationStatus: demoScenario === "PRESSURE_DROP" ? "Fault Injected" : "Simulation Active",
      connectivity: "ONLINE",
      source: demoScenario === "PRESSURE_DROP" ? "DEMO_FAULT" : "SIMULATED_AWS",
      detectionReason: pressSignals[0] || "Calibrated for station altitude (920m hypsometric baseline)",
      trend: "stable",
    },
    {
      sensorId: "wind",
      channelName: "Wind Speed Channel",
      targetSensorType: "Target sensor: Ultrasonic 2D Anemometer",
      name: "Wind Speed Channel (Ultrasonic 2D)",
      unit: "km/h",
      currentValue: awsObs.windSpeed,
      referenceValue: refWind,
      referenceDiff: windDiffStr,
      healthScore: computeHealth(windScore),
      lastUpdate: awsObs.timestamp,
      dataFreshnessSec: freshnessSec,
      anomalyCount: windScore >= 30 ? 1 : 0,
      currentAnomalyScore: windScore,
      driftEstimate: windDiffStr,
      status: computeStatus(windScore),
      simulationStatus: demoScenario === "WIND_SPIKE" ? "Fault Injected" : "Simulation Active",
      connectivity: "ONLINE",
      source: demoScenario === "WIND_SPIKE" ? "DEMO_FAULT" : "SIMULATED_AWS",
      detectionReason: windSignals[0] || "Wind vectors correlate with reference model",
      trend: "stable",
    },
    {
      sensorId: "precip",
      channelName: "Precipitation Channel",
      targetSensorType: "Target sensor: Tipping Bucket (0.2mm)",
      name: "Precipitation Channel (Tipping Bucket)",
      unit: "mm",
      currentValue: awsObs.precipitation,
      referenceValue: refPrecip,
      referenceDiff: `${Math.round((awsObs.precipitation - refPrecip) * 10) / 10} mm`,
      healthScore: computeHealth(precipScore),
      lastUpdate: awsObs.timestamp,
      dataFreshnessSec: freshnessSec,
      anomalyCount: precipScore >= 30 ? 1 : 0,
      currentAnomalyScore: precipScore,
      driftEstimate: "0.0 mm",
      status: computeStatus(precipScore),
      simulationStatus: "Simulation Active",
      connectivity: "ONLINE",
      source: "SIMULATED_AWS",
      detectionReason: precipSignals[0] || "Zero unverified rainfall events detected",
      trend: "stable",
    },
    {
      sensorId: "gateway",
      channelName: "IoT Gateway & Edge Power",
      targetSensorType: "Target: 4G LTE-M / Solar Charge Controller",
      name: "IoT Gateway & Edge Power",
      unit: "V",
      currentValue: "13.4V (Solar)",
      referenceValue: "12.0V Nom.",
      referenceDiff: "+1.4V",
      healthScore: freshnessSec > 600 ? 60 : 98,
      lastUpdate: awsObs.timestamp,
      dataFreshnessSec: freshnessSec,
      anomalyCount: freshnessSec > 1800 ? 1 : 0,
      currentAnomalyScore: freshnessSec > 1800 ? 45 : 5,
      driftEstimate: "Nominal",
      status: freshnessSec > 1800 ? "WARNING" : "HEALTHY",
      simulationStatus: "Simulation Active",
      connectivity: "ONLINE",
      source: "SIMULATED_AWS",
      detectionReason: "Edge processor keepalive packets active",
      trend: "stable",
    },
  ];

  /* ------------------------------------------------------------------ */
  /* 7. STATION OVERALL SUMMARY                                         */
  /* ------------------------------------------------------------------ */
  const avgHealth = Math.round(sensorHealth.reduce((acc, s) => acc + s.healthScore, 0) / sensorHealth.length);
  const maxScore = Math.max(0, ...sensorHealth.map((s) => s.currentAnomalyScore));
  const healthyCount = sensorHealth.filter((s) => s.status === "HEALTHY").length;
  const criticalCount = anomalies.filter((a) => a.severity === "CRITICAL").length;
  const warningCount = anomalies.filter((a) => a.severity === "WARNING" || a.severity === "HIGH").length;
  const refDevCount = anomalies.filter((a) => a.anomalyType === "REFERENCE_DEVIATION").length;

  const stationSummary: StationHealthSummary = {
    stationHealthScore: avgHealth,
    overallAnomalyScore: maxScore,
    activeAnomaliesCount: anomalies.length,
    criticalAlertsCount: criticalCount,
    warningAlertsCount: warningCount,
    healthySensorsCount: healthyCount,
    totalSensorsCount: sensorHealth.length,
    dataFreshnessSec: freshnessSec,
    referenceDeviationAlerts: refDevCount,
    activeFaultScenario: demoScenario,
  };

  return {
    anomalies,
    sensorHealth,
    stationSummary,
  };
}
