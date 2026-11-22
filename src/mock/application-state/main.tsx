import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import { ApplicationStateBoard } from './ApplicationStateBoard'
import '../../styles.css'
// Shares the artboard chrome (plates, specimens) with /mock/form-controls.
import '../form-controls/board.css'
import './board.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ApplicationStateBoard />
    </MotionConfig>
  </StrictMode>,
)
