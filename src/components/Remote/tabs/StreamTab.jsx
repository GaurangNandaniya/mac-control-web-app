import { useState, useRef } from "react";
import audioBufferToWav from "audiobuffer-to-wav";
import { MonitorSmartphone, Camera, Mic, Radio } from "lucide-react";
import Tile from "../ui/Tile";
import SectionLabel from "../ui/SectionLabel";

const StreamTab = ({ makeRequest, onWatch }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);

  const convertWebmToWav = async (webmBlob) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await ctx.decodeAudioData(await webmBlob.arrayBuffer());
    return new Blob([audioBufferToWav(buf)], { type: "audio/wav" });
  };

  const handleAudioUpload = async (blob) => {
    try {
      const wav = await convertWebmToWav(blob);
      const fd = new FormData();
      fd.append("audio", wav, `recording_${Date.now()}.wav`);
      await makeRequest("/alerts/upload/audio", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch (e) {
      console.error("Audio upload failed:", e);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 44100, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorderRef.current.onstop = async () =>
        handleAudioUpload(new Blob(chunks, { type: "audio/webm;codecs=opus" }));
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Error starting recording:", e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
    }
  };

  const startAudioStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 44100, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(1024, 1, 1);
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
        }
        makeRequest("/alerts/stream/audio", pcm, {
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
    } catch (e) {
      console.error("Error starting audio stream:", e);
    }
  };

  const stopAudioStream = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    setIsStreaming(false);
  };

  return (
    <div>
      <SectionLabel>Live System Stream</SectionLabel>
      <div className="row">
        <Tile icon={MonitorSmartphone} label="Watch Screen" onClick={() => onWatch("screen")} />
        <Tile icon={Camera} label="Watch Camera" onClick={() => onWatch("camera")} />
      </div>

      <SectionLabel>Send Audio to Mac</SectionLabel>
      <div className="row">
        <Tile
          icon={Mic}
          label={isRecording ? "Stop Rec" : "Record"}
          active={isRecording}
          onClick={isRecording ? stopRecording : startRecording}
        />
        <Tile
          icon={Radio}
          label={isStreaming ? "Stop Live" : "Live Mic"}
          active={isStreaming}
          onClick={isStreaming ? stopAudioStream : startAudioStream}
        />
      </div>
    </div>
  );
};

export default StreamTab;
