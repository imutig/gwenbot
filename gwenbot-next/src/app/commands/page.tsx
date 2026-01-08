const styles = `
  .command-card {
    padding: 1.25rem;
    background: rgba(255, 209, 220, 0.4);
    border-radius: 16px;
    margin-bottom: 1rem;
    border-left: 4px solid var(--pink-accent);
  }
  .command-name {
    font-family: monospace;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--pink-accent);
    margin-bottom: 0.5rem;
  }
  .command-desc {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }
  .command-example {
    font-family: monospace;
    font-size: 0.8rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-input);
    border-radius: 8px;
    color: var(--text-secondary);
  }
  .command-badge {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 600;
    margin-left: 0.5rem;
  }
  .badge-mod { background: var(--pink-main); color: white; }
  .badge-public { background: #f0abfc; color: var(--text-primary); }
  .category-title {
    font-size: 1.25rem;
    margin: 2rem 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
`

export default function CommandsPage() {
    return (
        <>
            <style>{styles}</style>
            <div className="animate-slideIn">
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '32px', height: '32px' }}>
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" x2="8" y1="13" y2="13" />
                        <line x1="16" x2="8" y1="17" y2="17" />
                    </svg>
                    Commandes du Bot
                </h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Liste des commandes disponibles sur le chat Twitch</p>

                <div className="glass-card" style={{ padding: '2rem' }}>
                    {/* Public Commands */}
                    <h2 className="category-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '24px', height: '24px' }}>
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Commandes publiques
                    </h2>

                    <div className="command-card">
                        <div className="command-name">!site<span className="command-badge badge-public">Tout le monde</span></div>
                        <div className="command-desc">Affiche le lien vers le site.</div>
                    </div>

                    <div className="command-card">
                        <div className="command-name">!stats [pseudo]<span className="command-badge badge-public">Tout le monde</span></div>
                        <div className="command-desc">Affiche tes statistiques (messages, points Cemantix). Ajoute un pseudo pour voir les stats d&apos;un autre viewer.</div>
                        <div className="command-example">!stats → tes stats | !stats @ami → stats d&apos;un autre</div>
                    </div>

                    <div className="command-card">
                        <div className="command-name">!pileouface<span className="command-badge badge-public">Tout le monde</span></div>
                        <div className="command-desc">Lance une pièce : Pile ou Face ?</div>
                    </div>

                    <div className="command-card">
                        <div className="command-name">!clip [titre]<span className="command-badge badge-public">Tout le monde</span></div>
                        <div className="command-desc">Crée un clip du moment actuel du stream. Tu peux ajouter un titre optionnel.</div>
                        <div className="command-example">!clip → clip par défaut | !clip Moment épique → clip avec titre</div>
                    </div>

                    <div className="command-card">
                        <div className="command-name">!announce &lt;message&gt; [couleur]<span className="command-badge badge-mod">Modo</span></div>
                        <div className="command-desc">Envoie une annonce colorée dans le chat. Couleurs disponibles : blue, green, orange, purple.</div>
                        <div className="command-example">!announce Bienvenue ! purple → annonce violette</div>
                    </div>

                    {/* Cemantix Commands */}
                    <h2 className="category-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2" style={{ width: '24px', height: '24px' }}>
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="6" />
                            <circle cx="12" cy="12" r="2" />
                        </svg>
                        Commandes Cemantix
                    </h2>

                    <div className="command-card">
                        <div className="command-name">!cemantix<span className="command-badge badge-public">Tout le monde</span></div>
                        <div className="command-desc">Affiche le lien vers le site avec les stats et le leaderboard.</div>
                    </div>

                    <div className="command-card">
                        <div className="command-name">!cemantix start [fr/en]<span className="command-badge badge-mod">Modo</span></div>
                        <div className="command-desc">Lance une session de jeu. Par défaut en français, ajoute &quot;en&quot; pour l&apos;anglais.</div>
                        <div className="command-example">!cemantix start → 🇫🇷 | !cemantix start en → 🇬🇧</div>
                    </div>

                    <div className="command-card">
                        <div className="command-name">!cemantix stop<span className="command-badge badge-mod">Modo</span></div>
                        <div className="command-desc">Arrête la session en cours et affiche le récapitulatif.</div>
                    </div>

                    <div className="command-card">
                        <div className="command-name">!cemantix top<span className="command-badge badge-public">Tout le monde</span></div>
                        <div className="command-desc">Affiche le Top 5 des meilleurs joueurs Cemantix.</div>
                    </div>

                    {/* How it works */}
                    <h2 className="category-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '24px', height: '24px' }}>
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                            <path d="M12 17h.01" />
                        </svg>
                        Comment ça marche ?
                    </h2>

                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
                        <p><strong>🎮 Pendant une session Cemantix :</strong></p>
                        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem' }}>
                            <li>Écrivez simplement un mot dans le chat</li>
                            <li>Le bot teste automatiquement le mot contre Cemantix/Cemantle</li>
                            <li>Vos points s&apos;accumulent en fonction du degré de proximité</li>
                            <li>Trouvez le mot secret pour gagner un bonus !</li>
                        </ul>

                        <p><strong>🏆 Points :</strong></p>
                        <ul style={{ marginLeft: '1.5rem' }}>
                            <li>Chaque mot valide rapporte des points basés sur sa proximité (0-100°)</li>
                            <li>Trouver le mot secret donne un bonus x1.5</li>
                            <li>Les points sont cumulés dans le leaderboard global</li>
                        </ul>
                    </div>
                </div>
            </div>
        </>
    )
}
