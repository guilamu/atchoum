import { NavLink } from 'react-router-dom'

function Layout({ children }) {
    return (
        <div className="app-container has-bottom-nav">
            {children}

            <nav className="bottom-nav">
                <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <span className="nav-icon">🏠</span>
                    <span className="nav-label">Accueil</span>
                </NavLink>

                <NavLink to="/cities" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <span className="nav-icon">📍</span>
                    <span className="nav-label">Villes</span>
                </NavLink>

                <NavLink to="/forecast" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <span className="nav-icon">📅</span>
                    <span className="nav-label">Prévisions</span>
                </NavLink>

                <NavLink to="/health" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <span className="nav-icon">🩺</span>
                    <span className="nav-label">Santé</span>
                </NavLink>



                <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <span className="nav-icon">⚙️</span>
                    <span className="nav-label">Réglages</span>
                </NavLink>
            </nav>
        </div>
    )
}

export default Layout
