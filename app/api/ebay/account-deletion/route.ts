import { env } from 'cloudflare:workers'
import { ebayChallenge, ebayDeletionNotice } from '../../../../lib/ebay-account-deletion'

const secrets = env as typeof env & {
  EBAY_DELETION_VERIFICATION_TOKEN?: string
  EBAY_APP_ID?: string
  EBAY_CERT_ID?: string
}

export function GET(request: Request) {
  return ebayChallenge(request, secrets.EBAY_DELETION_VERIFICATION_TOKEN)
}

export function POST(request: Request) {
  return ebayDeletionNotice(request, { appId: secrets.EBAY_APP_ID, certId: secrets.EBAY_CERT_ID })
}
