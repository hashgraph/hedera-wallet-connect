import { LedgerId } from '@hashgraph/sdk'
import { AccountInfo } from '.'

function getMirrorNodeUrl(ledgerId: LedgerId): string {
  return `https://${ledgerId.toString()}.mirrornode.hedera.com`
}

export async function getAccountInfo(
  ledgerId: LedgerId,
  address: string,
): Promise<AccountInfo | null> {
  const mirrorNodeApiUrl = getMirrorNodeUrl(ledgerId)
  const url = `${mirrorNodeApiUrl}/api/v1/accounts/${address}`

  const result = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
  })
  if (result.status !== 200) {
    return null
  }

  const response = await result.json()
  return response as AccountInfo
}
