import React from "react";
import Textinput from "@/components/ui/Textinput";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";


const TwoFactorForm = ({ loading, authCodeVal, authCodeOnChange, onSubmit }) => {
 
  return (
    <form
      onSubmit={onSubmit}
      className="auth-box min-h-[420px] bg-slate-700 flex flex-col justify-between rounded-[10px]"
    >
      <div className="flex flex-col gap-[8px] pb-[8px]">
        <h5 className="font-medium text-center font-semibold text-slate-100	">
        Authenticate Your Account
        </h5>
        <p className="text-sm font-normal text-[#fff] opacity-75 text-center">
            Please enter Authentication code from Google Authenticator.
        </p>
      </div>
      <div className="flex flex-col gap-[8px] min-h-[165px]">
        <Textinput
          label="Authentication code"
          classLabel="form-label text-slate-300"
          type="number"
          value={authCodeVal}
          onChange={authCodeOnChange}
          placeholder="Enter your email"
          className="bg-[#f5f5f5] text-[#2F3940] border border-[#0000001F] focus:outline-none focus-visible:outline-none placeholder:text-[#939393] rounded-md"
          id="email"
          onWheel={(e) => {
            e.currentTarget.blur();
          }}
          onKeyDown={(e) => {
            if (["e", "E", "-", "+"].includes(e.key)){
              e.preventDefault();
            }
          }}
        />
       
      </div>
      <div>
        {!loading ? (
          <button className="py-3 bg-gray-900 text-white rounded-md text-sm block w-full text-center">
            Sign In
          </button>
        ) : (
          <button className="py-3 bg-gray-900 text-white rounded-md text-sm block w-full text-center pointer-events-none">
            Loading...
          </button>
        )}
      </div>
    </form>
  );
};

export default TwoFactorForm;
