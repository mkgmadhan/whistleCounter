// This is a placeholder for the main whistle detection and alarm logic.
// The UI will allow users to start/stop listening, display the whistle count, and set the alarm threshold.

import React, { useState, useRef } from 'react';

const WhistleCounter: React.FC = () => {
  const [count, setCount] = useState(0);
  const [threshold, setThreshold] = useState(5);
  const [listening, setListening] = useState(false);
  const [alarm, setAlarm] = useState(false);
  const [peakFreq, setPeakFreq] = useState<number | null>(null);
  const [micAccess, setMicAccess] = useState<boolean | null>(null); // null = unknown, true = granted, false = denied
  const [recordingSample, setRecordingSample] = useState(false);
  const [sampleRecorded, setSampleRecorded] = useState(false);  const [sampleAudioUrl, setSampleAudioUrl] = useState<string | null>(null);
  const [speechDetectionEnabled, setSpeechDetectionEnabled] = useState(false);
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleSpectrumRef = useRef<Float32Array | null>(null);
  const sampleBufferRef = useRef<Float32Array[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const SAMPLE_BUFFER_SIZE = 15; // ~0.5s at 2048/44100Hz
  // Whistle state and cooldown
  const whistleActiveRef = useRef(false);
  const lastWhistleTimeRef = useRef(0);
  const COOLDOWN_MS = 1500; // Minimum time between whistles (ms)
  // Detection history and speech recognition
  const detectionHistoryRef = useRef<boolean[]>([]);
  const speechHistoryRef = useRef<string[]>([]);
  const DETECTION_HISTORY_SIZE = 5; // Number of frames to consider for smoothing

  // Check for speech recognition support on component mount
  React.useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
  }, []);

  // Initialize speech recognition for whistle detection
  const initSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase();
        
        // Look for whistle-like sounds that might be interpreted as text
        const whistleSounds = [
          'whistle', 'whist', 'wist', 'hiss', 'sss', 'shh', 'ssh',
          'whoo', 'woo', 'ooo', 'eee', 'aaa', 'ttt', 'sss',
          // Common misinterpretations of whistle sounds
          'the', 'see', 'tea', 'bee', 'key', 'she', 'he'
        ];
        
        const containsWhistleSound = whistleSounds.some(sound => 
          transcript.includes(sound) && transcript.length <= 10 // Short transcripts more likely to be whistles
        );
        
        if (containsWhistleSound) {
          console.log(`🎙️ Speech detected potential whistle: "${transcript}"`);
          
          // Add to speech history
          speechHistoryRef.current.push(transcript);
          if (speechHistoryRef.current.length > 3) {
            speechHistoryRef.current.shift();
          }
          
          // Trigger whistle detection if we have recent speech patterns
          const recentWhistleSounds = speechHistoryRef.current.filter(t => 
            whistleSounds.some(sound => t.includes(sound))
          ).length;
          
          if (recentWhistleSounds >= 2) {
            triggerSpeechWhistleDetection();
          }
        }
      }
    };
    
    recognition.onerror = (event: any) => {
      console.log('Speech recognition error:', event.error);
    };
    
    return recognition;
  };

  // Trigger whistle detection from speech recognition
  const triggerSpeechWhistleDetection = () => {
    const now = Date.now();
    if (!whistleActiveRef.current && now - lastWhistleTimeRef.current > COOLDOWN_MS) {
      console.log('🎵 SPEECH WHISTLE DETECTED! Count increasing...');
      setCount((prev) => {
        const newCount = prev + 1;
        if (newCount >= threshold) setAlarm(true);
        return newCount;
      });
      whistleActiveRef.current = true;
      lastWhistleTimeRef.current = now;
      
      // Clear speech history after detection
      speechHistoryRef.current = [];
      
      // Reset whistle state after a short delay
      setTimeout(() => {
        whistleActiveRef.current = false;
      }, 500);
    }
  };

  // Cosine similarity between two vectors
  function cosineSimilarity(a: Float32Array, b: Float32Array) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
  }

  // Draw frequency graph
  const drawFrequencyGraph = (freqData: Float32Array) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    const barWidth = canvas.width / freqData.length;
    for (let i = 0; i < freqData.length; i++) {
      // Normalize dB to [0, 1] (assuming -100dB to 0dB)
      const value = Math.max(0, (freqData[i] + 100) / 100);
      const y = canvas.height - value * canvas.height;
      ctx.lineTo(i * barWidth, y);
    }
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Draw kHz labels
    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    for (let khz = 0; khz <= Math.floor(sampleRate / 2000); khz++) {
      const freq = khz * 1000;
      const x = (freq / (sampleRate / 2)) * canvas.width;
      ctx.fillText(`${khz}kHz`, x, canvas.height - 2);
      ctx.beginPath();
      ctx.moveTo(x, canvas.height - 15);
      ctx.lineTo(x, canvas.height - 5);
      ctx.strokeStyle = '#ccc';
      ctx.stroke();
    }
  };  // Multi-algorithm whistle detection system
  const detectWhistle = (analyser: AnalyserNode) => {
    if (!audioContextRef.current) return;
    analyser.fftSize = 2048;
    const freqData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(freqData);
    drawFrequencyGraph(freqData);
    
    const sampleRate = audioContextRef.current.sampleRate;
    const binSize = sampleRate / analyser.fftSize;
    const minFreq = 800;
    const maxFreq = 2200;
    const minBin = Math.floor(minFreq / binSize);
    const maxBin = Math.ceil(maxFreq / binSize);
    const liveSlice = freqData.slice(minBin, maxBin + 1);
    
    // If recording sample, buffer the spectrum
    if (recordingSample) {
      if (sampleBufferRef.current.length >= SAMPLE_BUFFER_SIZE) {
        sampleBufferRef.current.shift();
      }
      sampleBufferRef.current.push(liveSlice);
      return;
    }
    
    // Calculate background noise level
    const backgroundBins = freqData.slice(0, minBin);
    const noiseLevel = backgroundBins.reduce((sum, val) => sum + val, 0) / backgroundBins.length;
    
    // Find peaks in whistle frequency range
    const peaks: { freq: number; magnitude: number; bin: number; sharpness: number }[] = [];
    for (let i = minBin + 3; i <= maxBin - 3; i++) {
      const val = freqData[i];
      // Check if it's a local maximum
      if (val > freqData[i-1] && val > freqData[i+1] && 
          val > freqData[i-2] && val > freqData[i+2] &&
          val > freqData[i-3] && val > freqData[i+3]) {
        
        // Calculate peak sharpness (how narrow the peak is)
        const leftSide = Math.max(freqData[i-3], freqData[i-2], freqData[i-1]);
        const rightSide = Math.max(freqData[i+1], freqData[i+2], freqData[i+3]);
        const sharpness = val - Math.max(leftSide, rightSide);
        
        peaks.push({ 
          freq: i * binSize, 
          magnitude: val, 
          bin: i,
          sharpness: sharpness
        });
      }
    }
    
    // Sort peaks by magnitude
    peaks.sort((a, b) => b.magnitude - a.magnitude);
    const strongestPeak = peaks[0];
    
    // Multi-algorithm scoring system
    let totalScore = 0;
    const scoreBreakdown: string[] = [];
    
    // Algorithm 1: Peak Prominence and Frequency Analysis (30 points)
    if (strongestPeak) {
      const prominence = strongestPeak.magnitude - noiseLevel;
      const freqScore = strongestPeak.freq >= 1000 && strongestPeak.freq <= 2000 ? 15 : 
                       strongestPeak.freq >= 900 && strongestPeak.freq <= 2100 ? 10 : 5;
      const magnitudeScore = prominence > 20 ? 15 : prominence > 15 ? 10 : prominence > 10 ? 5 : 0;
      
      const algo1Score = freqScore + magnitudeScore;
      totalScore += algo1Score;
      scoreBreakdown.push(`Freq/Mag: ${algo1Score}/30 (${strongestPeak.freq.toFixed(0)}Hz, ${prominence.toFixed(1)}dB)`);
    }
    
    // Algorithm 2: Peak Sharpness and Isolation (20 points)
    if (strongestPeak) {
      const sharpnessScore = strongestPeak.sharpness > 15 ? 15 : 
                            strongestPeak.sharpness > 10 ? 10 : 
                            strongestPeak.sharpness > 5 ? 5 : 0;
      
      // Check isolation (no other strong peaks nearby)
      const nearbyPeaks = peaks.filter(p => 
        Math.abs(p.freq - strongestPeak.freq) < 200 && p !== strongestPeak
      ).length;
      const isolationScore = nearbyPeaks === 0 ? 5 : nearbyPeaks <= 1 ? 3 : 0;
      
      const algo2Score = sharpnessScore + isolationScore;
      totalScore += algo2Score;
      scoreBreakdown.push(`Sharp/Iso: ${algo2Score}/20 (${strongestPeak.sharpness.toFixed(1)}dB, ${nearbyPeaks} nearby)`);
    }
    
    // Algorithm 3: Signal Focus Analysis (15 points)
    const totalEnergyInRange = liveSlice.reduce((sum, val) => sum + val, 0);
    const peakEnergy = strongestPeak ? strongestPeak.magnitude : -100;
    const energyConcentration = peakEnergy / (totalEnergyInRange / liveSlice.length);
    
    const focusScore = energyConcentration > 3 ? 15 : 
                      energyConcentration > 2 ? 10 : 
                      energyConcentration > 1.5 ? 5 : 0;
    totalScore += focusScore;
    scoreBreakdown.push(`Focus: ${focusScore}/15 (${energyConcentration.toFixed(2)}x)`);
    
    // Algorithm 4: Energy Distribution Analysis (15 points)
    const peakCount = peaks.filter(p => p.magnitude > noiseLevel + 10).length;
    const distributionScore = peakCount === 1 ? 15 : // Single dominant peak (best)
                             peakCount === 2 ? 10 : // Two peaks (could be harmonic)
                             peakCount === 3 ? 5 : 0; // Too many peaks
    totalScore += distributionScore;
    scoreBreakdown.push(`Distribution: ${distributionScore}/15 (${peakCount} peaks)`);
    
    // Algorithm 5: Temporal Consistency (20 points bonus)
    const currentDetection = totalScore >= 50; // Base threshold before temporal bonus
    detectionHistoryRef.current.push(currentDetection);
    if (detectionHistoryRef.current.length > DETECTION_HISTORY_SIZE) {
      detectionHistoryRef.current.shift();
    }
    
    const consistentDetections = detectionHistoryRef.current.filter(d => d).length;
    const temporalScore = consistentDetections >= 3 ? 20 : 
                         consistentDetections >= 2 ? 10 : 0;
    totalScore += temporalScore;
    scoreBreakdown.push(`Temporal: ${temporalScore}/20 (${consistentDetections}/${DETECTION_HISTORY_SIZE})`);
    
    // Template matching enhancement (if available)
    let templateScore = 0;
    if (sampleSpectrumRef.current) {
      const template = sampleSpectrumRef.current;
      let bestSimilarity = 0;
      
      // Try different pitch shifts
      const maxShift = Math.floor(template.length * 0.1);
      for (let shift = -maxShift; shift <= maxShift; shift++) {
        const shiftedSlice = new Float32Array(template.length);
        for (let i = 0; i < template.length; i++) {
          const sourceIndex = i + shift;
          if (sourceIndex >= 0 && sourceIndex < liveSlice.length) {
            shiftedSlice[i] = liveSlice[sourceIndex];
          }
        }
        const similarity = cosineSimilarity(shiftedSlice, template);
        bestSimilarity = Math.max(bestSimilarity, similarity);
      }
      
      templateScore = bestSimilarity > 0.7 ? 50 : 
                     bestSimilarity > 0.6 ? 30 : 
                     bestSimilarity > 0.5 ? 15 : 0;
      totalScore += templateScore;
      scoreBreakdown.push(`Template: ${templateScore}/50 (${bestSimilarity.toFixed(3)})`);
    }
    
    // Final decision
    const isWhistle = totalScore >= 50;
    const now = Date.now();
    
    setPeakFreq(strongestPeak ? strongestPeak.freq : null);
    
    // Debug output for scoring
    if (totalScore > 30 || (strongestPeak && strongestPeak.magnitude > noiseLevel + 10)) {
      console.log(`🎯 SCORE: ${totalScore}/100 - ${scoreBreakdown.join(', ')} - ${isWhistle ? 'WHISTLE!' : 'no whistle'}`);
    }
    
    // Trigger whistle detection
    if (isWhistle && !whistleActiveRef.current && now - lastWhistleTimeRef.current > COOLDOWN_MS) {
      console.log(`🎵 WHISTLE DETECTED! Score: ${totalScore}/100 - Count increasing...`);
      setCount((prev) => {
        const newCount = prev + 1;
        if (newCount >= threshold) setAlarm(true);
        return newCount;
      });
      whistleActiveRef.current = true;
      lastWhistleTimeRef.current = now;
      
      // Reset after detection
      setTimeout(() => {
        whistleActiveRef.current = false;
      }, 800);
    }
  };// Start recording sample audio
  const startSampleRecording = async () => {
    // If listening, stop it first
    if (listening) {
      stopListening();
    }
    setRecordingSample(true);
    setSampleRecorded(false);
    sampleBufferRef.current = [];
    setSampleAudioUrl(null);
    
    try {
      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
        // Always get a new stream, even if one exists (it might be stopped)
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicAccess(true);
      
      // Set up audio analysis for sample recording to collect frequency data
      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      const tempAnalyser = audioContextRef.current.createAnalyser();
      tempAnalyser.fftSize = 2048;
      source.connect(tempAnalyser);
      
      // Create a temporary processor to collect frequency data during recording
      const tempProcessor = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      tempAnalyser.connect(tempProcessor);
      tempProcessor.connect(audioContextRef.current.destination);
      tempProcessor.onaudioprocess = () => {
        if (recordingSample) {
          detectWhistle(tempAnalyser); // This will populate sampleBufferRef during recording
        }
      };
      
      const recorder = new MediaRecorder(mediaStreamRef.current);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      
      recorder.onstop = async () => {
        // Clean up temporary audio nodes
        tempProcessor.disconnect();
        tempAnalyser.disconnect();
        source.disconnect();
        
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        setSampleAudioUrl(URL.createObjectURL(blob));
        
        // Create template from the buffered live spectrum data collected during recording
        if (sampleBufferRef.current.length > 0) {
          // Average multiple frames from the sample recording for a robust template
          const templateLength = sampleBufferRef.current[0].length;
          const template = new Float32Array(templateLength);
          
          // Find the frame with the strongest signal
          let maxEnergy = -Infinity;
          let bestFrameIndex = 0;
          for (let i = 0; i < sampleBufferRef.current.length; i++) {
            const energy = sampleBufferRef.current[i].reduce((sum, val) => sum + val, 0);
            if (energy > maxEnergy) {
              maxEnergy = energy;
              bestFrameIndex = i;
            }
          }
          
          // Use the best frame as template
          const bestFrame = sampleBufferRef.current[bestFrameIndex];
          template.set(bestFrame);
          
          sampleSpectrumRef.current = template;
          setSampleRecorded(true);
          
          console.log(`📝 Sample template created from ${sampleBufferRef.current.length} frames, using frame ${bestFrameIndex} with energy ${maxEnergy.toFixed(1)}`);
        } else {
          console.warn('⚠️ No sample data collected during recording');
        }
        // Release stream if not needed
        if (!listening && mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err) {
      setMicAccess(false);
      setRecordingSample(false);
      alert('Microphone access denied or unavailable.');
    }
  };
  // Stop recording sample audio
  const stopSampleRecording = () => {
    setRecordingSample(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // Start listening for whistles
  const startListening = async () => {
    setCount(0);
    setAlarm(false);
    setListening(true);
    whistleActiveRef.current = false;
    lastWhistleTimeRef.current = 0;
    detectionHistoryRef.current = []; // Clear detection history
    speechHistoryRef.current = []; // Clear speech history
    
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Always get a fresh stream
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicAccess(true);
      
      // Set up frequency analysis
      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);
      processorRef.current = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      analyserRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      processorRef.current.onaudioprocess = () => {
        if (analyserRef.current) detectWhistle(analyserRef.current);
      };
      
      // Set up speech recognition if enabled and supported
      if (speechDetectionEnabled && speechSupported) {
        speechRecognitionRef.current = initSpeechRecognition();
        if (speechRecognitionRef.current) {
          speechRecognitionRef.current.start();
          console.log('🎙️ Speech recognition started for whistle detection');
        }
      }
    } catch (err) {
      setMicAccess(false);
      setListening(false);
    }
  };  // Stop listening for whistles
  const stopListening = () => {
    setListening(false);
    // Don't clear detection history here - let it naturally decay
    processorRef.current?.disconnect();
    analyserRef.current?.disconnect();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    
    // Stop speech recognition
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
      console.log('🎙️ Speech recognition stopped');
    }
    
    setMicAccess(null);
  };

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', padding: 24, border: '1px solid #ccc', borderRadius: 8, textAlign: 'center' }}>
      <h2>Pressure Cooker Whistle Counter</h2>
      {/* Sample recording UI */}
      <div style={{ marginBottom: 12 }}>
        {!recordingSample ? (
          <>
            <button
              onClick={startSampleRecording}
              disabled={listening}
              style={{ marginRight: 8, padding: '0.3rem 1rem' }}
            >
              Record Sample Whistle
            </button>
            {sampleAudioUrl && (
              <button
                onClick={() => {
                  const audio = new Audio(sampleAudioUrl);
                  audio.play();
                }}
                style={{ marginRight: 8, padding: '0.3rem 1rem', background: '#007bff', color: 'white' }}
              >
                Play Sample
              </button>
            )}
          </>
        ) : (
          <button
            onClick={stopSampleRecording}
            style={{ marginRight: 8, padding: '0.3rem 1rem', background: '#ff4136', color: 'white' }}
          >
            Stop Recording
          </button>
        )}
        {sampleRecorded && <span style={{ color: '#2ecc40', fontWeight: 500 }}>Sample recorded!</span>}
      </div>
      <div style={{ fontSize: 48, margin: '1rem 0' }}>{count}</div>
      {/* Frequency meter visualization */}
      <div style={{ height: 30, margin: '8px 0', background: '#eee', borderRadius: 4, position: 'relative' }}>
        {peakFreq && (
          <div style={{
            position: 'absolute',
            left: `${((peakFreq - 700) / 1800) * 100}%`,
            top: 0,
            width: 6,
            height: '100%',
            background: '#007bff',
            borderRadius: 3,
            transition: 'left 0.1s',
          }} />
        )}
        <div style={{ position: 'absolute', left: 0, top: 0, fontSize: 10, color: '#888' }}>700Hz</div>
        <div style={{ position: 'absolute', right: 0, top: 0, fontSize: 10, color: '#888' }}>2.5kHz</div>
      </div>
      {/* Frequency graph visualization */}
      <canvas
        ref={canvasRef}
        width={360}
        height={80}
        style={{ display: 'block', margin: '8px auto 16px', background: '#fafbfc', border: '1px solid #ddd', borderRadius: 4 }}
      />      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <span
          style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: micAccess === null ? '#ccc' : micAccess ? '#2ecc40' : '#ff4136',
            marginRight: 8,
            border: '1px solid #888',
          }}
        />
        <span style={{ fontSize: 14, color: '#555' }}>
          Microphone: {micAccess === null ? 'Unknown' : micAccess ? 'Available' : 'Not available'}
        </span>
      </div>
      
      {/* Speech Recognition Toggle */}
      {speechSupported && (
        <div style={{ marginBottom: 12, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={speechDetectionEnabled}
              onChange={(e) => setSpeechDetectionEnabled(e.target.checked)}
              disabled={listening}
              style={{ marginRight: 8 }}
            />
            <span>🎙️ Enable Speech Recognition Assist</span>
          </label>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4, textAlign: 'center' }}>
            Uses speech-to-text to detect whistle-like sounds
          </div>
        </div>
      )}
      
      {speechSupported === false && (
        <div style={{ marginBottom: 12, padding: 8, background: '#fff3cd', borderRadius: 4, fontSize: 12, color: '#856404' }}>
          ⚠️ Speech recognition not supported in this browser
        </div>
      )}
      
      <div>
        <label>
          Alarm after
          <input
            type="number"
            min={1}
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            style={{ width: 60, margin: '0 8px' }}
            disabled={listening}
          />
          whistles
        </label>
      </div>
      <div style={{ margin: '1rem 0' }}>
        {!listening ? (
          <button onClick={startListening} style={{ padding: '0.5rem 1.5rem', fontSize: 18 }}>Start</button>
        ) : (
          <button onClick={stopListening} style={{ padding: '0.5rem 1.5rem', fontSize: 18 }}>Stop</button>
        )}
      </div>
      {alarm && <div style={{ color: 'red', fontWeight: 'bold', fontSize: 24 }}>ALARM! Whistle threshold reached!</div>}
      <div style={{ fontSize: 12, color: '#888', marginTop: 16 }}>
        Microphone access required. Accuracy may vary depending on environment.
      </div>
    </div>
  );
};

export default WhistleCounter;
