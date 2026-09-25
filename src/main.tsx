import { createRoot } from 'react-dom/client'
import { App } from './App'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('PureTasks root element #root not found')
}

createRoot(rootElement).render(<App />)
