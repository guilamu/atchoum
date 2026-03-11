import { useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// Severity colors
const SEVERITY_COLORS = {
    low: '#50CCAA',
    medium: '#F0E641',
    high: '#FF5050',
    extreme: '#960032',
};

/**
 * Line chart showing symptom severity over time
 */
export function SymptomsTimelineChart({ timeline, height = 200 }) {
    const data = useMemo(() => {
        if (!timeline || timeline.length === 0) {
            return null;
        }

        return {
            labels: timeline.map(d => {
                const date = new Date(d.date);
                return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            }),
            datasets: [
                {
                    label: 'Sévérité moyenne',
                    data: timeline.map(d => d.avg_severity),
                    borderColor: '#FF6B6B',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                },
                {
                    label: 'Sévérité max',
                    data: timeline.map(d => d.max_severity),
                    borderColor: '#960032',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    tension: 0.3,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                },
            ],
        };
    }, [timeline]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                    padding: 15,
                },
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: (context) => {
                        const value = context.raw;
                        return `${context.dataset.label}: ${value}/10`;
                    },
                },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 10,
                ticks: {
                    stepSize: 2,
                },
                title: {
                    display: true,
                    text: 'Sévérité',
                },
            },
            x: {
                grid: {
                    display: false,
                },
            },
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false,
        },
    };

    if (!data) {
        return (
            <div style={{ 
                height, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#666',
            }}>
                Pas de données disponibles
            </div>
        );
    }

    return (
        <div style={{ height }}>
            <Line data={data} options={options} />
        </div>
    );
}

/**
 * Bar chart showing symptom count and medication intake correlation
 */
export function SymptomsVsMedicationsChart({ timeline, height = 180 }) {
    const data = useMemo(() => {
        if (!timeline || timeline.length === 0) {
            return null;
        }

        return {
            labels: timeline.map(d => {
                const date = new Date(d.date);
                return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            }),
            datasets: [
                {
                    label: 'Symptômes',
                    data: timeline.map(d => d.symptom_count),
                    backgroundColor: 'rgba(255, 107, 107, 0.7)',
                    borderRadius: 4,
                },
                {
                    label: 'Prises médicaments',
                    data: timeline.map(d => d.medication_count),
                    backgroundColor: 'rgba(80, 204, 170, 0.7)',
                    borderRadius: 4,
                },
            ],
        };
    }, [timeline]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                    padding: 15,
                },
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1,
                },
            },
            x: {
                grid: {
                    display: false,
                },
            },
        },
    };

    if (!data) {
        return (
            <div style={{ 
                height, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#666',
            }}>
                Pas de données disponibles
            </div>
        );
    }

    return (
        <div style={{ height }}>
            <Bar data={data} options={options} />
        </div>
    );
}

/**
 * Top symptoms display with horizontal bars
 */
export function TopSymptomsChart({ topSymptoms, height = 150 }) {
    const data = useMemo(() => {
        if (!topSymptoms || topSymptoms.length === 0) {
            return null;
        }

        // Sort by occurrence and take top 5
        const sorted = [...topSymptoms].sort((a, b) => b.occurrence - a.occurrence).slice(0, 5);

        return {
            labels: sorted.map(s => `${s.icon || '•'} ${s.name}`),
            datasets: [
                {
                    label: 'Occurrences',
                    data: sorted.map(s => s.occurrence),
                    backgroundColor: sorted.map(s => {
                        const avg = parseFloat(s.avg_severity);
                        if (avg <= 3) return SEVERITY_COLORS.low;
                        if (avg <= 6) return SEVERITY_COLORS.medium;
                        if (avg <= 8) return SEVERITY_COLORS.high;
                        return SEVERITY_COLORS.extreme;
                    }),
                    borderRadius: 4,
                },
            ],
        };
    }, [topSymptoms]);

    const options = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const symptom = topSymptoms[context.dataIndex];
                        return [
                            `${context.raw} occurrence(s)`,
                            `Sévérité moy: ${parseFloat(symptom.avg_severity).toFixed(1)}/10`,
                        ];
                    },
                },
            },
        },
        scales: {
            x: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1,
                },
            },
            y: {
                grid: {
                    display: false,
                },
            },
        },
    };

    if (!data) {
        return (
            <div style={{ 
                height, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#666',
            }}>
                Pas de données disponibles
            </div>
        );
    }

    return (
        <div style={{ height }}>
            <Bar data={data} options={options} />
        </div>
    );
}

/**
 * Severity gauge display (not a chart, but a visual indicator)
 */
export function SeverityGauge({ value, max = 10, size = 120 }) {
    const percentage = (value / max) * 100;
    
    // Determine color based on value
    let color = SEVERITY_COLORS.low;
    if (value > 3) color = SEVERITY_COLORS.medium;
    if (value > 6) color = SEVERITY_COLORS.high;
    if (value > 8) color = SEVERITY_COLORS.extreme;

    const circumference = 2 * Math.PI * 45; // radius = 45
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference * 0.75; // 270 degrees

    return (
        <div style={{ width: size, height: size, position: 'relative' }}>
            <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-135deg)' }}>
                {/* Background arc */}
                <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#e0e0e0"
                    strokeWidth="8"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={circumference * 0.25}
                    strokeLinecap="round"
                />
                {/* Value arc */}
                <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
            </svg>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                }}
            >
                <span style={{ fontSize: size * 0.25, fontWeight: 700, color }}>
                    {value.toFixed(1)}
                </span>
                <span style={{ fontSize: size * 0.1, color: '#666' }}>
                    /{max}
                </span>
            </div>
        </div>
    );
}

export default {
    SymptomsTimelineChart,
    SymptomsVsMedicationsChart,
    TopSymptomsChart,
    SeverityGauge,
};
