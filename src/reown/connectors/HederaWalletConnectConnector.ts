import type { SessionTypes } from '@walletconnect/types'
import { CaipNetwork, ChainNamespace, ConstantsUtil } from '@reown/appkit-common'
import { AdapterBlueprint, ChainAdapterConnector } from '@reown/appkit/adapters'
import { PresetsUtil } from '@reown/appkit-utils'
// import UniversalProvider from '@walletconnect/universal-provider'
import { createNamespaces } from '../utils'

type UniversalProvider = Parameters<AdapterBlueprint['setUniversalProvider']>[0]

export class HederaWalletConnectConnector implements ChainAdapterConnector {
  public readonly id = ConstantsUtil.CONNECTOR_ID.WALLET_CONNECT
  public readonly name = PresetsUtil.ConnectorNamesMap[
    ConstantsUtil.CONNECTOR_ID.WALLET_CONNECT
  ] as string
  public readonly type = 'WALLET_CONNECT'
  public readonly imageId =
    PresetsUtil.ConnectorImageIds[ConstantsUtil.CONNECTOR_ID.WALLET_CONNECT]
  public readonly chain: ChainNamespace
  public provider: UniversalProvider

  protected caipNetworks: CaipNetwork[]

  constructor({ provider, caipNetworks, namespace }: HederaWalletConnectConnector.Options) {
    this.caipNetworks = caipNetworks
    this.provider = provider
    this.chain = namespace as ChainNamespace
  }

  get chains() {
    return this.caipNetworks
  }

  async connectWalletConnect() {
    const isAuthenticated = await this.authenticate()

    if (!isAuthenticated) {
      await this.provider.connect({
        optionalNamespaces: createNamespaces(this.caipNetworks),
      })
    }

    return {
      clientId: await this.provider.client.core.crypto.getClientId(),
      session: this.provider.session as SessionTypes.Struct,
    }
  }

  async disconnect() {
    await this.provider.disconnect()
  }

  async authenticate(): Promise<boolean> {
    return false
  }
}

export namespace HederaWalletConnectConnector {
  export type Options = {
    provider: UniversalProvider
    caipNetworks: CaipNetwork[]
    namespace: 'hedera' | 'eip155'
  }
}
