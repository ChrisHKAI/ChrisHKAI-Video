"""What the vendored sampler.py takes from lemo-opuscar's core/audio/sfx.py (MIT, LICENSE beside):
the sample rate, placing a mono sound in a stereo buffer, and a look-ahead limiter. The same as lemo's."""
import numpy as np
from scipy.ndimage import maximum_filter1d, uniform_filter1d

SR = 48000


def limit(x, ceil=.9, look=.005):
    """1D look-ahead limiter (for multichannel, call it per channel)"""
    n = int(look * SR)
    m = maximum_filter1d(np.abs(x), size=2 * n + 1)
    g = uniform_filter1d(np.minimum(1, ceil / np.maximum(m, 1e-9)), size=n)
    return x * g


def add(buf, x, at, gain=1.0, pan=0.0):
    s = int(at * SR)
    if s >= len(buf) or s + len(x) <= 0:
        return
    if s < 0:
        x, s = x[-s:], 0
    e = min(len(buf), s + len(x))
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[s:e, 0] += x[:e - s] * gain * l * 1.414
    buf[s:e, 1] += x[:e - s] * gain * r * 1.414
