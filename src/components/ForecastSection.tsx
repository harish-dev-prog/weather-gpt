import React from "react";
import { DailyForecastDay, Units } from "../types";
import { Sun, Cloud, CloudRain, Wind, Droplets } from "lucide-react";

interface ForecastSectionProps {
  forecast: DailyForecastDay[];
  units: Units;
}

export function ForecastSection({ forecast, units }: ForecastSectionProps) {
  if (!forecast || forecast.length === 0) return null;

  const cToF = (c: number) => Math.round(((c * 9) / 5 + 32) * 10) / 10;

  return (
    <div
      id="section-7day-forecast"
      style={{
        background: "#0f172a",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "10px",
        padding: "18px 20px",
        marginTop: "16px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div>
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
            7-Day Meteorological Forecast (Open-Meteo Synoptic Prediction)
          </h2>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
            Forecast baseline used for long-range sensor drift comparison and anomaly predictive modeling.
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))",
          gap: "10px",
        }}
      >
        {forecast.map((day, idx) => {
          const maxT = units.temp === "F" ? cToF(day.maxTemp) : day.maxTemp;
          const minT = units.temp === "F" ? cToF(day.minTemp) : day.minTemp;

          return (
            <div
              key={day.date}
              id={`forecast-day-${day.date}`}
              style={{
                background: idx === 0 ? "rgba(56, 189, 248, 0.08)" : "rgba(255, 255, 255, 0.02)",
                border: `1px solid ${idx === 0 ? "rgba(56, 189, 248, 0.3)" : "rgba(255, 255, 255, 0.05)"}`,
                borderRadius: "8px",
                padding: "12px 10px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 600, color: idx === 0 ? "#38bdf8" : "#cbd5e1" }}>
                {day.dayName}
              </span>
              <span style={{ fontSize: "10.5px", color: "#64748b" }}>
                {day.date.slice(5)}
              </span>

              <div style={{ margin: "4px 0" }}>
                {day.precipProb > 40 ? (
                  <CloudRain size={22} color="#38bdf8" />
                ) : day.weatherCondition.toLowerCase().includes("cloud") ? (
                  <Cloud size={22} color="#94a3b8" />
                ) : (
                  <Sun size={22} color="#fbbf24" />
                )}
              </div>

              <div style={{ fontSize: "13px", fontWeight: 700, color: "#f8fafc" }}>
                {maxT}° / <span style={{ color: "#94a3b8", fontWeight: 500 }}>{minT}°</span>
              </div>

              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", display: "flex", alignItems: "center", gap: "3px" }}>
                <Droplets size={11} color="#38bdf8" />
                {day.precipProb}% Rain
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
