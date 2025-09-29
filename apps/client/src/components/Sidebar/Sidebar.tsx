import React from 'react';
import { NavLink } from 'react-router-dom';
import { MdHomeFilled, MdOutlineDriveFolderUpload, MdWork } from 'react-icons/md';
import { FaUserAlt, FaUserFriends } from 'react-icons/fa';
import { BsCardList } from "react-icons/bs";
import { FaCalendarAlt } from "react-icons/fa";
import './Sidebar.css';

const Sidebar: React.FC = () => {
  // ORDEN ACTUALIZADO: Dashboard -> Pólizas -> Especialidades
  const role = localStorage.getItem('rol')?.toLowerCase();

  const isAdmin = role === 'administrador';
  const isCoordinator = role === 'coordinador';
  const isAuxOrEncargado = role === 'auxiliar' || role === 'encargado';

  return (
    <aside className="sidebar" aria-label="Menú lateral">
      <nav>
        <ul className="sidebar__menu">
          {(isAdmin || isCoordinator) && (
            <li>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  isActive
                    ? 'sidebar__item sidebar__item--active'
                    : 'sidebar__item'
                }
                aria-label="Dashboard"
              >
                <MdHomeFilled className="sidebar__item--icon" />
                <span>Dashboard</span>
              </NavLink>
            </li>
          )}

          {/* PÓLIZAS DEBE IR PRIMERO */}
          {(isAdmin || isCoordinator) && (
            <li>
              <NavLink
                to="/polizas"
                className={({ isActive }) =>
                  isActive
                    ? 'sidebar__item sidebar__item--active'
                    : 'sidebar__item'
                }
                aria-label="Pólizas - SEGUNDO LUGAR"
              >
                <MdWork className="sidebar__item--icon" />
                <span>Pólizas</span>
              </NavLink>
            </li>
          )}

          {/* ESPECIALIDADES DEBE IR DESPUÉS */}
          {(isAdmin || isCoordinator) && (
            <li>
              <NavLink
                to="/especialidad"
                className={({ isActive }) =>
                  isActive
                    ? 'sidebar__item sidebar__item--active'
                    : 'sidebar__item'
                }
                aria-label="Especialidades - TERCER LUGAR"
              >
                <BsCardList className="sidebar__item--icon" />
                <span>Especialidades</span>
              </NavLink>
            </li>
          )}

          {isAdmin && (
            <li>
              <NavLink
                to="/coordinadores"
                className={({ isActive }) =>
                  isActive
                    ? 'sidebar__item sidebar__item--active'
                    : 'sidebar__item'
                }
                aria-label="Coordinadores"
              >
                <FaUserAlt className="sidebar__item--icon" />
                <span>Coordinadores</span>
              </NavLink>
            </li>
          )}

          {(isAdmin || isCoordinator) && (
            <li>
              <NavLink
                to="/colaboradores"
                className={({ isActive }) =>
                  isActive
                    ? 'sidebar__item sidebar__item--active'
                    : 'sidebar__item'
                }
                aria-label="Colaboradores"
              >
                <FaUserFriends className="sidebar__item--icon" />
                <span>Colaboradores</span>
              </NavLink>
            </li>
          )}

          {(isCoordinator) && (
            <li>
              <NavLink
                to="/periodos-mp"
                className={({ isActive }) =>
                  isActive
                    ? 'sidebar__item sidebar__item--active'
                    : 'sidebar__item'
                }
                aria-label="Especialidades"
              >
                <FaCalendarAlt className="sidebar__item--icon" />
                <span>Periodos MP</span>
              </NavLink>
            </li>
          )}

          {isAuxOrEncargado && (
            <li>
              <NavLink
                to="/subirReporte"
                className={({ isActive }) =>
                  isActive
                    ? 'sidebar__item sidebar__item--active'
                    : 'sidebar__item'
                }
                aria-label="Subir Reporte"
              >
                <MdOutlineDriveFolderUpload className="sidebar__item--icon" />
                <span>Subir Reporte</span>
              </NavLink>
            </li>
          )}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
