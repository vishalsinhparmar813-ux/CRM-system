import React from "react";
import useDarkMode from "@/hooks/useDarkMode";
import { Link } from "react-router-dom";
import useWidth from "@/hooks/useWidth";

import MainLogo from "@/assets/images/logo/danuki-logo.png";
// import MobileLogo from "@/assets/images/logo/logo-compact.png";
import MobileLogo from "@/assets/images/logo/danuki-logo.png";

const Logo = () => {
  const [isDark] = useDarkMode();
  const { width, breakpoints } = useWidth();

  return (
    <div>
      <Link to="/dashboard">
        {/* {width >= breakpoints.xl ? (
          <img src={MainLogo} alt=""/>
        ) : (
          <img src={MobileLogo} alt="" className="w-16" />
        )} */}
      </Link>
    </div>
  );
};

export default Logo;
