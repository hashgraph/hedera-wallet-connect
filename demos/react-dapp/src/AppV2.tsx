import { AppKit, createAppKit } from '@reown/appkit'
import { HederaAdapter, WalletConnectProvider } from '../../../src/reown'
import { LedgerId } from '@hashgraph/sdk'
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { testnetConfig } from '../../../src/reown/utils/chains'
import { UniversalProvider, UniversalProviderOpts } from '@walletconnect/universal-provider'

const projectId = process.env.PROJECT_ID || 'bfd9ad3ea26e2c73eb21e8f9c750c166'

const metadata = {
  name: 'Reown Hedera Demo',
  description: 'Reown Hedera WalletConnect Demo',
  url: 'https://reown.xyz',
  icons: ['https://reown.xyz/logo.png'],
}

const AppKitContext = createContext<AppKit | undefined>(undefined)

export default function V2App() {
  const [appKit, setAppKit] = useState<AppKit>()
  const [hederaAdapter, setHederaAdapter] = useState<HederaAdapter>()

  const sessions = useMemo(
    () => hederaAdapter?.provider?.client?.session.getAll(),
    [hederaAdapter?.provider?.client?.session],
  )

  useEffect(() => {
    // @ts-expect-error - only HederaAdapter is used as the eip155 adapter in this demo
    setHederaAdapter(appKit?.chainAdapters?.eip155 as HederaAdapter)
  }, [appKit?.chainAdapters?.eip155])

  const getAppKit = async () => {
    const walletConnectProvider = await WalletConnectProvider.init(
      metadata,
      LedgerId.TESTNET,
      projectId,
    )

    const hederaAdapter = new HederaAdapter({
      projectId,
      provider: walletConnectProvider,
      chainId: LedgerId.TESTNET,
      metadata,
      networks: [testnetConfig],
      defaultNetwork: testnetConfig,
    })

    /**
     * UniversalProvider instance with SignClient from WalletConnectProvider to be used by AppKit.
     * AppKit will generate its own instance by default in none provided
     */
    const universalProvider = await UniversalProvider.init({
      projectId,
      metadata,
      client: walletConnectProvider.client as unknown as UniversalProviderOpts['client'],
    })

    const appKit = createAppKit({
      projectId,
      networks: [testnetConfig],
      defaultNetwork: testnetConfig,
      universalProvider,
      metadata,
      adapters: [hederaAdapter],
      showWallets: true,
      features: {
        swaps: false,
        history: false,
        email: false,
        socials: false,
        allWallets: false,
      },
    })
    return appKit
  }

  useEffect(() => {
    getAppKit().then(setAppKit).catch(console.error)

    return () => {
      console.log('Disconnect')
      appKit?.disconnect().catch(console.error)
    }
  }, [])

  return (
    <AppKitContext.Provider value={appKit}>
      <div className="container">
      <h2>Hedera WalletConnect V2 Demo</h2>
      <div className="content">
        {sessions?.length > 0 ? (
          <>
            <legend>Connected Wallets</legend>
            <ul>
              {sessions.map((session, index) => (
                <li key={index}>
                  <p>Session ID: {session.topic}</p>
                  <p>Wallet Name: {session.peer.metadata.name}</p>
                  <p>Account IDs: {session.namespaces?.hedera?.accounts?.join(' | ')}</p>
                </li>
              ))}
            </ul>
            <button onClick={() => appKit.disconnect()}>Disconnect</button>
          </>
        ) : (
          <button onClick={() => appKit.open()}>Connect Wallet</button>
        )}
      </div>
    </div>
    </AppKitContext.Provider>
  )
}
