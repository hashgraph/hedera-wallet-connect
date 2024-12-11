import { AppKit, createAppKit } from '@reown/appkit'
import { HederaAdapter } from '../../../src/reown'
import { LedgerId } from '@hashgraph/sdk'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { hedera, hederaTestnet } from '@reown/appkit/networks'
import { AccountController } from '@reown/appkit'

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
  const [account, setAccount] = useState<string | null>(null)

  useEffect(() => {
    const adapter = new HederaAdapter({
      projectId,
      chainId: LedgerId.TESTNET,
      metadata,
      networks: [hederaTestnet],
      defaultNetwork: hederaTestnet,
    })

    const kit = createAppKit({
      projectId,
      networks: [hederaTestnet],
      metadata,
      adapters: [adapter],
      showWallets: true,
      features: {
        swaps: false,
        history: false,
        email: false,
        socials: false,
        allWallets: false,
      },
    })

    adapter.syncConnectors(
      {
        projectId,
        metadata,
        networks: [hederaTestnet],
      },
      kit,
    )

    AccountController.subscribeKey('address', (address: string | undefined) => {
      if (address) {
        setAccount(address)
      }
    })

    setAppKit(kit)

    return () => {
      kit.disconnect().catch(console.error)
    }
  }, [])

  if (!appKit) {
    return <div>Loading AppKit...</div>
  }

  return (
    <AppKitContext.Provider value={appKit}>
      <div className="container">
        <h2>Hedera WalletConnect V2 Demo</h2>
        <div className="content">
          {account ? (
            <>
              <p>Connected Account: {account}</p>
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
