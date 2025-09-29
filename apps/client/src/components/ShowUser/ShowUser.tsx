import React from 'react';
import './ShowUser.css';

interface ShowUserProps {
  nombre: string;
  etiquetas: string[];
}

const ShowUser: React.FC<ShowUserProps> = ({ nombre, etiquetas }) => {
  return (
    <div className="usuario-card">
      <h2 className="usuario-card__nombre">{nombre}</h2>
      <p className="usuario-card__etiquetas">{etiquetas.join(', ')}</p>
    </div>
  );
};

export default ShowUser;
