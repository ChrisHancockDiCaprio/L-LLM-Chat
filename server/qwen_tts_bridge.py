"""KAIROS protocol adapter for the official qwen-tts SDK; one model at a time."""
import base64
import gc
import io
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_AUDIO = 16 * 1024 * 1024
MODEL_IDS = {
    "custom": os.getenv("KAIROS_TTS_CUSTOM", "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"),
    "design": os.getenv("KAIROS_TTS_DESIGN", "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"),
    "clone": os.getenv("KAIROS_TTS_CLONE", "Qwen/Qwen3-TTS-12Hz-0.6B-Base"),
}


def capability(mode, model_id, config):
    expected = {"custom": "custom_voice", "design": "voice_design", "clone": "base"}
    if config["tts_model_type"] != expected[mode]:
        raise ValueError("Model type does not match configured mode")
    talker = config["talker_config"]
    return {"id": mode, "model": model_id,
            "languages": sorted({"auto", *[x.lower() for x in talker["codec_language_id"] if "dialect" not in x]}),
            "speakers": sorted(x.lower() for x in talker.get("spk_id", {})) if mode == "custom" else [],
            "instruction": mode == "design" or mode == "custom" and config["tts_model_size"] != "0b6"}


def validate_request(raw, caps):
    if not isinstance(raw, dict):
        raise ValueError("JSON object required")
    mode = next((m for m in caps if m["id"] == raw.get("mode")), None)
    if not mode:
        raise ValueError("Unavailable mode")
    allowed = {"mode", "text", "language", "do_sample", "temperature", "top_p", "top_k", "repetition_penalty", "max_new_tokens"}
    allowed |= {"custom": {"speaker", "instruct"}, "design": {"instruct"}, "clone": {"ref_audio", "ref_text", "x_vector_only_mode"}}[mode["id"]]
    if set(raw) - allowed:
        raise ValueError("Unsupported parameters")
    text = raw.get("text")
    if not isinstance(text, str) or not text.strip() or len(text) > 4000:
        raise ValueError("Text must contain 1-4000 characters")
    if raw.get("language") not in mode["languages"]:
        raise ValueError("Unsupported language")
    kwargs = {"text": text, "language": raw["language"]}
    ranges = {"temperature": (0.01, 2), "top_p": (0.01, 1), "top_k": (1, 1000),
              "repetition_penalty": (1, 2), "max_new_tokens": (64, 4096)}
    for key, (low, high) in ranges.items():
        if key in raw:
            value = raw[key]
            if type(value) not in (int, float) or not low <= value <= high or key in ("top_k", "max_new_tokens") and type(value) is not int:
                raise ValueError("Invalid sampling parameter")
            kwargs[key] = value
    if "do_sample" in raw:
        if type(raw["do_sample"]) is not bool:
            raise ValueError("Invalid sampling switch")
        kwargs["do_sample"] = raw["do_sample"]
    if mode["id"] == "custom":
        if raw.get("speaker") not in mode["speakers"]:
            raise ValueError("Unsupported speaker")
        kwargs["speaker"] = raw["speaker"]
    instruction = raw.get("instruct", "")
    if not isinstance(instruction, str) or len(instruction) > 2000:
        raise ValueError("Invalid instruction")
    if instruction and not mode["instruction"]:
        raise ValueError("This model does not support instructions")
    if mode["id"] == "design" and not instruction.strip():
        raise ValueError("Voice description required")
    if mode["instruction"]:
        kwargs["instruct"] = instruction
    if mode["id"] == "clone":
        xvec = raw.get("x_vector_only_mode", False)
        if type(xvec) is not bool:
            raise ValueError("Invalid cloning mode")
        transcript = raw.get("ref_text", "")
        if not isinstance(transcript, str) or len(transcript) > 4000 or not xvec and not transcript.strip():
            raise ValueError("Reference transcript required for ICL")
        audio = raw.get("ref_audio")
        if not isinstance(audio, str) or len(audio) > (MAX_AUDIO + 2) // 3 * 4:
            raise ValueError("Reference audio missing or too large")
        audio = base64.b64decode(audio, validate=True)
        if len(audio) < 44 or len(audio) > MAX_AUDIO or audio[:4] != b"RIFF" or audio[8:12] != b"WAVE":
            raise ValueError("Reference must be WAV")
        kwargs.update(ref_audio=audio, ref_text=transcript, x_vector_only_mode=xvec)
    return mode, kwargs


class Runtime:
    def __init__(self):
        from huggingface_hub import hf_hub_download
        self.caps = []
        for mode, model_id in MODEL_IDS.items():
            if not model_id:  # Empty environment value disables a mode.
                continue
            path = os.path.join(model_id, "config.json") if os.path.isdir(model_id) else hf_hub_download(model_id, "config.json")
            with open(path, encoding="utf-8") as source:
                self.caps.append(capability(mode, model_id, json.load(source)))
        self.model = None
        self.model_id = None
        self.lock = threading.Lock()

    def generate(self, raw):
        mode, kwargs = validate_request(raw, self.caps)
        if not self.lock.acquire(blocking=False):
            raise BlockingIOError("Generation already running")
        try:
            import torch
            import soundfile as sf
            from qwen_tts import Qwen3TTSModel
            if self.model_id != mode["model"]:
                self.model = None
                self.model_id = None
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                device = os.getenv("KAIROS_TTS_DEVICE", "cpu")
                self.model = Qwen3TTSModel.from_pretrained(mode["model"], device_map=device,
                    dtype=torch.float32 if device == "cpu" else torch.bfloat16,
                    attn_implementation="eager")
                self.model_id = mode["model"]
            if mode["id"] == "clone":
                with sf.SoundFile(io.BytesIO(kwargs["ref_audio"])) as source:
                    if source.channels not in (1, 2) or not 8000 <= source.samplerate <= 96000 or source.frames > source.samplerate * 30:
                        raise ValueError("Reference must be mono/stereo, 8-96 kHz, at most 30 seconds")
                    sample_rate = source.samplerate
                    audio = source.read(dtype="float32")
                if audio.ndim > 1:
                    audio = audio.mean(axis=1)
                kwargs["ref_audio"] = (audio, sample_rate)
            method = {"custom": self.model.generate_custom_voice, "design": self.model.generate_voice_design,
                      "clone": self.model.generate_voice_clone}[mode["id"]]
            wavs, rate = method(**kwargs)
            output = io.BytesIO()
            sf.write(output, wavs[0], rate, format="WAV", subtype="PCM_16")
            result = output.getvalue()
            if len(result) > MAX_AUDIO:
                raise ValueError("Output exceeds 16 MB")
            return result
        finally:
            self.lock.release()


class Handler(BaseHTTPRequestHandler):
    # No CORS: browser pages must not drive the unauthenticated local service.
    def log_message(self, *_args):
        pass  # Never log speech, reference audio, or request bodies.

    def reply(self, status, body, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass  # Client stopped waiting; inference is not retried.

    def blocked_browser(self):
        return self.headers.get("Origin") is not None or self.headers.get("Sec-Fetch-Site") is not None

    def do_GET(self):
        if self.blocked_browser():
            return self.reply(403, b'{}')
        if self.path != "/v1/tts/capabilities":
            return self.reply(404, b'{}')
        self.reply(200, json.dumps({"protocol": "kairos-qwen-tts-v1", "modes": self.server.runtime.caps}).encode())

    def do_POST(self):
        if self.blocked_browser():
            return self.reply(403, b'{}')
        if self.path != "/v1/tts/generate":
            return self.reply(404, b'{}')
        try:
            if self.headers.get("Transfer-Encoding") or self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                raise ValueError("JSON with Content-Length required")
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 23 * 1024 * 1024:
                raise ValueError("Invalid request size")
            self.connection.settimeout(30)
            raw = self.rfile.read(size)
            if len(raw) != size:
                raise ValueError("Incomplete body")
            result = self.server.runtime.generate(json.loads(raw))
            self.reply(200, result, "audio/wav")
        except BlockingIOError:
            self.reply(409, b'{"error":"Generation already running"}')
        except (ValueError, TypeError, KeyError):
            self.reply(400, b'{"error":"Invalid or unsupported TTS request"}')
        except Exception:
            self.reply(500, b'{"error":"Model loading or generation failed; check server installation"}')


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", int(os.getenv("KAIROS_TTS_PORT", "8860"))), Handler)
    server.runtime = Runtime()
    print("KAIROS Qwen TTS ready on loopback port", server.server_port, flush=True)
    server.serve_forever()
