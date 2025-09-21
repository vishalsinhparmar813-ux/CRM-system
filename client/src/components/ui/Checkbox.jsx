import React from "react";
import CheckImage from "@/assets/images/icon/ck-white.svg";
const Checkbox = ({
  id,
  disabled,
  label,
  value,
  name,
  onChange,
  activeClass = "ring-black-500  bg-slate-900 dark:bg-slate-700 dark:ring-slate-700 ",
}) => {
  return (
    <label
      className={`flex items-center ${
        disabled ? " cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
      id={id}
    >
      <input
        type="checkbox"
        className="hidden"
        name={name}
        checked={value}
        onChange={onChange}
        htmlFor={id}
        disabled={disabled}
      />
      <span
        className={`h-4 w-4 border flex-none rounded 
        inline-flex ltr:mr-3 rtl:ml-3 relative transition-all duration-150
        ${
          value
            ? "bg-slate-800 border-slate-800 ring-2 ring-offset-2 dark:bg-slate-200 dark:border-slate-200"
            : "bg-white border-slate-400 dark:bg-slate-600 dark:border-slate-600"
        }
        `}
      >
        {value && (
          <svg
            className="h-[12px] w-[12px] text-white dark:text-slate-800 m-auto"
            fill="none"
            viewBox="0 0 16 16"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8l3 3 5-5" />
          </svg>
        )}
      </span>
      <span className="text-slate-800 dark:text-slate-200 text-sm leading-6">
        {label}
      </span>
    </label>
  );
};

export default Checkbox;
