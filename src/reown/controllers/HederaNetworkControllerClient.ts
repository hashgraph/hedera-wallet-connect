import { CaipNetwork, NetworkControllerClient } from '@reown/appkit'
import { HederaAdapter } from '../adapter'

export class HederaNetworkControllerClient implements NetworkControllerClient {
  public adapter: HederaAdapter
  public constructor(adapter: HederaAdapter) {
    this.adapter = adapter
  }

  async switchCaipNetwork(caipNetwork: CaipNetwork): Promise<void> {
    await this.adapter.switchNetwork({ caipNetwork })
  }

  async getApprovedCaipNetworksData(): Promise<{
    approvedCaipNetworkIds: `eip155:${number}`[]
    supportsAllNetworks: boolean
    smartAccountEnabledNetworks: `eip155:${number}`[]
  }> {
    const approvedNetworks = ['eip155:295', 'eip155:296'] as `eip155:${number}`[]

    return {
      approvedCaipNetworkIds: approvedNetworks,
      supportsAllNetworks: false,
      smartAccountEnabledNetworks: [],
    }
  }
}
