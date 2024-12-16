import type { ConnectionControllerClient, EstimateGasTransactionArgs } from '@reown/appkit'
import { AdapterBlueprint } from '@reown/appkit/adapters'
import { HederaAdapter } from '../adapter'

export class HederaConnectionController implements ConnectionControllerClient {
  public adapter: HederaAdapter

  public constructor(adapter: HederaAdapter) {
    this.adapter = adapter
  }

  async connectWalletConnect(onUri: (uri: string) => void): Promise<void> {
    await this.connectWalletConnect(onUri)
  }

  async disconnect(): Promise<void> {
    await this.disconnect()
  }

  async connect(params: any): Promise<AdapterBlueprint.ConnectResult> {
    return this.connect(params)
  }

  async signMessage(message: string): Promise<string> {
    // TODO: we need to get the signer who sent this message while being comp with the interface.
    const address = await this.adapter.requestAccounts()
    const result = await this.adapter.signMessage({ message, address: address[0] })
    return result.signature
  }

  async sendTransaction(params: any): Promise<string> {
    return this.sendTransaction(params)
  }

  async estimateGas(args: EstimateGasTransactionArgs): Promise<bigint> {
    return BigInt(0)
  }

  parseUnits(): bigint {
    return BigInt(0)
  }

  formatUnits(): string {
    return ''
  }

  async getEnsAddress(value: string): Promise<string | false> {
    const profileResponse = await this.adapter.getProfile()
    if (!profileResponse.profileName) {
      return false
    }

    return profileResponse.profileName
  }

  async getCapabilities(): Promise<Record<string, never>> {
    return {}
  }

  async grantPermissions(): Promise<Record<string, never>> {
    return {}
  }

  async revokePermissions(params: {
    pci: string
    permissions: unknown[]
    expiry: number
    address: `0x${string}`
  }): Promise<`0x${string}`> {
    return '0x' as `0x${string}`
  }

  async writeContract(): Promise<never> {
    throw new Error('Contract interactions not supported on Hedera')
  }

  async getEnsAvatar(value: string): Promise<string | false> {
    const profileResponse = await this.adapter.getProfile()
    return profileResponse.profileImage || false
  }
}
