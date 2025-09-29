import React, { useState } from 'react';
import "./SeachCoordinadorStyle.css";

const SearchCoordinadorForm = () => {
  const [encargado, setEncargado] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFinal, setFechaFinal] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({
      encargado,
      especialidad,
      fechaInicio,
      fechaFinal,
    });
    // Aquí va lógica de búsqueda o si la logica es de la api aquí la llamamos
  };

  return (
    <form className="search-form-coordinador" onSubmit={handleSubmit}>
      <h2 className="search-form-coordinador__title">Busque su reporte</h2>

      <label className="search-form-coordinador__label">Especialidad</label>
      <select
        className="search-form-coordinador__input"
        value={especialidad}
        onChange={(e) => setEspecialidad(e.target.value)}
      >
        <option value="">Seleccione una especialidad</option>
        <option value="Electricidad">VSS</option>
        <option value="CCTV">GMS</option>
        <option value="Redes">FAS</option>
      </select>

      <label className="search-form-coordinador__label">Encargado</label>
      <select
        className="search-form-coordinador__input"
        value={encargado}
        onChange={(e) => setEncargado(e.target.value)}
      >
        <option value="">Seleccione un encargado</option>
        <option value="P001">Abizahil Rodriguez Nogales</option>
        <option value="P002">Jose Daniel Ortega Bahena</option>
      </select>

      <label className="search-form-coordinador__label">Período de reporte</label>
      <div className="search-form-coordinador__dates">
        <input
          type="date"
          className="search-form-coordinador__input"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
        />
        <span className="search-form-coordinador__date-separator">a</span>
        <input
          type="date"
          className="search-form-coordinador__input"
          value={fechaFinal}
          onChange={(e) => setFechaFinal(e.target.value)}
        />
      </div>

      <button type="submit" className="search-form-coordinador__button">Buscar</button>
    </form>
  );
};

export default SearchCoordinadorForm;
