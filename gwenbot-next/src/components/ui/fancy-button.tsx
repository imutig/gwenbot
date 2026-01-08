'use client'

import { ReactNode, ButtonHTMLAttributes } from 'react'

const styles = `
.fancy-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  outline: none;
  border: 0;
  vertical-align: middle;
  text-decoration: none;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  color: #8B4558;
  text-transform: uppercase;
  padding: 1.25em 2em;
  background: #fff0f0;
  border: 2px solid #b18597;
  border-radius: 0.75em;
  transform-style: preserve-3d;
  transition: transform 150ms cubic-bezier(0, 0, 0.58, 1), background 150ms cubic-bezier(0, 0, 0.58, 1);
}

.fancy-btn::before {
  position: absolute;
  content: '';
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f9c4d2;
  border-radius: inherit;
  box-shadow: 0 0 0 2px #b18597, 0 0.625em 0 0 #ffe3e2;
  transform: translate3d(0, 0.75em, -1em);
  transition: transform 150ms cubic-bezier(0, 0, 0.58, 1), box-shadow 150ms cubic-bezier(0, 0, 0.58, 1);
}

.fancy-btn:hover {
  background: #ffe9e9;
  transform: translate(0, 0.25em);
}

.fancy-btn:hover::before {
  box-shadow: 0 0 0 2px #b18597, 0 0.5em 0 0 #ffe3e2;
  transform: translate3d(0, 0.5em, -1em);
}

.fancy-btn:active {
  background: #ffe9e9;
  transform: translate(0em, 0.75em);
}

.fancy-btn:active::before {
  box-shadow: 0 0 0 2px #b18597, 0 0 #ffe3e2;
  transform: translate3d(0, 0, -1em);
}

.fancy-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.fancy-btn:disabled::before {
  transform: translate3d(0, 0.75em, -1em);
}

/* Size variants */
.fancy-btn--sm {
  font-size: 13px;
  padding: 0.875em 1.5em;
}

.fancy-btn--xs {
  font-size: 12px;
  padding: 0.5em 1em;
}

.fancy-btn--xs::before {
  box-shadow: 0 0 0 2px #b18597, 0 0.4em 0 0 #ffe3e2;
  transform: translate3d(0, 0.5em, -1em);
}

.fancy-btn--xs:hover::before {
  box-shadow: 0 0 0 2px #b18597, 0 0.3em 0 0 #ffe3e2;
  transform: translate3d(0, 0.35em, -1em);
}

.fancy-btn--xs:active::before {
  box-shadow: 0 0 0 2px #b18597, 0 0 #ffe3e2;
  transform: translate3d(0, 0, -1em);
}

.fancy-btn--lg {
  font-size: 17px;
  padding: 1.5em 2.5em;
}
`

interface FancyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

export default function FancyButton({
  children,
  size = 'md',
  className = '',
  ...props
}: FancyButtonProps) {
  const sizeClass = size !== 'md' ? `fancy-btn--${size}` : ''

  return (
    <>
      <style>{styles}</style>
      <button
        className={`fancy-btn ${sizeClass} ${className}`.trim()}
        {...props}
      >
        {children}
      </button>
    </>
  )
}
