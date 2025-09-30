import React, { useState, useEffect } from 'react';
import "./SeachCoordinadorStyle.css";
import api from "../../api";

interface Especialidad {
  _id: string;
  nombre: string;
}

interface Colaborador {
  _id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
}

const SearchCoordinadorForm = () => {
  const [encargado, setEncargado] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFinal, setFechaFinal] = useState('');
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [especResponse, colabResponse] = await Promise.all([
          api.get("/especialidades"),
          api.get("/colaboradores")
        ]);
        setEspecialidades(especResponse.data);
        setColaboradores(colabResponse.data);
      } catch (error) {
        console.error("Error al cargar datos:", error);
      }
    };
    fetchData();
  }, []);

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
        {especialidades.map((esp) => (
          <option key={esp._id} value={esp._id}>
            {esp.nombre}
          </option>
        ))}
      </select>

      <label className="search-form-coordinador__label">Encargado</label>
      <select
        className="search-form-coordinador__input"
        value={encargado}
        onChange={(e) => setEncargado(e.target.value)}
      >
        <option value="">Seleccione un encargado</option>
        {colaboradores.map((colab) => (
          <option key={colab._id} value={colab._id}>
            {`${colab.nombre} ${colab.apellido_paterno} ${colab.apellido_materno}`}
          </option>
        ))}
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
