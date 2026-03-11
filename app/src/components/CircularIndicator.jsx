import { useMemo } from 'react'

const POLLEN_COLORS = {
    1: '#50F0E6', // Très faible
    2: '#50CCAA', // Faible
    3: '#F0E641', // Modéré
    4: '#FF5050', // Élevé
    5: '#960032', // Très élevé
    6: '#872181', // Extrêmement élevé
    0: '#DDDDDD', // Indisponible
}

const POLLEN_LABELS = {
    0: 'Indisponible',
    1: 'Très faible',
    2: 'Faible',
    3: 'Modéré',
    4: 'Élevé',
    5: 'Très élevé',
    6: 'Extrêmement élevé',
}

// Combined POLLEN_LEVELS for external use (matches atmoApi.js format)
const POLLEN_LEVELS = {
    0: { label: 'Indisponible', color: '#DDDDDD' },
    1: { label: 'Très faible', color: '#50F0E6' },
    2: { label: 'Faible', color: '#50CCAA' },
    3: { label: 'Modéré', color: '#F0E641' },
    4: { label: 'Élevé', color: '#FF5050' },
    5: { label: 'Très élevé', color: '#960032' },
    6: { label: 'Extrêmement élevé', color: '#872181' },
}

function CircularIndicator({ level = 0, maxLevel = 6, label, size = 180 }) {
    const percentage = level === 0 ? 0 : (level / maxLevel) * 100
    const color = POLLEN_COLORS[level] || POLLEN_COLORS[0]
    const displayLabel = label || POLLEN_LABELS[level] || POLLEN_LABELS[0]

    // SVG calculations
    const radius = 75
    const circumference = 2 * Math.PI * radius
    const strokeDasharray = useMemo(() => {
        const filled = (percentage / 100) * circumference
        return `${filled} ${circumference}`
    }, [percentage, circumference])

    return (
        <div className="circular-indicator" style={{ width: size, height: size }}>
            <svg viewBox="0 0 200 200">
                {/* Background circle */}
                <circle
                    className="bg-circle"
                    cx="100"
                    cy="100"
                    r={radius}
                />
                {/* Progress circle */}
                <circle
                    className="progress-circle"
                    cx="100"
                    cy="100"
                    r={radius}
                    stroke={color}
                    strokeDasharray={strokeDasharray}
                    style={{
                        transition: 'stroke-dasharray 0.6s ease-out, stroke 0.3s ease',
                    }}
                />
            </svg>
            <div className="indicator-content">
                <div className="level-value">
                    {level}<span className="level-max">/{maxLevel}</span>
                </div>
                <div className="level-label">{displayLabel}</div>
            </div>
        </div>
    )
}

export default CircularIndicator
export { POLLEN_COLORS, POLLEN_LABELS, POLLEN_LEVELS }
