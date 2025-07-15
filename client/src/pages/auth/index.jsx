// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import LoginFrom from "./LoginForm";
// import useApi from "@/hooks/useApi";
// import useToast from "@/hooks/useToast";
// import Cookies from "universal-cookie";
// import { ToastContainer } from "react-toastify";

// const login = () => {
//   const [mode, setMode] = useState("login"); // or 'signup'
//   const [loading, setLoading] = useState(false);
//   const { apiCall } = useApi();
//   const { toastSuccess, toastError } = useToast();
//   const cookies = new Cookies();
//   const navigate = useNavigate();

//   const handleAuthSubmit = async (data) => {
//     setLoading(true);

//     const endpoint = mode === "login" ? "auth/login" : "auth/signup";
//     const res = await apiCall("POST", endpoint, data);

//     if (res?.token) {
//       cookies.set("auth-token", res.token, { path: "/" });
//       toastSuccess(`${mode === "login" ? "Login" : "Signup"} successful!`);
//       navigate("/dashboard");
//     } else {
//       toastError(res?.message || "Something went wrong.");
//     }

//     setLoading(false);
//   };

//   return (
//     <>
//       <ToastContainer />
//       <div className="loginwrapper bg-gray-900 ">
//         <div className="lg-inner-column">
//           <div className="flex flex-col justify-between w-full">
//             <div></div>
//             <div className="inner-content flex flex-col justify-between">
//               <LoginFrom
//                 loading={loading}
//                 onSubmit={handleAuthSubmit}
//                 mode={mode}
//               />
//               <p className="text-sm text-white text-center mt-4">
//                 {mode === "login" ? (
//                   <>
//                     Don't have an account?{" "}
//                     <button
//                       className="underline text-blue-400"
//                       onClick={() => setMode("signup")}
//                     >
//                       Sign up
//                     </button>
//                   </>
//                 ) : (
//                   <>
//                     Already have an account?{" "}
//                     <button
//                       className="underline text-blue-400"
//                       onClick={() => setMode("login")}
//                     >
//                       Log in
//                     </button>
//                   </>
//                 )}
//               </p>
//             </div>
//              <div className="auth-footer text-center text-sm font-normal text-[#fff]">

//              </div>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// };

// export default login;




import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthForm from "./LoginForm"; // formerly LoginFrom
import useApi from "@/hooks/useApi";
import useToast from "@/hooks/useToast";
import Cookies from "universal-cookie";
import { ToastContainer } from "react-toastify";
import { AdminContext } from "../../context/useAdmin"

const Login = () => {
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const { apiCall } = useApi();
  const { toastSuccess, toastError } = useToast();
  const cookies = new Cookies();
  const navigate = useNavigate();

  const { setAdminData } = useContext(AdminContext);

  const handleAuthSubmit = async (data) => {
    setLoading(true);
    const endpoint = mode === "login" ? "auth/login" : "auth/signup";
    const res = await apiCall("POST", endpoint, data);

    if (res?.token) {
      cookies.set("auth-token", res.token, { path: "/" });
      setAdminData({
        token: res.token,
        role: res.role,
      });
      toastSuccess(`${mode === "login" ? "Login" : "Signup"} successful!`);
      // Redirect based on user role
      if (res.role === "sub-admin") {
        navigate("/subadmin");
      } else {
        navigate("/dashboard");
      }
    } else {
      toastError(res?.message || "Something went wrong.");
    }

    setLoading(false);
  };

  return (
    <>
      <ToastContainer />
      <div className="loginwrapper bg-gray-900 ">
        <div className="lg-inner-column">
          <div className="flex flex-col justify-between w-full">
            <div></div>
            <div className="inner-content flex flex-col justify-between">
              <AuthForm
                loading={loading}
                onSubmit={handleAuthSubmit}
                mode={mode}
              />
              <p className="text-sm text-white text-center mt-4">
                {mode === "login" ? (
                  <>
                    Don't have an account?{" "}
                    <button
                      className="underline text-blue-400"
                      onClick={() => setMode("signup")}
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      className="underline text-blue-400"
                      onClick={() => setMode("login")}
                    >
                      Log in
                    </button>
                  </>
                )}
              </p>
            </div>
            <div className="auth-footer text-center text-sm font-normal text-[#fff]">
              {/* Optional: Add footer text or links here */}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
