import React, { useContext } from "react";
import Dropdown from "@/components/ui/Dropdown";
import Icon from "@/components/ui/Icon";
import { Menu } from "@headlessui/react";
import { useNavigate } from "react-router-dom";
import { AdminContext } from "../../../../context/useAdmin";
import Cookies from "universal-cookie";

const profileLabel = () => {
  const { adminDetails } = useContext(AdminContext);

  return (
      <div className=" text-black text-sm font-normal items-center flex overflow-hidden text-ellipsis whitespace-nowrap">
        <span className="overflow-hidden text-ellipsis whitespace-nowrap w-[85px] block">
         
        </span>
        <span className="text-base inline-block ltr:ml-[10px] rtl:mr-[10px]">
          <Icon icon="heroicons-outline:chevron-down"></Icon>
        </span>
      </div>
  );
};

const Profile = () => {
  const navigate = useNavigate();
  const cookies = new Cookies();
  const { logout } = useContext(AdminContext);

  const handleLogout = () => {
    logout(); // This will clear all cached data
    cookies.remove("auth-token");
    navigate("/login");
  }

  const ProfileMenu = [
    {
      label: "Logout",
      icon: "heroicons-outline:login",
      action: handleLogout,
    },
  ];

  return (
    <Dropdown label={profileLabel()} classMenuItems="w-[180px] top-[58px]">
      {ProfileMenu.map((item, index) => (
        <Menu.Item key={index}>
          {({ active }) => (
            <div
              onClick={() => item.action()}
              className={`${
                active
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-600 dark:text-slate-300 dark:bg-opacity-50"
                  : "text-slate-600 dark:text-slate-300"
              } block     ${
                item.hasDivider
                  ? "border-t border-slate-100 dark:border-slate-700"
                  : ""
              }`}
            >
              <div className={`block cursor-pointer px-4 py-2`}>
                <div className="flex items-center">
                  <span className="block text-xl ltr:mr-3 rtl:ml-3">
                    <Icon icon={item.icon} />
                  </span>
                  <span className="block text-sm">{item.label}</span>
                </div>
              </div>
            </div>
          )}
        </Menu.Item>
      ))}
    </Dropdown>
  );
};

export default Profile;
