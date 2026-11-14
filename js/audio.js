/**
 * ============================================================================
 * TACTICAL AUDIO SYNTHESIZER (Web Audio API)
 * Generates synthetic aerospace audio cues (Geiger counter, telemetry chimes, alarms)
 * Zero external audio file dependencies.
 * ============================================================================
 */

class TacticalAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.enabled = true;
    this.geigerInterval = null;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled && this.geigerInterval) {
      clearInterval(this.geigerInterval);
      this.geigerInterval = null;
    }
    return this.enabled;
  }

  // Quick subtle UI high-frequency chirp
  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.04);
      
      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.04);
      
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.05);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // Futuristic route calculation confirmed chime
  playRoutePlotted() {
    if (!this.enabled) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const notes = [587.33, 880, 1174.66]; // D5, A5, D6
      notes.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + idx * 0.08);
        
        gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + idx * 0.08 + 0.25);
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        osc.start(this.audioCtx.currentTime + idx * 0.08);
        osc.stop(this.audioCtx.currentTime + idx * 0.08 + 0.28);
      });
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // Geiger Counter Tick
  playGeigerClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      // Noise burst for geiger click
      const bufferSize = this.audioCtx.sampleRate * 0.003;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2400;

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.003);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);

      noise.start();
    } catch (e) {
      console.warn("Geiger audio error:", e);
    }
  }

  // Emergency Alarm Klaxon
  playEmergencyAlarm() {
    if (!this.enabled) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      for (let i = 0; i < 3; i++) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.type = 'sawtooth';
        const start = now + i * 0.45;
        osc.frequency.setValueAtTime(450, start);
        osc.frequency.linearRampToValueAtTime(750, start + 0.25);
        osc.frequency.linearRampToValueAtTime(450, start + 0.4);

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.42);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(start);
        osc.stop(start + 0.44);
      }
    } catch (e) {
      console.warn("Alarm error:", e);
    }
  }
}

window.tacticalAudio = new TacticalAudioEngine();
