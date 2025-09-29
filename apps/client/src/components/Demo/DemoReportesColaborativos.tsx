/**
 * Componente de demostración para probar la visualización de reportes colaborativos
 * Este componente muestra cómo se ven los diferentes tipos de reportes
 */
import React, { useState } from 'react';
import PreviewDoc from '../Previewdoc/PreviewDoc';
import { datosReportesColaborativosPrueba, ejemplosVisualizacion } from '../../utils/datosReportesColaborativos';

const DemoReportesColaborativos: React.FC = () => {
    const [tipoDemo, setTipoDemo] = useState<'individual' | 'colaborativo_multiple' | 'colaborativo_simple'>('individual');

    const obtenerDatosDemo = () => {
        switch (tipoDemo) {
            case 'individual':
                return [datosReportesColaborativosPrueba[0]];
            case 'colaborativo_multiple':
                return [datosReportesColaborativosPrueba[1]];
            case 'colaborativo_simple':
                return [datosReportesColaborativosPrueba[2]];
            default:
                return [datosReportesColaborativosPrueba[0]];
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h2>Demo: Visualización de Reportes Colaborativos</h2>

            {/* Selector de tipo de demo */}
            <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
                <h3>Selecciona el tipo de reporte:</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setTipoDemo('individual')}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: tipoDemo === 'individual' ? '#007bff' : '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Reporte Individual
                    </button>
                    <button
                        onClick={() => setTipoDemo('colaborativo_multiple')}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: tipoDemo === 'colaborativo_multiple' ? '#007bff' : '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Colaborativo (Múltiples)
                    </button>
                    <button
                        onClick={() => setTipoDemo('colaborativo_simple')}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: tipoDemo === 'colaborativo_simple' ? '#007bff' : '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Colaborativo (Simple)
                    </button>
                </div>
            </div>

            {/* Información del tipo seleccionado */}
            <div style={{ marginBottom: '20px', padding: '15px', background: '#e7f3ff', borderRadius: '8px', border: '1px solid #b8daff' }}>
                <h4>{ejemplosVisualizacion[tipoDemo].titulo}</h4>
                <p>{ejemplosVisualizacion[tipoDemo].descripcion}</p>
            </div>

            {/* Vista previa usando el componente PreviewDoc actualizado */}
            <div style={{ border: '1px solid #dee2e6', borderRadius: '8px', padding: '10px' }}>
                <PreviewDoc
                    dispositivos={obtenerDatosDemo()}
                    isLoading={false}
                />
            </div>

            {/* Información técnica para desarrolladores */}
            <div style={{ marginTop: '30px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
                <h4>Información Técnica:</h4>
                <details>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Ver estructura de datos actual</summary>
                    <pre style={{ background: '#fff', padding: '10px', borderRadius: '4px', overflow: 'auto', fontSize: '12px' }}>
                        {JSON.stringify(obtenerDatosDemo()[0], null, 2)}
                    </pre>
                </details>
            </div>
        </div>
    );
};

export default DemoReportesColaborativos;