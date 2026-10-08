import importlib.util
import json
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

spec = importlib.util.spec_from_file_location("bridge", Path(__file__).with_name("qwen_tts_bridge.py"))
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


def config(kind="custom_voice", size="0b6"):
    return {"tts_model_type": kind, "tts_model_size": size,
            "talker_config": {"codec_language_id": {"german": 1, "english": 2, "chinese_dialect": 3}, "spk_id": {"Ryan": 1}}}


class BridgeTests(unittest.TestCase):
    def test_capabilities_follow_checkpoint_config(self):
        cap = bridge.capability("custom", "model", config())
        self.assertEqual(cap["languages"], ["auto", "english", "german"])
        self.assertEqual(cap["speakers"], ["ryan"])
        self.assertFalse(cap["instruction"])
        self.assertTrue(bridge.capability("custom", "model", config(size="1b7"))["instruction"])
        with self.assertRaises(ValueError):
            bridge.capability("clone", "model", config())

    def test_supported_request_preserves_model_defaults(self):
        cap = bridge.capability("custom", "model", config())
        _, kwargs = bridge.validate_request({"mode": "custom", "text": "Hallo", "language": "german", "speaker": "ryan"}, [cap])
        self.assertEqual(kwargs, {"text": "Hallo", "language": "german", "speaker": "ryan"})

    def test_unsupported_parameters_and_instructions_are_rejected(self):
        cap = bridge.capability("custom", "model", config())
        base = {"mode": "custom", "text": "Hi", "language": "german", "speaker": "ryan"}
        for extra in ({"instruct": "warm"}, {"speed": 2}, {"speaker": "missing"}, {"temperature": float("nan")}, {"top_k": 1.5}, {"do_sample": "false"}):
            with self.subTest(extra=extra), self.assertRaises(ValueError):
                bridge.validate_request({**base, **extra}, [cap])

    def test_clone_reference_and_transcript_are_required(self):
        cap = bridge.capability("clone", "model", config(kind="base"))
        base = {"mode": "clone", "text": "Hi", "language": "german"}
        for extra in ({}, {"x_vector_only_mode": True}, {"ref_audio": "https://external/secret", "ref_text": "Hi"}):
            with self.assertRaises(ValueError):
                bridge.validate_request({**base, **extra}, [cap])

    def test_http_contract_and_browser_origin_block(self):
        class FakeRuntime:
            caps = [bridge.capability("custom", "model", config())]
            calls = 0

            def generate(self, raw):
                bridge.validate_request(raw, self.caps)
                self.calls += 1
                return b"RIFFfixtureWAVE"

        server = ThreadingHTTPServer(("127.0.0.1", 0), bridge.Handler)
        runtime = server.runtime = FakeRuntime()
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        connection = HTTPConnection("127.0.0.1", server.server_port, timeout=5)
        try:
            connection.request("GET", "/v1/tts/capabilities")
            response = connection.getresponse()
            self.assertEqual(json.loads(response.read())["protocol"], "kairos-qwen-tts-v1")
            body = json.dumps({"mode": "custom", "text": "Hi", "language": "german", "speaker": "ryan"})
            connection.request("POST", "/v1/tts/generate", body, {"Content-Type": "application/json", "Origin": "https://evil"})
            response = connection.getresponse()
            self.assertEqual(response.status, 403)
            response.read()
            self.assertEqual(runtime.calls, 0)
            connection.request("POST", "/v1/tts/generate", body, {"Content-Type": "application/json"})
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            self.assertEqual(response.getheader("Content-Type"), "audio/wav")
            response.read()
            self.assertEqual(runtime.calls, 1)
        finally:
            connection.close()
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
