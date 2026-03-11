import { useState } from 'react'
import PollenBar from './PollenBar'
import { getPlantLevel } from '../data/pollenGroups'

function PollenGroupAccordion({ group, pollenData, defaultOpen = true }) {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    return (
        <div className="accordion-group">
            <button
                className="accordion-header"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
            >
                <div className="accordion-title">
                    <span className="accordion-icon">{group.icon}</span>
                    <div>
                        <span className="accordion-name">{group.name}</span>
                        <span className="accordion-description">{group.description}</span>
                    </div>
                </div>
                <span className={`accordion-chevron ${isOpen ? 'open' : ''}`}>
                    ▼
                </span>
            </button>

            <div className={`accordion-content ${isOpen ? 'open' : ''}`}>
                <div className="accordion-body">
                    {group.plants.map((plant) => {
                        const level = getPlantLevel(plant, pollenData)
                        return (
                            <div key={plant.name} className="plant-row">
                                <PollenBar
                                    name={
                                        <span className="plant-name-wrapper">
                                            {plant.name}
                                            {!plant.isAtmo && (
                                                <span className="plant-estimated" title={plant.note}>
                                                    ~
                                                </span>
                                            )}
                                        </span>
                                    }
                                    level={level}
                                />
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default PollenGroupAccordion
