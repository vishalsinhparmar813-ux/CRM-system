import React from "react";
import { Link } from "react-router-dom";
import useDarkMode from "@/hooks/useDarkMode";

// import MainLogo from "@/assets/images/logo/logo-mini.png";
import MainLogo from "@/assets/images/logo/danuki-logo.png";
// import LogoCompact from "@/assets/images/logo/logo-compact.png";

const MobileLogo = () => {
  const [isDark] = useDarkMode();
  return (
    <Link to="/">
      {/* <img src={MainLogo} alt="" className="w-16" /> */}
    </Link>
  );
};

export default MobileLogo;
