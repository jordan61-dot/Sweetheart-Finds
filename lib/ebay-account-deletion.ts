import { createHash, verify } from 'node:crypto'
import { boundedJson } from './bounded-json.ts'

export const ebayDeletionEndpoint = 'https://sweetheart-finds.jordanmullens12.chatgpt.site/api/ebay/account-deletion'
const noStore = { 'Cache-Control': 'no-store' }
const apiOrigin = 'https://api.ebay.com'
type EbayCredentials = { appId?: string; certId?: string }
const signingKeys = new Map<string, { pem: string; expiresAt: number }>()
let accessToken: { value: string; expiresAt: number } | undefined

export function ebayChallenge(request: Request, token?: string) {
  if (!token || !/^[\w-]{32,80}$/.test(token)) return new Response(null, { status: 503, headers: noStore })
  const code = new URL(request.url).searchParams.get('challenge_code')
  if (!code || code.length > 1024) return new Response(null, { status: 400, headers: noStore })

  const challengeResponse = createHash('sha256').update(code).update(token).update(ebayDeletionEndpoint).digest('hex')
  return Response.json({ challengeResponse }, { headers: noStore })
}

async function publicKey(keyId: string, credentials: EbayCredentials) {
  const cached = signingKeys.get(keyId)
  if (cached && cached.expiresAt > Date.now()) return cached.pem
  if (!credentials.appId || !credentials.certId) throw new Error('eBay notification credentials unavailable')

  if (!accessToken || accessToken.expiresAt <= Date.now()) {
    const response = await fetch(apiOrigin + '/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(credentials.appId + ':' + credentials.certId),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }),
      redirect: 'error',
      signal: AbortSignal.timeout(4000),
    })
    if (!response.ok) throw new Error('eBay OAuth unavailable')
    const token = await response.json() as { access_token?: string; expires_in?: number }
    if (!token.access_token || !Number.isFinite(token.expires_in)) throw new Error('Invalid eBay OAuth response')
    accessToken = { value: token.access_token, expiresAt: Date.now() + (token.expires_in! - 60) * 1000 }
  }

  const response = await fetch(apiOrigin + '/commerce/notification/v1/public_key/' + keyId, {
    headers: { Authorization: 'Bearer ' + accessToken.value },
    redirect: 'error',
    signal: AbortSignal.timeout(4000),
  })
  if (response.status === 404) return null
  if (response.status === 401) accessToken = undefined
  if (!response.ok) throw new Error('eBay signing key unavailable')
  const { key } = await response.json() as { key?: string }
  const encoded = key?.match(/-----BEGIN PUBLIC KEY-----\s*([A-Za-z0-9+/=\s]+?)\s*-----END PUBLIC KEY-----/)?.[1]
  if (!encoded || encoded.length > 2048) throw new Error('Invalid eBay public key')
  const pem = '-----BEGIN PUBLIC KEY-----\n' + encoded.replace(/\s+/g, '') + '\n-----END PUBLIC KEY-----'
  if (signingKeys.size >= 32) signingKeys.clear()
  signingKeys.set(keyId, { pem, expiresAt: Date.now() + 3_600_000 })
  return pem
}

export async function ebayDeletionNotice(request: Request, credentials: EbayCredentials) {
  const reply = (status: number) => new Response(null, { status, headers: noStore })
  const header = request.headers.get('x-ebay-signature')
  if (!header || header.length > 2048) return reply(412)

  let signature: { kid?: string; signature?: string; alg?: string; digest?: string }
  let message: { metadata?: { topic?: string }; notification?: { notificationId?: string; data?: object } }
  try {
    signature = JSON.parse(atob(header))
    if (!signature?.kid || !/^[\w-]{1,128}$/.test(signature.kid) ||
        !signature.signature || !/^[a-zA-Z0-9+/]{1,256}={0,2}$/.test(signature.signature) ||
        signature.alg?.toUpperCase() !== 'ECDSA' || signature.digest !== 'SHA1') return reply(412)
    message = await boundedJson(request, 16_384)
    if (message?.metadata?.topic !== 'MARKETPLACE_ACCOUNT_DELETION' ||
        !message.notification?.notificationId || !message.notification?.data) return reply(400)
  } catch (error) {
    return reply((error as { status?: number }).status === 413 ? 413 : 400)
  }

  try {
    const pem = await publicKey(signature.kid, credentials)
    // Match the official eBay Node SDK's JSON serialization for signature verification.
    if (!pem || !verify('sha1', Buffer.from(JSON.stringify(message)), pem, Buffer.from(signature.signature, 'base64'))) {
      return reply(412)
    }
    // Sweetheart Finds has no eBay user data to erase. Never save or log this payload.
    // Any future feature storing eBay user data must add deletion before it goes live.
    return reply(204)
  } catch {
    return reply(503)
  }
}
