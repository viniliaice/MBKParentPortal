import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Push fan-out for new messages and new announcements.
 *
 * Invoked by the `on_new_message` / `on_new_announcement` triggers through
 * pg_net, which currently send no credentials. Anyone who learns this URL could
 * therefore inject notifications unless the endpoint is protected, so:
 *
 *  - set the PUSH_WEBHOOK_SECRET environment variable for this function, and
 *  - send the same value from the triggers as the `x-webhook-secret` header
 *    (see docs/notifications.md for the statement and the vault-backed variant
 *    that keeps the secret out of the migration text).
 *
 * When the variable is not set the function logs a warning and keeps working so
 * that an existing deployment is not broken by this change — it must not be
 * left unset once the dashboard/function is public.
 *
 * The service-role key is only ever read from the function's environment; it is
 * never logged, returned, or shipped to the client.
 */

const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? ''

interface MessageRecord {
  id: string
  senderId: string
  recipientId: string
  subject: string
}

interface AnnouncementRecord {
  id: string
  className: string
  message: string
  createdBy: string | null
}

interface ProfileRow {
  name: string | null
  expo_push_token: string | null
}

interface StudentRow {
  parentId: string | null
}

/** Minimal shape of the Expo push API response we rely on. */
interface ExpoPushResponse {
  data?: { status: string; message?: string }[]
  errors?: unknown[]
}

/** Narrows the raw row from the trigger into the two shapes we support. */
function parseRecord(
  record: Record<string, unknown>,
): { kind: 'message'; message: MessageRecord } | { kind: 'announcement'; announcement: AnnouncementRecord } | null {
  if (typeof record.recipientId === 'string' && typeof record.senderId === 'string') {
    return {
      kind: 'message',
      message: {
        id: String(record.id ?? ''),
        senderId: record.senderId,
        recipientId: record.recipientId,
        subject: typeof record.subject === 'string' ? record.subject : '',
      },
    }
  }

  if (typeof record.className === 'string') {
    return {
      kind: 'announcement',
      announcement: {
        id: String(record.id ?? ''),
        className: record.className,
        message: typeof record.message === 'string' ? record.message : '',
        createdBy: typeof record.createdBy === 'string' ? record.createdBy : null,
      },
    }
  }

  return null
}

serve(async (req: Request) => {
  try {
    if (WEBHOOK_SECRET) {
      const provided = req.headers.get('x-webhook-secret') ?? ''
      if (provided !== WEBHOOK_SECRET) {
        return new Response('Unauthorized', { status: 401 })
      }
    } else {
      console.warn('PUSH_WEBHOOK_SECRET is not set: this endpoint accepts unsigned calls')
    }

    const payload = (await req.json()) as { record?: Record<string, unknown> }
    const record = payload.record
    if (!record) {
      return new Response('No record', { status: 400 })
    }

    if (!SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured')
      return new Response('Server not configured', { status: 500 })
    }

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', SERVICE_ROLE_KEY)

    const parsed = parseRecord(record)
    if (!parsed) {
      return new Response('Unknown record type', { status: 400 })
    }

    return parsed.kind === 'message'
      ? await handleMessage(parsed.message, supabaseAdmin)
      : await handleAnnouncement(parsed.announcement, supabaseAdmin)
  } catch (error: unknown) {
    // Log the message only: request bodies can contain personal data.
    console.error('Edge function error:', error instanceof Error ? error.message : 'unknown error')
    return new Response('Push fan-out failed', { status: 500 })
  }
})

async function handleMessage(
  record: MessageRecord,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<Response> {
  const { id: messageId, senderId, recipientId, subject } = record

  const { data: sender } = await supabaseAdmin
    .from('profiles')
    .select('name')
    .eq('id', senderId)
    .single<{ name: string | null }>()
  const { data: recipient } = await supabaseAdmin
    .from('profiles')
    .select('name, expo_push_token')
    .eq('id', recipientId)
    .single<ProfileRow>()

  if (!recipient?.expo_push_token) {
    return new Response('No push token', { status: 200 })
  }

  const senderName = sender?.name ?? 'School'
  const result = await sendPushMessages([
    {
      to: recipient.expo_push_token,
      title: `New message from ${senderName}`,
      body: subject,
      data: { type: 'new_message', messageId, senderId },
    },
  ])

  console.log(`Message push delivered to 1 device (${result})`)
  return new Response('OK', { status: 200 })
}

async function handleAnnouncement(
  record: AnnouncementRecord,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<Response> {
  const { id: annId, className, message: body, createdBy } = record

  const { data: students } = await supabaseAdmin
    .from('students')
    .select('parentId')
    .eq('className', className)
    .returns<StudentRow[]>()

  if (!students || students.length === 0) {
    return new Response('No students in class', { status: 200 })
  }

  const parentIds = [...new Set(students.map(s => s.parentId).filter((id): id is string => Boolean(id)))]
  if (parentIds.length === 0) {
    return new Response('No parents with profiles', { status: 200 })
  }

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('name, expo_push_token')
    .in('id', parentIds)
    .returns<ProfileRow[]>()

  const tokens = (profiles ?? []).map(p => p.expo_push_token).filter((t): t is string => Boolean(t))
  if (tokens.length === 0) {
    return new Response('No push tokens', { status: 200 })
  }

  const creatorName = createdBy ? await profileName(supabaseAdmin, createdBy) : 'School'
  const title = `${className} announcement`

  // The Expo Push API accepts up to 100 tokens per request.
  let delivered = 0
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100)
    const result = await sendPushMessages(
      batch.map(token => ({
        to: token,
        title,
        body,
        data: { type: 'new_announcement', annId, className },
      })),
    )
    delivered += batch.length
    console.log(`Announcement push delivered to ${batch.length} devices (${result})`)
  }

  return new Response('OK', { status: 200 })
}

async function profileName(
  supabaseAdmin: ReturnType<typeof createClient>,
  profileId: string,
): Promise<string> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('name')
    .eq('id', profileId)
    .single<{ name: string | null }>()
  return data?.name ?? 'School'
}

/**
 * Posts to the Expo Push API and returns a short status summary. Push tokens
 * are personal data and are deliberately never written to the logs.
 */
async function sendPushMessages(
  messages: { to: string; title: string; body: string; data: Record<string, unknown> }[],
): Promise<string> {
  const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  })

  if (!expoRes.ok) {
    return `http ${expoRes.status}`
  }

  const result = (await expoRes.json()) as ExpoPushResponse
  const tickets = result.data ?? []
  const errors = tickets.filter(t => t.status === 'error').length
  return `ok=${tickets.length - errors} error=${errors}`
}
