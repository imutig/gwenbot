'use client'

import { ELEMENT_ICONS, WEAPON_ICONS, REGION_ICONS } from '@/data/genshin-icons'

export default function GenshinIconsTestPage() {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
            <h1 style={{ marginBottom: '2rem' }}>Test des icônes Genshin</h1>

            {/* Elements */}
            <section style={{ marginBottom: '3rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--pink-accent)' }}>Éléments</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                    {Object.entries(ELEMENT_ICONS).map(([name, url]) => (
                        <div key={name} style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                            <img
                                src={url}
                                alt={name}
                                style={{ width: '48px', height: '48px', marginBottom: '0.5rem' }}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.border = '2px solid red'
                                }}
                            />
                            <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{name}</p>
                            <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', wordBreak: 'break-all', marginTop: '0.5rem' }}>{url}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Weapons */}
            <section style={{ marginBottom: '3rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--pink-accent)' }}>Armes</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                    {Object.entries(WEAPON_ICONS).map(([name, url]) => (
                        <div key={name} style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                            <img
                                src={url}
                                alt={name}
                                style={{ width: '48px', height: '48px', marginBottom: '0.5rem' }}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.border = '2px solid red'
                                }}
                            />
                            <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{name}</p>
                            <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', wordBreak: 'break-all', marginTop: '0.5rem' }}>{url}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Regions */}
            <section style={{ marginBottom: '3rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--pink-accent)' }}>Régions</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                    {Object.entries(REGION_ICONS).map(([name, url]) => (
                        <div key={name} style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                            <img
                                src={url}
                                alt={name}
                                style={{ width: '48px', height: '48px', marginBottom: '0.5rem' }}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.border = '2px solid red'
                                }}
                            />
                            <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{name}</p>
                            <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', wordBreak: 'break-all', marginTop: '0.5rem' }}>{url}</p>
                        </div>
                    ))}
                </div>
            </section>

            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '8px', marginTop: '2rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <strong>Note :</strong> Les images avec une bordure rouge ne chargent pas correctement.
                    Donne-moi les bonnes URLs pour les remplacer !
                </p>
            </div>
        </div>
    )
}
