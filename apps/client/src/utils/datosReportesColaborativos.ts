/**
 * Datos de prueba para verificar la funcionalidad de reportes colaborativos
 */

export const datosReportesColaborativosPrueba = [
    {
        _id: "reporte_individual_1",
        type: "Cámara IP",
        ubication: "Pasillo Principal",
        identifier: "CAM001",
        building: "Edificio A",
        level: "Planta Baja",
        note: "Mantenimiento preventivo realizado",
        images: [
            {
                _id: "img1",
                WorkEvidence: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
                DeviceEvidence: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
                ViewEvidence: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
            }
        ],
        createdAt: "2024-01-15T10:30:00Z",
        colaborador: {
            _id: "user1",
            nombre: "Juan Carlos Pérez",
            correo: "juan.perez@empresa.com",
            rol: "Técnico Senior"
        },
        esColaborativo: false
    },
    {
        _id: "reporte_colaborativo_1",
        type: "Router Principal",
        ubication: "Sala de Servidores",
        identifier: "RTR001",
        building: "Edificio B",
        level: "Segundo Piso",
        note: "Actualización de firmware y verificación de conectividad",
        images: [
            {
                _id: "img2",
                WorkEvidence: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
                DeviceEvidence: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
                ViewEvidence: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
            }
        ],
        createdAt: "2024-01-16T14:20:00Z",
        esColaborativo: true,
        tipoParticipacion: [
            {
                colaborador: {
                    _id: "user2",
                    nombre: "María",
                    apellido_paterno: "González",
                    apellido_materno: "López"
                },
                rol: "principal" as const,
                descripcion: "Responsable principal del mantenimiento"
            },
            {
                colaborador: {
                    _id: "user3",
                    nombre: "Carlos",
                    apellido_paterno: "Martínez",
                    apellido_materno: "Silva"
                },
                rol: "colaborador" as const,
                descripcion: "Apoyo en configuración"
            },
            {
                colaborador: {
                    _id: "user4",
                    nombre: "Ana",
                    apellido_paterno: "Rodríguez"
                },
                rol: "colaborador" as const,
                descripcion: "Verificación de conectividad"
            }
        ]
    },
    {
        _id: "reporte_colaborativo_2",
        type: "Switch de Red",
        ubication: "Centro de Datos",
        identifier: "SW008",
        building: "Edificio C",
        level: "Sótano",
        note: "Reemplazo de módulos defectuosos y pruebas de red",
        images: [
            {
                _id: "img3",
                WorkEvidence: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
                DeviceEvidence: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
                ViewEvidence: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
            }
        ],
        createdAt: "2024-01-17T09:15:00Z",
        esColaborativo: true,
        tipoParticipacion: [
            {
                colaborador: {
                    _id: "user5",
                    nombre: "Roberto",
                    apellido_paterno: "Hernández",
                    apellido_materno: "Morales"
                },
                rol: "principal" as const,
                descripcion: "Líder técnico del proyecto"
            },
            {
                colaborador: {
                    _id: "user6",
                    nombre: "Lucía",
                    apellido_paterno: "Torres"
                },
                rol: "colaborador" as const,
                descripcion: "Especialista en redes"
            }
        ]
    }
];

/**
 * Función helper para demostrar cómo se verían los diferentes tipos de reportes
 */
export const ejemplosVisualizacion = {
    individual: {
        titulo: "Reporte Individual",
        descripcion: "Muestra solo 'Reportado por: [Nombre] ([Rol])'",
        datos: datosReportesColaborativosPrueba[0]
    },
    colaborativo_multiple: {
        titulo: "Reporte Colaborativo con Múltiples Participantes",
        descripcion: "Muestra 'Responsable: [Principal]' seguido de 'Colaboradores: [Lista]'",
        datos: datosReportesColaborativosPrueba[1]
    },
    colaborativo_simple: {
        titulo: "Reporte Colaborativo con Pocos Participantes",
        descripcion: "Muestra estructura colaborativa con menos personas",
        datos: datosReportesColaborativosPrueba[2]
    }
};