import type { Config } from 'jest'

const config: Config = {
  detectOpenHandles: true,
  fakeTimers: {
    enableGlobally: true,
  },
}

export default config
