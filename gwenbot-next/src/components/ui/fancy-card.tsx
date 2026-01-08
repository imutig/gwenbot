'use client'

import { ReactNode, HTMLAttributes } from 'react'
import Link from 'next/link'

const styles = `
.fancy-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
  text-decoration: none;
  font-family: inherit;
  color: #8B4558;
  padding: 2rem;
  background: #fff0f0;
  border: 2px solid #b18597;
  border-radius: 1rem;
  transform-style: preserve-3d;
  transition: transform 150ms cubic-bezier(0, 0, 0.58, 1), background 150ms cubic-bezier(0, 0, 0.58, 1);
}

.fancy-card::before {
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

.fancy-card:hover {
  background: #ffe9e9;
  transform: translate(0, 0.25em);
}

.fancy-card:hover::before {
  box-shadow: 0 0 0 2px #b18597, 0 0.5em 0 0 #ffe3e2;
  transform: translate3d(0, 0.5em, -1em);
}

.fancy-card:active {
  background: #ffe9e9;
  transform: translate(0em, 0.75em);
}

.fancy-card:active::before {
  box-shadow: 0 0 0 2px #b18597, 0 0 #ffe3e2;
  transform: translate3d(0, 0, -1em);
}

.fancy-card-icon {
  color: var(--pink-accent);
  margin-bottom: 1rem;
}

.fancy-card-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.fancy-card-description {
  font-size: 0.9rem;
  color: #b18597;
}
`

interface FancyCardProps extends HTMLAttributes<HTMLAnchorElement> {
    href: string
    icon: ReactNode
    title: string
    description: string
}

export default function FancyCard({
    href,
    icon,
    title,
    description,
    className = '',
    ...props
}: FancyCardProps) {
    return (
        <>
            <style>{styles}</style>
            <Link
                href={href}
                className={`fancy-card ${className}`.trim()}
                {...props}
            >
                <div className="fancy-card-icon">{icon}</div>
                <div className="fancy-card-title">{title}</div>
                <div className="fancy-card-description">{description}</div>
            </Link>
        </>
    )
}
