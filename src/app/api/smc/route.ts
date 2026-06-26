import { NextResponse } from 'next/server'
import { SMC_SYSTEM_PROMPT, type SMCRequestBody, type SMCResponse } from '@/lib/smcPrompt'

// Provider-agnostic LLM gateway. Works against any OpenAI-compatible API
// (Bitget AI, OpenAI, Mistral, Together, Groq, etc.) by configuring three
// env vars:
//
//   LLM_BASE_URL   e.g. https://api.openai.com/v1
//                       https://open-api.bitget.com/api/v1/ai     (if applicable)
//                       https://api.mistral.ai/v1
//   LLM_API_KEY    the bearer token
//   LLM_MODEL      e.g. gpt-4o-mini · mistral-small-latest · bitget-smc
//
// All three are read at request time so swapping providers is a .env edit
// plus a server restart — no code change.

export const runtime = 'nodejs'

// Generous timeout: Qwen3.6 is a thinking model — measured 16–25s per
// SMC call (most of it reasoning tokens). 45s leaves headroom for spikes
// without letting genuinely-dead requests linger.
const REQUEST_TIMEOUT_MS = 45_000

async function callLLM(body: SMCRequestBody): Promise<SMCResponse> {
  const baseUrl = process.env.LLM_BASE_URL
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL

  if (!baseUrl || !apiKey || !model) {
    throw new Error('LLM env not configured (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL)')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SMC_SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({ price: body.price, recent: body.recent }),
          },
        ],
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`)
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new Error('LLM returned empty content')

    // Some providers ignore response_format. Strip code fences defensively
    // before attempting the parse so we don't crash on ```json wrapping.
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim()

    const parsed = JSON.parse(cleaned) as SMCResponse
    return parsed
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(req: Request) {
  let body: SMCRequestBody
  try {
    body = (await req.json()) as SMCRequestBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (typeof body.price !== 'number' || !Array.isArray(body.recent)) {
    return NextResponse.json(
      { error: 'expected { price: number, recent: number[] }' },
      { status: 400 },
    )
  }

  try {
    const analysis = await callLLM(body)
    return NextResponse.json(analysis)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown LLM error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
