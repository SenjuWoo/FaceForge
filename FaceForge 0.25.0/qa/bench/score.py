"""Scores recovered EFM sliders against the known truth that produced the render.

skill = 1 - sum|V(recovered) - V(truth)|^2 / sum|V0 - V(truth)|^2   (an R^2 against "do nothing").
1.0 is perfect, 0.0 is no better than leaving the head neutral, negative is worse than neutral.
All of it is relative to the [U] linear model in headmodel.py, not to the game.
"""
import numpy as np


def _height(model) -> float:
    z = model.base.verts[:, 2]
    return float(z.max() - z.min())


def _usable(model, w: dict) -> dict:
    return {k: v for k, v in w.items() if k in model.sliders}


def score(model, truths: list, recovered: list, neutral_recovered: dict | None = None) -> dict:
    """truths[i]: {slider: value}; recovered[i]: {slider: value} or None for a detector miss."""
    height = _height(model)
    found = [(t, r) for t, r in zip(truths, recovered) if r is not None]
    out = {"n": len(truths), "found": len(found), "found_rate": len(found) / max(len(truths), 1)}
    if not found:
        return out | {"slider_corr": None, "sign_agree": None, "rmse_rel_height": None,
                      "null_rmse_rel_height": None, "skill": None}

    pool = sorted({k for t, _ in found for k in t} | {k for _, r in found for k in _usable(model, r)})
    t_vec = np.array([[t.get(k, 0.0) for k in pool] for t, _ in found])
    r_vec = np.array([[r.get(k, 0.0) for k in pool] for _, r in found])
    corr = float(np.corrcoef(t_vec.ravel(), r_vec.ravel())[0, 1]) if t_vec.std() and r_vec.std() else 0.0
    strong = np.abs(t_vec) >= 0.5
    agree = float(np.mean((np.sign(r_vec[strong]) == np.sign(t_vec[strong])) & (np.abs(r_vec[strong]) > 0.05))) \
        if strong.any() else None

    base = model.base.verts
    err = null = 0.0
    for t, r in found:
        v_t = model.apply(_usable(model, t))
        err += float(((model.apply(_usable(model, r)) - v_t) ** 2).sum(axis=1).mean())
        null += float(((base - v_t) ** 2).sum(axis=1).mean())
    n = len(found)
    out |= {
        "slider_corr": corr,
        "sign_agree": agree,
        "rmse_rel_height": float(np.sqrt(err / n) / height),
        "null_rmse_rel_height": float(np.sqrt(null / n) / height),
        "skill": 1.0 - err / null if null > 0 else None,
    }
    if neutral_recovered is not None:
        bias = model.apply(_usable(model, neutral_recovered)) - base
        out["neutral_bias_rmse_rel_height"] = float(np.sqrt((bias ** 2).sum(axis=1).mean()) / height)
    return out
