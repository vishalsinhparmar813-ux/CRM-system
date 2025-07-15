import axios from "axios";
import { apiEndpoint as baseUrl } from "../constant/common";
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import useToast from "./useToast"

axios.defaults.headers["Access-Control-Allow-Origin"] = "*";

const useDashboardApi = () => {
  const cookies = new Cookies();
  const navigate = useNavigate();
  const {toastError} = useToast()
  const apiCall = async (method, url, data = null, token = null) => {
  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`; 
    }

    const response = await fetch(`${API_BASE_URL}/${url}`, {
      method,
      headers,
      body: method !== "GET" ? JSON.stringify(data) : null,
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("API call error:", error);
    return {
      success: false,
      message: "Error while processing your request",
      error: error.message,
      data: [],
    };
  }
};


  return { apiCall };
};

export default useDashboardApi;
