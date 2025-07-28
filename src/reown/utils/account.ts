import {
  AccountBalance,
  AccountBalanceQuery,
  AccountId,
  Client,
  LedgerId,
} from '@hashgraph/sdk'

export async function getAccountBalance(
  ledgerId: LedgerId,
  address: string,
): Promise<AccountBalance | null> {
  const client = ledgerId === LedgerId.TESTNET ? Client.forTestnet() : Client.forMainnet()
  let accountId: AccountId

  try {
    accountId = AccountId.fromString(address)
  } catch (e) {
    accountId = AccountId.fromEvmAddress(0, 0, address)
  }

  if (accountId.num.isZero() && accountId.evmAddress != null) {
    await accountId.populateAccountNum(client)
  }

  try {
    return await new AccountBalanceQuery().setAccountId(accountId).execute(client)
  } catch (e) {
    return null
  }
}
