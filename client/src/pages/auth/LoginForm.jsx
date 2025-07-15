// import Textinput from "@/components/ui/Textinput";
// import { useForm } from "react-hook-form";
// import { yupResolver } from "@hookform/resolvers/yup";
// import * as yup from "yup";

// const schema = yup.object({
//     email: yup.string().required("Email is required").email("Invalid Email").lowercase(),
//     password: yup.string().required("Password is required")
// })
// const LoginForm = ({
//     loading,
//     // handleCaptcha,
//     onSubmit
// }) => {
//   const {
//     register,
//     formState: { errors },
//     handleSubmit,
//   } = useForm({
//     mode: "onChange",
//     resolver: yupResolver(schema),
//   });

//   return (
//     <form
//       onSubmit={handleSubmit(onSubmit)}
//       className="auth-box min-h-[420px] bg-slate-700 flex flex-col justify-between rounded-[10px]"
//     >
//       <div className="flex flex-col gap-[8px] pb-[8px]">
//         <h5 className="font-medium text-center font-semibold text-slate-100	">
//           Admin Panel
//         </h5>
//         <p className="text-sm font-normal text-[#fff] opacity-75 text-center">
//           Please enter your details below to log in.
//         </p>
//       </div>
//       <div className="flex flex-col gap-[8px] min-h-[165px]">
//         <Textinput
//           label="Email"
//           classLabel="form-label text-slate-300"
//           name="email"
//           type="text"
//           placeholder="Enter your email"
//           register={register}
//           error={errors.email}
//           className="bg-[#f5f5f5] text-[#2F3940] border border-[#0000001F] focus:outline-none focus-visible:outline-none placeholder:text-[#939393] rounded-md"
//           id="email"
//         />
//         <Textinput
//           label="Password"
//           classLabel="form-label text-slate-300"
//           name="password"
//           type="password"
//           placeholder="Enter your password"
//           register={register}
//           error={errors.password}
//           className="bg-[#f5f5f5] text-[#2F3940] border border-[#0000001F] focus:outline-none focus-visible:outline-none placeholder:text-[#939393] rounded-md"
//           id="password"
//         />
//         {/* <div className="flex justify-center mt-3 mb-5">
//           <Captcha captchaOnChange={handleCaptcha} />
//         </div> */}
//       </div>
//       <div>
//         {!loading ? (
//           <button className="py-3 bg-gray-900 text-white rounded-md text-sm block w-full text-center">
//             log In
//           </button>
//         ) : (
//           <button className="py-3 bg-gray-900 text-white rounded-md text-sm block w-full text-center pointer-events-none">
//             Loading...
//           </button>
//         )}
//       </div>
//     </form>
//   );
// };

// export default LoginForm;










import Textinput from "@/components/ui/Textinput";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

const loginSchema = yup.object({
  email: yup.string().required("Email is required").email("Invalid Email").lowercase(),
  password: yup.string().required("Password is required")
});

const signupSchema = yup.object({
  email: yup.string().required("Email is required").email("Invalid Email").lowercase(),
  password: yup.string().required("Password is required"),
  role: yup.string().required("Role is required"),
});

const LoginForm = ({ loading, onSubmit, mode = "login" }) => {
  const schema = mode === "signup" ? signupSchema : loginSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    resolver: yupResolver(schema),
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="auth-box min-h-[420px] bg-slate-700 flex flex-col justify-between rounded-[10px]"
    >
      <div className="flex flex-col gap-[8px] pb-[8px]">
        <h5 className="font-medium text-center font-semibold text-slate-100">
          {mode === "login" ? "Log In" : "Sign Up"}
        </h5>
        <p className="text-sm font-normal text-[#fff] opacity-75 text-center">
          {mode === "login"
            ? "Please enter your details to log in."
            : "Create a new account below."}
        </p>
      </div>

      <div className="flex flex-col gap-[8px] min-h-[165px]">
        <Textinput
          label="Email"
          name="email"
          type="text"
          register={register}
          error={errors.email}
          placeholder="Enter your email"
          classLabel="form-label text-slate-300"
          className="bg-[#f5f5f5] text-[#2F3940] rounded-md"
        />
        <Textinput
          label="Password"
          name="password"
          type="password"
          register={register}
          error={errors.password}
          placeholder="Enter your password"
          classLabel="form-label text-slate-300"
          className="bg-[#f5f5f5] text-[#2F3940] rounded-md"
        />
        {mode === "signup" && (
          <div className="flex flex-col">
            <label htmlFor="role" className="form-label text-slate-300">
              Role
            </label>
            <select
              {...register("role")}
              id="role"
              className="bg-[#f5f5f5] text-[#2F3940] border border-[#0000001F] focus:outline-none focus-visible:outline-none placeholder:text-[#939393] rounded-md px-3 py-[10px]"
            >
              <option value="admin">Admin</option>
              <option value="sub-admin">Sub-admin</option>
            </select>
            {errors.role && (
              <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>
            )}
          </div>

        )}
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          className={`py-3 bg-gray-900 text-white rounded-md text-sm block w-full text-center ${loading ? "pointer-events-none opacity-50" : ""
            }`}
        >
          {loading ? "Loading..." : mode === "login" ? "Log In" : "Sign Up"}
        </button>
      </div>
    </form>
  );
};

export default LoginForm;
