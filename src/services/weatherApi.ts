import { OpenMeteoResponse, CurrentWeatherTelemetry, Reading, DailyForecastDay } from "../types";

/**
 * Maps WMO weather codes to human-readable weather descriptions.
 * Useful for internal telemetry and future WeatherGPT conversational features.
 */
export function getWeatherCondition(code: number): string {
  switch (code) {
    case 0:
      return "Clear sky";
    case 1:
      return "Mainly clear";
    case 2:
      return "Partly cloudy";
    case 3:
      return "Overcast";
    case 45:
      return "Fog";
    case 48:
      return "Depositing rime fog";
    case 51:
      return "Light drizzle";
    case 53:
      return "Moderate drizzle";
    case 55:
      return "Dense drizzle";
    case 56:
    case 57:
      return "Freezing drizzle";
    case 61:
      return "Slight rain";
    case 63:
      return "Moderate rain";
    case 65:
      return "Heavy rain";
    case 66:
    case 67:
      return "Freezing rain";
    case 71:
      return "Slight snow fall";
    case 73:
      return "Moderate snow fall";
    case 75:
      return "Heavy snow fall";
    case 77:
      return "Snow grains";
    case 80:
      return "Slight rain showers";
    case 81:
      return "Moderate rain showers";
    case 82:
      return "Violent rain showers";
    case 85:
    case 86:
      return "Snow showers";
    case 95:
      return "Thunderstorm";
    case 96:
    case 99:
      return "Thunderstorm with slight or heavy hail";
    default:
      return "Clear";
  }
}

/**
 * Fetches real weather data from the Open-Meteo API.
 * Prepared with dynamic latitude and longitude so different station coordinates can be queried.
 */
export async function fetchWeatherData(
  latitude = 12.9716,
  longitude = 77.5946
): Promise<{
  current: CurrentWeatherTelemetry;
  hourlyReadings: Reading[];
  dailyForecast: DailyForecastDay[];
  elevation?: number;
}> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,precipitation,weather_code&hourly=temperature_2m,relative_humidity_2m,surface_pressure,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
  }

  const data: OpenMeteoResponse = await response.json();

  if (!data.current) {
    throw new Error("Invalid response format: 'current' weather data missing");
  }

  // Parse API timestamp: Open-Meteo returns ISO local string like "2026-09-09T11:30"
  let apiTimestamp = new Date(data.current.time).getTime();
  if (isNaN(apiTimestamp)) {
    apiTimestamp = Date.now();
  }

  const current: CurrentWeatherTelemetry = {
    temp: Math.round(data.current.temperature_2m * 10) / 10,
    pressure: Math.round(data.current.surface_pressure * 10) / 10,
    humidity: Math.round(data.current.relative_humidity_2m),
    windSpeed: Math.round(data.current.wind_speed_10m * 10) / 10,
    precipitation: data.current.precipitation ?? 0,
    weatherCode: data.current.weather_code,
    weatherCondition: getWeatherCondition(data.current.weather_code),
    apiTime: data.current.time,
    apiTimestamp,
    fetchedAt: Date.now(),
    dataSource: "REAL_API",
  };

  // Parse real hourly points from Open-Meteo
  const hourlyReadings: Reading[] = [];
  if (data.hourly && Array.isArray(data.hourly.time)) {
    const times = data.hourly.time;
    const temps = data.hourly.temperature_2m || [];
    const hums = data.hourly.relative_humidity_2m || [];
    const pressures = data.hourly.surface_pressure || [];
    const precipProbs = data.hourly.precipitation_probability || [];
    const codes = data.hourly.weather_code || [];

    for (let i = 0; i < times.length; i++) {
      const t = new Date(times[i]).getTime();
      if (!isNaN(t) && temps[i] !== undefined) {
        hourlyReadings.push({
          t,
          temp: Math.round(temps[i] * 10) / 10,
          pressure: Math.round((pressures[i] ?? 1013) * 10) / 10,
          humidity: Math.round(hums[i] ?? 50),
          precipitation: precipProbs[i] ?? 0,
          weatherCode: codes[i] ?? 0,
          weatherCondition: getWeatherCondition(codes[i] ?? 0),
        });
      }
    }
  }

  // Parse 7-day daily forecast
  const dailyForecast: DailyForecastDay[] = [];
  if (data.daily && Array.isArray(data.daily.time)) {
    const days = data.daily.time;
    const maxT = data.daily.temperature_2m_max || [];
    const minT = data.daily.temperature_2m_min || [];
    const pop = data.daily.precipitation_probability_max || [];
    const wind = data.daily.wind_speed_10m_max || [];
    const codes = data.daily.weather_code || [];

    for (let i = 0; i < days.length; i++) {
      const dateObj = new Date(days[i]);
      const dayName = i === 0 ? "Today" : i === 1 ? "Tomorrow" : dateObj.toLocaleDateString(undefined, { weekday: "short" });
      dailyForecast.push({
        date: days[i],
        dayName,
        maxTemp: Math.round((maxT[i] ?? 0) * 10) / 10,
        minTemp: Math.round((minT[i] ?? 0) * 10) / 10,
        precipProb: Math.round(pop[i] ?? 0),
        windSpeed: Math.round((wind[i] ?? 0) * 10) / 10,
        weatherCode: codes[i] ?? 0,
        weatherCondition: getWeatherCondition(codes[i] ?? 0),
      });
    }
  }

  return {
    current,
    hourlyReadings,
    dailyForecast,
    elevation: data.elevation,
  };
}
