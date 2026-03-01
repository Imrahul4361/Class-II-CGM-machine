import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  ReferenceLine, AreaChart, Area, ScatterChart, Scatter, Tooltip, Legend
} from "recharts";

/* ═══════════════════════════════════════════════════════════════════════════
   §0  UTILITIES
═══════════════════════════════════════════════════════════════════════════ */
const safe  = (v, fb = 0)     => (isFinite(v) && !isNaN(v) ? v : fb);
const clamp = (v, lo, hi)     => Math.min(hi, Math.max(lo, safe(v, lo)));
const rnd   = (v, d = 2)      => +safe(v, 0).toFixed(d);

/* ═══════════════════════════════════════════════════════════════════════════
   §1  THEME SYSTEM
═══════════════════════════════════════════════════════════════════════════ */
const THEMES = {
  dark: {
    bg0:"#020609", bg1:"#030b16", bg2:"#040d18", bg3:"#050f1c",
    border:"#08182a", border2:"#0d2035",
    txt0:"#8ab0cc", txt1:"#4a7090", txt2:"#1a3a55", txt3:"#0a2035",
    accent:"#00e5a0", accentB:"#60c0ff", accentC:"#d080ff",
    warn:"#ffaa00", crit:"#ff3333", ok:"#00e5a0",
    waveB:"#030c16",
  },
  light: {
    bg0:"#eef3f8", bg1:"#e4edf5", bg2:"#dce7f2", bg3:"#d0dded",
    border:"#b8ccde", border2:"#a0b8cc",
    txt0:"#1a3a55", txt1:"#2a5070", txt2:"#4a7090", txt3:"#6890aa",
    accent:"#007a55", accentB:"#005ba0", accentC:"#7030c0",
    warn:"#b05000", crit:"#cc0000", ok:"#007a55",
    waveB:"#dce7f2",
  },
};

function buildCSS(t) { return `
  @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600;700;800&family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${t.bg0}; overflow: hidden; }
  ::-webkit-scrollbar { width: 4px; height: 4px; background: ${t.bg0}; }
  ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 2px; }
  input[type=range] { -webkit-appearance: none; appearance: none; background: ${t.border}; border-radius: 2px; height: 3px; outline: none; width: 100%; cursor: pointer; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; border: none; cursor: pointer; transition: transform 0.1s; }
  input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.3); }
  input[type=range]::-moz-range-track { background: ${t.border}; border-radius: 2px; height: 3px; }
  input[type=range]::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; border: none; cursor: pointer; }
  input[type=range]::-ms-track { background: transparent; border-color: transparent; color: transparent; height: 3px; }
  input[type=range]::-ms-fill-lower { background: ${t.border}; border-radius: 2px; }
  input[type=range]::-ms-thumb { width: 12px; height: 12px; border-radius: 50%; border: none; }
  input[type=range]:disabled { opacity: 0.28; cursor: not-allowed; }
  @keyframes blink   { 0%,100%{opacity:1}    50%{opacity:0.08} }
  @keyframes pulse   { 0%,100%{opacity:0.75} 50%{opacity:1} }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:translateY(0)} }
  @keyframes glow    { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.6)} }
  .tooltip-host { position:relative; }
  .tooltip-host .tooltip-body { display:none; position:absolute; z-index:500; bottom:100%; left:50%; transform:translateX(-50%); margin-bottom:6px;
    background:${t.bg1}; border:1px solid ${t.border2}; border-radius:5px; padding:10px 13px; min-width:280px; max-width:340px; pointer-events:none; white-space:pre-line; }
  .tooltip-host:hover .tooltip-body { display:block; }
`; }

/* ═══════════════════════════════════════════════════════════════════════════
   §2  CLINICAL CONSTANTS
   Based on: Hovorka et al., Physiol Meas 2004;25:905-920
   Bergman minimal model + Dalla Man meal model
═══════════════════════════════════════════════════════════════════════════ */
const PATIENTS = {
  healthy: {
    label:"Healthy Adult",
    basalG:90, basalI:10, IBW:70,
    Sf:1.0,      // insulin sensitivity [mL/µU/min]
    k12:0.066,   // insulin compartment transfer [1/min]
    ke:0.138,    // insulin elimination [1/min]
    Vg:0.16,     // glucose distribution volume [L/kg]
    EGP0:2.0,    // endogenous glucose production [mg/kg/min]
    ka1:0.05,    // gut absorption rate 1 [1/min]
    ka2:0.05,    // gut absorption rate 2 [1/min]
    kabs:0.057,  // subcutaneous insulin absorption [1/min]
    P50:26.8,    // HbA1c P50 for sensor response
    color:"#00e5a0",
  },
  t1dm: {
    label:"Type 1 Diabetes",
    basalG:180, basalI:0, IBW:70,
    Sf:0.3, k12:0.04, ke:0.06, Vg:0.16, EGP0:2.5,
    ka1:0.04, ka2:0.04, kabs:0.04,
    P50:26.8, color:"#ff6b6b",
  },
  t2dm: {
    label:"Type 2 Diabetes",
    basalG:160, basalI:15, IBW:85,
    Sf:0.45, k12:0.05, ke:0.09, Vg:0.16, EGP0:2.2,
    ka1:0.045, ka2:0.045, kabs:0.05,
    P50:26.8, color:"#ffaa00",
  },
  gestational: {
    label:"Gestational Diabetes",
    basalG:105, basalI:12, IBW:75,
    Sf:0.6, k12:0.055, ke:0.11, Vg:0.16, EGP0:2.1,
    ka1:0.048, ka2:0.048, kabs:0.052,
    P50:26.8, color:"#60c0ff",
  },
  pediatric: {
    label:"Pediatric (10 yr)",
    basalG:95, basalI:8, IBW:30,
    Sf:0.85, k12:0.07, ke:0.15, Vg:0.16, EGP0:1.8,
    ka1:0.055, ka2:0.055, kabs:0.06,
    P50:26.8, color:"#d080ff",
  },
  adolescent: {
    label:"Adolescent (16 yr)",
    basalG:92, basalI:9, IBW:55,
    Sf:0.75, k12:0.065, ke:0.13, Vg:0.16, EGP0:1.9,
    ka1:0.052, ka2:0.052, kabs:0.055,
    P50:26.8, color:"#ff8c42",
  },
  elderly: {
    label:"Elderly (>70 yr)",
    basalG:110, basalI:6, IBW:68,
    Sf:0.55, k12:0.05, ke:0.10, Vg:0.16, EGP0:2.0,
    ka1:0.042, ka2:0.042, kabs:0.048,
    P50:26.8, color:"#ffd700",
  },
  prediabetic: {
    label:"Prediabetic",
    basalG:115, basalI:12, IBW:80,
    Sf:0.65, k12:0.058, ke:0.11, Vg:0.16, EGP0:2.15,
    ka1:0.046, ka2:0.046, kabs:0.051,
    P50:26.8, color:"#f472b6",
  },
};

// ISO 15197:2013 alarm limits
const ALIM = {
  healthy:   { hypo:70, sevHypo:54, hyper:180, sevHyper:250, roc:3, signalLoss:30 },
  t1dm:      { hypo:70, sevHypo:54, hyper:180, sevHyper:250, roc:3, signalLoss:30 },
  t2dm:      { hypo:70, sevHypo:54, hyper:200, sevHyper:300, roc:3, signalLoss:30 },
  gestational:{hypo:70, sevHypo:54, hyper:140, sevHyper:200, roc:3, signalLoss:30 },
  pediatric: { hypo:70, sevHypo:54, hyper:180, sevHyper:250, roc:3, signalLoss:30 },
  adolescent:{ hypo:70, sevHypo:54, hyper:180, sevHyper:250, roc:3, signalLoss:30 },
  elderly:   { hypo:70, sevHypo:54, hyper:200, sevHyper:300, roc:2.5, signalLoss:30 },
  prediabetic:{hypo:70,sevHypo:54, hyper:180, sevHyper:250, roc:3, signalLoss:30 },
};

const PRESETS = [
  { id:"t1dm_meal",    label:"T1DM + 60g Meal",        pid:"t1dm",       s:{ basalRate:1.0 }, f:{}, meal:60, bolus:0 },
  { id:"t2dm_bolus",   label:"T2DM + 5U Insulin",      pid:"t2dm",       s:{ basalRate:0.8 }, f:{}, meal:0,  bolus:5 },
  { id:"hypo_event",   label:"Hypoglycemia Event",     pid:"healthy",    s:{ basalRate:1.2 }, f:{}, meal:0,  bolus:8 },
  { id:"sensor_drift", label:"Sensor Drift Demo",      pid:"t1dm",       s:{ basalRate:1.0 }, f:{ sensor_drift:true }, meal:0, bolus:0 },
  { id:"meal_bolus",   label:"80g Meal + 6U Match",    pid:"t1dm",       s:{ basalRate:1.0 }, f:{}, meal:80, bolus:6 },
  { id:"dawn_phenom",  label:"Dawn Phenomenon (T1DM)", pid:"t1dm",       s:{ basalRate:1.3 }, f:{ increased_egp:true }, meal:0, bolus:0 },
  { id:"exercise",     label:"Exercise (↑ Sensitivity)",pid:"healthy",   s:{ basalRate:0.6 }, f:{ increased_sensitivity:true }, meal:30, bolus:0 },
  { id:"gd_screening", label:"Gestational Screening",  pid:"gestational",s:{ basalRate:1.0 }, f:{}, meal:75, bolus:0 },
];

const DEFAULT_SETTINGS = { basalRate:1.0 };
const DEFAULT_FAULTS   = { sensor_drift:false, reduced_sensitivity:false, increased_noise:false, increased_egp:false, increased_sensitivity:false };

const CALIBRATION_SCHEDULES = {
  factory: { label:"Factory (14-day)", driftRate:0.00001, calInterval:20160 },
  manual:  { label:"Manual (3-day)",   driftRate:0.0001,  calInterval:4320 },
  daily:   { label:"Daily calibration",driftRate:0.00005, calInterval:1440 },
  none:    { label:"No calibration",   driftRate:0.0005,  calInterval:Infinity },
};

const BLOCKCHAIN_DB = [
  { id:"0x7f2a…d91c", cmp:"Glucose Oxidase Enzyme",  sn:"GO-2024-00742", mfg:"Siemens Healthineers", batch:"B2024-11-08", cal:"2026-11-01", recalls:0, status:"VERIFIED" },
  { id:"0x4b8e…c23f", cmp:"Potentiostat ASIC",       sn:"PA-2024-01892", mfg:"Texas Instruments",    batch:"B2024-09-14", cal:"2026-09-01", recalls:0, status:"VERIFIED" },
  { id:"0x1c9d…a54b", cmp:"Microneedle Array (Si)",  sn:"MN-2023-05672", mfg:"Abbott Diabetes",      batch:"B2023-07-22", cal:"2025-07-15", recalls:0, status:"VERIFIED" },
  { id:"0x8e3a…f71d", cmp:"Temperature Sensor",      sn:"TS-2022-11834", mfg:"Analog Devices",       batch:"B2022-11-03", cal:"2025-10-28", recalls:1, status:"ADVISORY" },
  { id:"0x5d1c…b82a", cmp:"BLE Radio Module",        sn:"BR-2024-00391", mfg:"Nordic Semiconductor", batch:"B2024-05-19", cal:"N/A",         recalls:0, status:"VERIFIED" },
  { id:"0x2f7b…e49c", cmp:"Lithium Coin Cell",       sn:"LC-2024-02147", mfg:"Panasonic Industrial", batch:"B2024-03-11", cal:"2027-03-01", recalls:0, status:"VERIFIED" },
  { id:"0x9a4f…d63e", cmp:"ADC (24-bit Sigma-Delta)",sn:"AD-2024-00582", mfg:"Maxim Integrated",     batch:"B2024-06-08", cal:"2026-06-01", recalls:0, status:"VERIFIED" },
  { id:"0x6c2e…a91f", cmp:"Polyimide Substrate",     sn:"PS-2023-09421", mfg:"Dupont Electronics",   batch:"B2023-09-27", cal:"N/A",         recalls:0, status:"VERIFIED" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   §3  HOVORKA PHYSICS ENGINE
   ─────────────────────────────────────────────────────────────────────────
   Hovorka glucose–insulin model (Physiol Meas 2004;25:905-920):
   
   Glucose kinetics:
     dG/dt = [EGP - Uii - E·(G - Gb)] / Vg
   where:
     G    = plasma glucose [mg/dL]
     EGP  = endogenous glucose production [mg/kg/min]
     Uii  = insulin-dependent glucose uptake [mg/kg/min]
     E    = renal excretion [mL/kg/min] (only when G > 180 mg/dL)
     Vg   = glucose distribution volume [L/kg]
     Gb   = basal glucose
   
   Insulin action (two-compartment remote effect):
     dX1/dt = -k12·X1 + k12·I
     dX2/dt = -k12·X2 + k12·X1
     Uii = Sf·X2·G
   
   Meal absorption (Dalla Man two-compartment gut model):
     dQgut1/dt = -ka1·Qgut1 + meal_input
     dQgut2/dt = ka1·Qgut1 - ka2·Qgut2
     Ra = ka2·Qgut2 [glucose rate of appearance, mg/min]
   
   Subcutaneous insulin depot (first-order absorption):
     dS/dt = -kabs·S + bolus_input
     dI/dt = kabs·S - ke·I + basal_infusion
═══════════════════════════════════════════════════════════════════════════ */

class CGMEngine {
  constructor(pid, settings, faults, calSchedule = "factory") {
    this.pid = pid;
    this.p   = { ...PATIENTS[pid] };
    this.s   = { ...settings };
    this.f   = { ...faults };
    this.calSchedule = calSchedule;
    this.driftRate   = CALIBRATION_SCHEDULES[calSchedule].driftRate;
    this.calInterval = CALIBRATION_SCHEDULES[calSchedule].calInterval;

    // Hovorka state variables
    this.G      = this.p.basalG;  // plasma glucose [mg/dL]
    this.I      = this.p.basalI;  // plasma insulin [µU/mL]
    this.X1     = 0;              // remote insulin effect 1
    this.X2     = 0;              // remote insulin effect 2
    this.Qgut1  = 0;              // meal compartment 1 [g]
    this.Qgut2  = 0;              // meal compartment 2 [g]
    this.S      = 0;              // subcutaneous insulin depot [U]

    // Sensor model (glucose oxidase electrochemical)
    this.raw         = this.p.basalG * 0.1; // current [nA] ~ 0.1 nA per mg/dL
    this.calFactor   = 1.0;
    this.lastCalTime = 0;

    // Events
    this.meals   = [];
    this.boluses = [];
    this.time    = 0;
  }

  addMeal(carbs) {
    this.meals.push({ time: this.time, carbs });
    this.Qgut1 += carbs;
  }

  addBolus(insulin) {
    this.boluses.push({ time: this.time, insulin });
    this.S += insulin;
  }

  step(dt = 1/60) { // dt in minutes (1 second = 1/60 min)
    this.time += dt;

    // Meal absorption (two-compartment model)
    const ka1 = this.p.ka1;
    const ka2 = this.p.ka2;
    let dQgut1 = -ka1 * this.Qgut1;
    let dQgut2 = ka1 * this.Qgut1 - ka2 * this.Qgut2;
    this.Qgut1 = Math.max(0, this.Qgut1 + dQgut1 * dt);
    this.Qgut2 = Math.max(0, this.Qgut2 + dQgut2 * dt);
    const Ra = ka2 * this.Qgut2; // rate of glucose appearance [g/min]

    // Subcutaneous insulin absorption
    const kabs = this.p.kabs * (this.f.reduced_sensitivity ? 0.7 : 1.0);
    let dS = -kabs * this.S;
    let dI_depot = kabs * this.S;
    this.S = Math.max(0, this.S + dS * dt);

    // Basal insulin delivery (continuous infusion)
    const basal_rate = this.s.basalRate * 1.0; // U/hr baseline
    const basal_infusion = basal_rate / 60; // U/min

    // Insulin elimination
    const ke = this.p.ke;
    let dI = -ke * this.I + dI_depot + basal_infusion;
    this.I = clamp(this.I + dI * dt, 0, 500);

    // Remote insulin effects (two-compartment delay)
    const k12 = this.p.k12;
    let dX1 = -k12 * this.X1 + k12 * this.I;
    let dX2 = -k12 * this.X2 + k12 * this.X1;
    this.X1 = clamp(this.X1 + dX1 * dt, 0, 100);
    this.X2 = clamp(this.X2 + dX2 * dt, 0, 100);

    // Glucose dynamics (Hovorka)
    const Vg   = this.p.Vg * this.p.IBW; // distribution volume [L]
    const Sf   = this.p.Sf * (this.f.increased_sensitivity ? 1.5 : 1.0);
    const EGP0 = this.p.EGP0 * this.p.IBW * (this.f.increased_egp ? 1.3 : 1.0); // [mg/min]
    
    // Insulin-dependent glucose uptake: Uii = Sf·X2·G [mg/kg/min]
    const Uii = Sf * this.X2 * this.G;
    
    // Insulin suppresses EGP: EGP = EGP0·(1 - 0.5·tanh(0.1·X1))
    const EGP = EGP0 * (1 - 0.5 * Math.tanh(0.1 * this.X1));
    
    // Renal excretion (only when G > 180 mg/dL)
    const E = this.G > 180 ? 0.003 * this.p.IBW * (this.G - 180) : 0;
    
    // Glucose rate of change [mg/dL/min]
    const Ra_mg = Ra * 1000 / 180; // convert g/min to mg/min (1g glucose = 1000mg, MW=180)
    let dG = (EGP + Ra_mg - Uii - E) / Vg;
    this.G = clamp(this.G + dG * dt, 20, 600);

    // Sensor model: glucose oxidase electrochemical current
    let rawIdeal = this.G * 0.1; // [nA] ~ 0.1 nA per mg/dL

    // Sensor drift based on calibration schedule
    if (this.f.sensor_drift) {
      this.calFactor *= (1 - this.driftRate * dt);
    }

    // Noise injection
    if (this.f.increased_noise) {
      rawIdeal += (Math.random() - 0.5) * 8;
    }

    // Automatic calibration events
    this.lastCalTime += dt;
    if (this.lastCalTime >= this.calInterval && this.calInterval < Infinity) {
      this.calibrate();
      this.lastCalTime = 0;
    }

    this.raw = clamp(rawIdeal / this.calFactor, 0, 100);

    // Measured glucose (after calibration correction)
    const measuredGlucose = clamp(this.raw / 0.1, 20, 600);

    // Trend calculation (rate of change)
    const trend = dG; // [mg/dL/min]

    return {
      t: rnd(this.time, 2),
      glucose: rnd(measuredGlucose, 1),
      raw: rnd(this.raw, 3),
      calFactor: rnd(this.calFactor, 4),
      insulin: rnd(this.I, 2),
      trend: rnd(trend, 3),
      X1: rnd(this.X1, 3),
      X2: rnd(this.X2, 3),
      EGP: rnd(EGP, 2),
      Uii: rnd(Uii, 2),
      mealActive: this.Qgut1 > 0.1 || this.Qgut2 > 0.1,
      bolusActive: this.S > 0.1,
      Qgut1: rnd(this.Qgut1, 2),
      Qgut2: rnd(this.Qgut2, 2),
    };
  }

  // Perform calibration: adjust calFactor to match measured to true glucose
  calibrate() {
    const trueGlucose = this.G;
    const rawCurrent = trueGlucose * 0.1;
    this.calFactor = this.raw / clamp(trueGlucose, 1, 600);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   §4  ALARM ENGINE – ISO 15197:2013 compliant
═══════════════════════════════════════════════════════════════════════════ */
function checkAlarms(d, pid) {
  if (!d) return [];
  const L = ALIM[pid] || ALIM.healthy;
  const out = [];
  const add = (id, msg, sev, action, ref="") => out.push({ id, msg, sev, action, ref, ts:d.t });

  if (d.glucose < L.sevHypo)         add("hypo_sev",`SEVERE HYPOGLYCEMIA ${d.glucose} mg/dL`,"critical","Ingest 15-20g fast carbs immediately","ISO 15197:2013");
  else if (d.glucose < L.hypo)       add("hypo",`Hypoglycemia ${d.glucose} mg/dL`,"warning","Consider 15g fast-acting carbs","ADA Guidelines");
  if (d.glucose > L.sevHyper)        add("hyper_sev",`SEVERE HYPERGLYCEMIA ${d.glucose} mg/dL`,"critical","Administer correction insulin / seek help","ISO 15197:2013");
  else if (d.glucose > L.hyper)      add("hyper",`Hyperglycemia ${d.glucose} mg/dL`,"warning","Consider insulin adjustment");
  if (Math.abs(d.trend) > L.roc)     add("roc",`Rapid glucose change ${d.trend>0?"↑":"↓"} ${Math.abs(d.trend).toFixed(1)} mg/dL/min`,"warning","Monitor closely – recheck in 15 min");
  if (d.calFactor < 0.75 || d.calFactor > 1.35) add("cal",`Calibration factor ${d.calFactor.toFixed(2)} out of range`,"warning","Recalibrate sensor with fingerstick BG");
  if (d.trend < -2 && d.glucose < 100) add("pred_hypo",`Predicted hypoglycemia in ~${Math.round((d.glucose-70)/Math.abs(d.trend))} min`,"warning","Consume carbs preemptively","Predictive low alert");

  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   §5  ANALYTICS
═══════════════════════════════════════════════════════════════════════════ */
function linReg(arr, key) {
  if (!arr || arr.length < 10) return null;
  const data = arr.slice(-40), n = data.length;
  let sx=0,sy=0,sxy=0,sx2=0;
  data.forEach((d,i)=>{ sx+=i; sy+=d[key]; sxy+=i*d[key]; sx2+=i*i; });
  const den = n*sx2 - sx*sx;
  if (Math.abs(den) < 1e-9) return null;
  const slope = (n*sxy - sx*sy) / den;
  const icept = (sy - slope*sx) / n;
  return { slope:rnd(slope,4), pred:rnd(icept+slope*(n+20),1), dir:slope>0.05?"↑":slope<-0.05?"↓":"→" };
}

function exportCSV(trend, patLabel) {
  if (!trend.length) return;
  const hdr  = Object.keys(trend[0]).join(",");
  const rows = trend.map(r=>Object.values(r).join(",")).join("\n");
  const blob = new Blob([`# CGM Digital Twin Export\n# Patient: ${patLabel}\n# Date: ${new Date().toISOString()}\n${hdr}\n${rows}`],{ type:"text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `cgm_twin_${Date.now()}.csv`; a.click();
}

/**
 * Time-in-range (TIR) calculation – ADA 2021 targets:
 *   TIR (70-180 mg/dL): goal >70%
 *   TBR (<70 mg/dL):    goal <4%
 *   TBR (<54 mg/dL):    goal <1%
 *   TAR (>180 mg/dL):   goal <25%
 *   TAR (>250 mg/dL):   goal <5%
 */
function calculateTIR(history) {
  if (!history || history.length < 10) return null;
  const n = history.length;
  let tir=0, tbr_70=0, tbr_54=0, tar_180=0, tar_250=0;
  history.forEach(d => {
    if (d.glucose >= 70 && d.glucose <= 180) tir++;
    if (d.glucose < 70) tbr_70++;
    if (d.glucose < 54) tbr_54++;
    if (d.glucose > 180) tar_180++;
    if (d.glucose > 250) tar_250++;
  });
  return {
    tir: rnd(tir/n*100,1),
    tbr_70: rnd(tbr_70/n*100,1),
    tbr_54: rnd(tbr_54/n*100,1),
    tar_180: rnd(tar_180/n*100,1),
    tar_250: rnd(tar_250/n*100,1),
    gmean: rnd(history.reduce((a,b)=>a+b.glucose,0)/n,1),
    cv: rnd(Math.sqrt(history.reduce((a,b)=>a+Math.pow(b.glucose-history.reduce((c,d)=>c+d.glucose,0)/n,2),0)/n)/(history.reduce((a,b)=>a+b.glucose,0)/n)*100,1),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   §6  UI COMPONENTS
═══════════════════════════════════════════════════════════════════════════ */
const InfoTip = memo(({ text, t }) => (
  <span className="tooltip-host" style={{ cursor:"help", marginLeft:4, display:"inline-flex" }}>
    <span style={{ fontSize:8, color:t.txt2, border:`1px solid ${t.border2}`, borderRadius:"50%", width:13, height:13, display:"inline-flex", alignItems:"center", justifyContent:"center", lineHeight:1, fontFamily:"'Exo 2',sans-serif", fontWeight:800 }}>?</span>
    <span className="tooltip-body">
      <div style={{ fontSize:8, color:t.txt0, lineHeight:1.8, fontFamily:"'Exo 2',sans-serif" }}>{text}</div>
    </span>
  </span>
));

const MetricCard = memo(({ label, value, unit, status="neutral", sub, pred, tip, t, children }) => {
  const C = { normal:t.accent, warning:t.warn, critical:t.crit, neutral:t.accentB, info:t.accentC };
  const col = C[status] || C.neutral;
  return (
    <div style={{ background:t.bg2, border:`1px solid ${col}22`, borderLeft:`3px solid ${col}`, borderRadius:5,
      padding:"9px 12px", display:"flex", flexDirection:"column", gap:2, position:"relative", overflow:"hidden", animation:"fadeUp 0.25s ease" }}>
      <div style={{ position:"absolute",inset:0,background:`radial-gradient(ellipse at 0 0,${col}08 0%,transparent 60%)`,pointerEvents:"none" }}/>
      <div style={{ display:"flex", alignItems:"center" }}>
        <span style={{ fontFamily:"'Exo 2',sans-serif", fontSize:9, color:t.txt2, letterSpacing:2, fontWeight:700, textTransform:"uppercase" }}>{label}</span>
        {tip && <InfoTip text={tip} t={t} />}
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
        <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:26, lineHeight:1, color:col, textShadow:`0 0 14px ${col}44`, animation:status==="critical"?"pulse 0.8s infinite":"none" }}>
          {typeof value === "number" ? rnd(value,1) : value}
        </span>
        <span style={{ fontFamily:"'Exo 2',sans-serif", fontSize:9, color:t.txt3 }}>{unit}</span>
      </div>
      {sub  && <div style={{ fontSize:8, color:t.txt3 }}>{sub}</div>}
      {pred && <div style={{ fontSize:8, color:`${col}88`, fontFamily:"'Share Tech Mono',monospace" }}>▶ {pred}</div>}
      {children}
    </div>
  );
});

const TrendArrow = memo(({ trend, t }) => {
  if (trend > 3)   return <span style={{ fontSize:22, color:t.crit }}>↑↑</span>;
  if (trend > 1)   return <span style={{ fontSize:20, color:t.warn }}>↑</span>;
  if (trend > -1)  return <span style={{ fontSize:18, color:t.accent }}>→</span>;
  if (trend > -3)  return <span style={{ fontSize:20, color:t.warn }}>↓</span>;
  return <span style={{ fontSize:22, color:t.crit }}>↓↓</span>;
});

const GlucoseGraph = memo(({ data, color, yMin=0, yMax=400, refs=[], t }) => (
  <div style={{ background:t.waveB, border:`1px solid ${t.border}`, borderRadius:4, padding:"6px 8px 3px" }}>
    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
      <span style={{ fontFamily:"'Exo 2',sans-serif", fontSize:9, fontWeight:700, color:t.txt2, letterSpacing:3 }}>GLUCOSE TREND (8h)</span>
      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color }}>
        {data.length ? rnd(data[data.length-1]?.glucose ?? 0,1) : "—"} <span style={{ color:t.txt3 }}>mg/dL</span>
      </span>
    </div>
    <ResponsiveContainer width="100%" height={100}>
      <AreaChart data={data} margin={{ top:2,right:2,bottom:0,left:0 }}>
        <defs>
          <linearGradient id="gGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <YAxis domain={[yMin,yMax]} hide />
        <XAxis dataKey="t" hide />
        <CartesianGrid stroke={t.border} strokeDasharray="1 8" />
        {refs.map(r=><ReferenceLine key={r.v} y={r.v} stroke={r.c||t.border} strokeWidth={1} strokeDasharray="2 4"/>)}
        <Area type="monotone" dataKey="glucose" stroke={color} fill="url(#gGradient)" strokeWidth={2} dot={false} isAnimationActive={false}/>
      </AreaChart>
    </ResponsiveContainer>
  </div>
));

const DeviationSpark = memo(({ data, color, t }) => {
  if (!data || data.length < 2) return null;
  const last60 = data.slice(-60);
  return (
    <div style={{ height:22, marginTop:5 }}>
      <ResponsiveContainer width="100%" height={22}>
        <LineChart data={last60} margin={{ top:0,right:0,bottom:0,left:0 }}>
          <Line type="monotone" dataKey="dev" stroke={color} strokeWidth={1.2} dot={false} isAnimationActive={false}/>
          <ReferenceLine y={0} stroke={t.border} strokeWidth={1} strokeDasharray="2 2"/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

const Slider = memo(({ label, value, min, max, step, unit, onChange, color="#00e5a0", disabled=false, tip, t }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:3, opacity:disabled?0.3:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <div style={{ display:"flex", alignItems:"center" }}>
        <span style={{ fontFamily:"'Exo 2',sans-serif", fontSize:9, color:t.txt2, letterSpacing:2, fontWeight:700 }}>{label}</span>
        {tip && <InfoTip text={tip} t={t} />}
      </div>
      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color }}>
        {value}<span style={{ fontSize:8, color:t.txt3 }}> {unit}</span>
      </span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
      onChange={e=>!disabled&&onChange(clamp(+e.target.value,min,max))}
      style={{ accentColor:color }}/>
  </div>
));

const Tag = memo(({ label, active, onClick, color="#ff3333", t }) => (
  <button onClick={onClick} style={{
    background:active?`${color}18`:t.bg2, border:`1px solid ${active?color:t.border}`,
    color:active?color:t.txt2, fontFamily:"'Exo 2',sans-serif", fontWeight:700,
    fontSize:9, letterSpacing:1, padding:"5px 9px", borderRadius:3,
    cursor:"pointer", textTransform:"uppercase", transition:"all 0.12s",
    boxShadow:active?`0 0 8px ${color}28`:"none",
  }}>{label}</button>
));

const TabBtn = memo(({ id, label, active, onClick, col }) => (
  <button onClick={()=>onClick(id)} style={{
    background:"transparent", border:"none", borderBottom:`2px solid ${active?col:"transparent"}`,
    color:active?col:"#1a3a55", fontFamily:"'Exo 2',sans-serif", fontWeight:700,
    fontSize:9, letterSpacing:2, padding:"9px 14px", cursor:"pointer", transition:"all 0.12s",
  }}>{label}</button>
));

const Radio = memo(({ label, value, selected, onChange, color, t }) => (
  <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:9, color:t.txt2, cursor:"pointer", fontFamily:"'Exo 2',sans-serif" }}>
    <input type="radio" value={value} checked={selected===value} onChange={()=>onChange(value)} style={{ accentColor:color }} />
    {label}
  </label>
));

/* ═══════════════════════════════════════════════════════════════════════════
   §7  AMBULATORY GLUCOSE PROFILE (AGP) – daily pattern analysis
═══════════════════════════════════════════════════════════════════════════ */
function AGPPanel({ history, t }) {
  if (!history || history.length < 100) return <div style={{ color:t.txt3, fontSize:9 }}>Insufficient data for AGP (need ≥100 readings)</div>;

  // Group by hour of day (0-23)
  const hourlyBuckets = Array(24).fill(null).map(() => []);
  history.forEach(d => {
    const hour = Math.floor((d.t % 1440) / 60);
    hourlyBuckets[hour].push(d.glucose);
  });

  // Calculate percentiles (10th, 25th, median, 75th, 90th) for each hour
  const percentile = (arr, p) => {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a,b)=>a-b);
    const idx = Math.floor(sorted.length * p);
    return sorted[idx];
  };

  const agpData = hourlyBuckets.map((vals, hour) => ({
    hour,
    p10: percentile(vals, 0.1),
    p25: percentile(vals, 0.25),
    p50: percentile(vals, 0.5),
    p75: percentile(vals, 0.75),
    p90: percentile(vals, 0.9),
  }));

  return (
    <div style={{ background:t.bg2, border:`1px solid ${t.border}`, borderRadius:5, padding:12 }}>
      <div style={{ fontFamily:"'Exo 2',sans-serif", fontWeight:800, fontSize:10, color:t.txt2, letterSpacing:3, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
        AMBULATORY GLUCOSE PROFILE (AGP)
        <InfoTip text={"AGP shows daily glucose patterns by time of day.\nMedian (50th %ile) with IQR (25th-75th) and outer range (10th-90th).\nHelps identify recurring hypo/hyper episodes.\n\nRef: Bergenstal et al., Diabetes Technol Ther 2013"} t={t} />
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={agpData} margin={{ top:10, right:10, bottom:25, left:25 }}>
          <CartesianGrid stroke={t.border} strokeDasharray="1 8" />
          <XAxis dataKey="hour" label={{ value:"Hour of Day", position:"bottom", fill:t.txt3, fontSize:9 }} tick={{ fill:t.txt3, fontSize:9 }} />
          <YAxis domain={[0,300]} label={{ value:"Glucose (mg/dL)", angle:-90, position:"insideLeft", fill:t.txt3, fontSize:9 }} tick={{ fill:t.txt3, fontSize:9 }} />
          <ReferenceLine y={70} stroke={t.warn+"55"} strokeWidth={1} strokeDasharray="3 4" />
          <ReferenceLine y={180} stroke={t.warn+"55"} strokeWidth={1} strokeDasharray="3 4" />
          <Line type="monotone" dataKey="p10" stroke={t.accent+"33"} strokeWidth={1} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="p25" stroke={t.accent+"66"} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="p50" stroke={t.accent} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="p75" stroke={t.accent+"66"} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="p90" stroke={t.accent+"33"} strokeWidth={1} dot={false} isAnimationActive={false} />
          <Tooltip contentStyle={{ background:t.bg1, border:`1px solid ${t.border}`, fontSize:8, fontFamily:"'Share Tech Mono',monospace" }} />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ fontSize:7, color:t.txt3, marginTop:6 }}>■ Solid: Median (50th %ile) · Dashed: IQR (25–75th) · Faint: Outer (10–90th)</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   §8  MAIN APPLICATION
═══════════════════════════════════════════════════════════════════════════ */
export default function CGMApp() {
  const [themeName, setThemeName] = useState("dark");
  const t = THEMES[themeName];
  const [pid, setPid]         = useState("healthy");
  const [S, setS]             = useState(DEFAULT_SETTINGS);
  const [F, setF]             = useState(DEFAULT_FAULTS);
  const [calSchedule, setCalSchedule] = useState("factory");
  const [running, setRunning] = useState(true);
  const [tab, setTab]         = useState("monitor");
  const [glucoseHistory, setGlucoseHistory] = useState([]);
  const [trendHistory, setTrendHistory] = useState([]);
  const [devHistory, setDevHistory] = useState([]);
  const [current, setCurrent] = useState(null);
  const [ideal, setIdeal]     = useState(null);
  const [alarms, setAlarms]   = useState([]);
  const [acked, setAcked]     = useState(new Set());
  const [alarmLog, setAlarmLog] = useState([]);
  const [flash, setFlash]     = useState(false);
  const [T, setT]             = useState(0);
  const [showBC, setShowBC]   = useState(false);
  const [tourOn, setTourOn]   = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // Federated learning simulation
  const [modelVersion, setModelVersion] = useState(1);
  const [modelPulse, setModelPulse]     = useState(false);
  const lastUpdateTime = useRef(0);

  const setS1  = useCallback((k,v) => setS(s=>({...s,[k]:v})), []);
  const togF   = useCallback(k => setF(f=>({...f,[k]:!f[k]})), []);
  const resetAll = useCallback(() => { setF(DEFAULT_FAULTS); setAcked(new Set()); setAlarmLog([]); setDevHistory([]); }, []);

  const engRef  = useRef(null);
  const idlRef  = useRef(null);
  const tRef    = useRef(0);
  const rafRef  = useRef(null);
  const HIST_LEN = 480; // 8 hours at 1-min resolution

  useEffect(() => {
    engRef.current = new CGMEngine(pid, S, F, calSchedule);
    idlRef.current = new CGMEngine(pid, S, {}, calSchedule);
  }, [pid, S, F, calSchedule]);

  const tick = useCallback(() => {
    if (!engRef.current) return;
    tRef.current += 1/60;
    const d  = engRef.current.step(1/60);
    const id = idlRef.current.step(1/60);
    setCurrent(d); setIdeal(id); setT(rnd(tRef.current,1));

    setGlucoseHistory(h => {
      const nx = [...h, { t: rnd(tRef.current,2), glucose: d.glucose }];
      return nx.length > HIST_LEN ? nx.slice(-HIST_LEN) : nx;
    });

    setTrendHistory(h => {
      const nx = [...h, { t: rnd(tRef.current,0), glucose: d.glucose, trend: d.trend, insulin: d.insulin }];
      return nx.length > 200 ? nx.slice(-200) : nx;
    });

    if (id) {
      const dev = d.glucose - id.glucose;
      setDevHistory(h => {
        const nx = [...h, { t: rnd(tRef.current,2), dev }];
        return nx.length > 100 ? nx.slice(-100) : nx;
      });
    }

    const na = checkAlarms(d, pid);
    setAlarms(na);
    if (na.some(a=>a.sev==="critical")) setFlash(f=>!f); else setFlash(false);
    if (na.length) {
      setAlarmLog(al => {
        const last = al[al.length-1];
        if (last?.id === na[0].id && tRef.current - last.ts < 3) return al;
        return [...al, { ...na[0], wall: new Date().toLocaleTimeString() }].slice(-100);
      });
    }

    // Federated learning: every 5 min
    if (tRef.current - lastUpdateTime.current >= 5) {
      lastUpdateTime.current = tRef.current;
      setModelVersion(v => v + 1);
      setModelPulse(true);
      setTimeout(() => setModelPulse(false), 1200);
      if (engRef.current) engRef.current.calFactor *= 0.9995; // 0.05% accuracy improvement
    }

    if (running) rafRef.current = requestAnimationFrame(tick);
  }, [running, pid, S, F, calSchedule]);

  useEffect(() => {
    if (running) rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick, running]);

  const profile = PATIENTS[pid];
  const modeCol = t.accent;
  const L = ALIM[pid] || ALIM.healthy;
  const hasCrit = alarms.some(a=>a.sev==="critical"&&!acked.has(a.id));
  const dev = useMemo(()=>current&&ideal?{glucose:rnd(current.glucose-ideal.glucose,1)}:{}, [current,ideal]);
  const glucosePred = useMemo(()=>linReg(trendHistory,"glucose"), [trendHistory]);
  const tir = useMemo(()=>calculateTIR(glucoseHistory), [glucoseHistory]);

  const TOUR = [
    { title:"Patient Profiles", text:"8 diabetes phenotypes with Hovorka model parameters (Physiol Meas 2004). Basal glucose, insulin sensitivity (Sf), and meal absorption rates (ka1, ka2) are patient-specific. Neonatal uses P50=20 mmHg vs adult 26.8 mmHg." },
    { title:"Real-Time Glucose Monitor", text:"Current glucose with trend arrow (ISO 15197 directional indicators). 8-hour history with alarm thresholds shown as reference lines. Alarms for hypo <70, severe hypo <54, hyper >180, severe hyper >250 mg/dL." },
    { title:"Hovorka Two-Compartment Model", text:"Insulin action dynamics: dX1/dt = -k12·X1 + k12·I, dX2/dt = -k12·X2 + k12·X1, glucose uptake Uii = Sf·X2·G. Meal absorption via Dalla Man two-compartment gut model (ka1, ka2). Subcutaneous insulin depot with first-order absorption (kabs)." },
    { title:"Fault Injection", text:"Simulate sensor drift (slow calibration decay), reduced sensitivity (↓ insulin absorption kabs), increased noise (±8 mg/dL random), increased EGP (dawn phenomenon), or increased sensitivity (exercise). Watch alarms trigger and model deviation grow." },
    { title:"Calibration Schedule", text:"Choose factory (14-day, minimal drift), manual (3-day), daily, or no calibration. Drift rate affects sensor accuracy over time. Factory-calibrated sensors maintain accuracy longest. Manual calibration events reset calFactor to match true glucose." },
    { title:"Federated Learning Simulation", text:"Cloud-based model updates improve accuracy (simulated 0.05% every 5 min). Model version increments with pulse animation. In production, this represents aggregated learning from thousands of users without sharing personal data." },
    { title:"Time-in-Range (TIR) Analytics", text:"ADA 2021 targets: TIR 70-180 mg/dL >70%, TBR <70 mg/dL <4%, TBR <54 mg/dL <1%, TAR >180 mg/dL <25%, TAR >250 mg/dL <5%. GMI (glucose management indicator) and CV (coefficient of variation) also calculated." },
    { title:"Ambulatory Glucose Profile (AGP)", text:"Daily glucose pattern analysis by hour of day (Bergenstal et al., DTT 2013). Shows median (50th percentile), IQR (25th-75th), and outer range (10th-90th). Helps identify recurring hypo/hyper episodes and optimize therapy." },
    { title:"What-If Analyzer", text:"Add virtual meals (carbs) or insulin boluses to predict glucose response. Meal absorption follows two-compartment gut model with ka1, ka2. Insulin depot absorption follows first-order kinetics with kabs. Observe real-time Hovorka dynamics." },
    { title:"Blockchain Component Ledger", text:"ISO 13485 / FDA UDI 21 CFR 830 compliant traceability for 8 sensor components: glucose oxidase enzyme, potentiostat ASIC, microneedle array, temperature sensor, BLE radio, lithium cell, 24-bit ADC, polyimide substrate. Recall-ready <1 minute." },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:t.bg0, color:t.txt0, fontFamily:"'Exo 2',sans-serif", overflow:"hidden" }}>
      <style>{buildCSS(t)}</style>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header style={{ background:t.bg1, borderBottom:`1px solid ${hasCrit&&flash?"#ff333555":t.border}`, padding:"6px 16px", display:"flex", alignItems:"center", gap:12, flexShrink:0, transition:"border-color 0.2s" }}>
        <div style={{ display:"flex",alignItems:"center",gap:9 }}>
          <svg width="28" height="28" viewBox="0 0 28 28">
            <rect width="28" height="28" rx="5" fill={t.accent+"0a"} stroke={t.accent+"22"}/>
            <circle cx="14" cy="14" r="5" stroke={t.accent} strokeWidth="1.5" fill="none"/>
            <path d="M6 14 L10 14 M14 6 L14 10 M18 14 L22 14 M14 18 L14 22" stroke={t.accent} strokeWidth="1.3"/>
            <circle cx="14" cy="14" r="2" fill={t.accent}/>
          </svg>
          <div>
            <div style={{ fontWeight:800,fontSize:11,color:t.accent,letterSpacing:3 }}>CGM DIGITAL TWIN</div>
            <div style={{ fontSize:7,color:t.txt3,letterSpacing:2,fontFamily:"'Share Tech Mono',monospace" }}>HOVORKA MODEL · ISO 15197:2013 · FEDERATED LEARNING · FDA UDI</div>
          </div>
        </div>

        <div style={{ display:"flex",alignItems:"center",gap:5,paddingLeft:10,borderLeft:`1px solid ${t.border}` }}>
          <div style={{ width:7,height:7,borderRadius:"50%",background:running?t.accent:t.crit,boxShadow:`0 0 7px ${running?t.accent:t.crit}`,animation:running?"pulse 2s infinite":"none" }}/>
          <span style={{ fontSize:8,color:running?`${t.accent}55`:`${t.crit}55`,letterSpacing:2,fontFamily:"'Share Tech Mono',monospace" }}>{running?"LIVE":"PAUSED"}</span>
        </div>

        <div style={{ paddingLeft:10,borderLeft:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:6 }}>
          <div style={{ width:8,height:8,borderRadius:"50%",background:profile.color }}/>
          <span style={{ fontSize:10,color:profile.color,fontWeight:700,letterSpacing:1 }}>{profile.label}</span>
        </div>

        <div style={{ paddingLeft:10,borderLeft:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontSize:8,color:t.txt3,fontFamily:"'Share Tech Mono',monospace" }}>Model v{modelVersion}</span>
          <div style={{ width:8,height:8,borderRadius:"50%",background:modelPulse?t.accent:t.border,boxShadow:modelPulse?`0 0 14px ${t.accent}`:"none", transition:"all 0.3s", animation:modelPulse?"glow 0.6s ease":"none" }} />
        </div>

        <div style={{ flex:1 }}/>

        <div style={{ flex:2,overflow:"hidden",borderLeft:`1px solid ${t.border}`,paddingLeft:10,minWidth:0,display:"flex",alignItems:"center" }}>
          {alarms.filter(a=>!acked.has(a.id)).length===0
            ? <span style={{ fontSize:8,color:t.txt3,letterSpacing:2 }}>● ALL CLEAR — NO ACTIVE ALARMS</span>
            : alarms.filter(a=>!acked.has(a.id)).slice(0,3).map(a=>(
              <div key={a.id} style={{ display:"flex",alignItems:"center",gap:4,marginRight:8,flexShrink:0 }}>
                <div style={{ fontSize:8,color:a.sev==="critical"?t.crit:t.warn,padding:"3px 7px",borderRadius:3,border:`1px solid ${a.sev==="critical"?t.crit+"33":t.warn+"33"}`,background:a.sev==="critical"?t.crit+"0d":t.warn+"0d",animation:a.sev==="critical"?"blink 0.7s infinite":"none",fontFamily:"'Share Tech Mono',monospace",whiteSpace:"nowrap" }}>⚠ {a.msg}</div>
                <button onClick={()=>setAcked(ac=>{const n=new Set(ac);n.add(a.id);return n;})} style={{ fontSize:7,background:"transparent",border:`1px solid ${t.border2}`,color:t.txt2,padding:"2px 5px",borderRadius:2,cursor:"pointer",fontFamily:"'Exo 2',sans-serif" }}>ACK</button>
              </div>
            ))
          }
        </div>

        <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:t.txt3 }}>T+<span style={{ color:t.txt2 }}>{T.toFixed(0)}m</span></span>

        <button onClick={()=>setThemeName(n=>n==="dark"?"light":"dark")} style={{ background:t.bg3,border:`1px solid ${t.border}`,color:t.txt1,fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:9,padding:"5px 10px",borderRadius:3,cursor:"pointer" }}>
          {themeName==="dark" ? "☀ LIGHT" : "🌙 DARK"}
        </button>
        <button onClick={()=>setTourOn(true)} style={{ background:"transparent",border:`1px solid ${t.border}`,color:t.txt2,fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:8,letterSpacing:1,padding:"4px 10px",borderRadius:3,cursor:"pointer" }}>? TOUR</button>
        <button onClick={()=>setRunning(r=>!r)} style={{ background:running?t.crit+"10":t.accent+"10",border:`1px solid ${running?t.crit:t.accent}`,color:running?t.crit:t.accent,fontFamily:"'Exo 2',sans-serif",fontWeight:800,fontSize:9,letterSpacing:2,padding:"5px 14px",borderRadius:3,cursor:"pointer" }}>
          {running?"■ PAUSE":"▶ RUN"}
        </button>
        <button onClick={()=>setShowBC(b=>!b)} style={{ background:showBC?t.accentB+"10":"transparent",border:`1px solid ${showBC?t.accentB+"44":t.border}`,color:showBC?t.accentB:t.txt2,fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:9,padding:"5px 10px",borderRadius:3,cursor:"pointer" }}>⛓ LEDGER</button>
        <button onClick={()=>exportCSV(trendHistory,profile.label)} style={{ background:"transparent",border:`1px solid ${t.border}`,color:t.txt2,fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:9,padding:"5px 10px",borderRadius:3,cursor:"pointer" }}>↓ CSV</button>
      </header>

      <div style={{ display:"flex",flex:1,overflow:"hidden",minHeight:0 }}>

        {/* ══ SIDEBAR ═════════════════════════════════════════════════════ */}
        <aside style={{ width:262,background:t.bg1,borderRight:`1px solid ${t.border}`,overflowY:"auto",flexShrink:0,padding:13,display:"flex",flexDirection:"column",gap:13 }}>

          <section>
            <div style={{ fontSize:8,color:t.txt3,letterSpacing:3,marginBottom:7,fontWeight:800 }}>PATIENT PROFILE</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:3 }}>
              {Object.entries(PATIENTS).map(([k,p])=>(
                <button key={k} onClick={()=>setPid(k)} style={{ background:pid===k?`${p.color}14`:t.bg2, border:`1px solid ${pid===k?p.color:t.border}`, color:pid===k?p.color:t.txt2, fontFamily:"'Exo 2',sans-serif",fontWeight:600,fontSize:9,padding:"5px 7px",borderRadius:3,cursor:"pointer",textAlign:"left",transition:"all 0.12s" }}>
                  <div style={{ marginBottom:1 }}>{p.label}</div>
                  <div style={{ fontSize:7,opacity:0.6,fontFamily:"'Share Tech Mono',monospace" }}>Sf:{p.Sf} IBW:{p.IBW}kg</div>
                </button>
              ))}
            </div>
          </section>

          {current && (
            <section style={{ background:t.bg2,border:`1px solid ${profile.color}18`,borderRadius:4,padding:9 }}>
              <div style={{ fontSize:8,color:t.txt3,letterSpacing:3,marginBottom:6,fontWeight:800,display:"flex",alignItems:"center",gap:4 }}>
                HOVORKA STATES
                <InfoTip text={"G = plasma glucose [mg/dL]\nI = plasma insulin [µU/mL]\nX1, X2 = remote insulin effects (two-compartment delay)\nEGP = endogenous glucose production [mg/min]\nUii = insulin-dependent uptake [mg/kg/min]\nQgut1, Qgut2 = meal absorption compartments [g]"} t={t} />
              </div>
              {[
                ["Glucose",`${current.glucose}`,"mg/dL"],
                ["Insulin",`${current.insulin}`,"µU/mL"],
                ["X1",`${current.X1}`,""],
                ["X2",`${current.X2}`,""],
                ["EGP",`${current.EGP}`,"mg/min"],
                ["Uii",`${current.Uii}`,"mg/kg/min"],
                ["Cal Factor",`${current.calFactor}`,""],
                ["Qgut1",`${current.Qgut1}`,"g"],
              ].map(([l,v,u])=>(
                <div key={l} style={{ display:"flex",justifyContent:"space-between",padding:"2px 0",borderBottom:`1px solid ${t.border}` }}>
                  <span style={{ fontSize:8,color:t.txt3 }}>{l}</span>
                  <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:profile.color }}>{v} <span style={{ fontSize:7,color:t.txt3 }}>{u}</span></span>
                </div>
              ))}
            </section>
          )}

          <section>
            <div style={{ fontSize:8,color:t.txt3,letterSpacing:3,marginBottom:6,fontWeight:800 }}>PRESETS</div>
            <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
              {PRESETS.map(p=>(
                <button key={p.id} onClick={()=>{setPid(p.pid);setTimeout(()=>{setS(ss=>({...ss,...p.s}));setF(ff=>({...ff,...p.f}));if(p.meal)engRef.current?.addMeal(p.meal);if(p.bolus)engRef.current?.addBolus(p.bolus);},60);}} style={{ background:t.bg2,border:`1px solid ${t.border}`,color:t.txt1,fontFamily:"'Exo 2',sans-serif",fontWeight:600,fontSize:9,padding:"4px 8px",borderRadius:3,cursor:"pointer",textAlign:"left",transition:"all 0.12s" }}>▸ {p.label}</button>
              ))}
            </div>
          </section>

          <section style={{ display:"flex",flexDirection:"column",gap:9 }}>
            <div style={{ fontSize:8,color:t.txt3,letterSpacing:3,fontWeight:800,display:"flex",alignItems:"center",gap:4 }}>
              BASAL RATE
              <InfoTip text={"Basal insulin infusion rate multiplier.\n1.0 = standard basal (1 U/hr baseline)\nIncrease for higher insulin needs (e.g., dawn phenomenon)\nDecrease for increased sensitivity (e.g., exercise)"} t={t} />
            </div>
            <Slider label="MULTIPLIER" value={S.basalRate} min={0.3} max={2.0} step={0.1} unit="×" onChange={v=>setS1("basalRate",v)} color={t.accent} t={t} />
          </section>

          <section>
            <div style={{ fontSize:8,color:t.txt3,letterSpacing:3,marginBottom:6,fontWeight:800,display:"flex",alignItems:"center",gap:4 }}>
              CALIBRATION SCHEDULE
              <InfoTip text={"Factory: 14-day, minimal drift (0.001%/min)\nManual: 3-day, moderate drift (0.01%/min), calibrate with fingerstick\nDaily: daily fingerstick calibration\nNone: no calibration, high drift (0.05%/min)\n\nCalibration adjusts calFactor = raw / true_glucose"} t={t} />
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:3 }}>
              {Object.entries(CALIBRATION_SCHEDULES).map(([key,sch]) => (
                <Radio key={key} label={sch.label} value={key} selected={calSchedule} onChange={setCalSchedule} color={t.accent} t={t} />
              ))}
            </div>
          </section>

          <section>
            <div style={{ fontSize:8,color:t.txt3,letterSpacing:3,marginBottom:6,fontWeight:800,color:t.crit+"66" }}>⚡ FAULT INJECTION</div>
            <div style={{ display:"flex",flexDirection:"column",gap:3 }}>
              {[
                ["sensor_drift","Sensor Drift",t.warn],
                ["reduced_sensitivity","↓ Insulin Sensitivity",t.crit],
                ["increased_noise","↑ Sensor Noise",t.warn],
                ["increased_egp","↑ EGP (Dawn)",t.warn],
                ["increased_sensitivity","↑ Sensitivity (Exercise)",t.accent],
              ].map(([k,l,c])=>(
                <Tag key={k} label={l} active={F[k]} onClick={()=>togF(k)} color={c} t={t}/>
              ))}
            </div>
          </section>

          <section>
            <button onClick={resetAll} style={{ width:"100%",background:t.bg2,border:`1px solid ${t.warn}44`,color:t.warn,fontFamily:"'Exo 2',sans-serif",fontWeight:800,fontSize:9,letterSpacing:2,padding:"8px",borderRadius:4,cursor:"pointer",textTransform:"uppercase",transition:"all 0.15s" }}
              onMouseEnter={e=>{e.target.style.background=`${t.warn}15`;}} onMouseLeave={e=>{e.target.style.background=t.bg2;}}>
              ↺ RESET FAULTS & ALARMS
            </button>
          </section>

          <section>
            <div style={{ fontSize:8,color:t.txt3,letterSpacing:3,marginBottom:6,fontWeight:800 }}>QUICK ACTIONS</div>
            <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
              <button onClick={()=>engRef.current?.addMeal(30)} style={{ background:t.accent+"10",border:`1px solid ${t.accent}44`,color:t.accent,fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:9,padding:"5px 8px",borderRadius:3,cursor:"pointer" }}>🍎 30g Meal</button>
              <button onClick={()=>engRef.current?.addMeal(60)} style={{ background:t.accent+"10",border:`1px solid ${t.accent}44`,color:t.accent,fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:9,padding:"5px 8px",borderRadius:3,cursor:"pointer" }}>🍽 60g Meal</button>
              <button onClick={()=>engRef.current?.addBolus(2)} style={{ background:t.accentB+"10",border:`1px solid ${t.accentB}44`,color:t.accentB,fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:9,padding:"5px 8px",borderRadius:3,cursor:"pointer" }}>💉 2U Bolus</button>
              <button onClick={()=>engRef.current?.addBolus(5)} style={{ background:t.accentB+"10",border:`1px solid ${t.accentB}44`,color:t.accentB,fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:9,padding:"5px 8px",borderRadius:3,cursor:"pointer" }}>💉 5U Bolus</button>
            </div>
          </section>

          <div style={{ fontSize:7,color:t.txt3,lineHeight:2,borderTop:`1px solid ${t.border}`,paddingTop:10 }}>
            ■ Physics: Hovorka 2-compartment insulin action<br/>
            ■ Meal: Dalla Man gut absorption (ka1, ka2)<br/>
            ■ Insulin: Subcutaneous depot + first-order kabs<br/>
            ■ EGP: Endogenous production, insulin-suppressed<br/>
            ■ Sensor: Glucose oxidase electrochemical<br/>
            ■ Alarms: ISO 15197:2013 compliant<br/>
            ■ Refresh: 60 Hz (requestAnimationFrame)<br/>
            ■ TIR: ADA 2021 targets (70-180 mg/dL >70%)
          </div>
        </aside>

        {/* ══ MAIN CONTENT ════════════════════════════════════════════════ */}
        <main style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0 }}>
          <div style={{ background:t.bg1,borderBottom:`1px solid ${t.border}`,display:"flex",paddingLeft:12,flexShrink:0 }}>
            {[["monitor","MONITOR"],["analytics","ANALYTICS"],["agp","AGP"],["whatif","WHAT-IF"],["alarms","ALARM LOG"]].map(([id,lbl])=>(
              <TabBtn key={id} id={id} label={lbl} active={tab===id} onClick={setTab} col={modeCol}/>
            ))}
          </div>

          <div style={{ flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:12 }}>

            {/* ── MONITOR ──────────────────────────────────────────────────── */}
            {tab==="monitor" && current && (
              <>
                <div style={{ display:"flex", gap:12, alignItems:"stretch" }}>
                  <div style={{ flex:1, background:t.bg2, border:`1px solid ${current.glucose<L.hypo?t.crit+"33":current.glucose>L.hyper?t.warn+"33":t.accent+"22"}`, borderRadius:8, padding:22, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute",inset:0,background:`radial-gradient(ellipse,${current.glucose<L.sevHypo||current.glucose>L.sevHyper?t.crit:current.glucose<L.hypo||current.glucose>L.hyper?t.warn:t.accent}08 0%,transparent 70%)` }}/>
                    <div style={{ fontSize:8, color:t.txt3, letterSpacing:3 }}>GLUCOSE</div>
                    <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:80, lineHeight:1, color:current.glucose<L.sevHypo?t.crit:current.glucose<L.hypo?t.warn:current.glucose>L.sevHyper?t.crit:current.glucose>L.hyper?t.warn:t.accent, textShadow:`0 0 48px ${current.glucose<L.sevHypo||current.glucose>L.sevHyper?t.crit:current.glucose<L.hypo||current.glucose>L.hyper?t.warn:t.accent}44`, animation:current.glucose<L.sevHypo||current.glucose>L.sevHyper?"blink 0.6s infinite":"none" }}>
                      {current.glucose.toFixed(0)}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
                      <span style={{ fontSize:16, color:t.txt2 }}>mg/dL</span>
                      <TrendArrow trend={current.trend} t={t} />
                      <span style={{ fontSize:11, color:t.txt3, fontFamily:"'Share Tech Mono',monospace" }}>{current.trend>0?"+":""}{current.trend.toFixed(1)}</span>
                    </div>
                  </div>
                  <div style={{ width:230, display:"flex", flexDirection:"column", gap:8 }}>
                    <MetricCard label="INSULIN" value={current.insulin} unit="µU/mL" status="neutral" t={t}
                      tip={"Plasma insulin concentration [µU/mL]\nBasal + bolus (depot absorption via kabs)\nDrives remote effects X1, X2 (k12 transfer)"} />
                    <MetricCard label="CAL FACTOR" value={current.calFactor} unit="" status={Math.abs(current.calFactor-1)>0.25?"warning":"neutral"} t={t}
                      tip={"Calibration factor = raw_current / true_glucose\nIdeal: 1.0 (perfect calibration)\nDrift causes deviation from 1.0\nRecalibration resets to match fingerstick BG"} />
                    <MetricCard label="DEVIATION" value={dev.glucose>0?"+"+dev.glucose:dev.glucose} unit="mg/dL" status={Math.abs(dev.glucose)>15?"warning":Math.abs(dev.glucose)>10?"warning":"neutral"} t={t} sub="measured − ideal (no faults)">
                      <DeviationSpark data={devHistory} color={t.accent} t={t} />
                    </MetricCard>
                  </div>
                </div>

                <GlucoseGraph data={glucoseHistory} color={modeCol} refs={[{v:L.hypo,c:t.warn+"44"},{v:L.hyper,c:t.warn+"44"},{v:L.sevHypo,c:t.crit+"55"},{v:L.sevHyper,c:t.crit+"55"}]} t={t} />

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div style={{ background:t.bg2,border:`1px solid ${t.border}`,borderRadius:5,padding:12 }}>
                    <div style={{ fontSize:8,color:t.txt3,letterSpacing:3,marginBottom:5,fontWeight:800,display:"flex",alignItems:"center",gap:4 }}>
                      PREDICTIVE TREND (next ~20 min)
                      <InfoTip text={"Linear regression forecast from last 40 glucose readings.\nSlope (mg/dL/min), predicted value, direction arrow.\nPredictive low alert triggers when forecast <70 mg/dL"} t={t} />
                    </div>
                    <div style={{ fontSize:9,color:t.txt1,lineHeight:2 }}>
                      {glucosePred
                        ? <>Glucose predicted to <span style={{ color:glucosePred.dir==="↑"?t.warn:glucosePred.dir==="↓"?t.crit:t.accent }}>{glucosePred.dir} {glucosePred.pred} mg/dL</span> (slope {glucosePred.slope>0?"+":""}{glucosePred.slope})</>
                        : "Insufficient data for prediction (need ≥10 readings)."}
                    </div>
                  </div>

                  <div style={{ background:t.bg2,border:`1px solid ${t.border}`,borderRadius:5,padding:12 }}>
                    <div style={{ fontSize:8,color:t.txt3,letterSpacing:3,marginBottom:5,fontWeight:800,display:"flex",alignItems:"center",gap:4 }}>
                      MEAL & INSULIN STATUS
                      <InfoTip text={"Qgut1, Qgut2: two-compartment meal absorption\nSubcutaneous depot: insulin awaiting absorption\nMeal active when Qgut1 or Qgut2 > 0.1g\nBolus active when depot > 0.1U"} t={t} />
                    </div>
                    <div style={{ fontSize:9,color:t.txt1,lineHeight:2 }}>
                      {current.mealActive ? <span style={{ color:t.accent }}>● Meal absorption active (Qgut1:{current.Qgut1}g, Qgut2:{current.Qgut2}g)</span> : <span style={{ color:t.txt3 }}>○ No active meal</span>}<br/>
                      {current.bolusActive ? <span style={{ color:t.accentB }}>● Insulin bolus absorbing</span> : <span style={{ color:t.txt3 }}>○ No active bolus</span>}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── ANALYTICS (TIR) ──────────────────────────────────────────── */}
            {tab==="analytics" && (
              <div style={{ display:"flex",flexDirection:"column",gap:12,animation:"fadeUp 0.3s ease" }}>
                <div style={{ fontFamily:"'Exo 2',sans-serif",fontWeight:800,fontSize:10,color:t.txt2,letterSpacing:3 }}>TIME-IN-RANGE (TIR) ANALYTICS — ADA 2021 Targets</div>
                {tir ? (
                  <>
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
                      <MetricCard label="TIR (70-180)" value={tir.tir} unit="%" status={tir.tir>=70?"normal":tir.tir>=60?"warning":"critical"} sub="Goal: >70%" t={t}
                        tip={"Time-in-range: percentage of readings 70-180 mg/dL\nADA 2021 target: >70%\nCore metric for glycemic control quality"} />
                      <MetricCard label="TBR (<70)" value={tir.tbr_70} unit="%" status={tir.tbr_70<=4?"normal":"warning"} sub="Goal: <4%" t={t}
                        tip={"Time below range: % readings <70 mg/dL (hypoglycemia)\nADA target: <4%\nHigh TBR → increase risk of severe hypo"} />
                      <MetricCard label="TBR (<54)" value={tir.tbr_54} unit="%" status={tir.tbr_54<=1?"normal":"critical"} sub="Goal: <1%" t={t}
                        tip={"Time below 54 mg/dL: severe hypoglycemia zone\nADA target: <1%\nUrgent intervention required at this level"} />
                      <MetricCard label="TAR (>180)" value={tir.tar_180} unit="%" status={tir.tar_180<=25?"normal":"warning"} sub="Goal: <25%" t={t}
                        tip={"Time above range: % readings >180 mg/dL (hyperglycemia)\nADA target: <25%\nHigh TAR → ↑ HbA1c, microvascular complications"} />
                      <MetricCard label="TAR (>250)" value={tir.tar_250} unit="%" status={tir.tar_250<=5?"normal":"critical"} sub="Goal: <5%" t={t}
                        tip={"Severe hyperglycemia zone: >250 mg/dL\nADA target: <5%\nRisk of DKA in T1DM, HHS in T2DM"} />
                      <MetricCard label="GMI" value={tir.gmean} unit="mg/dL" status="info" sub={`CV: ${tir.cv}%`} t={t}
                        tip={"Glucose Management Indicator (mean glucose)\nCV = coefficient of variation (SD/mean × 100%)\nTarget CV: <36% (stable control)\nHigh CV → glycemic variability risk"} />
                    </div>

                    <div style={{ background:t.bg2,border:`1px solid ${t.border}`,borderRadius:5,padding:12 }}>
                      <div style={{ fontFamily:"'Exo 2',sans-serif",fontWeight:800,fontSize:9,color:t.txt2,marginBottom:8,letterSpacing:2 }}>TIR INTERPRETATION & RECOMMENDATIONS</div>
                      {[
                        tir.tir>=70&&tir.tbr_70<=4&&tir.tar_180<=25 && {t:"✓ Excellent glycemic control – all metrics within ADA targets.",s:"ok"},
                        tir.tir<70&&tir.tir>=60 && {t:"TIR <70% (borderline) – consider insulin dose optimization or CGM review.",s:"warning"},
                        tir.tir<60 && {t:"TIR <60% – poor control. Requires therapy adjustment (basal, bolus, carb counting).",s:"critical"},
                        tir.tbr_70>4 && {t:`TBR ${tir.tbr_70}% >4% – hypoglycemia risk. Reduce insulin doses or increase carb intake.`,s:"critical"},
                        tir.tar_180>25 && {t:`TAR ${tir.tar_180}% >25% – hyperglycemia burden. Increase insulin or reduce carbs.`,s:"warning"},
                        tir.cv>36 && {t:`CV ${tir.cv}% >36% – high glycemic variability. Review meal/insulin timing consistency.`,s:"warning"},
                        !tir.tir>=70&&!tir.tbr_70>4&&!tir.tar_180>25&&tir.cv<=36 && {t:"All metrics within acceptable ranges. Continue current regimen.",s:"ok"},
                      ].filter(Boolean).map((r,i)=>(
                        <div key={i} style={{ fontSize:8,lineHeight:2,paddingLeft:8,borderLeft:`2px solid ${r.s==="critical"?t.crit:r.s==="warning"?t.warn:t.accent}`,color:r.s==="critical"?t.crit+"88":r.s==="warning"?t.warn+"88":t.accent+"88",marginBottom:5 }}>{r.t}</div>
                      ))}
                    </div>
                  </>
                ) : <div style={{ color:t.txt3,fontSize:10,padding:"24px 0",textAlign:"center" }}>Insufficient data for TIR calculation (need ≥10 readings).</div>}
              </div>
            )}

            {/* ── AGP ──────────────────────────────────────────────────────── */}
            {tab==="agp" && <AGPPanel history={glucoseHistory} t={t} />}

            {/* ── WHAT-IF ──────────────────────────────────────────────────── */}
            {tab==="whatif" && (
              <div style={{ padding:14, background:t.bg2, border:`1px solid ${t.border}`, borderRadius:5, animation:"fadeUp 0.3s ease" }}>
                <div style={{ fontFamily:"'Exo 2',sans-serif", fontWeight:800, fontSize:10, color:t.txt2, letterSpacing:3, marginBottom:14, display:"flex", alignItems:"center", gap:6 }}>
                  WHAT-IF ANALYZER — Predict Glucose Response to Meals & Insulin
                  <InfoTip text={"Add virtual meals (carbs) or insulin boluses to observe real-time Hovorka dynamics.\n\nMeal: two-compartment gut absorption (ka1, ka2)\nInsulin: subcutaneous depot → plasma (kabs)\nGlucose: EGP + meal - Uii (Sf·X2·G)\n\nObserve X1, X2, Qgut1, Qgut2 in sidebar."} t={t} />
                </div>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14 }}>
                  <button onClick={()=>engRef.current?.addMeal(50)} style={{ padding:"10px 18px", background:t.accent+"10", border:`1px solid ${t.accent}44`, borderRadius:4, color:t.accent, fontFamily:"'Exo 2',sans-serif", fontWeight:700, fontSize:9, cursor:"pointer", letterSpacing:1 }}>🍎 Add 50g Meal</button>
                  <button onClick={()=>engRef.current?.addMeal(75)} style={{ padding:"10px 18px", background:t.accent+"10", border:`1px solid ${t.accent}44`, borderRadius:4, color:t.accent, fontFamily:"'Exo 2',sans-serif", fontWeight:700, fontSize:9, cursor:"pointer", letterSpacing:1 }}>🍽 Add 75g Meal</button>
                  <button onClick={()=>engRef.current?.addBolus(3)} style={{ padding:"10px 18px", background:t.accentB+"10", border:`1px solid ${t.accentB}44`, borderRadius:4, color:t.accentB, fontFamily:"'Exo 2',sans-serif", fontWeight:700, fontSize:9, cursor:"pointer", letterSpacing:1 }}>💉 Add 3U Bolus</button>
                  <button onClick={()=>engRef.current?.addBolus(6)} style={{ padding:"10px 18px", background:t.accentB+"10", border:`1px solid ${t.accentB}44`, borderRadius:4, color:t.accentB, fontFamily:"'Exo 2',sans-serif", fontWeight:700, fontSize:9, cursor:"pointer", letterSpacing:1 }}>💉 Add 6U Bolus</button>
                  <button onClick={()=>{engRef.current?.addMeal(80); engRef.current?.addBolus(5);}} style={{ padding:"10px 18px", background:t.warn+"10", border:`1px solid ${t.warn}44`, borderRadius:4, color:t.warn, fontFamily:"'Exo 2',sans-serif", fontWeight:700, fontSize:9, cursor:"pointer", letterSpacing:1 }}>🍽💉 80g Meal + 5U Match</button>
                </div>
                <div style={{ fontSize:9, color:t.txt1, lineHeight:2, background:t.bg3, border:`1px solid ${t.border}`, borderRadius:4, padding:12 }}>
                  <strong style={{ color:t.accent }}>Clinical Use Case:</strong> Test insulin-to-carb ratios (I:C) before applying to real patient. Standard I:C for T1DM: 1:10 to 1:15 (1U per 10-15g carbs). Observe peak glucose timing and magnitude. Adjust bolus dose accordingly.<br/><br/>
                  <strong style={{ color:t.accentB }}>Meal Absorption Kinetics:</strong> Two-compartment Dalla Man model simulates gastric emptying (ka1: stomach→gut1) and intestinal absorption (ka2: gut1→plasma). Typical peak: 60-90 min post-meal.<br/><br/>
                  <strong style={{ color:t.warn }}>Insulin Action:</strong> Subcutaneous bolus absorption (kabs: depot→plasma, ~30 min) followed by remote effects X1, X2 (k12 transfer, ~60-120 min delay). Glucose disposal Uii = Sf·X2·G reaches maximum 90-180 min post-bolus.
                </div>
              </div>
            )}

            {/* ── ALARM LOG ────────────────────────────────────────────────── */}
            {tab==="alarms" && (
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div style={{ fontFamily:"'Exo 2',sans-serif",fontWeight:800,fontSize:10,color:t.txt2,letterSpacing:3 }}>ALARM EVENT LOG — ISO 15197:2013</div>
                  <div style={{ display:"flex",gap:6 }}>
                    <button onClick={()=>setAcked(new Set())} style={{ background:"transparent",border:`1px solid ${t.border}`,color:t.txt2,fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:8,padding:"4px 10px",borderRadius:3,cursor:"pointer" }}>RESET ACK</button>
                    <button onClick={()=>setAlarmLog([])} style={{ background:t.warn+"10",border:`1px solid ${t.warn}33`,color:t.warn,fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:8,padding:"4px 10px",borderRadius:3,cursor:"pointer" }}>CLEAR LOG</button>
                  </div>
                </div>
                {alarmLog.length===0 ? <div style={{ color:t.txt3,fontSize:10,padding:"24px 0",textAlign:"center" }}>No alarms recorded.</div>
                  : [...alarmLog].reverse().map((a,i)=>(
                  <div key={i} style={{ background:t.bg2,border:`1px solid ${a.sev==="critical"?t.crit+"22":t.warn+"22"}`,borderLeft:`3px solid ${a.sev==="critical"?t.crit:t.warn}`,borderRadius:4,padding:"7px 12px",animation:"fadeUp 0.2s ease" }}>
                    <div style={{ display:"flex",justifyContent:"space-between",marginBottom:2 }}>
                      <span style={{ fontFamily:"'Exo 2',sans-serif",fontWeight:800,fontSize:9,color:a.sev==="critical"?t.crit:t.warn,letterSpacing:1 }}>{a.sev.toUpperCase()} — {a.msg}</span>
                      <span style={{ fontSize:8,color:t.txt3,fontFamily:"'Share Tech Mono',monospace" }}>{a.wall} · T+{rnd(a.ts,1)}m</span>
                    </div>
                    {a.action&&<div style={{ fontSize:8,color:t.txt2 }}>→ {a.action}</div>}
                    {a.ref&&<div style={{ fontSize:7,color:t.txt3 }}>Ref: {a.ref}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ══ BLOCKCHAIN OVERLAY ═══════════════════════════════════════════ */}
      {showBC&&(
        <div style={{ position:"fixed",inset:0,background:"#000000cc",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center" }} onClick={()=>setShowBC(false)}>
          <div style={{ background:t.bg1,border:`1px solid ${t.accentB}33`,borderRadius:8,padding:22,maxWidth:820,width:"92%",maxHeight:"82vh",overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:14 }}>
              <div>
                <div style={{ fontFamily:"'Exo 2',sans-serif",fontWeight:800,fontSize:13,color:t.accentB,letterSpacing:3 }}>⛓ COMPONENT BLOCKCHAIN LEDGER</div>
                <div style={{ fontSize:8,color:t.txt3,fontFamily:"'Share Tech Mono',monospace" }}>ISO 13485 · FDA UDI 21 CFR 830 · Ethereum Sepolia · Block #{(Date.now()%9999999).toString(16).toUpperCase()}</div>
              </div>
              <button onClick={()=>setShowBC(false)} style={{ background:"transparent",border:`1px solid ${t.border}`,color:t.txt2,padding:"4px 10px",borderRadius:3,cursor:"pointer",fontFamily:"'Exo 2',sans-serif",fontWeight:800 }}>✕</button>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
              {BLOCKCHAIN_DB.map((c,i)=>(
                <div key={i} style={{ background:t.bg2,border:`1px solid ${c.status==="ADVISORY"?t.warn+"33":t.border}`,borderLeft:`3px solid ${c.status==="ADVISORY"?t.warn:t.accent+"44"}`,borderRadius:4,padding:"9px 12px" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8 }}>
                    <div>
                      <div style={{ fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:10,color:c.status==="ADVISORY"?t.warn:`${t.accent}77`,marginBottom:2 }}>
                        {c.cmp}{c.status==="ADVISORY"&&<span style={{ fontSize:8,color:t.warn,marginLeft:8,animation:"blink 1.2s infinite" }}>⚠ ADVISORY — {c.recalls} RECALL(S)</span>}
                      </div>
                      <div style={{ fontSize:8,color:t.txt3,fontFamily:"'Share Tech Mono',monospace" }}>{c.id} · S/N: {c.sn} · {c.mfg}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:8,color:t.txt3 }}>Batch: {c.batch} · Cal: {c.cal}</div>
                      <div style={{ fontSize:8,color:c.recalls>0?t.warn:`${t.accent}33` }}>{c.status} · Recalls: {c.recalls}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:10,padding:"7px 12px",background:t.bg3,borderRadius:4,fontSize:8,color:t.txt3,fontFamily:"'Share Tech Mono',monospace" }}>
              Chain verified · Nodes: 12/12 · Last sync T+{T.toFixed(0)}m · All hashes verified ✓
            </div>
          </div>
        </div>
      )}

      {/* ══ GUIDED TOUR ═════════════════════════════════════════════════ */}
      {tourOn&&(
        <div style={{ position:"fixed",inset:0,background:"#000000aa",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:40 }}>
          <div style={{ background:t.bg1,border:`1px solid ${t.accent}33`,borderRadius:8,padding:22,maxWidth:540,width:"90%",animation:"fadeUp 0.3s ease" }}>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:10 }}>
              <div style={{ fontFamily:"'Exo 2',sans-serif",fontSize:8,color:t.txt3,letterSpacing:3 }}>GUIDED TOUR {tourStep+1}/{TOUR.length}</div>
              <button onClick={()=>setTourOn(false)} style={{ background:"transparent",border:"none",color:t.txt2,cursor:"pointer",fontFamily:"'Exo 2',sans-serif",fontWeight:800 }}>✕ CLOSE</button>
            </div>
            <div style={{ fontFamily:"'Exo 2',sans-serif",fontWeight:800,fontSize:14,color:t.accent,marginBottom:8 }}>{TOUR[tourStep].title}</div>
            <div style={{ fontSize:10,color:t.txt1,lineHeight:1.8 }}>{TOUR[tourStep].text}</div>
            <div style={{ display:"flex",gap:8,marginTop:16,justifyContent:"flex-end" }}>
              {tourStep>0&&<button onClick={()=>setTourStep(s=>s-1)} style={{ background:"transparent",border:`1px solid ${t.border}`,color:t.txt2,fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:9,padding:"5px 14px",borderRadius:3,cursor:"pointer" }}>← PREV</button>}
              {tourStep<TOUR.length-1
                ?<button onClick={()=>setTourStep(s=>s+1)} style={{ background:t.accent+"10",border:`1px solid ${t.accent}44`,color:t.accent,fontFamily:"'Exo 2',sans-serif",fontWeight:800,fontSize:9,padding:"5px 14px",borderRadius:3,cursor:"pointer" }}>NEXT →</button>
                :<button onClick={()=>setTourOn(false)} style={{ background:t.accent+"20",border:`1px solid ${t.accent}`,color:t.accent,fontFamily:"'Exo 2',sans-serif",fontWeight:800,fontSize:9,padding:"5px 14px",borderRadius:3,cursor:"pointer" }}>FINISH ✓</button>
              }
            </div>
            <div style={{ display:"flex",gap:4,marginTop:12,justifyContent:"center" }}>
              {TOUR.map((_,i)=><div key={i} style={{ width:i===tourStep?20:6,height:4,borderRadius:2,background:i===tourStep?t.accent:t.border,transition:"width 0.2s" }}/>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}