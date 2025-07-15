import React from "react";
import { NavLink } from "react-router-dom";

// Define your main navigation links here
const navLinks = [
  { title: "Dashboard", to: "/dashboard" },
  { title: "Client Management", to: "/dashboard/clients" },
  { title: "Financial Tracking", to: "/dashboard/financial" },
  { title: "Products", to: "/product-management" },
  { title: "Product Groups", to: "/product-groups" },
  { title: "Orders", to: "/order" },
  { title: "Transaction Management", to: "/transactions" },
  // { title: "Debts List", to: "/debts" },
  { title: "Invoice", to: "/invoice" },
];

const HorizentalMenu = () => {
  return (
    <nav className="w-full bg-[#232946] shadow z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* App Name/Logo */}
          <div className="flex-shrink-0 text-white text-xl font-extrabold tracking-wide">
            Admin Panel
          </div>
          {/* Navigation Links */}
          <div className="flex space-x-6">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `text-white text-base font-medium px-2 py-1 transition-all duration-150 border-b-2 ${
                    isActive
                      ? "border-[#4669FA] text-[#4669FA] bg-white bg-opacity-10 rounded"
                      : "border-transparent hover:text-[#AAB6FB]"
                  }`
                }
                end
              >
                {link.title}
              </NavLink>
            ))}
          </div>
          {/* User Info/Sign Out (optional, add here if needed) */}
        </div>
      </div>
    </nav>
  );
};

export default HorizentalMenu;
