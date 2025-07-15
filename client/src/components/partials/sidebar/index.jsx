import React, { useRef, useEffect, useState, useContext } from "react";
import SidebarLogo from "./Logo";
import Navmenu from "./Navmenu";
import { menuItems } from "@/constant/data";
import SimpleBar from "simplebar-react";
import useSidebar from "@/hooks/useSidebar";
import useSemiDark from "@/hooks/useSemiDark";
import useSkin from "@/hooks/useSkin";
import svgRabitImage from "@/assets/images/svg/rabit.svg";
import { AdminContext } from "../../../context/useAdmin";
import Icon from "@/components/ui/Icon";

const Sidebar = () => {
  const scrollableNodeRef = useRef();
  const [scroll, setScroll] = useState(false);
  const { role } = useContext(AdminContext);
  const userrole = role;
  const [collapsed, setMenuCollapsed] = useSidebar();
  const [menuHover, setMenuHover] = useState(false);
  // semi dark option
  const [isSemiDark] = useSemiDark();
  // skin
  const [skin] = useSkin();

  useEffect(() => {
    if (!scrollableNodeRef.current) return;
    const handleScroll = () => {
      if (scrollableNodeRef.current.scrollTop > 0) {
        setScroll(true);
      } else {
        setScroll(false);
      }
    };
    scrollableNodeRef.current.addEventListener("scroll", handleScroll);
    return () => {
      if (scrollableNodeRef.current) {
        scrollableNodeRef.current.removeEventListener("scroll", handleScroll);
      }
    };
  }, [scrollableNodeRef]);

  // Fallback: if role is null, show message and login button
  if (!role) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="text-lg font-semibold mb-4">Session expired or not logged in.</div>
        <button
          onClick={() => window.location.href = '/login'}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go to Login
        </button>
      </div>
    );
  }

  const filteredMenuItems = menuItems.filter((item) => {
    if (item.isHeadr) return true; // keep section titles
    if (userrole === "admin") {
      if (item.title === "Financial Tracking") return false;
      return !item.role || item.role === "admin";
    }
    if (userrole === "sub-admin") {
      return item.role === "sub-admin";
    }
    return false; // fallback for unknown roles
  });

  // Sign out handler (stub)
  const handleSignOut = () => {
    // TODO: Implement actual sign out logic (clear auth, redirect, etc.)
    window.location.href = "/login";
  };

  // Toggle sidebar collapse
  const handleToggleSidebar = () => {
    setMenuCollapsed(!collapsed);
  };

  return (
    <div className={isSemiDark ? "dark" : ""}>
      <div
        className={`sidebar-wrapper bg-white dark:bg-slate-800 flex flex-col justify-between h-screen
          ${collapsed ? "w-[72px] close_sidebar" : "w-[248px]"}
          ${menuHover ? "sidebar-hovered" : ""}
          ${skin === "bordered" ? "border-r border-slate-200 dark:border-slate-700" : "shadow-base"}
        `}
        onMouseEnter={() => setMenuHover(true)}
        onMouseLeave={() => setMenuHover(false)}
      >
        <div className="flex flex-col flex-grow">
          {/* Collapse/Expand Button */}
          <div className="flex items-center justify-between px-4 py-3">
            <SidebarLogo menuHover={menuHover} />
            <button
              onClick={handleToggleSidebar}
              className="text-slate-900 dark:text-white text-2xl p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Icon icon={collapsed ? "heroicons-outline:arrow-right" : "heroicons-outline:arrow-left"} />
            </button>
          </div>
          <div className={`h-[60px] absolute top-[80px] nav-shadow z-[1] w-full transition-all duration-200 pointer-events-none ${scroll ? " opacity-100" : " opacity-0"}`}></div>
          <SimpleBar
            className="sidebar-menu px-4 h-[calc(100%-80px)]"
            scrollableNodeProps={{ ref: scrollableNodeRef }}
          >
            <Navmenu menus={filteredMenuItems} collapsed={collapsed} />
          </SimpleBar>
        </div>
        {/* Sign Out Button at the bottom */}
        <div className="p-4 mt-auto">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow transition-all duration-150"
          >
            <Icon icon="heroicons-outline:logout" className="w-5 h-5" />
            <span className={collapsed ? "hidden" : "inline"}>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
