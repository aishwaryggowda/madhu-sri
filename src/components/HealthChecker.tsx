import React, { useState, useEffect } from 'react';
import { Hive, HealthLog } from '../types';
import { Sparkles, Calendar, Scale, Clipboard, ShieldCheck, HelpCircle, Activity, ChevronRight, PlusSquare } from 'lucide-react';

interface HealthCheckerProps {
  hives: Hive[];
  gLogs: HealthLog[];
  selectedHiveId: string | null;
  onSelectHive: (id: string | null) => void;
  onSubmitLog: (
    hiveId: string,
    weightKg: number,
    honeyHarvestedKg: number,
    queenSeen: boolean,
    activityLevel: 'High' | 'Medium' | 'Low',
    healthStatus: 'Excellent' | 'Good' | 'Fair' | 'Poor',
    notes: string
  ) => void;
}

export default function HealthChecker({
  hives,
  gLogs,
  selectedHiveId,
  onSelectHive,
  onSubmitLog,
}: HealthCheckerProps) {
  const [activeHiveId, setActiveHiveId] = useState<string>('');
  
  // Inspection form states
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formWeight, setFormWeight] = useState(25);
  const [formHoney, setFormHoney] = useState(0);
  const [formQueen, setFormQueen] = useState(true);
  const [formActivity, setFormActivity] = useState<'High' | 'Medium' | 'Low'>('High');
  const [formHealth, setFormHealth] = useState<'Excellent' | 'Good' | 'Fair' | 'Poor'>('Excellent');
  const [formNotes, setFormNotes] = useState('');
  const [showStatusSuccess, setShowStatusSuccess] = useState(false);

  // Sync state if selected from map
  useEffect(() => {
    if (selectedHiveId) {
      setActiveHiveId(selectedHiveId);
    } else if (hives.length > 0 && !activeHiveId) {
      setActiveHiveId(hives[0].id);
    }
  }, [selectedHiveId, hives]);

  const activeHive = hives.find(h => h.id === activeHiveId);
  const activeHiveLogs = gLogs
    .filter(log => log.hiveId === activeHiveId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHiveId) return;

    onSubmitLog(
      activeHiveId,
      Number(formWeight),
      Number(formHoney),
      formQueen,
      formActivity,
      formHealth,
      formNotes
    );

    setFormHoney(0);
    setFormNotes('');
    setShowStatusSuccess(true);
    setTimeout(() => setShowStatusSuccess(false), 3000);
  };

  // SVG Chart points calculation
  // We want to draw a clean SVG path for the weight trend.
  const chartWidth = 420;
  const chartHeight = 180;
  const padding = 25;

  let svgChartContent = null;
  if (activeHiveLogs.length > 0) {
    const weights = activeHiveLogs.map(l => l.weightKg);
    const minW = Math.min(...weights, 10) - 2;
    const maxW = Math.max(...weights, 40) + 5;
    const wRange = maxW - minW || 1;

    const points = activeHiveLogs.map((log, index) => {
      const x = padding + (index / (activeHiveLogs.length - 1 || 1)) * (chartWidth - padding * 2);
      const y = chartHeight - padding - ((log.weightKg - minW) / wRange) * (chartHeight - padding * 2);
      return { x, y, log };
    });

    const isSinglePoint = points.length === 1;

    const pathD = isSinglePoint
      ? ''
      : `M ${points[0].x} ${points[0].y} ` +
        points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

    const fillD = isSinglePoint
      ? ''
      : `${pathD} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`;

    svgChartContent = (
      <svg className="w-full h-full select-none" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#FEF3C7" strokeWidth="1" strokeDasharray="3,3" />
        <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#FEF3C7" strokeWidth="1" strokeDasharray="3,3" />
        <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#F59E0B" strokeWidth="1.5" />

        {/* Shaded area underneath */}
        {!isSinglePoint && (
          <path d={fillD} fill="url(#honeyGradient)" opacity="0.3" />
        )}

        {/* Trend solid line */}
        {!isSinglePoint && (
          <path d={pathD} fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Interactive nodes */}
        {points.map((p, i) => (
          <g key={p.log.id}>
            <circle 
              cx={p.x} 
              cy={p.y} 
              r="4.5" 
              className="fill-amber-500 stroke-amber-950 stroke-1.5 cursor-pointer hover:r-6 hover:fill-amber-600 transition" 
            />
            {/* Value markers */}
            <text 
              x={p.x} 
              y={p.y - 8} 
              textAnchor="middle" 
              className="fill-amber-950 text-[9px] font-mono font-bold"
            >
              {p.log.weightKg}kg
            </text>
            {/* X Axis dates label */}
            <text 
              x={p.x} 
              y={chartHeight - 6} 
              textAnchor="middle" 
              className="fill-amber-900/60 text-[8px] font-semibold"
            >
              {p.log.date.substring(5)}
            </text>
          </g>
        ))}

        <defs>
          <linearGradient id="honeyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#FFFBEB" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden flex flex-col lg:flex-row min-h-[500px]">
      
      {/* 1. Left side controls: Select hive and show trend charts */}
      <div className="w-full lg:w-[480px] p-6 border-r border-orange-50 bg-[#FDFBF7] flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-amber-950 flex items-center gap-1.5">
                <Sparkles className="text-amber-550 fill-amber-300" size={17} />
                <span>Hive Colony Analytics</span>
              </h3>
              <p className="text-xs text-amber-800">Review health timeline, check inspection cycles, and track weights.</p>
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold text-amber-900 mb-1.5">Select Hive Container</label>
            <select
              value={activeHiveId}
              onChange={(e) => {
                setActiveHiveId(e.target.value);
                onSelectHive(e.target.value || null);
              }}
              className="w-full text-xs font-semibold border border-orange-100 bg-white shadow-sm p-2.5 rounded-xl text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="" disabled>-- Choose a colony --</option>
              {hives.map((hive) => (
                <option key={hive.id} value={hive.id}>
                  🍯 {hive.name} ({hive.ownerName})
                </option>
              ))}
            </select>
          </div>

          {activeHive ? (
            <div className="space-y-4">
              {/* Metric Blocks */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-amber-50/50 border border-amber-100/50 rounded-xl p-2.5 text-center">
                  <span className="block text-[9px] text-amber-800 font-bold uppercase tracking-tight">Total Honey Collected</span>
                  <span className="text-base font-bold text-amber-950 font-mono mt-0.5 block">
                    {activeHive.honeyProductionKg.toFixed(1)} <span className="text-[10px]">kg</span>
                  </span>
                </div>
                <div className="bg-amber-50/50 border border-amber-100/50 rounded-xl p-2.5 text-center">
                  <span className="block text-[9px] text-amber-800 font-bold uppercase tracking-tight">Overall Health Status</span>
                  <span className="text-xs font-bold text-emerald-800 mt-1 block">
                    {activeHive.healthStatus}
                  </span>
                </div>
                <div className="bg-amber-50/50 border border-amber-100/50 rounded-xl p-2.5 text-center">
                  <span className="block text-[9px] text-amber-800 font-bold uppercase tracking-tight">Lid Cover Status</span>
                  <span className={`text-xs font-bold mt-1 block ${activeHive.coverStatus === 'Closed' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {activeHive.coverStatus}
                  </span>
                </div>
              </div>

              {/* Custom SVG Line Chart */}
              <div className="bg-orange-50/30 border border-orange-100/60 rounded-2xl p-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-900/70 mb-2 block text-left">
                  ⚖️ Colony Weight Weight Tracking Log (kg Trend)
                </span>
                
                {activeHiveLogs.length > 0 ? (
                  <div className="h-[180px] w-full flex items-center justify-center">
                    {svgChartContent}
                  </div>
                ) : (
                  <div className="h-[180px] flex flex-col items-center justify-center text-center p-4 bg-white/50 rounded-xl border border-dashed border-amber-200">
                    <Scale className="text-amber-300 animate-pulse mb-1.5" size={24} />
                    <p className="text-xs text-amber-900 font-semibold">No Inspections Logged Yet</p>
                    <p className="text-[10px] text-amber-700 mt-0.5">Use the right-hand panel to record your first hive diagnostic audit!</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-orange-50/40 rounded-xl p-10 text-center text-amber-900 flex flex-col items-center justify-center min-h-[200px]">
              <HelpCircle className="text-orange-300 mb-2" size={32} />
              <p className="text-sm font-semibold">No Hive Container Selected</p>
              <p className="text-xs text-amber-700">Please choose or deploy a hive box instance to view metrics.</p>
            </div>
          )}
        </div>

        {activeHive && (
          <div className="mt-4 border-t border-orange-100/80 pt-4 text-xs text-amber-900/85">
            <div className="flex justify-between items-center bg-white/70 rounded-lg p-2 border border-orange-100">
              <span className="font-semibold">Last Inspected:</span>
              <span className="font-mono bg-amber-100 text-amber-950 px-1.5 py-0.5 rounded font-bold">{activeHive.lastInspected}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Right side entry form: Save checking and list logs diary */}
      <div className="flex-1 p-6 flex flex-col justify-between">
        {activeHive ? (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-base text-amber-900 flex items-center gap-1.5">
                <Clipboard className="text-amber-500" size={17} />
                <span>Diagnostic Inspection Log for <span className="text-amber-950 font-bold">"{activeHive.name}"</span></span>
              </h3>
              <p className="text-xs text-amber-750">Add details of weights, queen spotting indices, and honey extracted logs.</p>
            </div>

            <form onSubmit={handleLogSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">Inspection Date</label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 text-amber-600" size={14} />
                  <input 
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full text-xs border border-orange-100 rounded-lg pl-8 p-2 focus:outline-none focus:ring-1 focus:ring-amber-500 text-amber-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">Colony Weight (kg)</label>
                  <input 
                    type="number"
                    required
                    min="5"
                    max="100"
                    value={formWeight}
                    onChange={(e) => setFormWeight(Number(e.target.value))}
                    className="w-full text-xs border border-orange-100 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-amber-500 text-amber-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">Honey Harvested (kg)</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    max="50"
                    value={formHoney}
                    onChange={(e) => setFormHoney(Number(e.target.value))}
                    className="w-full text-xs border border-orange-100 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-amber-500 text-amber-950 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">Queen Spotted?</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-amber-950">
                    <input 
                      type="radio"
                      checked={formQueen === true}
                      onChange={() => setFormQueen(true)}
                      className="accent-amber-500"
                    />
                    <span>Yes, Queen Spotted 👑</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-amber-950">
                    <input 
                      type="radio"
                      checked={formQueen === false}
                      onChange={() => setFormQueen(false)}
                      className="accent-amber-500"
                    />
                    <span>No See</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">Forager activity</label>
                  <select
                    value={formActivity}
                    onChange={(e) => setFormActivity(e.target.value as any)}
                    className="w-full text-xs border border-orange-100 bg-white rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="High">🔥 High Buzz</option>
                    <option value="Medium">🐝 Normal/Mid</option>
                    <option value="Low">❄️ Inert/Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">State Level</label>
                  <select
                    value={formHealth}
                    onChange={(e) => setFormHealth(e.target.value as any)}
                    className="w-full text-xs border border-orange-100 bg-white rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-amber-900 mb-1">Inspection Diary Comments</label>
                <textarea 
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Workers capping combs actively, spotted rich golden pollen arrivals, safe from adjacent pesticides."
                  rows={2}
                  className="w-full text-xs border border-orange-100 bg-orange-50/5 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 text-amber-950"
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-between mt-1">
                {showStatusSuccess ? (
                  <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 font-medium animate-bounce">
                    <ShieldCheck size={14} />
                    <span>Colony Audit Log Persisted Successfully!</span>
                  </div>
                ) : <div />}

                <button 
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-md hover:shadow-lg flex items-center gap-1.5"
                >
                  <PlusSquare size={15} />
                  <span>Commit Audited Log</span>
                </button>
              </div>
            </form>

            {/* List historic entries */}
            <div className="border-t border-orange-50 pt-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-900/70 mb-2.5 block text-left">
                📜 Active Colony Diagnostic Records History
              </span>
              {activeHiveLogs.length > 0 ? (
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {activeHiveLogs.slice().reverse().map((log) => (
                    <div key={log.id} className="bg-[#FAF8F5] border border-orange-100/40 rounded-lg p-2.5 flex items-start gap-2.5 text-xs">
                      <div className="flex flex-col items-center justify-center bg-amber-150 rounded text-center p-1 w-12 font-mono text-[9px] shrink-0 font-bold text-amber-900 border border-amber-250">
                        <span>Date</span>
                        <span className="text-amber-950">{log.date.substring(5)}</span>
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-amber-950 text-[11px] flex items-center gap-1">
                            <Activity size={11} className="text-amber-500" />
                            <span>Weight: <b className="font-mono">{log.weightKg}kg</b> | Harvested: <b className="font-mono text-amber-700">+{log.honeyHarvestedKg}kg</b></span>
                          </span>
                          <span className="text-[10px] font-medium text-amber-800">
                            {log.queenSeen ? '👑 Queen Spotted' : '🚫 Queen Missing'}
                          </span>
                        </div>
                        <p className="text-amber-900/80 text-[11px] leading-snug font-sans truncate" title={log.notes}>
                          "{log.notes || 'Routine colony health inspection completed.'}"
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-center text-amber-800/60 py-4 bg-[#FAF8F5] border border-dashed border-orange-100 rounded-lg">
                  No previous audit timeline logs found for this honeybee yard.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-10 h-full">
            <Clipboard className="text-orange-200 mb-2 stroke-1" size={48} />
            <p className="text-sm font-semibold text-amber-950">Secure Diagnostic Engine Active</p>
            <p className="text-xs text-amber-750 max-w-sm mt-1">
              Select any hive Box inside the left checklist box first to activate live logs diary submission processes.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
