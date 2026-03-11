import { POLLEN_COLORS, POLLEN_LABELS } from './CircularIndicator'

function PollenBar({ name, level = 0, showLevel = true }) {
    const color = POLLEN_COLORS[level] || POLLEN_COLORS[0]
    const label = POLLEN_LABELS[level] || POLLEN_LABELS[0]
    const maxLevel = 6
    const percentage = level === 0 ? 0 : (level / maxLevel) * 100

    // Create gradient for the bar
    const gradientStyle = level > 0 ? {
        background: `linear-gradient(90deg, ${color}88 0%, ${color} 100%)`,
        width: `${percentage}%`,
    } : {
        background: POLLEN_COLORS[0],
        width: '100%',
    }

    if (level === 0) {
        return (
            <div className="pollen-bar pollen-unavailable">
                <div className="pollen-name">{name}</div>
                <div className="pollen-bar-container">
                    <div
                        className="pollen-bar-fill"
                        style={{ background: '#eee', width: '100%', opacity: 0.5 }}
                    />
                </div>
                {showLevel && (
                    <span className="text-sm text-muted" style={{ marginLeft: 12, whiteSpace: 'nowrap' }}>
                        N/A
                    </span>
                )}
            </div>
        )
    }

    return (
        <div className="pollen-bar">
            <div className="pollen-name">{name}</div>
            <div className="pollen-bar-container">
                <div
                    className="pollen-bar-fill"
                    style={gradientStyle}
                />
            </div>
            {showLevel && (
                <span
                    className="text-sm font-medium"
                    style={{ marginLeft: 12, color: color, whiteSpace: 'nowrap' }}
                >
                    {level}/6
                </span>
            )}
        </div>
    )
}

export default PollenBar
