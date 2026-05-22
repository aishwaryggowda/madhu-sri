import React, { useState } from 'react';
import { PesticideAnalysis } from '../types';
import { Send, ShieldAlert, Sparkles, MessageSquare, Bot, AlertTriangle, ShieldCheck, HeartPulse, Wheat, HelpCircle } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export default function AiAdvisor() {
  const [chemicalInput, setChemicalInput] = useState('');
  const [pesticideData, setPesticideData] = useState<PesticideAnalysis | null>(null);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);

  // Chatbot states
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      id: 'msg-init-1',
      sender: 'ai',
      text: "Namaste! I am Madhu-Siri AI, your GenAI Agricultural Harmony Advisor. I am here to help crop farmers protect their crops while preserving nearby honeybee populations, especially during foraging windows. How can I assist you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  const handleEvaluatePesticide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chemicalInput.trim()) return;

    setLoadingEvaluation(true);
    setPesticideData(null);

    try {
      const res = await fetch('/api/pesticides/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chemicalName: chemicalInput }),
      });

      if (res.ok) {
        const data = await res.json();
        setPesticideData(data);
      } else {
        console.error("Evaluation response failed");
      }
    } catch (error) {
      console.error("Failed to parse pesticide evaluation", error);
    } finally {
      setLoadingEvaluation(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsgText = chatInput;
    const userMsg: Message = {
      id: `msg-u-${Date.now()}`,
      sender: 'user',
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setLoadingChat(true);

    // Context history formatting
    const history = chatMessages.map(m => ({
      sender: m.sender === 'user' ? 'user' : 'model',
      text: m.text
    }));

    try {
      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMsgText, history }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: Message = {
          id: `msg-ai-${Date.now()}`,
          sender: 'ai',
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, aiMsg]);
      }
    } catch (error) {
      console.error("Advisor chat response failed", error);
    } finally {
      setLoadingChat(false);
    }
  };

  // Pre-configured tips catalog for quick reference
  const safeTips = [
    { title: "Twilight Application Window", desc: "Always spray pesticides in the late evening (after 7:00 PM) or early night. Honeybees return entirely to hives during these hours, drastically reducing direct contact or drift fatalities." },
    { title: "Target Wind Controls Check", desc: "Avoid spraying crop chemicals when wind speeds exceed 10 km/h. Wind spreads toxic drift into nearby weed flowers where bees actively harvest pollen." },
    { title: "Maintain Pollinator Borders", desc: "Leave a 3-meter pesticide-free chemical buffer zone around hedges, water ponds, and active woodlands to keep wildflowers pure." },
    { title: "Pre-alert Neighboring Yards", desc: "Leverage this app's Spray Alert to warn all beekeepers in a 2km radius 4 hours before application, allowing them to shutter hives." }
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[520px]">
      
      {/* LEFT: Pesticide Hazard Evaluator Index - cols-7 */}
      <div className="xl:col-span-7 bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden flex flex-col justify-between p-6">
        <div className="space-y-4">
          <div className="border-b border-orange-50 pb-3">
            <h3 className="font-bold text-base text-amber-950 flex items-center gap-1.5">
              <HeartPulse className="text-amber-550" size={18} />
              <span>Pesticide Safety Dossier Evaluator</span>
            </h3>
            <p className="text-xs text-amber-800 mt-0.5">
              Input any agricultural chemical or pesticide name to evaluate instant toxic parameters, safety indexes, and bio-alternatives.
            </p>
          </div>

          <form onSubmit={handleEvaluatePesticide} className="flex gap-2">
            <input 
              type="text"
              required
              value={chemicalInput}
              onChange={(e) => setChemicalInput(e.target.value)}
              placeholder="e.g. Chlorpyrifos, Imidacloprid, Spinosad, Neem Oil..."
              className="flex-1 text-xs border border-orange-100 bg-orange-50/10 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans text-amber-950 font-medium"
            />
            <button 
              type="submit"
              disabled={loadingEvaluation}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 leading-none shrink-0"
            >
              {loadingEvaluation ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <Sparkles size={14} className="fill-amber-300" />
              )}
              <span>Analyze AI</span>
            </button>
          </form>

          {/* Results Block */}
          {pesticideData ? (
            <div className="bg-orange-50/25 border border-orange-100 rounded-2xl p-4 space-y-4 text-left animate-fadeIn">
              
              {/* Card Header Status */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-amber-950 font-mono tracking-tight">{pesticideData.chemicalName}</h4>
                  <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block mt-0.5">Pollinator Assessment Report</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Safety Level Badge */}
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold shadow-sm ${
                    pesticideData.safetyLevel === 'Highly Toxic' ? 'bg-red-50 text-red-700 border border-red-200' :
                    pesticideData.safetyLevel === 'Moderately Toxic' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {pesticideData.safetyLevel}
                  </span>
                  
                  {/* Risk gauge */}
                  <div className="bg-white px-2 py-0.5 rounded border border-orange-100 text-center font-mono text-[10px]">
                    <span className="text-amber-800 font-semibold block uppercase text-[8px] tracking-tight">Risk score</span>
                    <span className={`font-bold ${pesticideData.riskScore >= 7 ? 'text-red-650' : pesticideData.riskScore >= 4 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {pesticideData.riskScore}/10
                    </span>
                  </div>
                </div>
              </div>

              {/* Toxicity breakdown */}
              <div className="bg-white rounded-xl p-3 border border-orange-100/40 text-xs text-amber-900/90 leading-relaxed font-sans shadow-sm">
                {pesticideData.description}
              </div>

              {/* Action columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Safe Precautions */}
                <div className="space-y-1.5 text-left">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-950 flex items-center gap-1">
                    <AlertTriangle size={11} className="text-amber-550" />
                    <span>Safe Farmer Protocols</span>
                  </span>
                  <ul className="text-xs text-amber-900/85 space-y-1 pl-1 list-none">
                    {pesticideData.precautions.map((p, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-amber-550 font-bold text-[10px] mt-0.5">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Safe Alternatives */}
                <div className="space-y-1.5 text-left">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-950 flex items-center gap-1">
                    <ShieldCheck size={11} className="text-emerald-550" />
                    <span>Bee-Safe Alternatives</span>
                  </span>
                  <div className="space-y-1">
                    {pesticideData.safeAlternatives.map((alt, i) => (
                      <span 
                        key={i}
                        className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 font-medium px-2 py-1 rounded text-[10px] shadow-sm border border-emerald-100"
                      >
                        <Wheat size={9} />
                        <span>{alt}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chronological Foraging impact window */}
              {pesticideData.foragingImpact && (
                <div className="bg-amber-100/30 border border-amber-300/30 rounded-xl p-2.5 text-[11px] text-amber-900 font-sans leading-snug">
                  <b>🕒 Safe Application Timing:</b> {pesticideData.foragingImpact}
                </div>
              )}

            </div>
          ) : (
            <div className="bg-orange-50/20 border border-amber-100/30 rounded-2xl p-6.5 text-center min-h-[220px] flex flex-col items-center justify-center">
              <Bot className="text-orange-300 animate-bounce mb-2 stroke-1" size={32} />
              <p className="text-xs text-amber-950 font-bold">Awaiting Chemical Diagnostics query</p>
              <p className="text-[11px] text-amber-700 max-w-sm mt-1">
                Enter chemical herbicides, insecticides or fertilizers above. The GenAI inspector will audit honeybee vulnerability maps.
              </p>
            </div>
          )}
        </div>

        {/* Static Tips Shelf */}
        <div className="border-t border-orange-50/80 pt-4 mt-6">
          <span className="text-[10px] uppercase font-bold tracking-wider text-amber-950 mb-3.5 block text-left">
            📜 Core Pollinator Harmony Best Practices
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {safeTips.map((tip, idx) => (
              <div key={idx} className="bg-[#FCFAF5] border border-orange-100/40 rounded-xl p-3 text-left space-y-1">
                <h5 className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>{tip.title}</span>
                </h5>
                <p className="text-[11px] text-amber-800 leading-normal font-sans text-left">
                  {tip.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: GenAI Chat with Madhu-Siri helper - cols-5 */}
      <div className="xl:col-span-5 bg-[#FAF8F5] rounded-2xl shadow-sm border border-orange-100 overflow-hidden flex flex-col h-[520px]">
        {/* Chat header */}
        <div className="bg-white border-b border-orange-100 p-4 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600 font-bold shrink-0">
              🤖
            </div>
            <div>
              <h4 className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                <span>Madhu-Siri AI Harmony</span>
                <span className="bg-amber-100 text-amber-800 text-[8px] font-mono font-bold px-1 rounded">GENAI</span>
              </h4>
              <p className="text-[10px] text-amber-700/80">Karnataka Apicultural Extension Specialist</p>
            </div>
          </div>
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm ring-1 ring-emerald-300"></span>
        </div>

        {/* Chat Message Scroll */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {chatMessages.map((msg) => (
            <div 
              key={msg.id}
              className={`flex items-start gap-2 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse text-right' : 'text-left'}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 select-none ${
                msg.sender === 'user' 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-amber-100 border border-amber-250 text-amber-850 font-bold'
              }`}>
                {msg.sender === 'user' ? '👤' : '🐝'}
              </div>
              <div className="space-y-0.5">
                <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm font-sans block text-left ${
                  msg.sender === 'user'
                    ? 'bg-amber-500 text-white rounded-tr-none'
                    : 'bg-white border border-orange-100/60 rounded-tl-none text-amber-950 font-medium'
                }`}>
                  {msg.text}
                </div>
                <span className="text-[8px] text-amber-700/75 block px-1 font-mono">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {/* Chat Loader response */}
          {loadingChat && (
            <div className="flex items-start gap-2 max-w-[85%] text-left">
              <div className="w-6 h-6 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-xs shrink-0 font-bold">
                🐝
              </div>
              <div className="bg-white border border-orange-100/60 rounded-2xl rounded-tl-none px-3.5 py-2.5 flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
              </div>
            </div>
          )}
        </div>

        {/* Chat input pad */}
        <form onSubmit={handleSendMessage} className="bg-white border-t border-orange-100 p-3 shrink-0 flex gap-2">
          <input 
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={loadingChat}
            placeholder="Ask about crop protection windows, swarm health..."
            className="flex-1 text-xs border border-orange-100 bg-orange-50/10 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 text-amber-950"
          />
          <button 
            type="submit"
            disabled={loadingChat || !chatInput.trim()}
            className="p-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white rounded-xl transition shadow flex items-center justify-center"
          >
            <Send size={15} />
          </button>
        </form>
      </div>

    </div>
  );
}
