import axios from "axios";
import { useState, useRef } from "react";
import audioBufferToWav from "audiobuffer-to-wav";

const Remote = () => {
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);

  const makeRequest = async (endpoint, data = {}, config = {}) => {
    try {
      const token = localStorage.getItem("authToken");
      const serviceUrl = localStorage.getItem("serviceUrl");

      const response = await axios.post(`${serviceUrl}${endpoint}`, data, {
        ...config,
        headers: {
          Authorization: `Bearer ${token}`,
          ...config.headers,
        },
      });

      return response.data;
    } catch (error) {
      console.error(`Error calling ${endpoint}:`, error);
      throw error;
    }
  };

  const onMediaControl = (action) => {
    makeRequest(`/media/${action}`);
  };

  const onSystemControl = async (action, data = {}) => {
    try {
      const result = await makeRequest(`/system/${action}`, data);

      if (action === "battery" && result.status === "success") {
        setBatteryLevel(result.percentage);
      }

      return result;
    } catch (error) {
      console.error(`Error in system control ${action}:`, error);
    }
  };
  // Convert WebM blob to WAV format using audiobuffer-to-wav
  const convertWebmToWav = async (webmBlob) => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      // Convert blob to array buffer
      const arrayBuffer = await webmBlob.arrayBuffer();

      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Convert to WAV using the audiobuffer-to-wav library
      const wavBuffer = audioBufferToWav(audioBuffer);

      // Create blob from WAV data
      return new Blob([wavBuffer], { type: "audio/wav" });
    } catch (error) {
      console.error("Error converting audio:", error);
      throw error;
    }
  };
  const handleAudioUpload = async (blob) => {
    try {
      // Convert WebM to WAV
      const wavBlob = await convertWebmToWav(blob);

      const formData = new FormData();
      formData.append("audio", wavBlob, `recording_${Date.now()}.wav`);

      await makeRequest("/alerts/upload/audio", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("Audio uploaded successfully");
    } catch (error) {
      console.error("Audio upload failed:", error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // Create media recorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      const audioChunks = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks, {
          type: "audio/webm;codecs=opus",
        });
        await handleAudioUpload(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  const startAudioStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)({ sampleRate: 44100 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(
        1024,
        1,
        1
      );

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);

        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }

        // Send audio chunk to server
        makeRequest("/alerts/stream/audio", pcmData, {
          headers: {
            "X-Sample-Rate": "44100",
            "X-Channels": "1",
            "Content-Type": "application/octet-stream",
          },
        }).catch(console.error);
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      setIsStreaming(true);
    } catch (error) {
      console.error("Error starting audio stream:", error);
    }
  };

  const stopAudioStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setIsStreaming(false);
  };

  return (
    <div className="remote-container">
      <h3 className="remote-title">Remote</h3>
      <div className="control-section">
        <h5>Media controls</h5>
        <div className="remote-controls-container">
          <button
            className="control-button"
            onClick={() => onMediaControl("previous")}
          >
            Previous
          </button>
          <button
            className="control-button"
            onClick={() => onMediaControl("play-pause")}
          >
            Play
          </button>
          <button
            className="control-button"
            onClick={() => onMediaControl("next")}
          >
            Next
          </button>
        </div>
      </div>
      <div className="control-section">
        <h5>Media volume controls</h5>
        <div className="remote-controls-container">
          <button
            className="control-button"
            onClick={() => onMediaControl("mute")}
          >
            Mute
          </button>
          <button
            className="control-button"
            onClick={() => onMediaControl("volume-down")}
          >
            Volume Down
          </button>
          <button
            className="control-button"
            onClick={() => onMediaControl("volume-up")}
          >
            Volume Up
          </button>
        </div>
      </div>

      <div className="control-section">
        <h5>Arrow controls</h5>
        <button className="control-button" onClick={() => onMediaControl("up")}>
          up
        </button>
        <div className="remote-controls-container">
          <button
            className="control-button"
            onClick={() => onMediaControl("left")}
          >
            left
          </button>
          <button
            className="control-button"
            onClick={() => onMediaControl("down")}
          >
            down
          </button>
          <button
            className="control-button"
            onClick={() => onMediaControl("right")}
          >
            right
          </button>
        </div>
      </div>

      <div className="control-section">
        <h5>System Controls</h5>
        {/* Display Controls */}
        <div className="remote-controls-container">
          <button
            className="control-button"
            onClick={() => onSystemControl("lock")}
          >
            Lock Screen
          </button>
          <button
            className="control-button"
            onClick={() => onSystemControl("capture-and-lock")}
          >
            Capture & Lock
          </button>
          <button
            className="control-button"
            onClick={() => onSystemControl("sleep")}
          >
            Sleep
          </button>
        </div>

        {/* Brightness Controls */}
        <div className="remote-controls-container">
          <button
            className="control-button"
            onClick={() => onSystemControl("brightness-down")}
          >
            Brightness -
          </button>
          <button
            className="control-button"
            onClick={() => onSystemControl("brightness-up")}
          >
            Brightness +
          </button>
        </div>

        {/* Battery Status */}
        <div className="remote-controls-container">
          <button
            className="control-button battery-button"
            onClick={() => onSystemControl("battery")}
          >
            Battery
            {batteryLevel !== null && (
              <span>
                {" - "} {batteryLevel}%
              </span>
            )}
          </button>
        </div>

        {/* Audio Controls Section */}
        <div className="control-section">
          <h5>Audio Controls</h5>

          {/* Voice Recording */}
          <div className="remote-controls-container">
            <button
              className={`control-button ${
                isRecording ? "recording-active" : ""
              }`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? "Stop Recording" : "Start Recording"}
            </button>
          </div>

          {/* Audio Streaming */}
          <div className="remote-controls-container">
            <button
              className={`control-button ${
                isStreaming ? "streaming-active" : ""
              }`}
              onClick={isStreaming ? stopAudioStream : startAudioStream}
            >
              {isStreaming ? "Stop Streaming" : "Start Streaming"}
            </button>
          </div>

          {/* Recording Status */}
          {(isRecording || isStreaming) && (
            <div className="recording-status">
              <div className="recording-indicator"></div>
              <span>
                {isRecording
                  ? "Recording audio..."
                  : isStreaming
                  ? "Streaming audio..."
                  : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      <button
        className="control-button clean-token-button"
        onClick={() => {
          localStorage.removeItem("authToken");
          localStorage.removeItem("serviceUrl");
        }}
      >
        Clean token
      </button>
    </div>
  );
};

export default Remote;
