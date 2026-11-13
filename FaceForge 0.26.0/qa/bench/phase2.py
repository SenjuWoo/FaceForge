"""Phase 2 prototype: fit EFM sliders to DENSE detector landmarks with an analytic Jacobian.

Replaces the 39-ratio objective of fit.ts. Idea:
  * the detector's 468 landmarks are attached to the neutral Skyrim head by barycentric coordinates,
    found by locating each landmark of a neutral render on the head triangles it lies on;
  * morphs are linear, so a slider's effect on every landmark is a fixed vector (no render per slider);
  * the detector's own offset at neutral (beta) is carried along, so its systematic bias cancels;
  * the photo's unknown framing is a 2D similarity, re-solved each iteration (Umeyama);
  * a ridge prior keeps unobserved (depth-only) sliders near zero.

Everything is in the [U] linear head model of headmodel.py. Positive and negative morphs are separate
non-negative variables, then netted: w = x_pos - x_neg.
"""
import numpy as np

from render import PITCH, rh

SIZE = 1024
LIMIT = 3.0          # EFM range in RaceMenu (EFM_RANGE in faceAnalysis.ts)


class LandmarkModel:
    def __init__(self, model, neutral_px: np.ndarray):
        """neutral_px: (468,2) detector landmarks of the neutral render, in render pixels."""
        self.model, self.deg = model, PITCH[model.name]
        v0 = rh.pitch(model.base.verts, self.deg)
        low, high = v0.min(0), v0.max(0)
        center = (low + high) / 2
        self.cx, self.cz = center[0], center[2]
        self.scale = SIZE * 0.8 / max(high[0] - low[0], high[2] - low[2])  # render-head.render framing
        self.idx, self.w = self._locate(v0, model.base.tris, neutral_px)
        self.base_px = self._lm(self.pix(v0))
        self.neutral_px = neutral_px                    # == base_px + beta, beta = detector offset
        self.names = sorted(model.sliders)
        pos = [self._delta(model.morphs[model.sliders[n][1]]) for n in self.names]
        neg = [self._delta(model.morphs[model.sliders[n][0]]) for n in self.names]
        self.J = np.stack(pos + neg, axis=1)            # (2*468, 2n): landmark px per slider unit

    def pix(self, pitched):
        return np.stack([(pitched[:, 0] - self.cx) * self.scale + SIZE / 2,
                         -(pitched[:, 2] - self.cz) * self.scale + SIZE / 2], axis=1)

    def _lm(self, px):
        return (self.w[..., None] * px[self.idx]).sum(1)

    def _delta(self, morph):
        d = rh.pitch(morph, self.deg)                   # pitch is a rotation: linear on deltas
        return self._lm(np.stack([d[:, 0] * self.scale, -d[:, 2] * self.scale], axis=1)).ravel()

    def _locate(self, pitched, tris, pts):
        """Front-most facing triangle under each landmark: (vertex ids (K,3), barycentric weights (K,3))."""
        sx, sy, depth = self.pix(pitched)[:, 0], self.pix(pitched)[:, 1], pitched[:, 1]
        corners = pitched[tris]
        normals = np.cross(corners[:, 1] - corners[:, 0], corners[:, 2] - corners[:, 0])
        normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-9)
        t = tris[normals[:, 1] > 0]                     # back faces culled, as the renderer does
        xs, ys, ds = sx[t], sy[t], depth[t]
        area = (ys[:, 1] - ys[:, 2]) * (xs[:, 0] - xs[:, 2]) + (xs[:, 2] - xs[:, 1]) * (ys[:, 0] - ys[:, 2])
        keep = np.abs(area) > 1e-9
        t, xs, ys, ds, area = t[keep], xs[keep], ys[keep], ds[keep], area[keep]
        px, py = pts[:, 0] - 0.5, pts[:, 1] - 0.5       # normalized landmarks are pixel-edge based
        w0 = ((ys[:, 1] - ys[:, 2])[:, None] * (px - xs[:, 2][:, None]) +
              (xs[:, 2] - xs[:, 1])[:, None] * (py - ys[:, 2][:, None])) / area[:, None]
        w1 = ((ys[:, 2] - ys[:, 0])[:, None] * (px - xs[:, 2][:, None]) +
              (xs[:, 0] - xs[:, 2])[:, None] * (py - ys[:, 2][:, None])) / area[:, None]
        w2 = 1 - w0 - w1
        wmin = np.minimum(np.minimum(w0, w1), w2)
        z = w0 * ds[:, 0][:, None] + w1 * ds[:, 1][:, None] + w2 * ds[:, 2][:, None]
        score = np.where(wmin >= -1e-9, z, -1e9)
        best = np.where(score.max(0) <= -1e8, wmin.argmax(0), score.argmax(0))  # off-silhouette: nearest tri
        k = np.arange(len(pts))
        ww = np.clip(np.stack([w0[best, k], w1[best, k], w2[best, k]], axis=1), 0, None)
        return t[best], ww / ww.sum(1, keepdims=True)

    def predict(self, verts):
        """Landmarks (468,2) in neutral-frame pixels for head vertices `verts` (unpitched)."""
        return self._lm(self.pix(rh.pitch(verts, self.deg))) + (self.neutral_px - self.base_px)


def umeyama(src: np.ndarray, dst: np.ndarray):
    """dst ~ s * src @ R.T + t  (2D similarity, reflection excluded)."""
    ms, md = src.mean(0), dst.mean(0)
    a, b = src - ms, dst - md
    u, d, vt = np.linalg.svd(b.T @ a)
    fix = np.eye(2)
    if np.linalg.det(u @ vt) < 0:
        fix[1, 1] = -1
    r = u @ fix @ vt
    s = (d * np.diag(fix)).sum() / (a ** 2).sum()
    return s, r, md - s * ms @ r.T


def bounded_ridge(J, r, lam, hi, rounds=25):
    """min ||J x - r||^2 + lam ||x||^2  s.t. 0 <= x <= hi, by repeatedly freezing violators."""
    n = J.shape[1]
    free, x = np.ones(n, bool), np.zeros(n)
    jtj, jtr = J.T @ J, J.T @ r
    for _ in range(rounds):
        f, fixed = np.where(free)[0], np.where(~free)[0]
        b = jtr[f] - (jtj[np.ix_(f, fixed)] @ x[fixed] if len(fixed) else 0)
        x[f] = np.linalg.solve(jtj[np.ix_(f, f)] + lam * np.eye(len(f)), b)
        bad = (x < 0) | (x > hi)
        if not bad.any():
            break
        x[x < 0], x[x > hi] = 0.0, hi
        free &= ~bad
    return x


def fit(lm: LandmarkModel, target_px: np.ndarray, lam: float = 100.0, iters: int = 8, weights=None):
    """target_px: (468,2) detector landmarks of the photo in ITS pixels. Returns {slider: value}."""
    n, k = len(lm.names), len(lm.neutral_px)
    sw = np.repeat(np.sqrt(np.ones(k) if weights is None else np.asarray(weights, float)), 2)
    x = np.zeros(2 * n)
    for _ in range(iters):
        pred = lm.neutral_px + (lm.J @ x).reshape(k, 2)
        s, r, t = umeyama(pred, target_px)
        back = (target_px - t) @ r / s                  # photo landmarks expressed in the neutral frame
        resid = (back - lm.neutral_px).ravel()
        x = bounded_ridge(lm.J * sw[:, None], resid * sw, lam, LIMIT)
    w = np.clip(x[:n] - x[n:], -LIMIT, LIMIT)
    return {name: float(v) for name, v in zip(lm.names, w) if abs(v) > 1e-6}


def empirical_jacobian(lm: LandmarkModel, jac: dict, delta: float = 3.0) -> np.ndarray:
    """Measured detector response per slider unit: landmarks of each slider rendered at +-delta, mapped
    back to the neutral frame by a similarity (the renderer re-frames every head), minus neutral."""
    cols = {"pos": [], "neg": []}
    for tag in ("pos", "neg"):
        for name in lm.names:
            px = np.array(jac[f"{name}|{tag}"]["lm"])[:468, :2] * SIZE
            s, r, t = umeyama(px, lm.neutral_px)
            cols[tag].append(((s * px @ r.T + t - lm.neutral_px) / delta).ravel())
    return np.stack(cols["pos"] + cols["neg"], axis=1)
