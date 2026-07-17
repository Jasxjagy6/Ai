# Kaggle Notebook: QLoRA fine-tune Hermes-3-Llama-3.1-8B for companion chat
# =========================================================================
# Setup on Kaggle:
#   1. New Notebook -> Settings -> Accelerator: GPU T4 x2
#      (unsloth uses 1 GPU; T4 x2 works fine, P100 also OK)
#   2. Settings -> Internet: ON (needed to download the base model)
#   3. Add your dataset: Upload train.jsonl + eval.jsonl as a Kaggle Dataset
#      named "companion-chat-data", then "+ Add Input" it to the notebook.
#   4. Paste each CELL below into its own notebook cell. Run All.
#   5. Runtime: roughly 4-6 hours for 1 epoch on ~60-80K conversations.
#      Checkpoints save to /kaggle/working every 200 steps — if the session
#      dies, re-run with resume_from_checkpoint=True in the trainer cell.
#   6. When done, download /kaggle/working/aria-8b-q4_k_m.gguf from the
#      notebook Output tab and upload it to the VPS.

# %% [CELL 1] Install dependencies (~3 min)
# unsloth: fastest QLoRA on T4, handles 4-bit load + LoRA + GGUF export
!pip install -q unsloth
!pip install -q --no-deps trl peft accelerate bitsandbytes

# %% [CELL 2] Load base model in 4-bit
from unsloth import FastLanguageModel
import torch

MAX_SEQ_LEN = 4096  # T4 16GB: 4096 fits with 4-bit + gradient checkpointing

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="NousResearch/Hermes-3-Llama-3.1-8B",
    max_seq_length=MAX_SEQ_LEN,
    dtype=None,          # auto: float16 on T4
    load_in_4bit=True,
)

model = FastLanguageModel.get_peft_model(
    model,
    r=16,                # LoRA rank — 16 is the sweet spot for style transfer
    lora_alpha=32,
    lora_dropout=0,      # 0 = enables unsloth fast path
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    use_gradient_checkpointing="unsloth",
    random_state=42,
)

# %% [CELL 3] Load and format the dataset
import json
from datasets import Dataset

DATA_DIR = "/kaggle/input/companion-chat-data"

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

# %% [CELL 4] Train
from trl import SFTTrainer, SFTConfig

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_ds,
    eval_dataset=eval_ds.select(range(min(200, len(eval_ds)))),
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LEN,
    args=SFTConfig(
        output_dir="/kaggle/working/checkpoints",
        per_device_train_batch_size=2,
        gradient_accumulation_steps=8,   # effective batch 16
        num_train_epochs=1,
        learning_rate=2e-4,
        lr_scheduler_type="cosine",
        warmup_ratio=0.03,
        logging_steps=20,
        save_steps=200,
        save_total_limit=2,              # keep disk under Kaggle's 20GB cap
        eval_strategy="steps",
        eval_steps=400,
        bf16=False, fp16=True,           # T4 has no bf16
        optim="adamw_8bit",
        seed=42,
        report_to="none",
    ),
)

# To resume after a dead session, use:
# trainer.train(resume_from_checkpoint=True)
trainer.train()

# %% [CELL 5] Export merged GGUF for Ollama (~20-30 min)
# Merges LoRA into the base model and quantizes to q4_k_m in one step.
model.save_pretrained_gguf(
    "/kaggle/working/aria-8b",
    tokenizer,
    quantization_method="q4_k_m",
)
# Output: /kaggle/working/aria-8b/unsloth.Q4_K_M.gguf (~4.9 GB)
# Download it from the notebook's Output tab.

# %% [CELL 6] Quick smoke test of the fine-tuned model
FastLanguageModel.for_inference(model)
msgs = [
    {"role": "system", "content": "You are Aria, a warm, playful, flirty AI companion. You text casually like a real person."},
    {"role": "user", "content": "heyy whats up"},
]
inputs = tokenizer.apply_chat_template(msgs, tokenize=True,
                                       add_generation_prompt=True,
                                       return_tensors="pt").to("cuda")
out = model.generate(input_ids=inputs, max_new_tokens=120,
                     temperature=0.9, top_p=0.95, do_sample=True)
print(tokenizer.decode(out[0][inputs.shape[1]:], skip_special_tokens=True))
