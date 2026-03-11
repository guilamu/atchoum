import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function Login() {
    const navigate = useNavigate()
    const { sendCode, login, isAuthenticated } = useAuth()

    const [step, setStep] = useState('email') // 'email' | 'code'
    const [email, setEmail] = useState('')
    const [code, setCode] = useState(['', '', '', '', '', ''])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [maskedEmail, setMaskedEmail] = useState('')
    const inputRefs = useRef([])

    // Redirect if already authenticated
    if (isAuthenticated) {
        navigate('/', { replace: true })
        return null
    }

    const handleRequestCode = async (e) => {
        e.preventDefault()
        setError('')

        if (!email || !email.includes('@')) {
            setError('Veuillez entrer une adresse email valide')
            return
        }

        setIsLoading(true)

        try {
            const result = await sendCode(email)
            setMaskedEmail(result.masked_email || maskEmailLocal(email))
            setStep('code')
        } catch (err) {
            setError(err.message || 'Erreur lors de l\'envoi du code')
        } finally {
            setIsLoading(false)
        }
    }

    const maskEmailLocal = (email) => {
        const [local, domain] = email.split('@')
        if (local.length <= 2) return email
        return `${local[0]}***${local[local.length - 1]}@${domain}`
    }

    const handleCodeInput = (index, value) => {
        // Only allow digits
        if (value && !/^\d$/.test(value)) return

        const newCode = [...code]
        newCode[index] = value
        setCode(newCode)

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus()
        }

        // Auto-submit when complete
        if (value && index === 5 && newCode.every(d => d)) {
            handleVerifyCode(newCode.join(''))
        }
    }

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handlePaste = (e) => {
        e.preventDefault()
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
        if (pasted.length === 6) {
            const newCode = pasted.split('')
            setCode(newCode)
            inputRefs.current[5]?.focus()
            handleVerifyCode(pasted)
        }
    }

    const handleVerifyCode = async (fullCode) => {
        setIsLoading(true)
        setError('')

        try {
            await login(email, fullCode)
            navigate('/', { replace: true })
        } catch (err) {
            setError(err.message || 'Code invalide ou expiré')
            // Clear code inputs on error
            setCode(['', '', '', '', '', ''])
            inputRefs.current[0]?.focus()
        } finally {
            setIsLoading(false)
        }
    }

    const handleResendCode = async () => {
        setIsLoading(true)
        setError('')

        try {
            await sendCode(email)
            setCode(['', '', '', '', '', ''])
            inputRefs.current[0]?.focus()
        } catch (err) {
            setError(err.message || 'Impossible de renvoyer le code')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#1a2a6c',
            backgroundImage: 'linear-gradient(to right, #fdbb2d, #b21f1f, #1a2a6c)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
        }}>
            <div className="animate-fade-in" style={{ width: '100%', maxWidth: 400 }}>
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <div style={{ fontSize: '4rem', marginBottom: 16 }}>🤧</div>
                    <h1 style={{
                        fontSize: '2.5rem',
                        fontWeight: 800,
                        color: 'white',
                        margin: 0,
                    }}>
                        Atchoum!
                    </h1>
                    <p style={{
                        color: 'rgba(255,255,255,0.9)',
                        marginTop: 8,
                        fontSize: '1.1rem',
                    }}>
                        Votre compagnon anti-pollen
                    </p>
                </div>

                {/* Login card */}
                <div className="card" style={{ padding: 32 }}>
                    {step === 'email' ? (
                        <>
                            <h2 style={{
                                fontSize: '1.25rem',
                                fontWeight: 600,
                                marginBottom: 8,
                                textAlign: 'center',
                            }}>
                                Connexion
                            </h2>
                            <p className="text-muted text-center mb-6">
                                Entrez votre email pour recevoir un code de connexion
                            </p>

                            <form onSubmit={handleRequestCode}>
                                <div className="input-group">
                                    <label className="input-label">Adresse email</label>
                                    <input
                                        type="email"
                                        className="input"
                                        placeholder="email@exemple.fr"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={isLoading}
                                        autoFocus
                                    />
                                </div>

                                {error && (
                                    <div className="alert-banner mb-4" style={{ margin: '0 0 16px 0' }}>
                                        <span className="alert-icon">⚠️</span>
                                        <span className="alert-text">{error}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-lg w-full"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <span className="animate-pulse">⏳</span> Envoi en cours...
                                        </>
                                    ) : (
                                        <>✉️ Recevoir le code</>
                                    )}
                                </button>
                            </form>

                            <p className="text-center text-sm text-muted mt-6">
                                ✨ Pas de mot de passe nécessaire
                            </p>
                        </>
                    ) : (
                        <>
                            <h2 style={{
                                fontSize: '1.25rem',
                                fontWeight: 600,
                                marginBottom: 8,
                                textAlign: 'center',
                            }}>
                                Vérification
                            </h2>
                            <p className="text-muted text-center mb-6">
                                Code envoyé à {maskedEmail}
                            </p>

                            {/* Code input */}
                            <div
                                className="code-input-group mb-6"
                                onPaste={handlePaste}
                            >
                                {code.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={el => inputRefs.current[index] = el}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        className="code-input"
                                        value={digit}
                                        onChange={(e) => handleCodeInput(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        disabled={isLoading}
                                        autoFocus={index === 0}
                                    />
                                ))}
                            </div>

                            {error && (
                                <div className="alert-banner mb-4" style={{ margin: '0 0 16px 0' }}>
                                    <span className="alert-icon">⚠️</span>
                                    <span className="alert-text">{error}</span>
                                </div>
                            )}

                            <button
                                className="btn btn-primary btn-lg w-full"
                                onClick={() => handleVerifyCode(code.join(''))}
                                disabled={isLoading || code.some(d => !d)}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="animate-pulse">⏳</span> Vérification...
                                    </>
                                ) : (
                                    <>✓ Valider le code</>
                                )}
                            </button>

                            <div className="flex flex-col items-center gap-3 mt-6">
                                <button
                                    className="btn btn-ghost"
                                    onClick={handleResendCode}
                                    disabled={isLoading}
                                >
                                    🔄 Renvoyer le code
                                </button>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => {
                                        setStep('email')
                                        setCode(['', '', '', '', '', ''])
                                        setError('')
                                    }}
                                >
                                    ← Modifier l'email
                                </button>
                            </div>

                            <div className="alert-banner alert-warning mt-6" style={{ margin: '24px 0 0 0' }}>
                                <span className="alert-icon">⏱️</span>
                                <div className="alert-text">
                                    Le code expire dans 15 minutes
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <p style={{
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '0.875rem',
                    marginTop: 24,
                }}>
                    Application open source • Données Atmo Data
                </p>
            </div>
        </div>
    )
}

export default Login
