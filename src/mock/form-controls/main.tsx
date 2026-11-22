import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import { FormControlsBoard } from './FormControlsBoard'
import '../../styles.css'
import './board.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <FormControlsBoard />
    </MotionConfig>
  </StrictMode>,
)
