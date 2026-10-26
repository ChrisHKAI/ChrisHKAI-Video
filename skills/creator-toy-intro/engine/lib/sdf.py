"""Signed distance fields in numpy, for the sculpt kit (a person, a detailed
mascot): primitives, smooth booleans, projection onto a surface, and meshing
by marching cubes. A sculpt script built on it writes a manifest and one .npz
per part; engine/scripts/import-sculpt.py brings them into the film.

Units: mm. Points are (N, 3) float arrays. Negative = inside. Every node keeps
a bounding box (lo, hi), so a union only evaluates a child near that child.
Frames: R is a 3x3 matrix whose columns are the primitive's local axes in the
world; a point's local coordinates are (P - c) @ R.
"""
import numpy as np
from skimage.measure import marching_cubes

BIG = 1e4


def rot(rx=0.0, ry=0.0, rz=0.0):
    """Rotation (degrees) about x, then y, then z (world axes)."""
    a, b, c = np.radians([rx, ry, rz])
    X = np.array([[1, 0, 0], [0, np.cos(a), -np.sin(a)], [0, np.sin(a), np.cos(a)]])
    Y = np.array([[np.cos(b), 0, np.sin(b)], [0, 1, 0], [-np.sin(b), 0, np.cos(b)]])
    Z = np.array([[np.cos(c), -np.sin(c), 0], [np.sin(c), np.cos(c), 0], [0, 0, 1]])
    return Z @ Y @ X


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.maximum(k - np.abs(a - b), 0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def smax(a, b, k):
    return -smin(-a, -b, k)


class Node:
    lo = hi = None

    def __call__(self, P):
        return self.f(np.asarray(P, float))

    def near(self, P, pad):
        return np.all((P >= self.lo - pad) & (P <= self.hi + pad), axis=1)


class Prim(Node):
    """A shape in a local frame: c (centre), R (axes), reach (bound radius)."""

    def __init__(self, c, R, reach):
        self.c = np.asarray(c, float)
        self.R = np.eye(3) if R is None else np.asarray(R, float)
        self.lo, self.hi = self.c - reach, self.c + reach

    def f(self, P):
        return self.local((P - self.c) @ self.R)


class Sphere(Prim):
    def __init__(self, c, r):
        super().__init__(c, None, r)
        self.r = r

    def local(self, q):
        return np.linalg.norm(q, axis=1) - self.r


class Ellipsoid(Prim):
    def __init__(self, c, r, R=None):
        r = np.asarray(r, float)
        super().__init__(c, R, r.max())
        self.r = r

    def local(self, q):
        k0 = np.linalg.norm(q / self.r, axis=1)
        k1 = np.linalg.norm(q / (self.r * self.r), axis=1)
        return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


class RoundBox(Prim):
    def __init__(self, c, half, rr, R=None):
        half = np.asarray(half, float)
        super().__init__(c, R, np.linalg.norm(half))
        self.b, self.rr = half - rr, rr

    def local(self, q):
        q = np.abs(q) - self.b
        return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0) - self.rr


class Torus(Prim):
    """A ring of radius Rm about the local z axis, tube radius r."""

    def __init__(self, c, Rm, r, R=None):
        super().__init__(c, R, Rm + r)
        self.Rm, self.r = Rm, r

    def local(self, q):
        ring = np.linalg.norm(q[:, :2], axis=1) - self.Rm
        return np.hypot(ring, q[:, 2]) - self.r


def _round_rect(q2, hx, hy, rc):
    q = np.abs(q2) - np.array([hx - rc, hy - rc])
    return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0) - rc


class RectRing(Prim):
    """A rounded-rectangle frame in the local xy plane (half size hx, hy,
    corner radius rc), its band 2w wide and 2t thick, edges rounded by e."""

    def __init__(self, c, hx, hy, rc, w, t, e=0.2, R=None):
        super().__init__(c, R, np.hypot(hx + w, hy + w) + t)
        self.a = (hx, hy, rc, w, t, e)

    def local(self, q):
        hx, hy, rc, w, t, e = self.a
        d2 = np.abs(_round_rect(q[:, :2], hx, hy, rc)) - (w - e)
        dz = np.abs(q[:, 2]) - (t - e)
        return np.minimum(np.maximum(d2, dz), 0) + np.hypot(np.maximum(d2, 0), np.maximum(dz, 0)) - e


class RectSlab(Prim):
    """A filled rounded rectangle in the local xy plane, 2t thick."""

    def __init__(self, c, hx, hy, rc, t, R=None):
        super().__init__(c, R, np.hypot(hx, hy) + t)
        self.a = (hx, hy, rc, t)

    def local(self, q):
        hx, hy, rc, t = self.a
        d2 = _round_rect(q[:, :2], hx, hy, rc)
        dz = np.abs(q[:, 2]) - t
        return np.minimum(np.maximum(d2, dz), 0) + np.hypot(np.maximum(d2, 0), np.maximum(dz, 0))


class RoundCone(Node):
    """A capsule from a (radius ra) to b (radius rb)."""

    def __init__(self, a, b, ra, rb=None):
        rb = ra if rb is None else rb
        self.a, self.b = np.asarray(a, float), np.asarray(b, float)
        self.ra, self.rb = ra, rb
        r = max(ra, rb)
        self.lo = np.minimum(self.a, self.b) - r
        self.hi = np.maximum(self.a, self.b) + r

    def f(self, P):
        ba = self.b - self.a
        l2 = ba @ ba
        rr = self.ra - self.rb
        a2 = l2 - rr * rr
        il2 = 1.0 / l2
        pa = P - self.a
        y = pa @ ba
        z = y - l2
        v = pa * l2 - np.outer(y, ba)
        x2 = np.einsum("ij,ij->i", v, v)
        y2, z2 = y * y * l2, z * z * l2
        k = np.sign(rr) * rr * rr * x2
        d3 = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - self.ra
        d2 = np.sqrt(x2 + y2) * il2 - self.ra
        d1 = np.sqrt(x2 + z2) * il2 - self.rb
        return np.where(np.sign(z) * a2 * z2 > k, d1, np.where(np.sign(y) * a2 * y2 < k, d2, d3))


def Capsule(a, b, r):
    return RoundCone(a, b, r, r)


class Plane(Node):
    """The half-space dot(p - c, n) > 0 is outside; bounded by a box."""

    def __init__(self, c, n, lo, hi):
        self.c, self.n = np.asarray(c, float), np.asarray(n, float) / np.linalg.norm(n)
        self.lo, self.hi = np.asarray(lo, float), np.asarray(hi, float)

    def f(self, P):
        return (P - self.c) @ self.n


class Union(Node):
    def __init__(self, children, k=0.0):
        self.children, self.k = [c for c in children if c is not None], k
        self.lo = np.min([c.lo for c in self.children], axis=0) - k
        self.hi = np.max([c.hi for c in self.children], axis=0) + k

    def f(self, P):
        d = np.full(len(P), BIG)
        for c in self.children:
            m = c.near(P, self.k + 0.5)
            if m.any():
                d[m] = smin(d[m], c.f(P[m]), self.k)
        return d


class Sub(Node):
    """a minus b, blended by k."""

    def __init__(self, a, b, k=0.0):
        self.a, self.b, self.k = a, b, k
        self.lo, self.hi = a.lo, a.hi

    def f(self, P):
        d = self.a.f(P)
        m = self.b.near(P, self.k + 0.5)
        if m.any():
            d[m] = smax(d[m], -self.b.f(P[m]), self.k)
        return d


class Inter(Node):
    def __init__(self, a, b, k=0.0):
        self.a, self.b, self.k = a, b, k
        self.lo, self.hi = np.maximum(a.lo, b.lo), np.minimum(a.hi, b.hi)

    def f(self, P):
        d = np.full(len(P), BIG)
        m = self.b.near(P, self.k + 0.5)
        if m.any():
            d[m] = smax(self.a.f(P[m]), self.b.f(P[m]), self.k)
        return d


class Offset(Node):
    def __init__(self, a, r):
        self.a, self.r = a, r
        self.lo, self.hi = a.lo - max(r, 0), a.hi + max(r, 0)

    def f(self, P):
        return self.a.f(P) - self.r


class Squash(Node):
    """child squashed by s (< 1) along the unit axis ax, towards the plane through c."""

    def __init__(self, child, c, ax, s):
        self.child, self.c, self.s = child, np.asarray(c, float), s
        self.ax = np.asarray(ax, float) / np.linalg.norm(ax)
        self.lo, self.hi = child.lo - 1.0, child.hi + 1.0

    def f(self, P):
        along = (P - self.c) @ self.ax
        return self.child.f(P + np.outer(along * (1 / self.s - 1), self.ax)) * self.s


def tube(points, radii, k=0.3):
    """A tapering tube through points (a chain of round cones)."""
    pts = np.asarray(points, float)
    return Union([RoundCone(pts[i], pts[i + 1], radii[i], radii[i + 1]) for i in range(len(pts) - 1)], k)


def bezier(p0, p1, p2, n):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2


def project(node, origin, direction, far=40.0, iters=40):
    """Where rays from origin along direction first meet the surface
    (bisection between outside at the origin and inside at origin + far*dir)."""
    o = np.atleast_2d(np.asarray(origin, float))
    d = np.asarray(direction, float)
    d = d / np.linalg.norm(d)
    lo, hi = np.zeros(len(o)), np.full(len(o), far)
    for _ in range(iters):
        mid = (lo + hi) / 2
        inside = node.f(o + mid[:, None] * d) < 0
        hi = np.where(inside, mid, hi)
        lo = np.where(inside, lo, mid)
    return o + hi[:, None] * d


def mesh(node, h=0.3, chunk=2_000_000):
    """Marching cubes of node at voxel size h (mm): verts (mm), faces, normals."""
    lo, hi = node.lo - 2 * h, node.hi + 2 * h
    axes = [np.arange(lo[i], hi[i] + h, h) for i in range(3)]
    nx, ny, nz = map(len, axes)
    vol = np.empty((nx, ny, nz), np.float32)
    per = max(1, chunk // (ny * nz))
    Y, Z = np.meshgrid(axes[1], axes[2], indexing="ij")
    for i in range(0, nx, per):
        xs = axes[0][i:i + per]
        P = np.column_stack([np.repeat(xs, ny * nz), np.tile(Y.ravel(), len(xs)), np.tile(Z.ravel(), len(xs))])
        vol[i:i + per] = node.f(P).reshape(len(xs), ny, nz)
    verts, faces, normals, _ = marching_cubes(vol, 0.0, spacing=(h, h, h))
    return verts + lo, faces, normals
