import React from 'react'
import { useEffect, useRef, useState } from 'react'

interface ModalProps {
  isOpen: boolean
  title: string
  onClose?: () => void
  children: React.ReactNode
}

const Modal: React.FC<ModalProps> = ({ isOpen, title, onClose, children }) => {
  const [isModalOpen, setModalOpen] = useState(isOpen)
  const modalRef = useRef<HTMLDialogElement | null>(null)

  const handleCloseModal = () => {
    if (onClose) {
      onClose()
    }
    setModalOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      handleCloseModal()
    }
  }

  useEffect(() => {
    setModalOpen(isOpen)
  }, [isOpen])

  useEffect(() => {
    const modalElement = modalRef.current

    if (modalElement) {
      if (isModalOpen) {
        modalElement.showModal()
      } else {
        modalElement.close()
      }
    }
  }, [isModalOpen])

  return (
    <dialog ref={modalRef} onKeyDown={handleKeyDown} className="modal">
      <div>
        <span>{title}</span>
        <button onClick={handleCloseModal}>X</button>
      </div>
      <div>{children}</div>
    </dialog>
  )
}

export default Modal
