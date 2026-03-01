# CGM Digital Twin V4.0

A real‑time, high‑fidelity digital twin simulation of a Continuous Glucose Monitor (CGM). This React‑based simulator implements the **Hovorka glucose‑insulin model** (two‑compartment insulin action) and the **Dalla Man meal absorption model**, combined with a realistic electrochemical sensor model including drift, noise, and calibration schedules. It includes advanced digital twin features such as model deviation tracking, fault injection, federated learning simulation, forward prediction, and a blockchain‑based component ledger. The interface is designed in the **Obsidian Medical** style – a premium black‑glass aesthetic with custom fonts and smooth animations.

![CGM Digital Twin Screenshot](screenshot.png) *(replace with actual screenshot)*

---

## ✨ Features

### 🧠 Physiological Core (Hovorka + Dalla Man)
- **Hovorka two‑compartment insulin action** – plasma insulin (I), remote effects (X1, X2) driving glucose uptake.
- **Dalla Man two‑compartment meal absorption** – gastric emptying (Qgut1) and intestinal absorption (Qgut2).
- **Endogenous glucose production (EGP)** with insulin‑dependent suppression.
- **Renal excretion** for glucose >180 mg/dL.
- **Patient‑specific parameters** for 8 phenotypes: Healthy, T1DM, T2DM, Gestational, Pediatric, Adolescent, Elderly, Prediabetic.

### 🔬 Sensor & Calibration
- **Realistic sensor model** – ideal raw current = G × sensitivity, modified by `driftFactor` (multiplicative drift) and additive noise.
- **Calibration schedules** – Factory (14‑day), Manual (3‑day), Daily, or None – each with appropriate drift rates.
- **Calibration events** – reset measured glucose to true glucose (fingerstick simulation).
- **Drift alarm** when `driftFactor` deviates by >10% (ISO 15197:2013 §6.3.4).

### 🤖 Digital Twin Features
- **Model deviation** – measured glucose vs. ideal no‑fault twin, displayed as a metric card with auto‑scaled sparkline.
- **Fault injection** – toggle sensor drift, reduced insulin sensitivity, increased noise, increased EGP (dawn phenomenon), or increased sensitivity (exercise).
- **Federated learning simulation** – EMA‑based Bayesian update of insulin sensitivity (`Sf`) every 5 simulated minutes, with model version counter and pulse animation.
- **Forward prediction** – uses the full Hovorka model to simulate 20 minutes ahead (not linear regression). Updates every minute and displays a mini‑chart with hypo/hyper warnings.

### 📈 Clinical Analytics
- **ISO 15197:2013 alarms** – hypo, severe hypo, hyper, severe hyper, rate of change, drift, predictive low.
- **ADA 2021 Time‑in‑Range (TIR)** – TIR (70‑180), TBR (<70), TBR (<54), TAR (>180), TAR (>250), mean glucose, coefficient of variation (CV), with colour‑coded status and interpretation.
- **Ambulatory Glucose Profile (AGP)** – median (50th %ile), IQR (25–75th), outer range (10–90th) per hour of day. Time‑window selector: 30 min, 2h, 8h, all data. Gaps for insufficient readings.


## 🛠️ Technologies Used

- **Frontend**: React 18, Recharts (charting library)
- **Styling**: CSS‑in‑JS (inline styles with global CSS injection)
- **Animation**: CSS keyframes, `requestAnimationFrame` for 60 Hz simulation loop
- **Simulation Engine**: Custom JavaScript class (`CGMEngine`) implementing Hovorka + Dalla Man equations
- **Build Tool**: Create React App (or Vite – adjust as needed)
- **Package Manager**: npm / yarn
- **Version Control**: Git


## 🎮 How to Use
Select a Patient Profile from the sidebar (Healthy, T1DM, T2DM, etc.). Each profile has pre‑configured physiological parameters (Sf, k12, ke, etc.).

Adjust Basal Rate – multiplier for basal insulin infusion (1.0 = standard 1 U/h).

Choose Calibration Schedule – Factory, Manual (3‑day), Daily, or None.

Inject Faults (optional) – toggle Sensor Drift, Reduced Sensitivity, Increased Noise, Increased EGP (Dawn), or Increased Sensitivity (Exercise).

Monitor Real‑Time Data:

The main dashboard shows current glucose (large number), trend arrow, rate of change, and a status badge.

Side cards display insulin, drift factor, and model deviation with sparkline.

The 8‑hour glucose graph shows history with alarm thresholds as reference lines.

Explore Additional Tabs:

Analytics: Time‑in‑range metrics and interpretation.

AGP: Ambulatory Glucose Profile – select time window to see percentiles.

What‑If: Add virtual meals or boluses and observe real‑time Hovorka dynamics.

Alarm Log: History of all triggered alarms with timestamps, actions, and references.

Federated Learning Indicator – watch the model version increment every 5 simulated minutes; insulin sensitivity (Sf) updates automatically.

Forward Prediction – the “HOVORKA PREDICTION (20 min)” panel shows a forecast using the full model, updated every minute.

Blockchain Ledger: Click the “LEDGER” button to view a simulated immutable component record with recall status.

Export Data: Click “CSV” to download trend data.

## 📁 Project Structure
text
cgm-digital-twin/
├── public/
│   └── index.html
├── src/
│   ├── App.js                # Main application component (all code)
│   ├── index.js              # Entry point
│   ├── components/           # (optional – for splitting UI components)
│   ├── utils/                # (constants, helper functions)
│   └── styles/               # (global CSS, theme)
├── package.json
├── README.md
└── LICENSE
Currently, all code is in a single App.js for simplicity. In a production project, you might refactor into smaller modules.

## 🔧 Customisation
Adding new patient profiles: Extend the PATIENTS constant with appropriate parameters (basalG, basalI, Sf, k12, ke, ka1, ka2, kabs, etc.) and a colour.

Modifying alarm thresholds: Update the ALIM constant.

Adding fault types: Extend DEFAULT_FAULTS and add corresponding logic in the engine (_updateInsulin, _updateGlucose, _updateSensor).

Changing calibration schedules: Edit the CALIBRATION_SCHEDULES constant.

## 🧪 Testing
No formal test suite is included yet. You can manually test by:

Changing patient profiles and verifying that glucose dynamics change realistically.

Injecting faults and ensuring alarms trigger as expected.

Adding meals/boluses and watching the absorption compartments update.

Checking that all UI components render correctly in both dark and light themes.

## 📄 License
This project is provided for educational and demonstration purposes. All rights reserved. For commercial use, please contact the author.

