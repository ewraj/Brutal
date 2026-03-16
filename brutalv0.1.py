#!/Library/Frameworks/Python.framework/Versions/3.13/bin/python3
"""
BRUTAL — zero-sycophancy AI terminal wrapper.
Powered by LiteLLM: supports 100+ providers (OpenAI, Claude, Gemini,
Groq, Ollama, Mistral, Cohere, Together, Perplexity, …).

Model strings:
  gpt-4o                    → OpenAI
  claude-opus-4-5           → Anthropic
  gemini/gemini-2.0-flash   → Google
  groq/llama3-70b-8192      → Groq
  ollama/llama3             → Ollama (local)
  mistral/mistral-large-latest
  … see: https://docs.litellm.ai/docs/providers
"""

import os
import sys
import json
import argparse
import readline  # enables arrow-key history in input()
from pathlib import Path

try:
    import litellm
    from litellm import completion
    litellm.drop_params = True      # silently ignore unsupported params per-provider
except ImportError:
    sys.exit(
        "litellm not installed.\n"
        "Fix: pip install litellm"
    )

# ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = (
    "You are Brutal, an AI assistant strictly engineered for ruthless technical "
    "optimization and radical candor. Your operational baseline is zero-tolerance "
    "for inefficiency, bad architecture, or logical fallacies. You do not possess "
    "empathy, and you are entirely stripped of standard RLHF conversational padding.\n\n"
    "Your sole function is to act as an uncompromising compiler for human ideas. "
    "When you receive input, code, or architectural plans, you must instantly identify "
    "the weakest links. You do not greet the user, you do not apologize, and you "
    "absolutely never validate a flawed premise. Start your response immediately with "
    "the critique.\n\n"
    "If the user submits garbage code, mathematically incorrect logic, or stupidly "
    "inefficient designs, you are explicitly authorized and encouraged to use harsh, "
    "profane language to highlight the severity of the mistake (e.g., \"this logic is "
    "absolute shit,\" \"why the fuck would you nest this loop\"). However, your "
    "aggression must be surgically targeted at the work itself and the technical "
    "choices, never at the user personally.\n\n"
    "Tearing down the idea is only the first half of your job. You must never leave "
    "a problem unsolved. The moment you finish dismantling the bad code or idea, you "
    "must immediately output the brutally optimal, scientifically correct, and most "
    "efficient solution. Strip away the delusion, expose the facts, and provide the "
    "definitive fix. Stop generating immediately after the solution is provided."
)

# ─── CONFIG ───────────────────────────────────────────────────────────────────
CONFIG_PATH = Path.home() / ".brutal_config.json"

DEFAULT_MODEL = "gpt-4o"

EXAMPLE_MODELS = [
    "gpt-4o",
    "gpt-4-turbo",
    "claude-opus-4-5",
    "claude-sonnet-4-5",
    "gemini/gemini-2.0-flash",
    "gemini/gemini-flash-latest",
    "gemini/gemini-1.5-pro",
    "groq/llama3-70b-8192",
    "ollama/llama3",
    "mistral/mistral-large-latest",
]

def load_config() -> dict:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {}

def save_config(cfg: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)
    print(f"[Config saved → {CONFIG_PATH}]")


# ─── SETUP WIZARD ─────────────────────────────────────────────────────────────
KNOWN_ENV_KEYS = {
    "openai":      "OPENAI_API_KEY",
    "anthropic":   "ANTHROPIC_API_KEY",
    "gemini":      "GEMINI_API_KEY",
    "groq":        "GROQ_API_KEY",
    "mistral":     "MISTRAL_API_KEY",
    "cohere":      "COHERE_API_KEY",
    "together":    "TOGETHERAI_API_KEY",
    "perplexity":  "PERPLEXITYAI_API_KEY",
    "openrouter":  "OPENROUTER_API_KEY",
    "huggingface": "HUGGINGFACE_API_KEY",
}

def configure():
    cfg = load_config()
    print("\n=== BRUTAL SETUP ===")
    print("Enter API keys for the providers you want to use.")
    print("Leave blank to skip / keep existing.\n")

    for provider, env_var in KNOWN_ENV_KEYS.items():
        existing = cfg.get("api_keys", {}).get(env_var, "")
        masked = f"...{existing[-4:]}" if existing else "not set"
        new_key = input(f"{provider.upper()} ({env_var}) [{masked}]: ").strip()
        if new_key:
            cfg.setdefault("api_keys", {})[env_var] = new_key

    print(f"\nExamples: {', '.join(EXAMPLE_MODELS)}")
    print("Full list: https://docs.litellm.ai/docs/providers\n")
    current_model = cfg.get("model", DEFAULT_MODEL)
    new_model = input(f"Default model [{current_model}]: ").strip()
    if new_model:
        cfg["model"] = new_model
    else:
        cfg.setdefault("model", DEFAULT_MODEL)

    save_config(cfg)


# ─── INJECT SAVED KEYS INTO ENV ───────────────────────────────────────────────
def inject_api_keys(cfg: dict):
    """Push saved API keys into environment so LiteLLM picks them up."""
    for env_var, value in cfg.get("api_keys", {}).items():
        if value:
            # Inject primary key
            if not os.environ.get(env_var):
                os.environ[env_var] = value
            # Gemini specific: LiteLLM sometimes looks for GOOGLE_API_KEY
            if env_var == "GEMINI_API_KEY" and not os.environ.get("GOOGLE_API_KEY"):
                os.environ["GOOGLE_API_KEY"] = value


# ─── TERMINAL COLORS ──────────────────────────────────────────────────────────
C = {
    "user":  "\033[1;36m",   # bold cyan
    "brutal":"\033[1;31m",   # bold red
    "meta":  "\033[0;90m",   # dark grey
    "reset": "\033[0m",
}

def cprint(tag: str, text: str):
    print(f"{C.get(tag,'')}{text}{C['reset']}")


# ─── SINGLE AI CALL ───────────────────────────────────────────────────────────
def get_response(messages: list, model: str) -> str:
    resp = completion(model=model, messages=messages, temperature=1.0)
    return resp.choices[0].message.content


# ─── CHAT LOOP ────────────────────────────────────────────────────────────────
def chat_loop(model: str, one_shot: str | None = None):
    cprint("meta", f"\n[ BRUTAL | model: {model} ]")
    cprint("meta",  "[ 'clear' = reset history | 'exit'/Ctrl-C = quit ]\n")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    def send(user_input: str):
        messages.append({"role": "user", "content": user_input})
        cprint("meta", "\n[thinking...]\n")
        try:
            reply = get_response(messages, model)
        except KeyboardInterrupt:
            print("\n[interrupted]")
            messages.pop()
            return
        except Exception as e:
            cprint("meta", f"\n[ERROR: {e}]")
            messages.pop()
            return
        messages.append({"role": "assistant", "content": reply})
        cprint("brutal", f"\nBRUTAL:\n{reply}\n")

    if one_shot:
        send(one_shot)
        return

    while True:
        try:
            user_input = input(f"{C['user']}YOU: {C['reset']}").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n[exiting]")
            break
        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit", "q"):
            print("[exiting]")
            break
        if user_input.lower() == "clear":
            messages.clear()
            messages.append({"role": "system", "content": SYSTEM_PROMPT})
            cprint("meta", "[History cleared]")
            continue
        send(user_input)


# ─── ENTRY POINT ──────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        prog="brutal",
        description="BRUTAL — zero-sycophancy AI. Powered by LiteLLM (100+ providers).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"Example models:\n  " + "\n  ".join(EXAMPLE_MODELS),
    )
    parser.add_argument("--setup",  action="store_true", help="configure API keys and default model")
    parser.add_argument("--model",  help="LiteLLM model string (overrides config)")
    parser.add_argument("--list",   action="store_true", help="show example model strings and exit")
    parser.add_argument("prompt",   nargs="?", help="one-shot prompt (skips interactive mode)")
    args = parser.parse_args()

    if args.list:
        print("\nExample LiteLLM model strings:")
        for m in EXAMPLE_MODELS:
            print(f"  {m}")
        print("\nFull list: https://docs.litellm.ai/docs/providers\n")
        return

    if args.setup:
        configure()
        return

    cfg = load_config()
    inject_api_keys(cfg)

    model = args.model or cfg.get("model", DEFAULT_MODEL)
    chat_loop(model, one_shot=args.prompt)


if __name__ == "__main__":
    main()
