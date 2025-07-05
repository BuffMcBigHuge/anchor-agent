// PCM Audio Processor for L16 PCM audio playback
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pcmBuffer = null;
    this.bufferIndex = 0;
    this.isPlaying = false;
    this.sampleRate = 24000; // GenAI returns 24kHz
    
    // Listen for messages from the main thread
    this.port.onmessage = (event) => {
      const { type, data } = event.data;
      
      if (type === 'SET_PCM_DATA') {
        this.setPCMData(data);
      } else if (type === 'PLAY') {
        this.play();
      } else if (type === 'STOP') {
        this.stop();
      }
    };
  }
  
  setPCMData(base64Data) {
    try {
      // Decode base64 to binary
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Convert to 16-bit signed integers (L16 format)
      this.pcmBuffer = new Int16Array(bytes.buffer);
      this.bufferIndex = 0;
      
      console.log('🎵 PCM data loaded:', this.pcmBuffer.length, 'samples');
      this.port.postMessage({ type: 'READY', duration: this.pcmBuffer.length / this.sampleRate });
    } catch (error) {
      console.error('Error setting PCM data:', error);
      this.port.postMessage({ type: 'ERROR', error: error.message });
    }
  }
  
  play() {
    this.isPlaying = true;
    this.bufferIndex = 0;
    console.log('🎵 Starting PCM playback');
    this.port.postMessage({ type: 'PLAYING' });
  }
  
  stop() {
    this.isPlaying = false;
    this.bufferIndex = 0;
    console.log('🎵 Stopping PCM playback');
    this.port.postMessage({ type: 'STOPPED' });
  }
  
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    
    if (!this.isPlaying || !this.pcmBuffer || !output || !output[0]) {
      return true;
    }
    
    const outputChannel = output[0];
    const bufferLength = outputChannel.length;
    
    // Fill the output buffer with PCM data
    for (let i = 0; i < bufferLength; i++) {
      if (this.bufferIndex < this.pcmBuffer.length) {
        // Convert 16-bit signed integer to float [-1, 1]
        const sample = this.pcmBuffer[this.bufferIndex] / 32768.0;
        outputChannel[i] = sample;
        this.bufferIndex++;
      } else {
        // End of audio data
        outputChannel[i] = 0;
        if (this.isPlaying) {
          this.isPlaying = false;
          this.port.postMessage({ type: 'ENDED' });
        }
      }
    }
    
    // Copy to all output channels (mono to stereo)
    for (let channel = 1; channel < output.length; channel++) {
      output[channel].set(outputChannel);
    }
    
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor); 