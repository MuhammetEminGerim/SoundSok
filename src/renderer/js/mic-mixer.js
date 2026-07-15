/**
 * SoundSok – In-App Microphone Mixer
 *
 * Captures the physical microphone via Web Audio API, applies a noise gate,
 * and outputs the cleaned signal to CABLE Input.  This replaces the Windows
 * "Listen to this device" feature and avoids the jitter that causes Discord
 * Krisp to swallow soundboard audio.
 *
 * Usage:
 *   window.MicMixer = new MicMixer();
 *   await window.MicMixer.start(physicalMicId, cableInputId);
 */

class MicMixer {
  constructor() {
    /** @type {AudioContext|null} */
    this.audioContext = null;
    /** @type {MediaStream|null} */
    this.micStream = null;
    /** @type {MediaStreamAudioSourceNode|null} */
    this.micSource = null;
    /** @type {GainNode|null} */
    this.gateGain = null;
    /** @type {AnalyserNode|null} */
    this.analyser = null;
    /** @type {MediaStreamAudioDestinationNode|null} */
    this.destination = null;
    /** @type {HTMLAudioElement|null} */
    this.outputAudio = null;

    this.isActive = false;

    /**
     * Noise-gate threshold in dB.  Signals quieter than this are muted.
     * A typical desk environment sits around -55 dB to -45 dB.
     * @type {number}
     */
    this.noiseGateThreshold = -50;

    /** @private */
    this._gateRAF = null;
    /** @private */
    this._dataArray = null;
  }

  /* ────────────────────────── Public API ────────────────────────── */

  /**
   * Start capturing the physical microphone and routing it through a noise
   * gate to the virtual-cable output device.
   *
   * @param {string} physicalMicId  – deviceId of the real microphone (audioinput).
   * @param {string} cableOutputId  – deviceId of CABLE Input (audiooutput).
   */
  async start(physicalMicId, cableOutputId) {
    // Tear down any previous session
    if (this.isActive) this.stop();

    try {
      // 1. Capture the physical microphone – disable browser processing so
      //    we get the raw signal and handle noise ourselves.
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: physicalMicId ? { exact: physicalMicId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      // 2. Build the Web Audio graph
      this.audioContext = new AudioContext();
      this.micSource = this.audioContext.createMediaStreamSource(this.micStream);

      // Analyser – measures RMS level for the noise gate
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this._dataArray = new Float32Array(this.analyser.fftSize);

      // Gate gain – we automate this between 0 and 1
      this.gateGain = this.audioContext.createGain();
      this.gateGain.gain.value = 0; // start muted

      // MediaStream destination – produces a stream we can feed to an <audio>
      this.destination = this.audioContext.createMediaStreamDestination();

      // Wire: mic → analyser → gateGain → destination
      this.micSource.connect(this.analyser);
      this.analyser.connect(this.gateGain);
      this.gateGain.connect(this.destination);

      // 3. Route the destination stream to CABLE Input via a hidden <audio>
      this.outputAudio = new Audio();
      this.outputAudio.srcObject = this.destination.stream;
      if (this.outputAudio.setSinkId && cableOutputId) {
        await this.outputAudio.setSinkId(cableOutputId);
      }
      await this.outputAudio.play();

      // 4. Start the noise-gate loop
      this._runNoiseGate();

      this.isActive = true;
      console.log('[MicMixer] Started — Physical mic → Noise Gate → CABLE Input');
    } catch (err) {
      console.error('[MicMixer] Failed to start:', err);
      this.stop();
    }
  }

  /**
   * Stop capturing and release all resources.
   */
  stop() {
    if (this._gateRAF) {
      cancelAnimationFrame(this._gateRAF);
      this._gateRAF = null;
    }
    if (this.outputAudio) {
      this.outputAudio.pause();
      this.outputAudio.srcObject = null;
      this.outputAudio = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.micSource = null;
    this.analyser = null;
    this.gateGain = null;
    this.destination = null;
    this.isActive = false;
    console.log('[MicMixer] Stopped');
  }

  /**
   * Update the noise-gate threshold.
   * @param {number} dB – Threshold in dB (e.g. -50).
   */
  setThreshold(dB) {
    this.noiseGateThreshold = dB;
    localStorage.setItem('micMixerThreshold', String(dB));
  }

  /* ────────────────────────── Internals ─────────────────────────── */

  /** @private – runs once per animation frame */
  _runNoiseGate() {
    if (!this.analyser || !this.gateGain || !this.audioContext) return;

    this.analyser.getFloatTimeDomainData(this._dataArray);

    // Calculate RMS (root-mean-square) level
    let sum = 0;
    for (let i = 0; i < this._dataArray.length; i++) {
      sum += this._dataArray[i] * this._dataArray[i];
    }
    const rms = Math.sqrt(sum / this._dataArray.length);
    const dB = 20 * Math.log10(rms + 1e-10);

    const now = this.audioContext.currentTime;

    if (dB >= this.noiseGateThreshold) {
      // Signal is above threshold → open gate (fast attack)
      this.gateGain.gain.setTargetAtTime(1, now, 0.006);
    } else {
      // Signal is below threshold → close gate (slower release)
      this.gateGain.gain.setTargetAtTime(0, now, 0.025);
    }

    this._gateRAF = requestAnimationFrame(() => this._runNoiseGate());
  }
}

// Singleton export
window.MicMixer = new MicMixer();
