import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import * as THREE from 'three';
import { 
  Users, 
  UserCheck, 
  Clock, 
  Wifi, 
  WifiOff, 
  Sparkles, 
  Cpu, 
  Database, 
  Volume2, 
  Terminal, 
  ChevronRight, 
  HelpCircle,
  Award
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const { snapshot, isConnected, error } = useWebSocket();
  const [showPitchModal, setShowPitchModal] = useState(false);

  // Live snapshot calculations
  const { patients = [], current_token, total_waiting = 0, settings } = snapshot || {};
  const currentPatient = patients.find(p => p.id === current_token);
  const waitingPatients = patients.filter(p => p.status === 'waiting');

  const avgWaitTime = useMemo(() => {
    return waitingPatients.length > 0
      ? Math.round(waitingPatients.reduce((sum, p) => sum + (p.estimated_wait_minutes || 0), 0) / waitingPatients.length)
      : (settings ? settings.avg_consultation_minutes : 10);
  }, [waitingPatients, settings]);

  // Three.js interactive background setup
  useEffect(() => {
    if (!canvasRef.current) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 3, 12);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. Geometry: Animated particle grid (resembling medical ECG/wave)
    const rows = 90;
    const cols = 90;
    const count = rows * cols;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = (r - rows / 2) * 0.45;
        const z = (c - cols / 2) * 0.45;

        positions[i * 3] = x;
        positions[i * 3 + 1] = 0; // modulated in animation
        positions[i * 3 + 2] = z;

        // Custom clinical gradient: Indigo (#6366f1) to Teal (#0d9488 / #10b981)
        const mixedColor = new THREE.Color();
        const pct = r / rows;
        mixedColor.lerpColors(new THREE.Color('#4f46e5'), new THREE.Color('#10b981'), pct);

        colors[i * 3] = mixedColor.r;
        colors[i * 3 + 1] = mixedColor.g;
        colors[i * 3 + 2] = mixedColor.b;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Circle Texture
    const createCircleTexture = () => {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.7)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      return new THREE.CanvasTexture(canvas);
    };

    const material = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      map: createCircleTexture(),
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // 3. User interaction & tracking
    let mouseX = 0, mouseY = 0;
    let targetMouseX = 0, targetMouseY = 0;

    const handleMouseMove = (event) => {
      targetMouseX = (event.clientX - window.innerWidth / 2) / 250;
      targetMouseY = (event.clientY - window.innerHeight / 2) / 250;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 4. Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // 5. Animation loop
    const clock = new THREE.Clock();
    let animationFrameId;

    const tick = () => {
      const elapsedTime = clock.getElapsedTime();

      // Lerp mouse coordinates
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      // Access particle array to apply sine heartbeat wave formula
      const posAttribute = geometry.attributes.position;
      const array = posAttribute.array;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const x = array[i * 3];
          const z = array[i * 3 + 2];

          // Dual-wave simulation representing fluid patient flows and medical heart pulse
          const wave = Math.sin(x * 0.35 + elapsedTime * 1.6) * 0.45;
          const ripple = Math.cos(z * 0.25 + elapsedTime * 1.1) * 0.25;

          // Pulse expansion from center
          const dist = Math.sqrt(x*x + z*z);
          const pulse = Math.sin(dist * 0.45 - elapsedTime * 2.8) * 0.65 * (1 / (1 + dist * 0.15));

          array[i * 3 + 1] = wave + ripple + pulse;
        }
      }
      posAttribute.needsUpdate = true;

      // Rotate camera/scene slightly on mouse movement
      points.rotation.y = elapsedTime * 0.015 + mouseX * 0.15;
      points.rotation.x = 0.22 + mouseY * 0.15;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(tick);
    };

    tick();

    // 6. Cleanup WebGL elements to prevent memory leaks
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-950 text-white font-sans overflow-hidden flex flex-col justify-between select-none">
      
      {/* 3D WebGL Canvas Layer */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      {/* Modern Background Gradients / Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <span className="text-white font-black text-xl">+</span>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
              Queue Cure
            </h1>
            <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Smart Clinic Ecosystem</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowPitchModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-indigo-300 border border-slate-800 hover:border-indigo-500/40 text-xs font-bold transition-all duration-300"
          >
            <Award className="w-4 h-4 text-indigo-400" />
            <span>Judge Pitch Deck</span>
          </button>
          
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 text-xs font-bold transition-all border border-slate-850"
          >
            <Terminal className="w-3.5 h-3.5" /> API Docs
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-6 flex flex-col lg:flex-row items-center justify-center gap-12 py-10">
        
        {/* Left Column: Hero & Copy */}
        <div className="flex-1 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] font-extrabold uppercase tracking-widest leading-none">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            Hackathon Winner Entry
          </div>

          <h2 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.08] text-white">
            Dynamic, Real-Time <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
              Clinical Queue Flow
            </span>
          </h2>

          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Ditch inaccurate static multipliers. Queue Cure calculates expected wait times using a rolling average of actual clinic performance adjusted by real-time elapsed session metrics.
          </p>

          {/* Action Launch Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md sm:max-w-none pt-4">
            
            {/* Card 1: Receptionist */}
            <div 
              onClick={() => navigate('/receptionist')}
              className="group cursor-pointer bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800/80 hover:border-indigo-500/50 rounded-2xl p-5 text-left transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10 backdrop-blur-md relative"
            >
              <div className="absolute top-4 right-4 p-1.5 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-600 transition-colors">
                <ChevronRight className="w-4 h-4 text-indigo-300 group-hover:text-white" />
              </div>
              <div className="w-10 h-10 bg-indigo-500/15 rounded-xl flex items-center justify-center mb-4 border border-indigo-500/20">
                <Users className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="font-bold text-white text-base group-hover:text-indigo-300 transition-colors">Receptionist Portal</h3>
              <p className="text-xs text-slate-400 mt-1 leading-normal">Onboard walk-in patients, manage consultation status, and adjust settings.</p>
            </div>

            {/* Card 2: Patient */}
            <div 
              onClick={() => navigate('/patient')}
              className="group cursor-pointer bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800/80 hover:border-emerald-500/50 rounded-2xl p-5 text-left transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 backdrop-blur-md relative"
            >
              <div className="absolute top-4 right-4 p-1.5 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-600 transition-colors">
                <ChevronRight className="w-4 h-4 text-emerald-300 group-hover:text-white" />
              </div>
              <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center mb-4 border border-emerald-500/20">
                <Clock className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="font-bold text-white text-base group-hover:text-emerald-300 transition-colors">Patient Display TV</h3>
              <p className="text-xs text-slate-400 mt-1 leading-normal">Live lobby monitor with huge typography, wait times, and voice alerts.</p>
            </div>

          </div>
        </div>

        {/* Right Column: Live WS Clinic Widget (The WOW Factor) */}
        <div className="w-full lg:w-[420px] bg-slate-900/40 border border-slate-800/60 backdrop-blur-xl rounded-3xl p-6 shadow-2xl relative z-10">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg shadow-emerald-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            Live Preview
          </div>

          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-widest">Active Waiting Room</span>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                <Wifi className="w-3 h-3 animate-pulse" /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-450 text-[10px] font-bold animate-pulse">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3 py-6 text-center">
            
            <div>
              <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Current Token</p>
              <div className="text-2xl font-black text-indigo-400 font-mono tracking-tight mt-1.5">
                {currentPatient ? `#${currentPatient.token_number}` : 'None'}
              </div>
            </div>

            <div className="border-x border-slate-800/80">
              <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">In Queue</p>
              <div className="text-2xl font-black text-white font-mono tracking-tight mt-1.5">
                {total_waiting}
              </div>
            </div>

            <div>
              <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Next Wait</p>
              <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight mt-1.5">
                {avgWaitTime} <span className="text-xs font-bold text-slate-500">m</span>
              </div>
            </div>

          </div>

          {/* Feature highlights inside Widget */}
          <div className="bg-slate-950/40 border border-slate-850/60 rounded-2xl p-4.5 space-y-3.5">
            <h4 className="text-[10px] text-indigo-300 font-black uppercase tracking-wider">Core Clinical Engines</h4>
            
            <div className="flex gap-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg h-fit border border-indigo-500/15">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-200">Dynamic Wait Logic</h5>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Adjusts estimates based on exact doctor duration elapsed.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg h-fit border border-emerald-500/15">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-200">Accessibility Synthesis</h5>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Built-in audio callouts for blind & elderly patient tokens.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg h-fit border border-purple-500/15">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-200">Session Separation & Reset</h5>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Preserves logs via SET NULL database hooks for auditing.</p>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 border-t border-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>© 2026 Queue Cure. Real-Time Patient Waitlist Telemetry.</p>
        <div className="flex gap-4">
          <a href="http://localhost:8000/docs" target="_blank" className="hover:text-slate-350 transition-colors">API Endpoint Documentation</a>
        </div>
      </footer>

      {/* Pitch Deck / Judge Modal */}
      {showPitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl relative">
            <button
              onClick={() => setShowPitchModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold p-2"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-6">
              <Award className="w-6 h-6 text-indigo-400 animate-bounce" />
              <h3 className="text-2xl font-black text-white">Queue Cure — Judge Pitch Summary</h3>
            </div>

            <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
              <section>
                <h4 className="text-base font-extrabold text-white mb-2">🚨 The Waitlist Problem</h4>
                <p>
                  Typical digital queue boards multiply average consultation times statically, creating wild inaccuracies when appointments run long. Waiting rooms remain packed and stressful.
                </p>
              </section>

              <section>
                <h4 className="text-base font-extrabold text-white mb-2">⚡ Our Innovative Solution</h4>
                <p>
                  <strong>Queue Cure</strong> introduces self-healing wait time telemetry. It updates estimates live via <strong>WebSockets</strong> based on actual doctor performance.
                </p>
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-850 font-mono text-xs text-indigo-300 mt-2">
                  Expected Wait = (Rolling Average - Active Consultation Elapsed Time) + (People Ahead × Rolling Average)
                </div>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/30 border border-slate-800/80 rounded-2xl">
                  <h5 className="font-bold text-white mb-1">🔐 Single-Worker Lock Safety</h5>
                  <p className="text-xs text-slate-400">Protects queue mutations under concurrency, solving race conditions on overlapping receptionist calls.</p>
                </div>
                <div className="p-4 bg-slate-950/30 border border-slate-800/80 rounded-2xl">
                  <h5 className="font-bold text-white mb-1">🗄️ SET NULL Database Relational Integrity</h5>
                  <p className="text-xs text-slate-400">Preserves historical duration logs on active daily queue reset to support clinical audit logs.</p>
                </div>
              </section>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowPitchModal(false)}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-750 text-white font-bold transition-all text-xs"
                >
                  Got it! Let's Explore
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
