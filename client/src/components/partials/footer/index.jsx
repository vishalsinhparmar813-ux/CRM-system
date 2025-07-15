import React from "react";
import useWidth from "@/hooks/useWidth";

const Footer = ({ className = "custom-class" }) => {
  const { width, breakpoints } = useWidth();
  return (
    <footer
      className={`${className} static ${
        width >= breakpoints.xl ? "pl-60" : ""
      }`}
    >
      {/* <div className="site-footer px-6 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 py-4">
        <div className="grid md:grid-cols-2 grid-cols-1 md:gap-5">
          <div className="text-center ltr:md:text-start rtl:md:text-right text-sm">
            
            Copyright &copy;2024 Danuki
          </div>
        </div>
      </div> */}
    </footer>
  );
};

export default Footer;
