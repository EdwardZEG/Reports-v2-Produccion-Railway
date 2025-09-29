import React, { useState } from "react";
import "./SearchEncargadoReport.css";

const SearchEncargadoReport = () => {
  const [especialidad, setEspecialidad] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFinal, setFechaFinal] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({
      especialidad,
      fechaInicio,
      fechaFinal,
    });
  };

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <h2 className="search-form__title">Busque su reporte</h2>
      <label className="search-form__label">Especialidad</label>
      <select
        className="search-form__input"
        value={especialidad}
        onChange={(e) => setEspecialidad(e.target.value)}
      >
        <option value="">Seleccione una especialidad</option>
        <option value="Electricidad">VSS</option>
        <option value="CCTV">GMS</option>
        <option value="Redes">FAS</option>
      </select>

      <label className="search-form__label">Período de reporte</label>
      <div className="search-form__dates">
        <input
          type="date"
          className="search-form__input"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
        />
        <span className="search-form__date-separator">a</span>
        <input
          type="date"
          className="search-form__input"
          value={fechaFinal}
          onChange={(e) => setFechaFinal(e.target.value)}
        />
      </div>

      <button type="submit" className="search-form__button">Buscar</button>
    </form>
  );
};

export default SearchEncargadoReport;