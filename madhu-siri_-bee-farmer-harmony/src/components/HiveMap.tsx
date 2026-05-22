import React, { useState } from 'react';
import { Hive, SprayAlert } from '../types';
import { MapPin, ShieldAlert, ShieldCheck, Droplet, User, CircleHelp, Map, Plus, AlertTriangle, Layers, Crosshair } from 'lucide-react';

interface HiveMapProps {
  hives: Hive[];
  alerts: SprayAlert[];
  userRole: 'beekeeper' | 'farmer';
  selectedHiveId: string | null;
  onSelectHive: (id: string | null) => void;
  onAddHive: (latitude: number, longitude: number, name: string) => void;
  onAddAlert: (chemicalName: string, farmerName: string, latitude: number, longitude: number, radiusKm: number, durationMinutes: number) => void;
}

export default function HiveMap({
  hives,
  alerts,
  userRole,
  selectedHiveId,
  onSelectHive,
  onAddHive,
  onAddAlert,
}: HiveMapProps) {
  // Map dimensions
  const minLat = 12.4320;
  const maxLat = 12.4620;
  const minLng = 76.7630;
  const maxLng = 76.7930;

  const [clickCoord, setClickCoord] = useState<{ x: number; y: number; lat: number; lng: number } | null>(null);
  const [formName, setFormName] = useState('');
  const [formChemical, setFormChemical] = useState('Chlorpyrifos (Restricted Organophosphate)');
  const [formFarmer, setFormFarmer] = useState('');
  const [formRadius, setFormRadius] = useState(1.5);
  const [formDuration, setFormDuration] = useState(240);
  const [showTerrain, setShowTerrain] = useState(true);

  // Translate coordinate functions
  const toSvgCoords = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 600;
    const y = (1 - (lat - minLat) / (maxLat - minLat)) * 500;
    return { x, y };
  };

  const fromSvgCoords = (x: number, y: number) => {
    const lng = minLng + (x / 600) * (maxLng - minLng);
    const lat = minLat + (1 - y / 500) * (maxLat - minLat);
    return { lat, lng };
  };

  // Distance helper (Haversine in KM)
  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 600;
    const y = ((e.clientY - rect.top) / rect.height) * 500;
    const { lat, lng } = fromSvgCoords(x, y);
    setClickCoord({ x, y, lat, lng });
    setFormName(`New Hive Spot #${hives.length + 1}`);
  };

  const processHiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clickCoord && formName) {
      onAddHive(clickCoord.lat, clickCoord.lng, formName);
      setClickCoord(null);
      setFormName('');
    }
  };

  const processAlertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clickCoord && formChemical && formFarmer) {
      onAddAlert(formChemical, formFarmer, clickCoord.lat, clickCoord.lng, formRadius, formDuration);
      setClickCoord(null);
      setFormFarmer('');
    }
  };

  // Convert km radius to SVG pixels along longitude scale approximately (1 degree lat ~= 111km, 1 degree lng ~= 108km near coords)
  const kmToSvgRadius = (km: number) => {
    const degreeWidth = maxLng - minLng;
    const totalKmWidth = degreeWidth * 108.5; // conversion factor
    return (km / totalKmWidth) * 600;
  };

  // Check which alerts currently threat each hive
  const getHiveSprayStatus = (hive: Hive) => {
    const status: { isThreatened: boolean; closestAlertId: string | null; closestDistance: number } = {
      isThreatened: false,
      closestAlertId: null,
      closestDistance: 999
    };

    alerts.forEach((alert) => {
      if (alert.active) {
        const dist = getDistanceKm(alert.latitude, alert.longitude, hive.latitude, hive.longitude);
        if (dist <= alert.radiusKm) {
          status.isThreatened = true;
          if (dist < status.closestDistance) {
            status.closestDistance = dist;
            status.closestAlertId = alert.id;
          }
        }
      }
    });

    return status;
  };

  const activeAlerts = alerts.filter(a => a.active);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden flex flex-col md:flex-row h-[580px]">
      
      {/* Map Interactive Viewport */}
      <div className="flex-1 bg-[#F5F2EB] relative h-full flex flex-col">
        
        {/* Header Ribbon info */}
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap gap-2 items-center justify-between">
          <div className="bg-white/95 backdrop-blur-sm shadow-md border border-orange-100 rounded-full px-3 py-1.5 flex items-center gap-2 text-xs font-semibold text-amber-900">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Mandya Village Grid Map</span>
            <span className="text-amber-500">•</span>
            <span className="font-mono text-[11px]">Lat: {minLat.toFixed(3)}–{maxLat.toFixed(3)}</span>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setShowTerrain(!showTerrain)}
              className={`p-1.5 rounded-full shadow-md backdrop-blur-sm border transition ${
                showTerrain 
                  ? 'bg-amber-100 border-amber-300 text-amber-800' 
                  : 'bg-white/95 border-orange-100 text-amber-600 hover:bg-amber-50'
              }`}
              title="Toggle Micro Terrain Farms"
            >
              <Layers size={15} />
            </button>
            <div className="bg-amber-650 text-amber-950 font-medium px-2.5 py-1 text-[11px] rounded-full shadow-md bg-amber-200/90 border border-amber-300 flex items-center gap-1">
              <span>{userRole === 'beekeeper' ? '🐝 Beekeeper Yard' : '🚜 Farmer Tractor GPS'}</span>
            </div>
          </div>
        </div>

        {/* The SVG Ground Map Canvas */}
        <div className="flex-1 w-full h-full relative cursor-crosshair overflow-hidden select-none">
          <svg 
            viewBox="0 0 600 500" 
            className="w-full h-full"
            onClick={handleMapClick}
          >
            {/* 1. Base Soil Terrain Layout (Farms and Village Roads) */}
            {showTerrain && (
              <>
                {/* Background pasture grass */}
                <rect width="600" height="500" fill="#EAE5DA" />
                
                {/* Fields/Farms layout blocks */}
                <rect x="20" y="40" width="180" height="130" fill="#DFD9CA" rx="4" opacity="0.8" />
                <path d="M 20 60 L 200 60 L 200 130" stroke="#CDD0C0" strokeWidth="1" strokeDasharray="3" fill="none" />
                <path d="M 20 100 L 200 100" stroke="#CDD0C0" strokeWidth="1" strokeDasharray="3" fill="none" />
                <text x="30" y="55" className="fill-amber-950/40 text-[9px] font-mono select-none">Sugarcane Crop Field A</text>

                <rect x="280" y="20" width="280" height="160" fill="#E4DEC9" rx="8" opacity="0.9" />
                {/* crop row lines */}
                {Array.from({ length: 14 }).map((_, i) => (
                  <line 
                    key={i} 
                    x1={290 + i * 20} 
                    y1={30} 
                    x2={290 + i * 18 + 10} 
                    y2={170} 
                    stroke="#D0C4A4" 
                    strokeWidth="1.5" 
                  />
                ))}
                <text x="295" y="45" className="fill-emerald-950/40 text-[9px] font-semibold bg-white px-1">Organic Paddy Sector B</text>

                {/* River Cauvery stream channel through map */}
                <path 
                  d="M -10 320 C 150 330, 240 280, 380 430 C 450 490, 520 510, 610 510" 
                  fill="none" 
                  stroke="#BCD4E6" 
                  strokeWidth="24" 
                  strokeLinecap="round" 
                  opacity="0.85" 
                />
                <path 
                  d="M -10 320 C 150 330, 240 280, 380 430 C 450 490, 520 510, 610 510" 
                  fill="none" 
                  stroke="#99C1DE" 
                  strokeWidth="6" 
                  strokeLinecap="round" 
                  opacity="0.9" 
                />
                
                {/* Village Dirt Road outline */}
                <path 
                  d="M 220 -10 C 210 180, 240 250, 260 300 C 280 340, 180 420, 25 510" 
                  fill="none" 
                  stroke="#DDD6C5" 
                  strokeWidth="10" 
                  opacity="0.7" 
                />
                
                {/* Forest Sage area */}
                <circle cx="120" cy="420" r="80" fill="#C2D5A7" opacity="0.7" />
                <circle cx="60" cy="450" r="50" fill="#A7C957" opacity="0.6" />
                <text x="70" y="415" className="fill-emerald-800/40 text-[10px] font-bold">Bramhagiri Native Forest</text>
              </>
            )}

            {/* Grid Coordinates helper rings */}
            <g opacity="0.1">
              <line x1="100" y1="0" x2="100" y2="500" stroke="#000" />
              <line x1="200" y1="0" x2="200" y2="500" stroke="#000" />
              <line x1="300" y1="0" x2="300" y2="500" stroke="#000" />
              <line x1="400" y1="0" x2="400" y2="500" stroke="#000" />
              <line x1="500" y1="0" x2="500" y2="500" stroke="#000" />
              
              <line x1="0" y1="100" x2="600" y2="100" stroke="#000" />
              <line x1="0" y1="200" x2="600" y2="200" stroke="#000" />
              <line x1="0" y1="300" x2="600" y2="300" stroke="#000" />
              <line x1="0" y1="400" x2="600" y2="400" stroke="#000" />
            </g>

            {/* 2. Active Spray Alert Warning Zones (Pulsing circles under hives) */}
            {activeAlerts.map((alert) => {
              const { x, y } = toSvgCoords(alert.latitude, alert.longitude);
              const radiusPixels = kmToSvgRadius(alert.radiusKm);
              return (
                <g key={alert.id}>
                  {/* Outer pulsing threat ring */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radiusPixels}
                    className="fill-red-500/10 stroke-red-500/40 stroke-2 animate-pulse"
                    strokeDasharray="4,4"
                  />
                  {/* Subtle inner dangerous range core */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radiusPixels < 30 ? radiusPixels : 30}
                    className="fill-red-650/15 stroke-red-650/50"
                  />
                  {/* Hazard center center tracker pin */}
                  <circle cx={x} cy={y} r="6" className="fill-red-600 stroke-white stroke-2" />
                  <path d={`M ${x} ${y - 12} L ${x - 5} ${y} L ${x + 5} ${y} Z`} className="fill-red-700" />
                </g>
              );
            })}

            {/* 3. Hive Pins render layer */}
            {hives.map((hive) => {
              const { x, y } = toSvgCoords(hive.latitude, hive.longitude);
              const { isThreatened } = getHiveSprayStatus(hive);
              const isSelected = selectedHiveId === hive.id;
              
              const isClosed = hive.coverStatus === 'Closed';

              return (
                <g 
                  key={hive.id} 
                  transform={`translate(${x}, ${y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectHive(isSelected ? null : hive.id);
                  }}
                  className="cursor-pointer group"
                >
                  {/* Danger shockwave ring if open and threatened */}
                  {isThreatened && !isClosed && (
                    <circle r="22" className="fill-none stroke-amber-500 animate-ping opacity-70 stroke-2" />
                  )}

                  {/* Highlight bubble when selected */}
                  {isSelected && (
                    <circle r="25" className="fill-amber-400/25 stroke-amber-400 stroke-2" />
                  )}

                  {/* Shield graphic backdrop if cover is Closed */}
                  {isClosed ? (
                    <path 
                      d="M -14 -12 C -14 -12, 0 -18, 0 -18 C 0 -18, 14 -12, 14 -12 C 14 0, 8 12, 0 16 C -8 11, -14 0, -14 -12" 
                      className="fill-emerald-500/25 stroke-emerald-600 stroke-[1.5]" 
                    />
                  ) : isThreatened ? (
                    <polygon 
                      points="0,-18 16,10 -16,10" 
                      className="fill-amber-50 stroke-amber-600 stroke-2" 
                    />
                  ) : (
                    <ellipse rx="15" ry="15" className="fill-amber-50 stroke-amber-400 stroke-2 shadow-md hover:fill-amber-100" />
                  )}

                  {/* Micro Bee Hive Box Graphics */}
                  <g transform="translate(0, -6)">
                    {/* Small colored status flag */}
                    <rect x="-8" y="-4" width="16" height="5" rx="1" fill={isClosed ? "#10B981" : isThreatened ? "#EF4444" : "#F59E0B"} />
                    <rect x="-10" y="1" width="20" height="4" fill="#D97706" />
                    <rect x="-10" y="5" width="20" height="4" fill="#B45309" />
                    {/* Entrance slot spot */}
                    <rect x="-3" y="7" width="6" height="2" fill="#000" />
                  </g>

                  {/* Status Indicator Overlays */}
                  {isClosed ? (
                    <g transform="translate(10, 8)">
                      <circle r="7" className="fill-emerald-600 stroke-white" />
                      <path d="M -3 0 L -1 2 L 3 -2" className="stroke-white fill-none stroke-2 stroke-round" />
                    </g>
                  ) : isThreatened ? (
                    <g transform="translate(10, 8)">
                      <circle r="7" className="fill-red-650 bg-red-600 stroke-white" />
                      <text x="-0.5" y="3" className="fill-white text-[8px] font-bold text-center translate-x-[-1px]">⚠️</text>
                    </g>
                  ) : null}

                  {/* Label tag overlay */}
                  <g transform="translate(0, 24)" className="opacity-80 group-hover:opacity-100">
                    <rect x="-40" y="-8" width="80" height="15" rx="3" className="fill-amber-950/80 stroke-white/20 stroke" />
                    <text 
                      x="0" 
                      y="2" 
                      textAnchor="middle" 
                      className="fill-white font-mono text-[9px] font-medium tracking-tight"
                    >
                      {hive.name.length > 13 ? `${hive.name.substring(0, 11)}..` : hive.name}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* 4. Click Preview coordinate pin placement */}
            {clickCoord && (
              <g transform={`translate(${clickCoord.x}, ${clickCoord.y})`}>
                <circle r="35" className="fill-none stroke-amber-500 animate-pulse stroke-[1.5]" />
                <line x1="-15" y1="0" x2="15" y2="0" stroke="#D97706" />
                <line x1="0" y1="-15" x2="0" y2="15" stroke="#D97706" />
                <circle r="4" className="fill-amber-600 stroke-white stroke-2" />
              </g>
            )}
          </svg>
        </div>

        {/* Legend strip */}
        <div className="bg-amber-50 border-t border-orange-100 p-2.5 flex items-center justify-around text-xs text-amber-900 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-yellow-400 border border-amber-500 rounded-md block"></span>
            <span>Active Hive (Healthy)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-emerald-400 border border-emerald-600 rounded-md block"></span>
            <span>Closed/Protected Hive</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-red-150 border border-red-500 rounded-full animate-pulse block"></span>
            <span>Active Spray Danger Zone</span>
          </div>
        </div>
      </div>

      {/* Map Control Sidebar Details */}
      <div className="w-full md:w-80 bg-orange-50/50 border-l border-orange-100 p-4 flex flex-col justify-between overflow-y-auto h-full">
        <div>
          <h3 className="font-semibold text-sm text-amber-950 mb-1 flex items-center gap-1.5">
            <Map className="text-amber-500" size={16} />
            <span>Map Controller Settings</span>
          </h3>
          <p className="text-xs text-amber-800 mb-4">
            Click anywhere on the terrain grid map left to fetch exact target coordinates.
          </p>

          {!clickCoord ? (
            <div className="border border-dashed border-orange-200 bg-white/70 rounded-xl p-6 text-center">
              <Crosshair className="mx-auto text-orange-300 animate-pulse mb-2" size={28} />
              <p className="text-xs text-amber-900 font-medium font-sans">No Spot Tagged on Map</p>
              <p className="text-[11px] text-amber-700/85 mt-1">
                Select a coordinate to {userRole === 'beekeeper' ? 'install a hive' : 'broadcast a chemical spray alert'}.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-3 border border-orange-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-orange-50 pb-2">
                <span className="text-[11px] uppercase tracking-wider font-mono text-amber-800">Coordinate Selected</span>
                <button 
                  onClick={() => setClickCoord(null)}
                  className="text-amber-500 font-bold text-xs hover:text-amber-850"
                >
                  Clear Selection
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center font-mono">
                <div className="bg-amber-50/60 rounded p-1.5 border border-amber-100/40">
                  <span className="block text-[9px] text-amber-700 uppercase">Latitude</span>
                  <span className="text-amber-950 text-xs font-semibold">{clickCoord.lat.toFixed(5)}</span>
                </div>
                <div className="bg-amber-50/60 rounded p-1.5 border border-amber-100/40">
                  <span className="block text-[9px] text-amber-700 uppercase">Longitude</span>
                  <span className="text-amber-950 text-xs font-semibold">{clickCoord.lng.toFixed(5)}</span>
                </div>
              </div>

              {/* A. Form for Beekeepers: Place Hive */}
              {userRole === 'beekeeper' && (
                <form onSubmit={processHiveSubmit} className="space-y-2.5">
                  <div>
                    <label className="block text-[10px] text-amber-900 font-bold mb-1">Colony Name</label>
                    <input 
                      type="text" 
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Bramhara Golden Nest"
                      className="w-full text-xs border border-orange-100 bg-orange-50/20 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs py-2 rounded-lg transition shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>Install Hive Box Here</span>
                  </button>
                </form>
              )}

              {/* B. Form for Farmers: Trigger Spray Alert */}
              {userRole === 'farmer' && (
                <form onSubmit={processAlertSubmit} className="space-y-2 text-left">
                  <div>
                    <label className="block text-[10px] text-amber-900 font-bold mb-0.5">Your Name (Farmer ID)</label>
                    <input 
                      type="text" 
                      required
                      value={formFarmer}
                      onChange={(e) => setFormFarmer(e.target.value)}
                      placeholder="Kari Gowda"
                      className="w-full text-xs border border-orange-100 bg-orange-50/20 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-amber-900 font-bold mb-0.5">Pesticide / Chemical</label>
                    <select
                      value={formChemical}
                      onChange={(e) => setFormChemical(e.target.value)}
                      className="w-full text-xs border border-orange-100 bg-white rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="Chlorpyrifos (Restricted Organophosphate)">Chlorpyrifos (OP, Severe Residual)</option>
                      <option value="Imidacloprid (Highly toxic Neonicotinoid)">Imidacloprid (Neonicotinoid, Severe)</option>
                      <option value="Permethrin (Synthetic Pyrethroid)">Permethrin (Pyrethroid, Toxic)</option>
                      <option value="Spinosad Bio-Spray (Degrades fast)">Spinosad Bio-Insecticide (Moderate)</option>
                      <option value="Neem Kernel Oil (Safe Bio-Pesticide)">Pure Cold-pressed Neem Oil (Safe)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-amber-900 font-bold mb-0.5">Spray Radius</label>
                      <input 
                        type="number" 
                        required
                        step="0.1"
                        min="0.5"
                        max="3"
                        value={formRadius}
                        onChange={(e) => setFormRadius(Number(e.target.value))}
                        className="w-full text-xs border border-orange-100 bg-orange-50/20 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <span className="text-[9px] text-amber-600 block mt-0.5">Avg: 1.5 - 2.0 km</span>
                    </div>
                    <div>
                      <label className="block text-[10px] text-amber-900 font-bold mb-0.5">Safe Duration</label>
                      <select
                        value={formDuration}
                        onChange={(e) => setFormDuration(Number(e.target.value))}
                        className="w-full text-xs border border-orange-100 bg-white rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value={120}>2 Hours</option>
                        <option value={240}>4 Hours (Rec.)</option>
                        <option value={360}>6 Hours</option>
                      </select>
                      <span className="text-[9px] text-amber-600 block mt-0.5">Closed shelter</span>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white font-medium text-xs py-2 rounded-lg transition shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle size={14} />
                    <span>Ping Spray Alert (Broadcast)</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Selected Hive Action Preview */}
        {selectedHiveId && (
          <div className="mt-4 border-t border-orange-100 pt-4">
            {hives.filter(h => h.id === selectedHiveId).map(hive => (
              <div key={hive.id} className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-left">
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="font-bold text-xs text-amber-950">{hive.name}</h4>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    hive.healthStatus === 'Excellent' ? 'bg-emerald-100 text-emerald-800' :
                    hive.healthStatus === 'Good' ? 'bg-yellow-100 text-amber-800' :
                    hive.healthStatus === 'Fair' ? 'bg-orange-100 text-orange-850' : 'bg-red-100 text-red-800'
                  }`}>
                    {hive.healthStatus}
                  </span>
                </div>
                
                <div className="space-y-1 text-[11px] text-amber-900 mb-2">
                  <p><span className="text-amber-700 font-medium">Owner:</span> {hive.ownerName}</p>
                  <p><span className="text-amber-700 font-medium">Lid Status:</span> <b className={hive.coverStatus === 'Closed' ? 'text-emerald-700' : 'text-amber-700'}>{hive.coverStatus}</b></p>
                  <p><span className="text-amber-700 font-medium">Honey yield:</span> {hive.honeyProductionKg.toFixed(1)} kg</p>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => onSelectHive(null)}
                    className="flex-1 bg-white border border-amber-200 text-amber-900 font-mono text-[10px] py-1.5 rounded-lg text-center hover:bg-amber-100"
                  >
                    Close Log
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
