import React, { useState, useEffect } from 'react';
import { Hive, SprayAlert, HealthLog } from './types';
import HiveMap from './components/HiveMap';
import HealthChecker from './components/HealthChecker';
import AiAdvisor from './components/AiAdvisor';
import { Map, Activity, Bot, ShieldAlert, ShieldCheck, Heart, User, Tractor, Siren, Star, Bell, Info } from 'lucide-react';

interface NotificationToast {
  id: string;
  title: string;
  description: string;
  type: 'danger' | 'info' | 'success';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'logs' | 'advisor'>('map');
  const [userRole, setUserRole] = useState<'beekeeper' | 'farmer'>('beekeeper');
  
  // Database state lists
  const [hives, setHives] = useState<Hive[]>([]);
  const [alerts, setAlerts] = useState<SprayAlert[]>([]);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  
  const [selectedHiveId, setSelectedHiveId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  // Fetch initial village statistics
  const fetchAllData = async () => {
    try {
      const [hivesRes, alertsRes, logsRes] = await Promise.all([
        fetch('/api/hives'),
        fetch('/api/alerts'),
        fetch('/api/logs')
      ]);

      if (hivesRes.ok) setHives(await hivesRes.json());
      if (alertsRes.ok) setAlerts(await alertsRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (error) {
      console.error("Failed to load full village datasets", error);
    }
  };

  useEffect(() => {
    fetchAllData();

    // Setup Real-time Server-Sent Events (SSE) stream
    const sse = new EventSource('/api/alerts/stream');

    sse.addEventListener('new_spray_alert', (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      const alert: SprayAlert = payload.alert;
      
      // Post warning notification
      addToast({
        id: `toast-${Date.now()}`,
        title: '🔴 HAZARD WARNING: Pesticide Spray Active!',
        description: `Farmer ${alert.farmerName} is spraying ${alert.chemicalName} over fields (Impact Radius: ${alert.radiusKm}km). Hives in location must be covered.`,
        type: 'danger'
      });

      // Play soft real-time browser alarm sound safely using Web Audio API
      playSoundAlarm();
      
      fetchAllData();
    });

    sse.addEventListener('hive_created', () => { fetchAllData(); });
    sse.addEventListener('hive_updated', () => { fetchAllData(); });
    sse.addEventListener('hive_deleted', () => { 
      fetchAllData(); 
      setSelectedHiveId(null);
    });
    sse.addEventListener('log_created', () => { fetchAllData(); });

    return () => {
      sse.close();
    };
  }, []);

  // Soft synth audio alert using pure Web Audio API
  const playSoundAlarm = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      // First chime
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain1.gain.setValueAtTime(0.2, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.4);
      
      // Delay second chime
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        gain2.gain.setValueAtTime(0.2, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.5);
      }, 150);
    } catch (e) {
      console.log("Audio activation block bypassed");
    }
  };

  const addToast = (toast: NotificationToast) => {
    setToasts(prev => [...prev, toast]);
    // Auto erase toast after 9 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 9000);
  };

  // REST API: Add New Hive
  const handleAddHive = async (latitude: number, longitude: number, name: string) => {
    try {
      const res = await fetch('/api/hives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          ownerName: 'Madhu Gowda', // Standard logged-in user
          latitude,
          longitude,
          honeyProductionKg: 0,
          healthStatus: 'Excellent'
        })
      });

      if (res.ok) {
        const newHive = await res.json();
        addToast({
          id: `t-${Date.now()}`,
          title: '🐝 Colony Deployed',
          description: `Successfully installed colony box "${newHive.name}" in Mandya village coordinates.`,
          type: 'success'
        });
        setSelectedHiveId(newHive.id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // REST API: Broadcast Spray Alert
  const handleAddAlert = async (
    chemicalName: string,
    farmerName: string,
    latitude: number,
    longitude: number,
    radiusKm: number,
    durationMinutes: number
  ) => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chemicalName,
          farmerName,
          latitude,
          longitude,
          radiusKm,
          durationMinutes
        })
      });

      if (res.ok) {
        const payload = await res.json();
        addToast({
          id: `t-${Date.now()}`,
          title: '🚜 Spray Broadcast Live',
          description: `Logged chemical spray target site. High-risk warning broadcasted to ${payload.affectedHivesCount} adjacent hives.`,
          type: 'info'
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  // REST API: Add Inspection Log entry
  const handleAddInspectionLog = async (
    hiveId: string,
    weightKg: number,
    honeyHarvestedKg: number,
    queenSeen: boolean,
    activityLevel: 'High' | 'Medium' | 'Low',
    healthStatus: 'Excellent' | 'Good' | 'Fair' | 'Poor',
    notes: string
  ) => {
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hiveId,
          weightKg,
          honeyHarvestedKg,
          queenSeen,
          activityLevel,
          healthStatus,
          notes
        })
      });

      if (res.ok) {
        fetchAllData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  // REST API: Shutter or open hive box lid
  const handleToggleHiveCoverStatus = async (hiveId: string, currentStatus: 'Open' | 'Closed') => {
    const nextStatus = currentStatus === 'Open' ? 'Closed' : 'Open';
    try {
      const res = await fetch(`/api/hives/${hiveId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverStatus: nextStatus })
      });

      if (res.ok) {
        const updatedHive = await res.json();
        addToast({
          id: `t-${Date.now()}`,
          title: updatedHive.coverStatus === 'Closed' ? '🛡️ Hive Covered Safe' : '🍃 Hive Opened',
          description: updatedHive.coverStatus === 'Closed' 
            ? `Colony ${updatedHive.name} closed securely. Protective filters enabled for next 4 hours.` 
            : `Colony ${updatedHive.name} opened up. Active foraging resumed.`,
          type: 'success'
        });
        fetchAllData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  // REST API: Scrap/Delete Hive Colony
  const handleDeleteHive = async (hiveId: string) => {
    if (!confirm("Are you sure you want to decommission this colony box? This deletes all historic checking log files too.")) return;
    try {
      const res = await fetch(`/api/hives/${hiveId}`, {
         method: 'DELETE'
      });
      if (res.ok) {
        addToast({
          id: `t-${Date.now()}`,
          title: '🗑️ Hive Box Decommissioned',
          description: 'Hive removed from village grid maps.',
          type: 'info'
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Coordinate distances check for warnings summary
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

  // Calculate live danger counts
  const activeAlerts = alerts.filter(a => a.active);
  const hivesInActiveDanger = hives.filter(hive => {
    if (hive.coverStatus === 'Closed') return false; // shielded hives are safe from active logs!
    return activeAlerts.some(alert => {
      const dist = getDistanceKm(alert.latitude, alert.longitude, hive.latitude, hive.longitude);
      return dist <= alert.radiusKm;
    });
  });

  return (
    <div className="min-h-screen bg-[#FCFAF6] text-amber-950 font-sans selection:bg-amber-100 selection:text-amber-900 pb-12">
      
      {/* 1. TOP GLOBAL EMERGENCY BANNER ticker */}
      {hivesInActiveDanger.length > 0 && (
        <div className="bg-red-600 text-white text-xs px-4 py-2.5 flex items-center justify-between shadow-md relative z-50">
          <div className="flex items-center gap-2 max-w-4xl">
            <Siren className="animate-bounce shrink-0" size={16} />
            <span className="font-semibold tracking-wide">
              EMERGENCY DETECTED: {hivesInActiveDanger.length} colony boxes are in active pesticide spray radius! 
              {userRole === 'beekeeper' && " Switch adjacent hives below to 'Closed' to protect your colonies."}
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-widest bg-red-800 text-red-100 px-2 py-0.5 rounded-full">
            Immediate Action Required
          </span>
        </div>
      )}

      {/* 2. BRAND NAVIGATION HEADER */}
      <header className="bg-white border-b border-orange-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo Title section */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-400 border border-amber-500 shadow-md flex items-center justify-center animate-pulse">
              <span className="text-xl">🐝</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-sans font-black tracking-tight text-xl text-amber-950">Madhu-Siri</h1>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-250">
                  MindMatrix VTU
                </span>
              </div>
              <span className="text-xs text-amber-800/90 font-medium block">Bee - Farmer Harmony & Spray Alert Communication Portal</span>
            </div>
          </div>

          {/* Navigation Tab Menu */}
          <nav className="flex items-center gap-1.5 bg-orange-50/75 p-1 rounded-xl border border-orange-100 shadow-inner">
            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold font-sans transition-all duration-200 ${
                activeTab === 'map'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-amber-850 hover:bg-amber-100/50'
              }`}
            >
              <Map size={14} />
              <span>Village Hive Map</span>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold font-sans transition-all duration-200 ${
                activeTab === 'logs'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-amber-850 hover:bg-amber-100/50'
              }`}
            >
              <Activity size={14} />
              <span>Colony Health Logs</span>
            </button>
            <button
              onClick={() => setActiveTab('advisor')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold font-sans transition-all duration-200 ${
                activeTab === 'advisor'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-amber-850 hover:bg-amber-100/50'
              }`}
            >
              <Bot size={14} />
              <span>Safe-Pesticide AI Advisor</span>
            </button>
          </nav>

          {/* Role selector simulator */}
          <div className="flex items-center gap-2 bg-amber-50/50 border border-orange-100 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Your Current Role:</span>
            <div className="flex gap-1">
              <button 
                onClick={() => {
                  setUserRole('beekeeper');
                  addToast({ id: `t-role-${Date.now()}`, title: 'Mode Switched', description: 'Beekeeper panel controls loaded. Tag colony boxes on grid.', type: 'success' });
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold border transition ${
                  userRole === 'beekeeper' 
                    ? 'bg-yellow-400 border-amber-400 text-amber-950 shadow-sm' 
                    : 'bg-white border-orange-100 text-amber-700 hover:bg-orange-50'
                }`}
              >
                <Heart size={10} className="fill-amber-950" />
                <span>Beekeeper</span>
              </button>
              <button 
                onClick={() => {
                  setUserRole('farmer');
                  addToast({ id: `t-role-${Date.now()}`, title: 'Mode Switched', description: 'Farmers tractor GPS activated. Settle spray coords.', type: 'info' });
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold border transition ${
                  userRole === 'farmer' 
                    ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm' 
                    : 'bg-white border-orange-100 text-amber-700 hover:bg-orange-50'
                }`}
              >
                <Tractor size={10} />
                <span>Crop Farmer</span>
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* 3. CORE SUMMARY STATS CARDS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="block text-[10px] uppercase font-bold tracking-wider text-amber-700">Deployed Hives</span>
              <span className="text-xl font-bold font-mono text-amber-950 block mt-1">{hives.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center text-lg shadow-inner">🍯</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="block text-[10px] uppercase font-bold tracking-wider text-amber-700">Active Spray Alerts</span>
              <span className="text-xl font-bold font-mono text-amber-950 block mt-1">
                {activeAlerts.length}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-lg shadow-inner">⚠️</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="block text-[10px] uppercase font-bold tracking-wider text-amber-700">Vulnerable Colonies</span>
              <span className="text-xl font-bold font-mono text-amber-950 block mt-1">
                {hivesInActiveDanger.length}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-lg shadow-inner">🚨</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="block text-[10px] uppercase font-bold tracking-wider text-amber-700">Total Honey Yield</span>
              <span className="text-xl font-bold font-mono text-amber-950 block mt-1">
                {hives.reduce((acc, h) => acc + h.honeyProductionKg, 0).toFixed(1)} <span className="text-xs">kg</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg shadow-inner">✨</div>
          </div>

        </div>
      </section>

      {/* 4. MAIN INTERACTIVE VIEWS */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {activeTab === 'map' && (
          <div className="space-y-6">
            
            {/* Live active warnings banner summary */}
            {activeAlerts.length > 0 && (
              <div className="bg-orange-50/70 border border-orange-200/80 rounded-2xl p-4 text-left animate-fadeIn">
                <h4 className="font-bold text-xs text-amber-950 flex items-center gap-1.5 uppercase tracking-wide mb-2.5">
                  <Bell className="text-red-550 animate-pulse" size={14} />
                  <span>On-going Spray Cautions in Village (Auto Expiring Logs)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeAlerts.map((alert) => {
                    const alertTime = new Date(alert.timestamp).toLocaleTimeString();
                    return (
                      <div key={alert.id} className="bg-white rounded-xl p-3 border border-orange-100 shadow-sm flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="font-bold text-xs text-amber-950 font-mono block">Chemical: {alert.chemicalName}</span>
                          <span className="text-[11px] text-amber-800 block">
                            Logged by Farmer: <b>{alert.farmerName}</b> | Active radius: <b>{alert.radiusKm}km</b>
                          </span>
                          <span className="text-[10px] text-amber-700 block font-mono">
                            Triggered: <b>{alertTime}</b> | Safe duration: <b>{alert.durationMinutes} mins</b>
                          </span>
                        </div>
                        <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-bold font-mono px-2 py-0.5 rounded-full animate-pulse">
                          SPRAYING NOW
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Map Canvas render element */}
            <HiveMap
              hives={hives}
              alerts={alerts}
              userRole={userRole}
              selectedHiveId={selectedHiveId}
              onSelectHive={setSelectedHiveId}
              onAddHive={handleAddHive}
              onAddAlert={handleAddAlert}
            />

            {/* Live Hives Grid Management Controls for selected Beekeeper */}
            {userRole === 'beekeeper' && (
              <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6 text-left">
                <div className="flex items-center gap-2 mb-4">
                  <Heart className="text-amber-500 fill-amber-300" size={18} />
                  <h3 className="font-bold text-sm text-amber-950">Manage Deployed Village Hive Covers</h3>
                </div>
                
                {hives.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {hives.map((hive) => {
                      const { isThreatened } = (() => {
                        const val = { isThreatened: false };
                        activeAlerts.forEach((a) => {
                          const dist = getDistanceKm(a.latitude, a.longitude, hive.latitude, hive.longitude);
                          if (dist <= a.radiusKm) val.isThreatened = true;
                        });
                        return val;
                      })();

                      return (
                        <div 
                          key={hive.id} 
                          className={`rounded-xl p-3.5 border transition flex flex-col justify-between gap-3 ${
                            hive.coverStatus === 'Closed' 
                              ? 'bg-emerald-50/40 border-emerald-200/70' 
                              : isThreatened 
                                ? 'bg-red-50 border-red-200 shadow-sm animate-pulse' 
                                : 'bg-[#FDFDFD] border-orange-100/60'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs text-amber-950 truncate font-mono">{hive.name}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                                hive.coverStatus === 'Closed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {hive.coverStatus === 'Closed' ? '🔒 Covered' : '🔓 Exposed'}
                              </span>
                            </div>
                            
                            <div className="text-[11px] text-amber-800 space-y-1 mt-2">
                              <p>Health: <b className="text-amber-950">{hive.healthStatus}</b></p>
                              {isThreatened && hive.coverStatus === 'Open' && (
                                <p className="text-red-700 font-bold flex items-center gap-1 font-sans">
                                  <span>🚨 Adjacent Spray threat detected!</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-orange-50 mt-1">
                            {/* Toggle lid protective cover button */}
                            <button
                              onClick={() => handleToggleHiveCoverStatus(hive.id, hive.coverStatus)}
                              className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg border transition ${
                                hive.coverStatus === 'Closed'
                                  ? 'bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                  : 'bg-amber-500 hover:bg-amber-600 border-amber-600 text-white shadow-sm'
                              }`}
                            >
                              {hive.coverStatus === 'Closed' ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                              <span>{hive.coverStatus === 'Closed' ? 'Open Hive Entrance' : 'Close Entrance (4 hrs)'}</span>
                            </button>
                            
                            {/* Trash button */}
                            <button
                              onClick={() => handleDeleteHive(hive.id)}
                              className="px-2 py-1.5 bg-white border border-red-200 rounded-lg hover:bg-red-50 text-red-600 text-[10px] font-bold transition"
                              title="Decommission Colony"
                            >
                              Decommission
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-amber-800 bg-[#FAF8F5] border border-dashed border-orange-100 rounded-xl p-8 text-center font-sans">
                    No honeybee colonies deployed. Click anywhere on the Village Grid map above in "Beekeeper Tooling Mode" to position your first hive yard.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Health Checker log panel view */}
        {activeTab === 'logs' && (
          <div className="animate-fadeIn">
            <HealthChecker
              hives={hives}
              gLogs={logs}
              selectedHiveId={selectedHiveId}
              onSelectHive={setSelectedHiveId}
              onSubmitLog={handleAddInspectionLog}
            />
          </div>
        )}

        {/* GenAI safety Advisor panel view */}
        {activeTab === 'advisor' && (
          <div className="animate-fadeIn">
            <AiAdvisor />
          </div>
        )}

      </main>

      {/* 5. FLOATING DYNAMIC NOTIFICATION DISK STACK */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-xl border flex items-start gap-3 transition-all duration-300 transform translate-y-0 scale-100 ${
              toast.type === 'danger' 
                ? 'bg-red-50 border-red-200 text-red-950' 
                : toast.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="text-lg leading-none select-none shrink-0">
              {toast.type === 'danger' ? '🚨' : toast.type === 'success' ? '✅' : '🔔'}
            </div>
            <div className="flex-1 text-left">
              <h5 className="font-black text-xs tracking-tight">{toast.title}</h5>
              <p className="text-[11px] leading-relaxed mt-1">{toast.description}</p>
            </div>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-[10px] font-bold px-1 hover:opacity-70"
            >
              ×
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
