#!/usr/bin/env python3
"""
Build the companion SFT dataset.

Downloads source datasets from Hugging Face, filters, converts everything to
ShareGPT-style chat format, mixes according to the recipe, and writes
train.jsonl / eval.jsonl ready for QLoRA SFT on Kaggle.

Recipe (all commercial-friendly licenses):
  - PIPPA (deduped, NSFW-filtered)      ~ companion-chat distribution
  - SODA (subsample)                    ~ natural everyday chat
  - Synthetic-Persona-Chat              ~ persona consistency
  - samantha-data (via HF)              ~ warm disclosed-AI voice
  - hieunguyenminh/roleplay             ~ system-prompt persona control
"""
import json
import random
import re
from pathlib import Path

from datasets import load_dataset

random.seed(42)

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# --- NSFW / quality filtering -------------------------------------------------
# Keyword filter for PIPPA. Conservative: drop the whole conversation if any
# message trips the filter. A companion product must stay romantic-but-SFW.
NSFW_PATTERNS = [
    r"\bcock\b", r"\bpussy\b", r"\bcum\b", r"\bcumm", r"\borgasm", r"\bmoan",
    r"\bthrust", r"\bnipple", r"\bbreasts?\b", r"\bdick\b", r"\bhorny\b",
    r"\bfuck(s|ed|ing)? (me|you|her|him)\b", r"\bsex\b", r"\bnaked\b",
    r"\berect", r"\bpenis\b", r"\bvagina\b", r"\bclit", r"\banal\b",
    r"\bblowjob\b", r"\bhandjob\b", r"\bstrok(e|ing) (his|her|my|your)\b",
    r"\bgrind(s|ing) against\b", r"\bslut\b", r"\bwhore\b", r"\brape\b",
    r"\bnsfw\b", r"\blewd\b", r"\bpant(s|ies) (off|down)\b",
]
NSFW_RE = re.compile("|".join(NSFW_PATTERNS), re.IGNORECASE)


def is_sfw(text: str) -> bool:
    return not NSFW_RE.search(text)


def conv_is_sfw(messages) -> bool:
    return all(is_sfw(m["value"]) for m in messages)


def valid_conv(messages, min_turns=2, max_chars=8000) -> bool:
    """Basic quality gate: enough turns, not absurdly long, no empty messages."""
    if len(messages) < min_turns:
        return False
    total = sum(len(m["value"]) for m in messages)
    if total > max_chars:
        return False
    return all(m["value"].strip() for m in messages)


def to_sharegpt(system: str | None, turns) -> dict:
    """turns: list of (role, text) with role in {'human','gpt'}."""
    conv = []
    if system:
        conv.append({"from": "system", "value": system.strip()})
    conv.extend({"from": r, "value": t.strip()} for r, t in turns)
    return {"conversations": conv}


# --- Loaders -------------------------------------------------------------------

def load_pippa(limit=None):
    """PIPPA deduped: real Character.AI companion logs. Apache-2.0.

    The HF repo uses a legacy loading script, so fetch the raw jsonl directly.
    """
    print("Loading PIPPA ...")
    from huggingface_hub import hf_hub_download
    path = hf_hub_download("PygmalionAI/PIPPA", "pippa_deduped.jsonl",
                           repo_type="dataset")
    out = []
    with open(path) as f:
        rows = (json.loads(line) for line in f)
        for row in _pippa_iter(rows, limit):
            out.append(row)
    print(f"  PIPPA kept {len(out)} conversations (SFW-filtered)")
    return out


def _pippa_iter(rows, limit):
    count = 0
    for row in rows:
        persona = (row.get("bot_description") or "").strip()
        system = None
        if persona:
            system = f"You are {row.get('bot_name', 'a companion')}. {persona}"
        msgs = row["conversation"]
        turns = []
        for m in msgs:
            turns.append(("human" if m["is_human"] else "gpt", m["message"]))
        rec = to_sharegpt(system, turns)
        body = rec["conversations"]
        if valid_conv(body, max_chars=12000) and conv_is_sfw(body):
            yield rec
            count += 1
        if limit and count >= limit:
            return


def load_soda(limit=40000):
    """SODA: natural social dialogue. CC-BY-4.0. Subsampled."""
    print("Loading SODA ...")
    ds = load_dataset("allenai/soda", split="train", streaming=True)
    out = []
    for row in ds:
        d = row["dialogue"]
        if len(d) < 4:
            continue
        # Speaker A = human, speaker B = gpt (alternating)
        turns = [("human" if i % 2 == 0 else "gpt", t) for i, t in enumerate(d)]
        # Ensure last message is from gpt so it's a training target
        if turns[-1][0] == "human":
            turns = turns[:-1]
        rec = to_sharegpt(None, turns)
        if valid_conv(rec["conversations"]):
            out.append(rec)
        if len(out) >= limit:
            break
    print(f"  SODA kept {len(out)} conversations")
    return out


def load_spc(limit=None):
    """Google Synthetic-Persona-Chat. CC-BY-4.0."""
    print("Loading Synthetic-Persona-Chat ...")
    ds = load_dataset("google/Synthetic-Persona-Chat", split="train")
    out = []
    for row in ds:
        persona = (row.get("user 2 personas") or "").strip()
        system = f"Your persona:\n{persona}" if persona else None
        raw = row["Best Generated Conversation"]
        turns = []
        for line in raw.split("\n"):
            line = line.strip()
            m = re.match(r"^User ([12]):\s*(.+)$", line)
            if not m:
                continue
            role = "human" if m.group(1) == "1" else "gpt"
            turns.append((role, m.group(2)))
        if turns and turns[-1][0] == "human":
            turns = turns[:-1]
        rec = to_sharegpt(system, turns)
        if valid_conv(rec["conversations"], min_turns=4):
            out.append(rec)
        if limit and len(out) >= limit:
            break
    print(f"  SPC kept {len(out)} conversations")
    return out


def load_samantha(limit=None):
    """samantha-data: warm disclosed-AI companion voice. Apache-2.0.

    Legacy loading script on HF, so fetch the raw per-subject jsonl files.
    Format: {"conversation": "Theodore: ...\n\nSamantha: ...\n\n..."}
    """
    print("Loading samantha-data ...")
    from huggingface_hub import hf_hub_download
    subjects = ["flirty", "therapy", "advice", "fundamental", "random",
                "philosophy", "joke"]
    out = []
    for subj in subjects:
        path = hf_hub_download("cognitivecomputations/samantha-data",
                               f"data/{subj}_conversations.jsonl",
                               repo_type="dataset")
        for row in _read_json_stream(path):
            raw = row.get("conversation", "")
            turns = []
            for m in re.finditer(
                    r"(Theodore|Samantha):\s*(.*?)(?=\n\n(?:Theodore|Samantha):|$)",
                    raw, re.DOTALL):
                role = "human" if m.group(1) == "Theodore" else "gpt"
                turns.append((role, m.group(2).strip()))
            if not turns:
                continue
            if turns[-1][0] == "human":
                turns = turns[:-1]
            rec = to_sharegpt(None, turns)
            if valid_conv(rec["conversations"]):
                out.append(rec)
            if limit and len(out) >= limit:
                break
    print(f"  samantha kept {len(out)} conversations")
    return out


def _read_json_stream(path):
    """Yield objects from a file that may be JSONL or concatenated JSON objects."""
    with open(path) as f:
        content = f.read()
    dec = json.JSONDecoder()
    idx = 0
    n = len(content)
    while idx < n:
        while idx < n and content[idx] in " \t\r\n":
            idx += 1
        if idx >= n:
            break
        try:
            obj, end = dec.raw_decode(content, idx)
        except json.JSONDecodeError:
            break
        yield obj
        idx = end


def load_roleplay(limit=None):
    """hieunguyenminh/roleplay: system-prompt persona control. CC-BY-4.0."""
    print("Loading hieunguyenminh/roleplay ...")
    ds = load_dataset("hieunguyenminh/roleplay", split="train")
    out = []
    for row in ds:
        text = row.get("text", "")
        # Format: <|system|>...<|user|>...<|assistant|>... token-delimited
        parts = re.split(r"<\|(system|user|assistant)\|>", text)
        # re.split gives ['', 'system', '...', 'user', '...', ...]
        system = None
        turns = []
        for tag, content in zip(parts[1::2], parts[2::2]):
            content = content.strip()
            if not content:
                continue
            if tag == "system":
                system = content
            else:
                turns.append(("human" if tag == "user" else "gpt", content))
        if not turns:
            continue
        if turns[-1][0] == "human":
            turns = turns[:-1]
        rec = to_sharegpt(system, turns)
        if valid_conv(rec["conversations"]) and conv_is_sfw(rec["conversations"]):
            out.append(rec)
        if limit and len(out) >= limit:
            break
    print(f"  roleplay kept {len(out)} conversations")
    return out


def main():
    mix = []
    mix += load_pippa()
    mix += load_soda(limit=40000)
    mix += load_spc()
    mix += load_samantha()
    mix += load_roleplay()

    random.shuffle(mix)
    n_eval = min(1000, len(mix) // 50)
    eval_set, train_set = mix[:n_eval], mix[n_eval:]

    train_path = OUT_DIR / "train.jsonl"
    eval_path = OUT_DIR / "eval.jsonl"
    with open(train_path, "w") as f:
        for rec in train_set:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    with open(eval_path, "w") as f:
        for rec in eval_set:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    print(f"\nWrote {len(train_set)} train / {len(eval_set)} eval conversations")
    print(f"  {train_path}\n  {eval_path}")


if __name__ == "__main__":
    main()
