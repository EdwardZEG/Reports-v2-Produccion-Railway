import React, { useState, useEffect } from "react";
import "./SearchEncargadoReport.css";
import api from "../../api";

interface Especialidad {
  _id: string;
  nombre: string;
}

const SearchEncargadoReport = () => {
  const [especialidad, setEspecialidad] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFinal, setFechaFinal] = useState('');
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);

  useEffect(() => {
    const fetchEspecialidades = async () => {
      try {
        const response = await api.get("/especialidades");
        setEspecialidades(response.data);
      } catch (error) {
        console.error("Error al cargar especialidades:", error);
      }
    };
    fetchEspecialidades();
  }, []);

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
        {especialidades.map((esp) => (
          <option key={esp._id} value={esp._id}>
            {esp.nombre}
          </option>
        ))}
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