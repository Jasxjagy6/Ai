import Link from "next/link";
import { Navbar } from "@/components/navbar";

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl bg-[#16121f] p-4 text-xs leading-relaxed text-[#e2d9f3]">
      {children}
    </pre>
  );
}

function Endpoint({ method, path }: { method: string; path: string }) {
  return (
    <div className="mt-6 flex items-center gap-2 font-mono text-sm">
      <span
        className={`rounded-md px-2 py-0.5 text-xs font-bold ${
          method === "POST" ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
        }`}
      >
        {method}
      </span>
      <code>{path}</code>
    </div>
  );
}

const SECTIONS = [
  { id: "getting-started", label: "Getting started" },
  { id: "authentication", label: "Authentication" },
  { id: "chat", label: "Chat completions" },
  { id: "streaming", label: "Streaming" },
  { id: "models", label: "Models" },
  { id: "rate-limits", label: "Rate limits" },
  { id: "errors", label: "Errors" },
  { id: "sdks", label: "SDK examples" },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto flex max-w-6xl gap-10 px-4 py-12">
        {/* TOC */}
        <aside className="sticky top-24 hidden h-fit w-52 shrink-0 lg:block">
          <p className="mb-3 text-xs font-semibold uppercase text-text-secondary">API Reference</p>
          <nav className="space-y-1.5 text-sm">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block text-text-secondary transition hover:text-text">
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <article className="min-w-0 flex-1 [&_h2]:mt-14 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-8 [&_h3]:font-semibold [&_p]:mt-3 [&_p]:leading-relaxed [&_p]:text-text-secondary [&_table]:mt-4 [&_td]:border-t [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left">
          <h1 className="text-4xl font-extrabold">Aria API</h1>
          <p className="mt-3 max-w-xl text-lg">
            Add Aria&apos;s warm, human-like conversation to your own apps. The API is{" "}
            <strong className="text-text">OpenAI-compatible</strong>, so every OpenAI SDK works out of
            the box — just change the base URL.
          </p>

          <h2 id="getting-started">Getting started</h2>
          <p>
            1. <Link href="/register" className="text-accent-strong hover:underline">Create an account</Link> (the free plan includes 50 API requests/day).
            <br />
            2. Generate a key in the <Link href="/developers" className="text-accent-strong hover:underline">developer dashboard</Link>.
            <br />
            3. Make your first request:
          </p>
          <Code>{`curl https://YOUR_DOMAIN/api/v1/chat/completions \\
  -H "Authorization: Bearer aria_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "hey aria, how are you?"}
    ]
  }'`}</Code>

          <h2 id="authentication">Authentication</h2>
          <p>
            Pass your API key as a Bearer token in the <code>Authorization</code> header. Keys start
            with <code>aria_sk_</code>. Keep them server-side — never ship a key inside a mobile app
            or public website code.
          </p>
          <Code>{`Authorization: Bearer aria_sk_your_key_here`}</Code>

          <h2 id="chat">Chat completions</h2>
          <Endpoint method="POST" path="/api/v1/chat/completions" />
          <p>Generates Aria&apos;s reply for a conversation.</p>
          <h3>Request body</h3>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-text-secondary">
              <tr><th>Field</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>messages</code></td><td>array, required</td><td>Conversation so far. Each item: <code>{`{role, content}`}</code> where role is <code>system</code> | <code>user</code> | <code>assistant</code>. Max 60 messages, 8,000 chars each.</td></tr>
              <tr><td><code>stream</code></td><td>boolean</td><td>Stream tokens via server-sent events. Default <code>false</code>.</td></tr>
              <tr><td><code>temperature</code></td><td>number 0–2</td><td>Creativity. Default 0.9.</td></tr>
              <tr><td><code>max_tokens</code></td><td>number</td><td>Cap on reply length (1–2048).</td></tr>
              <tr><td><code>model</code></td><td>string</td><td>Optional; currently always <code>aria-1</code>.</td></tr>
            </tbody>
          </table>
          <h3>Custom persona</h3>
          <p>
            Pass a <code>system</code> message to reshape Aria&apos;s personality for your product —
            name, tone, backstory. Without one, the default Aria persona applies.
          </p>
          <Code>{`{
  "messages": [
    {"role": "system", "content": "You are Maya, a cheerful yoga-loving companion..."},
    {"role": "user", "content": "good morning!"}
  ]
}`}</Code>
          <h3>Response</h3>
          <Code>{`{
  "id": "chatcmpl-8f3a...",
  "object": "chat.completion",
  "created": 1752666000,
  "model": "aria-1",
  "choices": [{
    "index": 0,
    "message": {"role": "assistant", "content": "morning sunshine ☀️ sleep okay?"},
    "finish_reason": "stop"
  }],
  "usage": {"prompt_tokens": 32, "completion_tokens": 12, "total_tokens": 44}
}`}</Code>

          <h2 id="streaming">Streaming</h2>
          <p>
            Set <code>&quot;stream&quot;: true</code> to receive OpenAI-format SSE chunks, ending with{" "}
            <code>data: [DONE]</code>.
          </p>
          <Code>{`data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"delta":{"content":"morning"},"finish_reason":null,"index":0}],...}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"delta":{"content":" sunshine"},"finish_reason":null,"index":0}],...}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"delta":{},"finish_reason":"stop","index":0}],...}

data: [DONE]`}</Code>

          <h2 id="models">Models</h2>
          <Endpoint method="GET" path="/api/v1/models" />
          <p>Lists available models. Currently one: <code>aria-1</code>, our fine-tuned companion model.</p>

          <h2 id="rate-limits">Rate limits</h2>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-text-secondary">
              <tr><th>Plan</th><th>API requests / day</th><th>API keys</th></tr>
            </thead>
            <tbody>
              <tr><td>Free</td><td>50</td><td>1</td></tr>
              <tr><td>Plus</td><td>2,000</td><td>3</td></tr>
              <tr><td>Pro</td><td>10,000</td><td>10</td></tr>
            </tbody>
          </table>
          <p>
            Limits reset at midnight UTC. Every response includes <code>X-RateLimit-Limit</code> and{" "}
            <code>X-RateLimit-Used</code> headers. Need more?{" "}
            <Link href="/pricing" className="text-accent-strong hover:underline">Upgrade your plan</Link>.
          </p>

          <h2 id="errors">Errors</h2>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-text-secondary">
              <tr><th>Status</th><th>Type</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td>401</td><td><code>invalid_api_key</code></td><td>Missing, malformed, or revoked key</td></tr>
              <tr><td>400</td><td><code>invalid_request</code></td><td>Body failed validation — see message</td></tr>
              <tr><td>429</td><td><code>rate_limit_exceeded</code></td><td>Daily quota exhausted</td></tr>
              <tr><td>502</td><td><code>upstream_error</code></td><td>AI backend temporarily unavailable</td></tr>
            </tbody>
          </table>

          <h2 id="sdks">SDK examples</h2>
          <h3>Python (openai SDK)</h3>
          <Code>{`from openai import OpenAI

client = OpenAI(
    base_url="https://YOUR_DOMAIN/api/v1",
    api_key="aria_sk_...",
)

reply = client.chat.completions.create(
    model="aria-1",
    messages=[{"role": "user", "content": "hey aria!"}],
)
print(reply.choices[0].message.content)`}</Code>
          <h3>Node.js (openai SDK)</h3>
          <Code>{`import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://YOUR_DOMAIN/api/v1",
  apiKey: "aria_sk_...",
});

const reply = await client.chat.completions.create({
  model: "aria-1",
  messages: [{ role: "user", content: "hey aria!" }],
});
console.log(reply.choices[0].message.content);`}</Code>
          <h3>Plain fetch with streaming</h3>
          <Code>{`const res = await fetch("https://YOUR_DOMAIN/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer aria_sk_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    stream: true,
    messages: [{ role: "user", content: "hey!" }],
  }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  for (const line of decoder.decode(value).split("\\n")) {
    if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
    const chunk = JSON.parse(line.slice(6));
    process.stdout.write(chunk.choices[0].delta.content ?? "");
  }
}`}</Code>

          <div className="mt-16 rounded-2xl border border-border bg-bg-soft p-6 text-sm text-text-secondary">
            <strong className="text-text">Responsible use:</strong> apps built on the Aria API must
            disclose to their users that responses are AI-generated. Don&apos;t use the API to
            impersonate real people or deceive users into believing they&apos;re talking to a human.
          </div>
        </article>
      </div>
    </div>
  );
}
