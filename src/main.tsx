import { createRoot } from 'react-dom/client'
import { App } from './App'
import { TasksStyles } from './ui/styles'
import './compact-in-room.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('PureTasks root element #root not found')
}

createRoot(rootElement).render(<><TasksStyles /><App /></>)
