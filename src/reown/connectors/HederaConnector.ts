import type { SessionTypes } from '@walletconnect/types'
import { CaipNetwork, ChainNamespace, ConstantsUtil } from '@reown/appkit-common'
import { AdapterBlueprint, type ChainAdapterConnector } from '@reown/appkit-controllers'
import { PresetsUtil } from '@reown/appkit-utils'
import { createNamespaces } from '../utils'

type UniversalProvider = Parameters<AdapterBlueprint['setUniversalProvider']>[0]

export class HederaConnector implements ChainAdapterConnector {
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

  constructor({ provider, caipNetworks, namespace }: HederaConnector.Options) {
    this.caipNetworks = caipNetworks
    this.provider = provider
    this.chain = namespace as ChainNamespace
  }

  get chains() {
    return this.caipNetworks
  }

  async connectWalletConnect() {
    const namespaces = createNamespaces(this.caipNetworks)
    const connectParams = { optionalNamespaces: namespaces }

    await this.provider.connect(connectParams)

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

export namespace HederaConnector {
  export type Options = {
    provider: UniversalProvider
    caipNetworks: CaipNetwork[]
    namespace: 'hedera' | 'eip155'
  }
}
