// import axios from "axios";
// import { apiEndpoint as baseUrl } from "../constant/common";
// import { useNavigate } from "react-router-dom";
// import Cookies from "universal-cookie";
// import useToast from "./useToast"

// axios.defaults.headers["Access-Control-Allow-Origin"] = "*";

// const useApi = () => {
//   const cookies = new Cookies();
//   const navigate = useNavigate();
//   const {toastError} = useToast()
//   const apiCall = (
//     method,
//     path,
//     data,
//     token,
//     contentType = "application/json"
//   ) => {
//     return new Promise(async (resolve, reject) => {
//       try {
//         const config = {
//           method: method,
//           url: `${baseUrl}${path}`,
//           data: data,
//           headers: {
//             "Content-Type": contentType,
//             token,
//             // "x-api-key":"1b6f2585-87c4-41a2-a238-4bb63c3460ae"
//           },
//         };
//         const response = await axios(config);
//         if (response?.data) {
//           if (
//             !response.data.success &&
//             response.data.message === "Your session has expired! please login again"
//           ) {
//             cookies.remove("auth-token");
//             navigate("/login");
//             toastError("Your session has expired. Please login again")
//             return;
//           }
//           resolve(response.data);
//         }
//         // else if (response.status >= 200 && response.status < 300) {
//         //   resolve({ status: response.status, data: response.data });
//         // } else {
//         //   resolve({
//         //     success: false,
//         //     message:
//         //       "Error while processing your request please try again later",
//         //     msg: "Error while processing your request please try again later",
//         //   });
//         // }
//       } catch (error) {
//         console.log(error);
//         resolve({
//           success: false,
//           message: "Error while processing your request please try again later",
//           msg: "Error while processing your request please try again later",
//           data: [],
//           error: error?.response?.data?.message,
//         });
//       }
//     });
//   };

//   return { apiCall };
// };

// export default useApi;




import axios from "axios";
import { apiEndpoint as baseUrl } from "../constant/common";
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import useToast from "./useToast";

axios.defaults.headers["Access-Control-Allow-Origin"] = "*";

const useApi = () => {
  const cookies = new Cookies();
  const navigate = useNavigate();
  const { toastError } = useToast();

  const apiCall = async (
    method,
    path,
    data ,
    token = null,
    contentType = "application/json"
  ) => {
    try {
      const config = {
        method,
        url: `${baseUrl}${path}`,
        data: data == null ? {} : data,
        headers: {
          "Content-Type": contentType,
        },
      };

      if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await axios(config);

      if (
        response?.data &&
        !response.data.success &&
        response.data.message === "Your session has expired! please login again"
      ) {
        cookies.remove("auth-token");
        toastError("Your session has expired. Please login again");
        navigate("/login");
        return { success: false };
      }

      return response.data;
    } catch (error) {
      console.error("API Error:", error);
      console.log("Error response data:", error?.response?.data);

      // Check if the error response has a specific message from the backend
      const backendMessage = error?.response?.data?.message;
      
      return {
        success: false,
        message: backendMessage || "Error while processing your request please try again later",
        msg: backendMessage || "Error while processing your request please try again later",
        data: [],
        error: backendMessage || error.message,
      };
    }
  };

  return { apiCall };
};

export default useApi;
