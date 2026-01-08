export default function MaintenancePage() {
    return (
        <>
            {/* Hide the navbar with CSS */}
            <style>{`
                nav, .navbar, header { display: none !important; }
                footer { display: none !important; }
            `}</style>

            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-base)',
                padding: '2rem',
                zIndex: 9999
            }}>
                <div className="glass-card animate-slideIn" style={{
                    padding: '2.5rem',
                    textAlign: 'center',
                    maxWidth: '500px',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    <img
                        src="https://static-cdn.jtvnw.net/jtv_user_pictures/1efe260a-d1d3-4215-9c9f-5a24aea55625-profile_image-70x70.png"
                        alt="xsgwen"
                        style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            border: '4px solid var(--pink-main)',
                            marginBottom: '1.5rem',
                            display: 'block'
                        }}
                    />

                    <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                        Site en construction
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                        Le site xsgwen.fr arrive bientôt !<br />
                        En attendant, rejoins le stream !
                    </p>

                    <a
                        href="https://www.twitch.tv/xsgwen"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '1.5rem',
                            background: '#9146FF'
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                        </svg>
                        Regarder sur Twitch
                    </a>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem',
                        marginBottom: '1rem',
                        width: '100%'
                    }}>
                        <span style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></span>
                        Accès développeur
                        <span style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></span>
                    </div>

                    <form action="/api/maintenance/bypass" method="POST" style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        <input
                            type="text"
                            name="code"
                            placeholder="Code d'accès"
                            className="input"
                            style={{ flex: 1, minWidth: 0 }}
                            required
                        />
                        <button type="submit" className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                            Accès
                        </button>
                    </form>

                    {/* Streamer Bot Authorization */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem',
                        marginTop: '1.5rem',
                        marginBottom: '1rem',
                        width: '100%'
                    }}>
                        <span style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></span>
                        Autorisation Bot
                        <span style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></span>
                    </div>

                    <a
                        href={`https://id.twitch.tv/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID || 'YOUR_CLIENT_ID'}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')}/api/twitch/callback&response_type=code&scope=${encodeURIComponent('bits:read channel:bot channel:manage:broadcast channel:manage:polls channel:manage:predictions channel:manage:redemptions channel:read:hype_train channel:read:polls channel:read:predictions channel:read:redemptions channel:read:subscriptions chat:edit chat:read moderator:read:chatters moderator:read:followers user:read:email whispers:read whispers:edit')}`}
                        className="btn btn-secondary"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.85rem',
                            padding: '0.6rem 1rem'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                        </svg>
                        Réautoriser le bot (Streamer)
                    </a>

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem', opacity: 0.7 }}>
                        🌸 Merci de ta patience 🌸
                    </p>
                </div>
            </div>
        </>
    )
}
