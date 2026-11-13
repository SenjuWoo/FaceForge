"""Skyrim head as a linear morph model, for the Phase 0 accuracy benchmark.

A RaceMenu slider is `Name = flags, Slider, <negative morph>, <positive morph>`; a morph is a named
per-vertex delta array in a FaceGen .tri. This module reads both and applies a slider vector:

    V(w) = V0 + sum_i |w_i| * delta[ pos_i if w_i >= 0 else neg_i ]

[U] That sign/scale convention (and the per-morph multiplier) matches RaceMenu only if an in-game
F5 head export agrees. It is the same convention FaceForge.Core/TriFile.cs documents, but it has
not been checked against the engine. Every number built on it is a model number, not a game number.

Only the head mesh is modelled. EFM sliders whose morph pair lives on the eye or mouth mesh are
reported by `HeadModel.skipped` rather than silently dropped.
"""
from __future__ import annotations

import os
import struct
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

DATA = Path(os.environ.get(
    "SKYRIM_DATA",
    r"C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data"))
BENCH = Path(__file__).resolve().parent
HPH_CACHE = BENCH / "cache" / "hph-bsa" / "meshes" / "actors" / "character" / "facegenmorphs"
FACEGEN = DATA / "meshes" / "actors" / "character" / "facegenmorphs"
ASSETS = DATA / "meshes" / "actors" / "character" / "character assets"


@dataclass
class Tri:
    verts: np.ndarray            # [N,3] float32
    tris: np.ndarray             # [M,3] int64
    morphs: dict = field(default_factory=dict)   # name -> float32[N,3] (multiplier applied)


def read_tri(path) -> Tri:
    """FRTRI003; layout verified against FaceForge.Core/TriFile.cs. Raises on any size mismatch."""
    data = Path(path).read_bytes()
    if data[:8] != b"FRTRI003":
        raise ValueError(f"Not a FRTRI003 file: {path}")
    n_verts, n_tris = struct.unpack_from("<II", data, 8)
    n_uv, flags, n_morphs = (struct.unpack_from("<I", data, off)[0] for off in (28, 32, 36))
    off = 64
    verts = np.frombuffer(data, "<f4", n_verts * 3, off).reshape(-1, 3).copy()
    off += n_verts * 12
    tris = np.frombuffer(data, "<u4", n_tris * 3, off).reshape(-1, 3).astype(np.int64)
    off += n_tris * 12
    if flags & 1:
        off += n_uv * 8 + n_tris * 12
    morphs = {}
    for _ in range(n_morphs):
        if off + 4 > len(data):
            raise ValueError(f"Truncated morph table in {path}")
        length = struct.unpack_from("<I", data, off)[0]
        off += 4
        name = data[off:off + length].rstrip(b"\0").decode("ascii")  # length counts the NUL
        off += length
        mult = struct.unpack_from("<f", data, off)[0]
        off += 4
        if off + n_verts * 6 > len(data):
            raise ValueError(f"Truncated morph '{name}' in {path}")
        delta = np.frombuffer(data, "<i2", n_verts * 3, off).reshape(-1, 3)
        off += n_verts * 6
        morphs[name] = delta.astype(np.float32) * mult
    if off != len(data):
        raise ValueError(f"Parsed {off} of {len(data)} bytes in {path}")
    return Tri(verts, tris, morphs)


def read_sliders(ini: Path, sex: str) -> dict:
    """`Name = flags, Slider, neg, pos` lines of the [Female]/[Male] section."""
    sliders, active = {}, False
    for raw in ini.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        line = raw.strip()
        if line.startswith("["):
            active = line.strip("[]").lower() == sex
            continue
        if not active or "=" not in line or line.startswith(("#", ";")):
            continue
        name, rest = (part.strip() for part in line.split("=", 1))
        fields = [part.strip() for part in rest.split(",")]
        if len(fields) >= 4 and fields[1].lower() == "slider":
            sliders[name] = (fields[2], fields[3])
    return sliders


@dataclass
class HeadModel:
    name: str
    base: Tri
    morphs: dict
    sliders: dict            # slider -> (neg, pos), only those whose morphs are on this head
    skipped: list            # sliders whose morph pair is not on this head mesh

    def apply(self, w: dict) -> np.ndarray:
        verts = self.base.verts.copy()
        for slider, value in w.items():
            neg, pos = self.sliders[slider]
            verts += abs(value) * self.morphs[pos if value >= 0 else neg]
        return verts


# head id -> (base tri, EFM morph tri, sex). HPH ships its own 3832-vertex EFM morphs inside
# High Poly Head.bsa (extracted into cache/ with housecarl_bsa_extract); vanilla EFM is loose.
HEADS = {
    "vanilla_female": (ASSETS / "FemaleHeadChargen.tri",
                       FACEGEN / "morphs" / "EFM" / "Female" / "FemaleHead.tri", "female"),
    "vanilla_male": (ASSETS / "MaleHeadCustomizations.tri",
                     FACEGEN / "morphs" / "EFM" / "Male" / "MaleHead.tri", "male"),
    "hph_female": (DATA / "meshes" / "KL" / "High Poly Head" / "femaleheadchargen.tri",
                   HPH_CACHE / "morphs" / "kl" / "femalehead_efm.tri", "female"),
    "hph_male": (DATA / "meshes" / "KL" / "High Poly Head" / "maleheadcustomizations.tri",
                 HPH_CACHE / "morphs" / "kl" / "malehead_efm.tri", "male"),
}


def load_efm(head: str) -> HeadModel:
    base_path, efm_path, sex = HEADS[head]
    base, efm = read_tri(base_path), read_tri(efm_path)
    if len(base.verts) != len(efm.verts):
        raise ValueError(f"{head}: base has {len(base.verts)} vertices, EFM morphs {len(efm.verts)}")
    morphs = {**base.morphs, **efm.morphs}
    wanted = read_sliders(FACEGEN / "Expressive Facegen Morphs.esl" / "sliders" / "human.ini", sex)
    live = {s: pair for s, pair in wanted.items() if all(m in morphs for m in pair)}
    skipped = sorted(set(wanted) - set(live))
    return HeadModel(head, base, morphs, live, skipped)
