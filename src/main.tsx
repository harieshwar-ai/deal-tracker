import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { enablePreviewFromUrl } from './preview/mode'
import { ThemeProvider } from './theme/theme'
import './index.css'

enablePreviewFromUrl()

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing.')

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
