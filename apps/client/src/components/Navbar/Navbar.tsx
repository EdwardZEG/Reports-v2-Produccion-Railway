import React, { useState, useRef, useEffect } from "react";
import { AiOutlineLogout } from "react-icons/ai";
import "./Navbar.css";
import logoRowan from "../../assets/logo_rwnet.png";
import { logout } from "../../auth/authService";

const Navbar: React.FC = () => {
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const manejarClickFuera = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        iconRef.current &&
        !iconRef.current.contains(e.target as Node)
      ) {
        setMostrarMenu(false);
      }
    };

    document.addEventListener("mousedown", manejarClickFuera);
    return () => {
      document.removeEventListener("mousedown", manejarClickFuera);
    };
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar__logo">
        <img src={logoRowan} alt="Rowan Networks" />
      </div>
      <div className="navbar__profile" ref={iconRef}>
        <div className="drowpdown">
          <AiOutlineLogout
            className="navbar_dropbtn"
            onClick={() => setMostrarMenu(prev => !prev)}
            size={30}
          />
          {mostrarMenu && (
            <div className="dropdown-content" ref={menuRef}>
              <a href="#" onClick={logout}>Cerrar sesión</a>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
