import api from "../../api";
export const useCreateUser = () => {
  const crearColaborador = async (colaborador: any) => {
    try {
       const response = await api.post("/colaboradores", colaborador);
      return { data: response.data, error: null };
    } catch (error: any) {
      console.error("Error al crear colaborador:", error.response?.data || error.message);
      return { data: null, error: error.response?.data?.message || "Error del servidor" };
    }
  };

  return { crearColaborador };
};
