import { useAtom } from 'jotai'
import { messagesAtom, readerAtom } from './atoms'
import { AppShell } from './components/AppShell'
import { ChatView } from './components/ChatView'
import { ReaderOverlay } from './components/ReaderOverlay'
import { AnimatePresence } from 'framer-motion'
import { ToastContainer } from './components/Toast'
import { Sidebar } from './components/Sidebar'
import { SettingsModal } from './components/SettingsModal'

export default function App() {
  const [reader] = useAtom(readerAtom)

  return (
    <>
      <AppShell>
        <ChatView />
      </AppShell>
      <AnimatePresence>
        {reader.isOpen && <ReaderOverlay />}
      </AnimatePresence>
      <Sidebar />
      <SettingsModal />
      <ToastContainer />
    </>
  )
}
