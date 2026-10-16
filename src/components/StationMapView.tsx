import React from "react";
import { StationInfo } from "../types";
import { STATIONS_NETWORK, StationNetworkNode } from "../services/stationConfig";
import { MapPin, Navigation, ShieldCheck, AlertTriangle, ArrowRight, ExternalLink, Mountain } from "lucide-react";

interface StationMapViewProps {
  currentStation: StationInfo;
  onSelectStation: (station: StationNetworkNode) => void;
}

export function StationMapView({ currentStation, onSelectStation }: StationMapViewProps) {
  return (
    <div id="view-station-map" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
          Regional Station Network & Geospatial Health
        </h1>
        <p style={{ fontSize: "13.5px", color: "#94a3b8", marginTop: "4px" }}>
          Interactive monitoring of Karnataka and Western Ghats automatic weather station observatories.
        </p>
      </div>

      {/* Geospatial Map Visualization Card */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "12px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Navigation size={18} color="#38bdf8" />
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
              South India AWS Mesh Topology
            </h2>
          </div>
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
            Active Monitoring Node: <strong style={{ color: "#38bdf8" }}>{currentStation.name}</strong>
          </span>
        </div>

        {/* SVG Regional Schematic Map */}
        <div
          style={{
            width: "100%",
            height: "280px",
            background: "radial-gradient(ellipse at center, #1e293b 0%, #0b1329 100%)",
            borderRadius: "10px",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="100%" height="100%" viewBox="0 0 600 280" style={{ position: "absolute", top: 0, left: 0 }}>
            {/* Ambient topo contours */}
            <path d="M 50 180 Q 150 120 280 140 T 550 90" fill="none" stroke="rgba(56, 189, 248, 0.1)" strokeWidth="1.5" strokeDasharray="4 4" />
            <path d="M 30 220 Q 180 160 320 200 T 580 130" fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="1.5" strokeDasharray="4 4" />
            <path d="M 80 80 Q 220 50 380 70 T 560 40" fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="1.5" />

            {/* Mesh connection links */}
            <line x1="160" y1="160" x2="330" y2="120" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1.5" strokeDasharray="3 3" />
            <line x1="330" y1="120" x2="310" y2="190" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1.5" strokeDasharray="3 3" />
            <line x1="310" y1="190" x2="350" y2="240" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1.5" strokeDasharray="3 3" />
            <line x1="160" y1="160" x2="310" y2="190" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" strokeDasharray="2 2" />

            {/* Station Nodes plotted schematically */}
            {/* Mangaluru (Coastal) */}
            <g transform="translate(160, 160)" style={{ cursor: "pointer" }} onClick={() => onSelectStation(STATIONS_NETWORK[2])}>
              <circle r="14" fill="rgba(6, 182, 212, 0.2)" />
              <circle r="7" fill={currentStation.id === "AWS-003" ? "#38bdf8" : "#06b6d4"} />
              <text x="14" y="4" fill="#cbd5e1" fontSize="11" fontWeight="600">AWS-003 Mangaluru (22m)</text>
            </g>

            {/* Bengaluru (Urban) */}
            <g transform="translate(330, 120)" style={{ cursor: "pointer" }} onClick={() => onSelectStation(STATIONS_NETWORK[0])}>
              <circle r="18" fill="rgba(56, 189, 248, 0.25)" className="animate-pulse" />
              <circle r="8" fill={currentStation.id === "AWS-001" ? "#38bdf8" : "#10b981"} />
              <text x="14" y="4" fill="#ffffff" fontSize="12" fontWeight="700">AWS-001 Bengaluru (920m) ★</text>
            </g>

            {/* Mysuru (Agromet) */}
            <g transform="translate(310, 190)" style={{ cursor: "pointer" }} onClick={() => onSelectStation(STATIONS_NETWORK[1])}>
              <circle r="14" fill="rgba(16, 185, 129, 0.2)" />
              <circle r="7" fill={currentStation.id === "AWS-002" ? "#38bdf8" : "#10b981"} />
              <text x="14" y="4" fill="#cbd5e1" fontSize="11" fontWeight="600">AWS-002 Mysuru (763m)</text>
            </g>

            {/* Ooty (High-Altitude) */}
            <g transform="translate(350, 240)" style={{ cursor: "pointer" }} onClick={() => onSelectStation(STATIONS_NETWORK[3])}>
              <circle r="14" fill="rgba(139, 92, 246, 0.2)" />
              <circle r="7" fill={currentStation.id === "AWS-004" ? "#38bdf8" : "#8b5cf6"} />
              <text x="14" y="4" fill="#cbd5e1" fontSize="11" fontWeight="600">AWS-004 Ooty (2,240m)</text>
            </g>
          </svg>

          {/* Map legend in bottom corner */}
          <div
            style={{
              position: "absolute",
              bottom: "12px",
              right: "14px",
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "6px",
              padding: "6px 10px",
              fontSize: "11px",
              color: "#94a3b8",
              display: "flex",
              gap: "12px",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#38bdf8" }} /> Active Station
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} /> Healthy Node
            </span>
          </div>
        </div>
      </div>

      {/* Station Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
        {STATIONS_NETWORK.map((s) => {
          const isSelected = currentStation.id === s.id;

          return (
            <div
              key={s.id}
              id={`station-node-card-${s.id}`}
              style={{
                background: "#0f172a",
                border: `1px solid ${isSelected ? "#38bdf8" : "rgba(255, 255, 255, 0.08)"}`,
                borderRadius: "10px",
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                boxShadow: isSelected ? "0 0 15px rgba(56, 189, 248, 0.15)" : "none",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: "11.5px", color: "#38bdf8", fontWeight: 700 }}>
                    {s.id} • {s.state}
                  </div>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#f8fafc", margin: "2px 0 0 0" }}>
                    {s.name}
                  </h3>
                </div>

                <div
                  style={{
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: "#34d399",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  {s.healthScore}% Health
                </div>
              </div>

              <p style={{ fontSize: "12.5px", color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
                {s.description}
              </p>

              <div
                style={{
                  background: "rgba(0,0,0,0.25)",
                  borderRadius: "6px",
                  padding: "10px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  fontSize: "11.5px",
                }}
              >
                <div>
                  <span style={{ color: "#64748b" }}>Coordinates:</span>
                  <div style={{ color: "#cbd5e1", fontWeight: 500 }}>{s.lat}, {s.lon}</div>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Elevation:</span>
                  <div style={{ color: "#cbd5e1", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                    <Mountain size={12} color="#38bdf8" />
                    {s.elevation}
                  </div>
                </div>
              </div>

              <button
                id={`btn-select-station-${s.id}`}
                onClick={() => onSelectStation(s)}
                style={{
                  background: isSelected ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.05)",
                  border: `1px solid ${isSelected ? "#38bdf8" : "rgba(255, 255, 255, 0.1)"}`,
                  color: isSelected ? "#38bdf8" : "#cbd5e1",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  padding: "7px 12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                {isSelected ? (
                  <>
                    <ShieldCheck size={14} /> Currently Monitored
                  </>
                ) : (
                  <>
                    Connect to this Station <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
