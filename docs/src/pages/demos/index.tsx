import Layout from '@theme/Layout'
import { useState } from 'react'
import BrowserOnly from '@docusaurus/BrowserOnly'
import '/'

export const TypeScriptDemo = () => {
  const [isDapp, setIsDapp] = useState(true)
  return (
    <Layout>
      <BrowserOnly>
        {() => {
          return (
            <div className="flex h-screen">
              <div className="w-1/2 relative">
                <iframe
                  src="/demos/typescript/dapp/index.html"
                  className="w-full h-full"
                  allow="clipboard-write"
                />
                {!isDapp && (
                  <div
                    onClick={() => setIsDapp(true)}
                    className="absolute inset-0 bg-black flex items-center justify-center text-white cursor-pointer"
                  >
                    Switch to dapp
                  </div>
                )}
              </div>
              <div className="w-1/2 relative">
                <iframe
                  src="/demos/typescript/wallet/index.html"
                  className="w-full h-full"
                  allow="clipboard-write"
                />
                {isDapp && (
                  <div
                    onClick={() => setIsDapp(false)}
                    className="absolute inset-0 bg-black flex items-center justify-center text-white cursor-pointer"
                  >
                    Switch to wallet
                  </div>
                )}
              </div>
            </div>
          )
        }}
      </BrowserOnly>
    </Layout>
  )
}

export default TypeScriptDemo
