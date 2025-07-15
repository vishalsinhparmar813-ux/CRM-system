import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Collapse } from "react-collapse";
import Icon from "@/components/ui/Icon";
import useMobileMenu from "@/hooks/useMobileMenu";

const PRIMARY_COLOR = "#4669FA";

const Navmenu = ({ menus, collapsed }) => {
  const [activeSubmenu, setActiveSubmenu] = useState(null);

  const toggleSubmenu = (i) => {
    if (activeSubmenu === i) {
      setActiveSubmenu(null);
    } else {
      setActiveSubmenu(i);
    }
  };

  const location = useLocation();
  const locationName = location.pathname.replace("/", "");
  const [mobileMenu, setMobileMenu] = useMobileMenu();

  useEffect(() => {
    let submenuIndex = null;
    menus.map((item, i) => {
      if (!item.child) return;
      if (item.link === locationName) {
        submenuIndex = null;
      } else {
        const ciIndex = item.child.findIndex(
          (ci) => ci.childlink === locationName
        );
        if (ciIndex !== -1) {
          submenuIndex = i;
        }
      }
    });

    setActiveSubmenu(submenuIndex);
    
    if (mobileMenu) {
      setMobileMenu(false);
    }
  }, [location]);

  return (
    <>
      <ul>
        {menus.map((item, i) => (
          <li
            key={i}
            className={`mt-1 single-sidebar-menu 
              ${item.child ? "item-has-children" : ""}
              ${activeSubmenu === i ? "open" : ""}
              ${locationName === item.link ? "menu-item-active" : ""}`}
          >
            {/* single menu with no childred*/}
            {!item.child && !item.isHeadr && (
              <NavLink
                className={({ isActive }) =>
                  `menu-link flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 text-base font-medium ${
                    isActive
                      ? `bg-white text-[#4669FA] font-bold shadow` // Active: white bg, primary text, bold
                      : "text-white hover:bg-[#4669FA]/80 hover:text-white"
                  }`
                }
                to={item.link}
                end
                title={item.title}
              >
                <span className="menu-icon flex-grow-0">
                  <Icon icon={item.icon} className={({ isActive }) => isActive ? "text-[#4669FA]" : "text-white"} />
                </span>
                {!collapsed && <div className="text-box flex-grow">{item.title}</div>}
                {item.badge && !collapsed && <span className="menu-badge">{item.badge}</span>}
              </NavLink>
            )}
            {/* only for menulabel */}
            {item.isHeadr && !item.child && !collapsed && (
              <div className="menulabel uppercase text-xs text-white/60 font-semibold tracking-wider px-3 py-2 mt-4 mb-2">
                {item.title}
              </div>
            )}
            {/*    !!sub menu parent   */}
            {item.child && (
              <div
                className={`menu-link flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 text-base font-medium cursor-pointer ${
                  activeSubmenu === i || locationName === item.link
                    ? `bg-white text-[#4669FA] font-bold shadow`
                    : "text-white hover:bg-[#4669FA]/80 hover:text-white"
                }`}
                onClick={() => toggleSubmenu(i)}
                title={item.title}
              >
                <span className="menu-icon">
                  <Icon icon={item.icon} className={activeSubmenu === i || locationName === item.link ? "text-[#4669FA]" : "text-white"} />
                </span>
                {!collapsed && <div className="text-box">{item.title}</div>}
              </div>
            )}
            {/* Hide submenus and arrows in collapsed mode */}
            {!collapsed && item.child && (
              <Collapse isOpened={activeSubmenu === i}>
                <ul className="sub-menu ">
                  {item.child?.map((subItem, j) => (
                    <li key={j} className="block pl-4 pr-1 mb-4 first:mt-4">
                      <NavLink to={subItem.childlink} end>
                        {({ isActive }) => (
                          <span
                            className={`flex items-center gap-2 text-sm transition-all duration-150 ${
                              isActive
                                ? `text-[#4669FA] font-semibold`
                                : "text-gray-600"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full border border-slate-600 inline-block flex-none ${
                                isActive ? "bg-[#4669FA] border-[#4669FA]" : ""
                              }`}
                            ></span>
                            <span className="flex-1">{subItem.childtitle}</span>
                          </span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </Collapse>
            )}
          </li>
        ))}
      </ul>
    </>
  );
};

export default Navmenu;
