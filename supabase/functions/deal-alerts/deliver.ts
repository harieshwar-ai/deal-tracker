import {
  RESEND_BATCH_GAP_MS,
  chooseMailAdapter,
  encodeRfc822,
  mailboxAddress,
  planResendBatches,
  resendIdempotencyHeader,
  resendPayload,
  retryDelayMs,
  type OutboundEmail,
} from '../../../src/domain/alerts.ts'

export interface DeliveryResult {
  idempotencyKey: string
  ok: boolean
  detail: string | null
}

interface MailSocket {
  read(buffer: Uint8Array): Promise<number | null>
  write(buffer: Uint8Array): Promise<number>
  close(): void
}

interface DenoLike {
  env: { get(name: string): string | undefined }
  connect(options: { hostname: string; port: number }): Promise<MailSocket>
  connectTls(options: { hostname: string; port: number }): Promise<MailSocket>
  startTls(socket: MailSocket, options: { hostname: string }): Promise<MailSocket>
}

export async function deliver(messages: OutboundEmail[]): Promise<{ results: DeliveryResult[]; reason: 'unconfigured' | null }> {
  const env = deno().env
  const adapter = chooseMailAdapter({
    resendApiKey: env.get('RESEND_API_KEY'),
    smtpHost: env.get('SMTP_HOST'),
    smtpPort: env.get('SMTP_PORT'),
    smtpUser: env.get('SMTP_USER'),
    smtpPass: env.get('SMTP_PASS'),
  })
  if (adapter === 'none') {
    console.log(JSON.stringify({ event: 'alerts_noop', reason: 'unconfigured', count: messages.length }))
    return {
      reason: 'unconfigured',
      results: messages.map((message) => ({ idempotencyKey: message.idempotencyKey, ok: false, detail: 'unconfigured' })),
    }
  }
  if (adapter === 'resend') {
    return { reason: null, results: await deliverResend(messages, env.get('RESEND_API_KEY') ?? '') }
  }
  return {
    reason: null,
    results: await deliverSmtp(messages, {
      host: env.get('SMTP_HOST') ?? '',
      port: Number(env.get('SMTP_PORT')),
      user: env.get('SMTP_USER') ?? '',
      pass: env.get('SMTP_PASS') ?? '',
    }),
  }
}

async function deliverResend(messages: OutboundEmail[], apiKey: string): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = []
  const batches = planResendBatches(messages)
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index] ?? []
    const header = await resendIdempotencyHeader(batch.map((message) => message.idempotencyKey))
    const outcome = await postBatch(apiKey, header, batch.map(resendPayload))
    for (const message of batch) {
      results.push({ idempotencyKey: message.idempotencyKey, ok: outcome.ok, detail: outcome.detail })
    }
    if (index < batches.length - 1) await sleep(RESEND_BATCH_GAP_MS)
  }
  return results
}

async function postBatch(apiKey: string, idempotencyKey: string, payload: unknown): Promise<{ ok: boolean; detail: string | null }> {
  let attempt = 0
  while (attempt < 3) {
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    })
    if (response.ok) {
      const body = await response.json().catch(() => null) as { data?: unknown } | null
      const count = Array.isArray(payload) ? payload.length : 0
      if (!body || !Array.isArray(body.data) || body.data.length !== count) {
        return { ok: false, detail: 'resend:bad_response' }
      }
      return { ok: true, detail: null }
    }
    if (response.status === 429 || response.status >= 500) {
      const wait = retryDelayMs(response.headers.get('retry-after'), attempt)
      attempt += 1
      if (attempt >= 3) return { ok: false, detail: `resend:${response.status}` }
      await sleep(wait)
      continue
    }
    return { ok: false, detail: `resend:${response.status}` }
  }
  return { ok: false, detail: 'resend:failed' }
}

async function deliverSmtp(
  messages: OutboundEmail[],
  account: { host: string; port: number; user: string; pass: string },
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = []
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    if (!message) continue
    try {
      await sendOneSmtp(account, message)
      results.push({ idempotencyKey: message.idempotencyKey, ok: true, detail: null })
    } catch (error) {
      const code = error instanceof SmtpError ? error.code : 'smtp'
      console.log(JSON.stringify({ event: 'smtp_failed', code }))
      results.push({ idempotencyKey: message.idempotencyKey, ok: false, detail: `smtp:${code}`.slice(0, 200) })
    }
    if (index < messages.length - 1) await sleep(RESEND_BATCH_GAP_MS)
  }
  return results
}

class SmtpError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

async function sendOneSmtp(
  account: { host: string; port: number; user: string; pass: string },
  message: OutboundEmail,
): Promise<void> {
  const from = mailboxAddress(message.from)
  const to = mailboxAddress(message.to)
  if (!from || !to) throw new SmtpError('address')
  const runtime = deno()
  let socket = account.port === 465
    ? await runtime.connectTls({ hostname: account.host, port: account.port })
    : await runtime.connect({ hostname: account.host, port: account.port })
  try {
    await expectCode(socket, [220])
    let greeting = await command(socket, 'EHLO harbour-alerts')
    if (account.port !== 465 && /STARTTLS/i.test(greeting)) {
      await expectCode(socket, [220], 'STARTTLS')
      socket = await runtime.startTls(socket, { hostname: account.host })
      greeting = await command(socket, 'EHLO harbour-alerts')
    }
    if (!greeting.startsWith('2')) throw new SmtpError('ehlo')
    await expectCode(socket, [334], 'AUTH LOGIN')
    await expectCode(socket, [334], btoa(account.user))
    await expectCode(socket, [235], btoa(account.pass))
    await expectCode(socket, [250], `MAIL FROM:<${from}>`)
    await expectCode(socket, [250, 251], `RCPT TO:<${to}>`)
    await expectCode(socket, [354], 'DATA')
    const payload = encodeRfc822(message).replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
    await writeLine(socket, `${payload}\r\n.`)
    await expectCode(socket, [250])
    await command(socket, 'QUIT')
  } finally {
    try {
      socket.close()
    } catch {
      // The server may already have closed the connection.
    }
  }
}

async function expectCode(socket: MailSocket, codes: number[], line?: string): Promise<void> {
  const reply = line ? await command(socket, line) : await readReply(socket)
  const code = Number(reply.slice(0, 3))
  if (!codes.includes(code)) throw new SmtpError(String(code || 'closed'))
}

async function command(socket: MailSocket, line: string): Promise<string> {
  await writeLine(socket, line)
  return readReply(socket)
}

async function writeLine(socket: MailSocket, line: string): Promise<void> {
  await socket.write(new TextEncoder().encode(`${line}\r\n`))
}

async function readReply(socket: MailSocket): Promise<string> {
  const decoder = new TextDecoder()
  let text = ''
  const buffer = new Uint8Array(1024)
  while (!/(^|\n)\d{3} /.test(text)) {
    const count = await socket.read(buffer)
    if (count == null) break
    text += decoder.decode(buffer.subarray(0, count), { stream: true })
    if (text.length > 16_384) break
  }
  return text.trim()
}

function deno(): DenoLike {
  const runtime = (globalThis as { Deno?: DenoLike }).Deno
  if (!runtime) throw new Error('Mail delivery needs the edge runtime.')
  return runtime
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
