import { AccountId, LedgerId, PublicKey } from '@hashgraph/sdk'

function getMirrorNodeUrl(ledgerId: LedgerId): string {
  return `https://${ledgerId.toString()}.mirrornode.hedera.com`
}

export async function getAccountPublicKey(
  ledgerId: LedgerId,
  accountId: AccountId,
): Promise<PublicKey | null> {
  const mirrorNodeApiUrl = getMirrorNodeUrl(ledgerId)
  const url = `${mirrorNodeApiUrl}/api/v1/accounts/${accountId.toString()}`

  const result = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
  })
  if (result.status === 404) {
    return null
  }
  if (result.status !== 200) {
    throw new Error('Failed request to mirror node')
  }

  const response = await result.json()
  const keyInfo = response.key as { _type: string; key: string } | null

  return keyInfo?.key ? PublicKey.fromString(keyInfo.key) : null
}
