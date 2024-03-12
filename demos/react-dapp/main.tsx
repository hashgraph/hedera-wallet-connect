import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './src/App'

document.body.innerHTML = '<div id="app"></div>'

const appElement = document.getElementById('app')
if (appElement) {
  const root = createRoot(appElement)
  root.render(<App />)
}
