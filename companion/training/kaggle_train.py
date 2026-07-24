# Kaggle Notebook: Fast QLoRA fine-tune Hermes-3-Llama-3.1-8B for companion chat
# =============================================================================
# Setup on Kaggle:
#   1. New Notebook -> Accelerator: GPU T4 x2, Internet: ON
#   2. Add Input -> your "companion-chat-data" dataset (train.jsonl + eval.jsonl)
#   3. Paste each CELL below as its own notebook cell. Run All.
#   4. Expected runtime: ~4-6 hours (all 67K conversations, 1 epoch, pack=2048)
#   5. Download /kaggle/working/aria-8b-q4_k_m.gguf from Output tab

# %% [CELL 1] Install dependencies
!pip install -q unsloth
!pip install -q --no-deps trl peft accelerate bitsandbytes

# %% [CELL 2] Load model with packing-optimized settings
from unsloth import FastLanguageModel
import torch

# 2048 is enough for most convos; packing multiplies throughput since
# SFTTrainer concatenates all texts and splits into 2048-token chunks.
MAX_SEQ_LEN = 2048

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="NousResearch/Hermes-3-Llama-3.1-8B",
    max_seq_length=MAX_SEQ_LEN,
    dtype=None,
    load_in_4bit=True,
)

model = FastLanguageModel.get_peft_model(
    model,
    r=8,                      # r=8 vs 16: ~40% less LoRA compute, minimal quality diff
    lora_alpha=16,
    lora_dropout=0,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    use_gradient_checkpointing="unsloth",
    random_state=42,
)

# %% [CELL 3] Load and pack dataset
import json
from datasets import Dataset

DATA_DIR = "/kaggle/input/datasets/jagygamers/companion-chat-data"
ROLE_MAP = {"system": "system", "human": "user", "gpt": "assistant"}

def load_jsonl(path):
    rows = []
    with open(path) as f:
        for line in f:
            conv = json.loads(line)["conversations"]
            msgs = [{"role": ROLE_MAP[m["from"]], "content": m["value"]}
                    for m in conv]
            rows.append({"messages": msgs})
    return rows

train_rows = load_jsonl(f"{DATA_DIR}/train.jsonl")
eval_rows = load_jsonl(f"{DATA_DIR}/eval.jsonl")
print(f"train: {len(train_rows)}  eval: {len(eval_rows)}")

def formatting(examples):
    texts = [
        tokenizer.apply_chat_template(msgs, tokenize=False,
                                      add_generation_prompt=False)
        for msgs in examples["messages"]
    ]
    return {"text": texts}

train_ds = Dataset.from_list(train_rows).map(formatting, batched=True,
                                             remove_columns=["messages"])
eval_ds = Dataset.from_list(eval_rows).map(formatting, batched=True,
                                           remove_columns=["messages"])

# %% [CELL 4] Train with packing (fast!)
from trl import SFTTrainer, SFTConfig

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_ds,
    eval_dataset=eval_ds,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LEN,
    packing=True,                     # <-- the BIG speedup: concatenates + chunks
    args=SFTConfig(
        output_dir="/kaggle/working/checkpoints",
        per_device_train_batch_size=4,    # more since seq=2048 not 4096
        gradient_accumulation_steps=4,    # effective batch 16
        num_train_epochs=1,
        learning_rate=3e-4,               # slightly higher for fewer steps
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        logging_steps=20,
        save_steps=500,
        save_total_limit=2,
        eval_strategy="steps",
        eval_steps=500,
        bf16=False, fp16=True,
        optim="adamw_8bit",
        seed=42,
        report_to="none",
        dataloader_num_workers=2,
    ),
)

trainer.train()

# %% [CELL 5] Export merged GGUF for Ollama (~20 min)
model.save_pretrained_gguf(
    "/kaggle/working/aria-8b",
    tokenizer,
    quantization_method="q4_k_m",
)
# Output: /kaggle/working/aria-8b/unsloth.Q4_K_M.gguf

# %% [CELL 6] Quick smoke test
FastLanguageModel.for_inference(model)
msgs = [
    {"role": "system", "content": "You are Aria, a warm, playful, flirty AI companion."},
    {"role": "user", "content": "heyy whats up"},
]
inputs = tokenizer.apply_chat_template(msgs, tokenize=True,
                                       add_generation_prompt=True,
                                       return_tensors="pt").to("cuda")
out = model.generate(input_ids=inputs, max_new_tokens=120,
                     temperature=0.9, top_p=0.95, do_sample=True)
print(tokenizer.decode(out[0][inputs.shape[1]:], skip_special_tokens=True))
