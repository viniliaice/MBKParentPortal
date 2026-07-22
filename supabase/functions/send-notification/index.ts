import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const payload = await req.json()
    const { record } = payload
    if (!record) {
      return new Response('No record', { status: 400 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Detect type: messages have recipientId, announcements have className
    if (record.recipientId) {
      return await handleMessage(record, supabaseAdmin)
    }
    if (record.className) {
      return await handleAnnouncement(record, supabaseAdmin)
    }

    return new Response('Unknown record type', { status: 400 })
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(error.message, { status: 500 })
  }
})

async function handleMessage(record: any, supabaseAdmin: any) {
  const { id: messageId, senderId, recipientId, subject } = record

  const { data: sender } = await supabaseAdmin
    .from('profiles')
    .select('name')
    .eq('id', senderId)
    .single()

  const { data: recipient } = await supabaseAdmin
    .from('profiles')
    .select('name, expo_push_token')
    .eq('id', recipientId)
    .single()

  if (!recipient?.expo_push_token) {
    return new Response('No push token', { status: 200 })
  }

  const senderName = sender?.name ?? 'Unknown'

  const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: recipient.expo_push_token,
      title: `New Message from ${senderName}`,
      body: subject,
      data: { type: 'new_message', messageId, senderId },
    }),
  })

  const expoResult = await expoRes.json()
  console.log('Message push response:', JSON.stringify(expoResult))
  return new Response('OK', { status: 200 })
}

async function handleAnnouncement(record: any, supabaseAdmin: any) {
  const { id: annId, className, message: body, createdBy } = record

  // Find parents of students in this class
  const { data: students } = await supabaseAdmin
    .from('students')
    .select('parentId')
    .eq('className', className)

  if (!students || students.length === 0) {
    return new Response('No students in class', { status: 200 })
  }

  const parentIds = [...new Set(students.map((s: any) => s.parentId))]

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('name, expo_push_token')
    .in('id', parentIds)

  if (!profiles || profiles.length === 0) {
    return new Response('No parents with profiles', { status: 200 })
  }

  const tokens = profiles
    .map((p: any) => p.expo_push_token)
    .filter(Boolean)

  if (tokens.length === 0) {
    return new Response('No push tokens', { status: 200 })
  }

  // Get sender name
  const { data: creator } = await supabaseAdmin
    .from('profiles')
    .select('name')
    .eq('id', createdBy)
    .single()

  const creatorName = creator?.name ?? 'School'
  const title = `${className} Announcement`

  // Expo Push API accepts up to 100 tokens per request
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100)
    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        batch.map((token: string) => ({
          to: token,
          title,
          body,
          data: { type: 'new_announcement', annId, className, createdBy },
        }))
      ),
    })
    const expoResult = await expoRes.json()
    console.log('Announcement push batch response:', JSON.stringify(expoResult))
  }

  return new Response('OK', { status: 200 })
}
